import getGrid from "../../plates-model/grid";
import FieldStore from "../field-store";
import ModelStore from "../model-store";

const MAX_HOVER_DIST = 500; // km

function countNeighboringPlates(field: FieldStore, model: ModelStore) {
  const neighboringPlates: Record<number, boolean> = {};
  const grid = getGrid();
  for (const adjId of field.adjacentFields) {
    const absolutePos = grid.fields[adjId].localPos; // grid is never rotated, so local position = absolute position.
    const neighboringField = model.topFieldAt(absolutePos);
    if (neighboringField && neighboringField.plate.id !== field.plate.id) {
      neighboringPlates[neighboringField.plate.id] = true;
    }
  }
  return Object.keys(neighboringPlates).length;
}

export function findFieldFromNeighboringPlate(field: FieldStore, model: ModelStore) {
  const grid = getGrid();
  for (const adjId of field.adjacentFields) {
    const absolutePos = grid.fields[adjId].localPos; // grid is never rotated, so local position = absolute position.
    const neighboringField = model.topFieldAt(absolutePos);
    if (neighboringField && neighboringField.plate.id !== field.plate.id) {
      return neighboringField;
    }
  }
}

export function findNeighboringPlateId(field: FieldStore, model: ModelStore, otherPlateId: number) {
  const grid = getGrid();
  for (const adjId of field.adjacentFields) {
    const absolutePos = grid.fields[adjId].localPos; // grid is never rotated, so local position = absolute position.
    const neighboringField = model.topFieldAt(absolutePos);
    if (neighboringField && neighboringField.plate.id === otherPlateId) {
      return neighboringField;
    }
  }
}

export function setHighlightStartingFromField(field: FieldStore, model: ModelStore, otherPlateId: number) {
  const stack: FieldStore[] = [field];
  while (stack.length > 0) {
    const f = stack.pop() as FieldStore;
    f.highlighted = true;
    f.forEachNeighbor(n => {
      if (!n.highlighted && n.boundary && findNeighboringPlateId(n, model, otherPlateId)) {
        stack.push(n);
      }
    });
  }
}

export function highlightBoundarySegment(field: FieldStore, model: ModelStore): FieldStore[] {
  const fieldFromNeighboringPlate = findFieldFromNeighboringPlate(field, model);
  if (fieldFromNeighboringPlate) {
    setHighlightStartingFromField(field, model, fieldFromNeighboringPlate.plate.id);
    setHighlightStartingFromField(fieldFromNeighboringPlate, model, field.plate.id);
    return [field, fieldFromNeighboringPlate];
  }
  return [];
}

export function unhighlightBoundary(field: FieldStore) {
  const stack: FieldStore[] = [field];

  while (stack.length > 0) {
    const f = stack.pop() as FieldStore;
    f.highlighted = false;
    f.forEachNeighbor(n => {
      if (n.highlighted && n.boundary) {
        stack.push(n);
      }
    });
  }
}

export function findBoundaryFieldAround(field: FieldStore | null, model: ModelStore) {
  if (!field) {
    return null;
  }
  const fieldDiameterInKm = getGrid().fieldDiameterInKm;
  const queue: FieldStore[] = [field];
  const processed: Record<number, boolean> = {
    [field.id]: true
  };
  const dist: Record<number, number> = {
    [field.id]: 0
  };

  while (queue.length > 0) {
    const f = queue.shift() as FieldStore;
    // If field has more than 1 neighboring plate, it means it's a corner between 3 plates.
    // This point is ambiguous, so look for another one.
    if (f.boundary && countNeighboringPlates(f, model) === 1) {
      return f;
    }
    f.forEachNeighbor(n => {
      if (!processed[n.id] && dist[f.id] + fieldDiameterInKm < MAX_HOVER_DIST) {
        processed[n.id] = true;
        dist[n.id] = dist[f.id] + fieldDiameterInKm;
        queue.push(n);
      }
    });
  }
  return null;
}
