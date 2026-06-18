import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { FileCacheService } from '../../patient-files/services/file-cache.service';
import { MATERIAL_PRESETS } from '../constants/material-presets.const';
import { ModelFormat } from '../models/viewer-state.model';

/**
 * Parses STL/PLY/OBJ/GLB(glTF) buffers into a three.js Object3D and applies a
 * clinical default material. Reuses the same loaders/material the existing
 * patient-files viewer uses, so behaviour is consistent. (Web-Worker parsing is
 * a GV-4 perf item; parsing here is synchronous on the main thread, matching the
 * existing working viewer.)
 */
@Injectable()
export class ModelLoaderService {
  private cache = inject(FileCacheService);

  formatOf(filename: string): ModelFormat | null {
    const ext = (filename.includes('.') ? filename.split('.').pop()! : '').toLowerCase();
    if (['stl', 'ply', 'obj', 'glb', 'gltf'].includes(ext)) return ext as ModelFormat;
    return null;
  }

  /** Fetch a patient-file model (S3 signed URL, cached). Emits progress then buffer. */
  loadFromCache(patientId: string, fileId: string): Observable<{ progress: number; buffer?: ArrayBuffer }> {
    return this.cache.load(patientId, fileId);
  }

  /** Parse a buffer into a centered, render-ready Object3D (throws on failure). */
  parse(format: ModelFormat, buffer: ArrayBuffer): Promise<THREE.Object3D> {
    return new Promise((resolve, reject) => {
      try {
        if (format === 'stl') {
          const g = new STLLoader().parse(buffer); g.computeVertexNormals();
          resolve(new THREE.Mesh(g, this.material(g)));
        } else if (format === 'ply') {
          const g = new PLYLoader().parse(buffer);
          if (!g.getAttribute('normal')) g.computeVertexNormals();
          resolve(new THREE.Mesh(g, this.material(g)));
        } else if (format === 'obj') {
          const obj = new OBJLoader().parse(new TextDecoder().decode(buffer));
          obj.traverse((o) => {
            const m = o as THREE.Mesh;
            if (m.isMesh) m.material = this.material(m.geometry as THREE.BufferGeometry);
          });
          resolve(obj);
        } else if (format === 'glb' || format === 'gltf') {
          new GLTFLoader().parse(buffer, '', (g) => resolve(g.scene), (e) => reject(e));
        } else {
          reject(new Error('Unsupported 3D format'));
        }
      } catch (e) { reject(e); }
    });
  }

  material(geo?: THREE.BufferGeometry): THREE.Material {
    const hasColor = !!(geo && geo.getAttribute && geo.getAttribute('color'));
    return new THREE.MeshStandardMaterial({
      color: hasColor ? 0xffffff : MATERIAL_PRESETS.stlColor,
      vertexColors: hasColor,
      metalness: MATERIAL_PRESETS.metalness,
      roughness: MATERIAL_PRESETS.roughness,
    });
  }

  /** Count triangles + vertices across a parsed object. */
  meshStats(obj: THREE.Object3D): { triangles: number; vertices: number } {
    let triangles = 0, vertices = 0;
    obj.traverse((o) => {
      const m = o as THREE.Mesh; const g = m.geometry as THREE.BufferGeometry | undefined;
      if (m.isMesh && g) {
        const pos = g.getAttribute('position');
        vertices += pos ? pos.count : 0;
        triangles += g.index ? g.index.count / 3 : (pos ? pos.count / 3 : 0);
      }
    });
    return { triangles: Math.round(triangles), vertices };
  }
}
