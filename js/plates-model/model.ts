import * as THREE from "three";
import generatePlates from "./generate-plates";
import Plate, { ISerializedPlate, plateHues } from "./plate";
import getGrid from "./grid";
import config from "../config";
import fieldsCollision from "./fields-collision";
import addRelativeMotion from "./add-relative-motion";
import dividePlate from "./divide-plate";
import markIslands from "./mark-islands";
import eulerStep from "./physics/euler-integrator";
import rk4Step from "./physics/rk4-integrator";
import verletStep from "./physics/verlet-integrator";
import * as seedrandom from "../seedrandom";
import Field, { IFieldOptions } from "./field";
import PlateGroup from "./plate-group";

// Limit max speed of the plate, so model doesn't look crazy.
const MAX_PLATE_SPEED = 0.04;

// How many steps between plate centers are recalculated.
const CENTER_UPDATE_INTERVAL = 15;

const MIN_RELATIVE_MOTION = 0.005;
const MIN_RELATIVE_MOTION_TO_MERGE_PLATES = 0.001;
// How many steps it takes to assume that relative motion has stopped. In practice, larger value will delay
// stopping the model and displaying a dialog to user.
const MIN_RELATIVE_MOTION_STEPS_COUNT = 100;

function sortByDensityAsc(plateA: Plate, plateB: Plate) {
  return plateA.density - plateB.density;
}

export interface ISerializedModel {
  time: number;
  stepIdx: number;
  lastPlateDivisionOrMerge: number;
  seedrandomState: any;
  plates: ISerializedPlate[];
  nextPlateId: number;
  lowRelativeMotionStepsCount: number;
}

export default class Model {
  stepIdx: number;
  lastPlateDivisionOrMerge: number;
  time: number;
  plates: Plate[];
  nextPlateId = 0;
  _diverged: boolean;
  lowRelativeMotionStepsCount: number;

  constructor(imgData: ImageData | null, initFunction?: ((plates: Record<number, Plate>) => void) | null, seedrandomState?: any) {
    if (config.deterministic && seedrandomState) {
      seedrandom.initializeFromState(seedrandomState);
    } else {
      seedrandom.initialize(config.deterministic);
    }
    this.time = 0;
    this.stepIdx = 0;
    this.lastPlateDivisionOrMerge = 0;
    this.lowRelativeMotionStepsCount = 0;
    this.plates = [];
    if (imgData) {
      // It's very important to keep plates sorted, so if some new plates will be added to this list,
      // it should be sorted again.
      this.plates = generatePlates(imgData, initFunction).sort(sortByDensityAsc);
      this.nextPlateId = Math.max(...this.plates.map(p => p.id)) + 1;
      markIslands(this.plates);
      this.calculateDynamicProperties(false);
    }
  }

  serialize(): ISerializedModel {
    return {
      time: this.time,
      stepIdx: this.stepIdx,
      lastPlateDivisionOrMerge: this.lastPlateDivisionOrMerge,
      seedrandomState: seedrandom.getState(),
      plates: this.plates.map((plate: Plate) => plate.serialize()),
      nextPlateId: this.nextPlateId,
      lowRelativeMotionStepsCount: this.lowRelativeMotionStepsCount
    };
  }

  static deserialize(props: ISerializedModel) {
    const model = new Model(null, null, props.seedrandomState);
    model.time = props.time;
    model.stepIdx = props.stepIdx;
    model.lastPlateDivisionOrMerge = props.lastPlateDivisionOrMerge;
    model.plates = props.plates.map((serializedPlate: ISerializedPlate) => Plate.deserialize(serializedPlate));
    // Process plate groups.
    const platesById: Record<string, Plate> = {};
    model.plates.forEach(plate => platesById[plate.id] = plate);
    const plateGroupProcessed: Record<string, true> = {};
    props.plates.forEach((serializedPlate: ISerializedPlate) => {
      const plateGroupProps = serializedPlate.plateGroup;
      if (plateGroupProps) {
        const key = plateGroupProps.plateIds.toString();
        if (!plateGroupProcessed[key]) {
          const groupPlates = plateGroupProps.plateIds.map(plateId => platesById[plateId]);
          const plateGroup = PlateGroup.deserialize(plateGroupProps, groupPlates);
          plateGroup.plates.forEach(plate => plate.plateGroup = plateGroup);
          plateGroupProcessed[key] = true;
        }
      }
    });
    model.nextPlateId = props.nextPlateId || Math.max(...model.plates.map(p => p.id)) + 1;
    model.lowRelativeMotionStepsCount = props.lowRelativeMotionStepsCount;
    model.calculateDynamicProperties(false);
    return model;
  }

