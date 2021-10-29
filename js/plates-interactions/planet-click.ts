import * as THREE from "three";

interface IPlanetClickOptions {
  getIntersection: (mesh: THREE.Mesh) => THREE.Intersection;
  emit: (event: string, data?: any) => void;
  startEventName?: string;
  moveEventName?: string;
  endEventName?: string;
  cursor?: string;
  alwaysEmitMoveEvent?: boolean;
}

// Generic helper that detects click on the planet surface and emits an event with provided name.
export default class PlanetClick {
  earthMesh: any;
  getIntersection: (mesh: THREE.Mesh) => THREE.Intersection;
  emit: (event: string, data?: any) => void;
  startEventName?: string;
  moveEventName?: string;
  endEventName?: string;
  cursor: string;
  pointerDown: boolean;
  alwaysEmitMoveEvent: boolean;

  constructor(options: IPlanetClickOptions) {
    const { getIntersection, emit, startEventName, moveEventName, endEventName, alwaysEmitMoveEvent } = options;
    this.getIntersection = getIntersection;
    this.emit = emit;
    this.startEventName = startEventName;
    this.moveEventName = moveEventName;
    this.endEventName = endEventName;
    this.cursor = options.cursor || "crosshair";
    this.alwaysEmitMoveEvent = !!alwaysEmitMoveEvent;
    // Test geometry is a sphere with radius 1, which is exactly what is used in the whole model for earth visualization.
    this.earthMesh = new THREE.Mesh(new THREE.SphereGeometry(1.0, 64, 64));
  }

  // "active" state is when user points at target object but still hasn't pressed the mouse button.
  // This kind of state should provide some hint that interaction is possible.
  setActive() {
    document.body.style.cursor = this.cursor;
  }

  setInactive() {
    document.body.style.cursor = "auto";
  }

  onPointerDown() {
    if (!this.startEventName) {
      return false;
    }
    const intersection = this.getIntersection(this.earthMesh);
    if (!intersection) {
      return false;
    }
    this.emit(this.startEventName, intersection.point);
    this.pointerDown = true;
    return true;
  }

  onPointerMove() {
    if ((!this.alwaysEmitMoveEvent && !this.pointerDown) || !this.moveEventName) {
      return;
    }
    const intersection = this.getIntersection(this.earthMesh);
    if (!intersection) {
      return;
    }
    this.emit(this.moveEventName, intersection.point);
  }

  onPointerUp() {
    if (this.pointerDown && this.endEventName) {
      this.emit(this.endEventName);
    }
    this.pointerDown = false;
  }
}
