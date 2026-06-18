// Dental-standard camera views (PRD §4.2, §17). Positions are normalized unit
// directions; the actual camera distance is derived from the model's bounding
// sphere at runtime so every model fits regardless of scale.

export type Vec3 = [number, number, number];

export interface CameraView {
  position: Vec3;   // normalized direction from target
  target:   Vec3;
  up:       Vec3;
}

export type DentalViewKey =
  | 'ANTERIOR' | 'POSTERIOR' | 'LEFT_BUCCAL' | 'RIGHT_BUCCAL'
  | 'OCCLUSAL_UPPER' | 'OCCLUSAL_LOWER' | 'MESIAL' | 'DISTAL';

export const DENTAL_VIEWS: Record<DentalViewKey, CameraView> = {
  ANTERIOR:       { position: [0, 0, 1],       target: [0, 0, 0], up: [0, 1, 0] },
  POSTERIOR:      { position: [0, 0, -1],      target: [0, 0, 0], up: [0, 1, 0] },
  LEFT_BUCCAL:    { position: [-1, 0, 0],      target: [0, 0, 0], up: [0, 1, 0] },
  RIGHT_BUCCAL:   { position: [1, 0, 0],       target: [0, 0, 0], up: [0, 1, 0] },
  OCCLUSAL_UPPER: { position: [0, 1, 0],       target: [0, 0, 0], up: [0, 0, -1] },
  OCCLUSAL_LOWER: { position: [0, -1, 0],      target: [0, 0, 0], up: [0, 0, 1] },
  MESIAL:         { position: [0.7, 0, 0.7],   target: [0, 0, 0], up: [0, 1, 0] },
  DISTAL:         { position: [-0.7, 0, -0.7], target: [0, 0, 0], up: [0, 1, 0] },
};

export const DENTAL_VIEW_LABELS: Record<DentalViewKey, string> = {
  ANTERIOR: 'Anterior', POSTERIOR: 'Posterior',
  LEFT_BUCCAL: 'Left buccal', RIGHT_BUCCAL: 'Right buccal',
  OCCLUSAL_UPPER: 'Occlusal (upper)', OCCLUSAL_LOWER: 'Occlusal (lower)',
  MESIAL: 'Mesial', DISTAL: 'Distal',
};

// Keyboard 1–8 → view (PRD §6.6).
export const DENTAL_VIEW_ORDER: DentalViewKey[] = [
  'ANTERIOR', 'POSTERIOR', 'LEFT_BUCCAL', 'RIGHT_BUCCAL',
  'OCCLUSAL_UPPER', 'OCCLUSAL_LOWER', 'MESIAL', 'DISTAL',
];