  getNextPlateId() {
    return this.nextPlateId++;
  }

  getNextPlateHue(id: number, hueToAvoid?: number) {
    const getRandomItem = (set: Set<number>) => {
      const items = Array.from(set);
      return items[Math.floor(Math.random() * items.length)];
    };
    const availableHues = new Set<number>(plateHues);

    if (id < plateHues.length) {
      // Use color that matches the plate id.
      return plateHues[id];
    }
    if (this.plates.length < plateHues.length) {
      // Return first color that is not used yet.
      this.plates.forEach(p => {
        availableHues.delete(p.hue);
      });
      return getRandomItem(availableHues);
    }
    // Very unlikely, but if all the available hues are used, return random color.
    if (hueToAvoid !== undefined) {
      availableHues.delete(hueToAvoid);
    }
    return getRandomItem(availableHues);
  }

  getPlate(plateId: number) {
    for (const plate of this.plates) {
      if (plate.id === plateId) {
        return plate;
      }
    }
    return null;
  }

  get plateGroups() {
    const groups = new Set<PlateGroup>();
    for (const plate of this.plates) {
      if (plate.plateGroup && !groups.has(plate.plateGroup)) {
        groups.add(plate.plateGroup);
      }
    }
    return Array.from(groups);
  }

  forEachPlate(callback: (plate: Plate) => void) {
    this.plates.forEach(callback);
  }

  forEachField(callback: (field: Field) => void) {
    this.forEachPlate((plate: Plate) => plate.forEachField(callback));
  }

  // TODO simplify this function, use alternative approach.
  // Returns map of given plates property.
  getPlatesProp(property: keyof Plate) {
    const result = new Map<Plate, any>();
    this.forEachPlate((plate: Plate) => {
      result.set(plate, (plate[property] as any).clone());
    });
    return result;
  }

  // TODO simplify this function, use alternative approach.
  // Updates each plate using provided map.
  setPlatesProp(property: keyof Plate, map: Map<Plate, any>) {
    this.forEachPlate((plate: Plate) => {
      (plate[property] as any) = map.get(plate);
    });
  }

  getQuaternions() {
    return this.getPlatesProp("quaternion");
  }

  getAngularVelocities() {
    return this.getPlatesProp("angularVelocity");
  }

  getAngularAccelerations() {
    // `return this.getPlatesProp("angularAcceleration")` would work fine too, but... When plate that is part
    // of a group and it calculates its angularAcceleration, it delegates this task to group class. So, for each group,
    // acceleration would be calculated multiple times. If we split calculations to grouped and non-grouped plates,
    // we can sped it up.
    const result = new Map<Plate, any>();
    this.plateGroups.forEach(group => {
      const groupAngularAcceleration = group.angularAcceleration;
      group.plates.forEach(plate => {
        result.set(plate, groupAngularAcceleration.clone());
      });
    });
    this.forEachPlate((plate: Plate) => {
      if (!plate.plateGroup) {
        result.set(plate, plate.angularAcceleration.clone());
      }
    });
    return result;
  }

  setQuaternions(map: Map<Plate, THREE.Quaternion>) {
    this.setPlatesProp("quaternion", map);
  }

