/**
 * Calibrated two-finger gesture tuning (thumb + index).
 * Adjust groups independently: pose → filter → output → viewer.
 */
export const GESTURE_CONFIG = {
  minDetectionConfidence: 0.50,
  minTrackingConfidence:  0.60,

  // ── Pose detection ───────────────────────────────────────────────────────
  pinchMaxSpan:         0.22,   // max thumb–index distance to engage
  fingerExtendRatio:    1.05,

  // ── 1€ filters (lower cutoff = smoother; higher beta = faster when moving) ─
  filterMidCutoff:      1.65,
  filterMidBeta:        0.022,
  filterSpanCutoff:     2.0,
  filterSpanBeta:       0.014,

  // ── Output shaping ───────────────────────────────────────────────────────
  outputAlpha:          0.22,   // final velocity EMA
  deadzoneNorm:         0.0014,
  spanDeadzone:         0.0009,
  orbitGain:            2.1,
  pinchGain:            0.62,
  pinchDominanceRatio:  2.2,    // span must dominate midpoint motion to zoom
  zoomLockMs:           140,

  // Touch lock — thumb + index together saves cavity zoom anchor
  touchLockSpan:        0.055,
  touchLockFrames:      5,
  touchLockCooldownMs:  1000,

  refFrameMs:           16.67,
  handLostFrames:       24,
} as const;

export const GESTURE_MODE_LABELS: Record<string, string> = {
  ORBIT:      'Rotate',
  ZOOM_IN:    'Zoom in',
  ZOOM_OUT:   'Zoom out',
  TWO_FINGER: 'Two fingers',
  ANCHOR_LOCKED: 'Detail locked',
  IDLE:       'Show thumb + index',
};

/** Viewer-side orbit / zoom multipliers (paired with mapper output). */
export const GESTURE_VIEWER_CALIBRATION = {
  rotateMultiplier:   1.72,
  dampingFactor:      0.46,
  zoomPowBase:        0.975,
  zoomStrength:       36,
} as const;
