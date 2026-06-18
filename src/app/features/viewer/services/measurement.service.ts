import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { Measurement } from '../models/measurement.model';

/**
 * GV-3 — raycasting + linear distance (PRD §6.1). Pure helpers; the viewer owns
 * the scene/camera and feeds them in. Model units are assumed to be millimetres
 * (intraoral/CAD dental exports are mm), so distances are reported directly in mm.
 */
@Injectable()
export class MeasurementService {
  private raycaster = new THREE.Raycaster();

  /** Pick the nearest surface point under normalized device coords, or null. */
  pick(ndc: THREE.Vector2, camera: THREE.Camera, object: THREE.Object3D): THREE.Vector3 | null {
    this.raycaster.setFromCamera(ndc, camera);
    const hits = this.raycaster.intersectObject(object, true);
    return hits.length ? hits[0].point.clone() : null;
  }

  distanceMm(a: THREE.Vector3, b: THREE.Vector3): number {
    return Math.round(a.distanceTo(b) * 100) / 100;
  }

  make(a: THREE.Vector3, b: THREE.Vector3): Measurement {
    return {
      id: crypto.randomUUID(),
      a: [a.x, a.y, a.z],
      b: [b.x, b.y, b.z],
      distanceMm: this.distanceMm(a, b),
    };
  }

  format(mm: number): string {
    return `${mm.toFixed(2)} mm`;
  }
}