  setAngularVelocities(map: Map<Plate, THREE.Vector3>) {
    this.setPlatesProp("angularVelocity", map);
  }

  setDensities(densities: Record<number, number>) {
    this.forEachPlate((plate: Plate) => {
      plate.setDensity(densities[plate.id]);
    });
    this.plates.sort(sortByDensityAsc);
  }

  get kineticEnergy() {
    // Well, not really correct, but good enough to check if model hasn't diverged.
    let ke = 0;
    this.forEachPlate((plate: Plate) => {
      ke += 0.5 * plate.angularSpeed * plate.angularSpeed * plate.mass;
    });
    return ke;
  }

  get relativeMotion() {
    let sum = 0;
    this.forEachPlate((plate: Plate) => {
      this.forEachPlate((otherPlate: Plate) => {
        if (plate.id < otherPlate.id) {
          sum += plate.angularVelocity.clone().sub(otherPlate.angularVelocity).length();
        }
      });
    });
    return sum;
  }

  get relativeMotionStopped() {
    return this.lowRelativeMotionStepsCount >= MIN_RELATIVE_MOTION_STEPS_COUNT;
  }

  step(timestep: number) {
    if (this._diverged) {
      return;
    }
    if (config.integration === "euler") {
      eulerStep(this, timestep);
    } else if (config.integration === "rk4") {
      rk4Step(this, timestep);
    } else if (config.integration === "verlet") {
      verletStep(this, timestep);
    }
    this.time += timestep;
    this.stepIdx += 1;
    this.forEachPlate((plate: Plate) => {
      if (plate.angularVelocity.length() > MAX_PLATE_SPEED) {
        plate.angularVelocity.setLength(MAX_PLATE_SPEED);
      }
    });
    // Detect collisions, update geological processes, add new fields and remove unnecessary ones.
    this.simulatePlatesInteractions(timestep, this.stepIdx);
    this.calculateDynamicProperties(true);

    if (this.relativeMotion < MIN_RELATIVE_MOTION) {
      this.lowRelativeMotionStepsCount += 1;
    }
    if (this.kineticEnergy > 500) {
      this._diverged = true;
      throw new Error("model has diverged!");
    }
  }

  // Calculates properties that can be derived from other properties and don't need to be serialized.
  // Those properties also should be updated every step.
  calculateDynamicProperties(optimize: boolean) {
    this.forEachPlate((plate: Plate) => plate.calculateContinentBuffers());
    this.detectCollisions(optimize);
  }

  // Detect collisions, update geological processes, add new fields and remove unnecessary ones.
  simulatePlatesInteractions(timestep: number, stepIdx: number) {
    this.forEachField((field: Field) => field.performGeologicalProcesses(timestep));
    this.forEachPlate((plate: Plate) => plate.removeUnnecessaryFields()); // e.g. fields that subducted
    this.removeEmptyPlates();
    this.generateNewFields(timestep);
    // Some fields might have been added or removed, so update calculated physical properties.
    // Process plates that are part of the group and plates that aren't grouped independently. When group
    // updates its inertia tensor, all the members of the group are also updated. So, split processing not to duplicate
    // math calculations.
    this.plateGroups.forEach(plateGroup => {
      plateGroup.updateInertiaTensor();
    });
    this.forEachPlate(plate => {
      if (!plate.plateGroup) {
        plate.updateInertiaTensor();
      }
    });
    if (stepIdx % CENTER_UPDATE_INTERVAL === 0) {
      this.forEachPlate((plate: Plate) => {
        plate.updateCenter();
      });
    }
    // Update / decrease hot spot torque value.
    this.forEachPlate((plate: Plate) => plate.updateHotSpot(timestep));
    this.tryToMergePlates();
    this.divideBigPlates();
  }

