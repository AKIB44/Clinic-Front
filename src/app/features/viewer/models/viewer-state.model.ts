import { DentalViewKey } from '../constants/dental-views.const';

export type ModelFormat = 'stl' | 'glb' | 'gltf' | 'ply' | 'obj';

export type LoadPhase = 'idle' | 'connecting' | 'downloading' | 'decoding' | 'rendering' | 'ready' | 'error';

export interface ModelStats {
  triangles: number;
  vertices: number;
  dimensions: string;   // "x × y × z units"
}

/** Toolbar / keyboard actions dispatched to the viewer. */
export type ViewerAction =
  | { kind: 'reset' }
  | { kind: 'fullscreen' }
  | { kind: 'screenshot' }
  | { kind: 'toggle-measure' }
  | { kind: 'toggle-section' }
  | { kind: 'toggle-annotate' }
  | { kind: 'toggle-gesture' }
  | { kind: 'toggle-compare' }
  | { kind: 'snap'; view: DentalViewKey };
