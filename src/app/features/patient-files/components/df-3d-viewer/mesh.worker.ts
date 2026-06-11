/// <reference lib="webworker" />
// Parses STL / PLY meshes off the main thread so the UI + loader stay smooth.
// Returns transferable typed arrays; the main thread rebuilds the BufferGeometry.
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader';

addEventListener('message', ({ data }: MessageEvent) => {
  const { ext, buffer } = data as { ext: string; buffer: ArrayBuffer };
  try {
    const geo: THREE.BufferGeometry = ext === 'ply'
      ? new PLYLoader().parse(buffer)
      : new STLLoader().parse(buffer);

    if (!geo.getAttribute('normal')) geo.computeVertexNormals();

    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    const nor = geo.getAttribute('normal') as THREE.BufferAttribute;
    const col = geo.getAttribute('color') as THREE.BufferAttribute | undefined;
    const idx = geo.getIndex();

    const position = pos.array as Float32Array;
    const normal   = nor.array as Float32Array;
    const color    = col ? (col.array as Float32Array) : null;
    const colorItemSize = col ? col.itemSize : 0;
    const index    = idx ? (idx.array as Uint32Array | Uint16Array) : null;

    const transfer: Transferable[] = [position.buffer, normal.buffer];
    if (color) transfer.push(color.buffer);
    if (index) transfer.push((index as Uint32Array).buffer);

    (postMessage as (m: unknown, t: Transferable[]) => void)({
      ok: true, position, normal, color, colorItemSize, index,
      tris: idx ? idx.count / 3 : pos.count / 3,
      verts: pos.count,
    }, transfer);
  } catch (e) {
    postMessage({ ok: false, error: String(e) });
  }
});