  detectCollisions(optimize: boolean) {
    const fieldsPossiblyColliding = new Set();
    if (optimize) {
      // Optimization can be applied once we know which fields have collided in the previous step.
      // Only those fields and boundaries (plus their neighbors) can collide in this step.
      // There's an obvious assumption that fields won't move more than their own diameter in a single step.
      this.forEachField((field: Field) => {
        if (field.boundary || field.colliding) {
          fieldsPossiblyColliding.add(field);
          field.forEachNeighbor((neigh: Field) => fieldsPossiblyColliding.add(neigh));
        }
        field.resetCollisions();
      });
    } else {
      // No optimization - check all the fields.
      this.forEachField((field: Field) => fieldsPossiblyColliding.add(field));
    }
    fieldsPossiblyColliding.forEach((field: Field) => {
      if (field.colliding) {
        // Collision already handled
        return;
      }
      // Why so strange loop? We want to find the closest colliding fields. First, we need to check plate which can
      // be directly underneath and above. Later, check plates which have bigger density difference.
      // Note that this.plates is sorted by density (ASC).
      if (field.plate.isSubplate) {
        console.warn("Unexpected processing of subplate field");
        return;
      }
      const plateIdx = this.plates.indexOf(field.plate);
      let i = 1;
      while (this.plates[plateIdx + i] || this.plates[plateIdx - i]) {
        const lowerPlate = this.plates[plateIdx + i];
        const lowerField = lowerPlate?.fieldAtAbsolutePos(field.absolutePos);
        if (lowerField) {
          fieldsCollision(lowerField, field);
          // Handle only one collision per field (with the plate laying closest to it).
          return;
        }
        const upperPlate = this.plates[plateIdx - i];
        const upperField = upperPlate?.fieldAtAbsolutePos(field.absolutePos);
        if (upperField) {
          fieldsCollision(field, upperField);
          // Handle only one collision per field (with the plate laying closest to it).
          return;
        }
        i += 1;
      }
    });
  }

  removePlate(plate: Plate) {
    const idx = this.plates.indexOf(plate);
    if (idx !== -1) {
      this.plates.splice(idx, 1);
    }
  }

  removeEmptyPlates() {
    let i = 0;
    while (i < this.plates.length) {
      if (this.plates[i].size === 0) {
        this.plates.splice(i, 1);
      } else {
        i += 1;
      }
    }
  }

  generateNewFields(timestep: number) {
    const grid = getGrid();
    for (let i = 0, len = this.plates.length; i < len; i++) {
      const plate = this.plates[i];
      plate.adjacentFields.forEach((field: Field) => {
        let collision = false;
        for (let j = 0; j < len; j++) {
          if (i === j) {
            continue;
          }
          const otherPlate = this.plates[j];
          if (otherPlate.fieldAtAbsolutePos(field.absolutePos)) {
            collision = true;
            break;
          }
        }
        if (!collision) {
          field.noCollisionDist += field.displacement(timestep).length();
          // Make sure that adjacent field traveled distance at least similar to size of the single field.
          // It ensures that divergent boundaries will stay in place more or less and new crust will be building
          // only when plate is moving.
          if (field.noCollisionDist > grid.fieldDiameter * 0.9) {
            const neighborsCount = field.neighborsCount();
            // Make sure that new field has at least two existing neighbors. It prevents from creating
            // awkward, narrow shapes of the continents.
            if (neighborsCount > 1) {
              let neighbor = field.neighborAlongVector(field.linearVelocity);
              if (!neighbor) {
                // Sometimes there will be no field along velocity vector (depends of angle between vector and boundary).
                // Use other neighbor instead. Pick one which is closest to the position of the missing field.
                const perfectPos = field.absolutePos.clone().add(field.linearVelocity.clone().setLength(grid.fieldDiameter));
                const minDist = Infinity;
                field.forEachNeighbor((otherField: Field) => {
                  if (otherField.absolutePos.distanceTo(perfectPos) < minDist) {
                    neighbor = otherField;
                  }
                });
              }
              const props: Omit<IFieldOptions, "id" | "plate"> = {};
              if (neighbor?.crustCanBeStretched) {
                props.type = "continent";
                props.crustThickness = neighbor.crustThickness - config.continentalStretchingRatio * grid.fieldDiameter;
                props.age = neighbor.age;
                // When continent is being stretched, move field marker to the new field to emphasize this effect.
                props.marked = neighbor.marked;
                // `blockFaulting` value doesn't have physical meaning, but it's used to determine its direction in the
                // rendering code. 1e6 value is big enough to cover all the visible fields in the cross-section.
                props.blockFaulting = (neighbor.blockFaulting ?? 1e6) - 1;
                neighbor.marked = false;
              } else {
                props.type = "ocean";
                // `age` is a distance traveled by field. When a new field is added next to the divergent boundary,
                // it's distance from it is around half of its diameter.
                props.age = grid.fieldDiameter * 0.5;
              }
              plate.addFieldAt(props, field.absolutePos);
            }
          }
        } else {
          field.noCollisionDist = 0;
        }
      });
    }
  }

