// Gesture types — thumb + index two-finger control + cavity anchor lock.

export type GestureControlMode =
  | 'ORBIT' | 'ZOOM_IN' | 'ZOOM_OUT' | 'TWO_FINGER' | 'ANCHOR_LOCKED' | 'IDLE';

export interface NormalizedLandmark { x: number; y: number; z: number; visibility?: number; }

export interface GestureFrame {
  gesture: string;
  confidence: number;
  handedness: 'Left' | 'Right' | null;
  landmarks: NormalizedLandmark[] | null;
  at: number;
}

export type GestureCommand =
  | { type: 'orbit'; dx: number; dy: number }
  // Absolute zoom: ratio of the current finger span to the span captured when
  // the pinch engaged (hand-scale normalized). ratio 1 = anchor zoom level.
  | { type: 'zoomTo'; ratio: number }
  | { type: 'lockAnchor' };

export interface GestureProcessResult {
  commands: GestureCommand[];
  mode: GestureControlMode;
}
