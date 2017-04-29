import grid from './grid';
import c from '../constants';

// We use unit sphere (radius = 1) for calculations, so scale constants.
const maxSubductionDist = c.subductionMaxDist / c.earthRadius;

export default class Field {
  constructor(id, plate) {
    this.id = id;
    this.plate = plate;
    this.alive = true;
    this.localPos = grid.fields[id].localPos;

    this.prevAbsolutePos = null;
    this.absolutePos = this.plate.absolutePosition(this.localPos);
    this.displacement = 0;
    this.collision = false;

    this.subduction = null;
  }

  get density() {
    return this.plate.density;
  }

  update() {
    this.prevAbsolutePos = this.absolutePos;
    this.absolutePos = this.plate.absolutePosition(this.localPos);
    // Of course it's not fully correct, as great-circle distance should be used. But displacements are so small,
    // that it's a reasonable approximation and it doesn't really matter for the simulation.
    this.displacement = this.absolutePos.clone().sub(this.prevAbsolutePos);
    // Reset per-step collision flag.
    this.collision = false;

    // Continue subduction once started.
    if (this.subduction) {
      this.subduction.dist += this.subduction.relativeDisplacement;
      if (this.subduction.dist > maxSubductionDist) {
        this.alive = false;
      }
    }
  }

  collideWith(field) {
    this.collision = true;
    if (!this.subduction && this.density < field.density) {
      this.subduction = {
        topPlateId: field.plate.id,
        dist: 0
      };
    }
    if (this.subduction && this.subduction.topPlateId === field.plate.id) {
      // Update relative displacement only if we're still under the same plate. Otherwise, just keep previous value.
      this.subduction.relativeDisplacement = this.displacement.distanceTo(field.displacement)
    }
  }
}