  topFieldAt(position: THREE.Vector3, options?: { visibleOnly?: boolean }) {
    // Plates are sorted by density, start from the top one.
    for (let i = 0, len = this.plates.length; i < len; i++) {
      const plate = this.plates[i];
      if (options?.visibleOnly && !plate.visible) {
        continue;
      }
      const field = plate.fieldAtAbsolutePos(position);
      if (field) {
        return field;
      }
    }
    return null;
  }

  setHotSpot(position: THREE.Vector3, force: THREE.Vector3) {
    const field = this.topFieldAt(position);
    if (field && !field.plate.isSubplate) {
      field.plate.setHotSpot(position, force);
    }
  }

  addRelativeMotion() {
    if (!config.enforceRelativeMotion) {
      return;
    }

    if (this.relativeMotion < MIN_RELATIVE_MOTION) {
      addRelativeMotion(this.plates);
      // Shuffle plates densities to make results more interesting.
      this.plates.forEach((plate: Plate) => {
        plate.density = seedrandom.random();
      });
      this.plates.sort(sortByDensityAsc);
      // Restore integer values.
      this.plates.forEach((plate: Plate, idx: number) => {
        plate.density = idx;
      });
    }
  }

  divideBigPlates() {
    if (this.stepIdx < this.lastPlateDivisionOrMerge + 100) {
      return;
    }

    let newPlateAdded = false;
    this.forEachPlate((plate: Plate) => {
      if (plate.size > config.minSizeRatioForDivision * getGrid().size) {
        if (this.dividePlate(plate)) {
          newPlateAdded = true;
        }
      }
    });
    if (newPlateAdded) {
      this.addRelativeMotion();
      this.lastPlateDivisionOrMerge = this.stepIdx;
    }
  }

  tryToMergePlates() {
    if ((!config.mergePlates && !config.groupPlates) || this.stepIdx < this.lastPlateDivisionOrMerge + 100) {
      return;
    }

    this.forEachPlate(plate1 => {
      this.forEachPlate(plate2 => {
        if (plate1 !== plate2 && !plate1.mergedWith(plate2)) {
          if (plate1.angularVelocity.clone().sub(plate2.angularVelocity).length() < MIN_RELATIVE_MOTION_TO_MERGE_PLATES) {
            if (config.mergePlates) {
              this.mergePlates(plate1, plate2);
            } else if (config.groupPlates) {
              this.groupPlates(plate1, plate2);
            }
            this.lastPlateDivisionOrMerge = this.stepIdx;
          }
        }
      });
    });
  }

  resetDensities() {
    // Make sure that all the densities are unique.
    this.plates.sort(sortByDensityAsc);
    this.plates.forEach((p: Plate, idx: number) => {
      p.density = idx;
    });
  }

  dividePlate(plate: Plate) {
    const newPlateId = this.getNextPlateId();
    const newPlateHue = this.getNextPlateHue(newPlateId, plate.hue);
    const newPlate = dividePlate(plate, newPlateId, newPlateHue);
    if (newPlate) {
      this.plates.push(newPlate);
      this.resetDensities();
      return true;
    }
    return false;
  }

  // Plate merging replaces two plates with a single plate that includes all the fields and properties
  // of the previous plates.
  mergePlates(plate1: Plate, plate2: Plate) {
    const cloneField = (field: Field, newId: number) => {
      const newField = field.clone(newId, plate1);
      return newField;
    };

    // plate1 will be the final plate, and plate2 will be removed. ID and hue should be inherited from the plate with lower ID.
    plate1.hue = plate1.id < plate2.id ? plate1.hue : plate2.hue;
    plate1.id = Math.min(plate1.id, plate2.id);
    if (plate1.subplate) {
      plate1.subplate.setId(plate1.id);
    }

    const grid = getGrid();
    grid.fields.forEach(f => {
      const plate1Id = f.id;
      const plate1Field = plate1.fields.get(plate1Id);
      const absolutePos = plate1.absolutePosition(f.localPos);
      const plate2Id = grid.nearestFieldId(plate2.localPosition(absolutePos));
      const plate2Field = plate2.fields.get(plate2Id);

      let subplateUpdated = false;

      // This loop is processing every field/position in the geodesic grid and checking if there are fields at this
      // position in plate1 and plate2. There are few options possible:
      // 1. plate1Field exists and plate2Field does not. Nothing to do, just keep plate1Field.
      if (!plate1Field && plate2Field) {
        // 2. plate1Field does not exists and plate2Field exists.
        // Simply add plate2Field to plate1.
        plate1.addExistingField(cloneField(plate2Field, plate1Id));
      } else if (plate1Field && plate2Field) {
        // 3. Both fields exist at this position.
        // Higher field should stay in plate1, while lower plate should be moved to subplate (these fields are not
        // part of the simulation anymore, but they're rendered by cross-section so user can reason about past events).
        if (plate1Field.elevation < plate2Field.elevation) {
          // Move plate1Field to subplate.
          plate1.deleteField(plate1Id);
          plate1.subplate.addExistingField(cloneField(plate1Field, plate1Id));
          // Add plate2Field as a main field.
          plate1.addExistingField(cloneField(plate2Field, plate1Id));
          subplateUpdated = true;
        } else {
          // Add plate2Field to subplate. plate1Field stays where it was.
          plate1.subplate.addExistingField(cloneField(plate2Field, plate1Id));
          subplateUpdated = true;
        }
      }

      if (!subplateUpdated) {
        // Note that subplate stores the most recent history. So, if it hasn't been updated due to merging of plate1
        // and plate2, it's possible to transfer subplate fields from plate2 to plate1.
        const subplate1Field = plate1.subplate.fields.get(plate1Id);
        const subplate2Field = plate2.subplate.fields.get(plate2Id);
        if (!subplate1Field && subplate2Field) {
          plate1.subplate.addExistingField(cloneField(subplate2Field, plate1Id));
        }
      }
    });

    // Sort fields by ID. Map traversal follows insertion order.
    // This is not necessary, but it lets us test model better. Quaternion and physical properties are often calculated
    // by traversing all the fields. Order of this traverse might influence micro numerical errors that can create
    // visible differences in a longer run. Example of a place where it matters: plate-division-merge.test.ts
    plate1.sortFields();

    this.removePlate(plate2);

    this.resetDensities();
  }

  // Plate connection leaves two plates fully separate, but it creates a rigid connection that is reflected in physics
  // calculations. It's an alternative to plate merging.
  groupPlates(plate1: Plate, plate2: Plate) {
    const group1 = plate1.plateGroup || new PlateGroup([plate1]);
    const group2 = plate2.plateGroup || new PlateGroup([plate2]);

    const newPlateGroup = new PlateGroup();
    newPlateGroup.mergeGroup(group1);
    newPlateGroup.mergeGroup(group2);
    newPlateGroup.plates.forEach(plate => {
      plate.plateGroup = newPlateGroup;
    });
  }
}
