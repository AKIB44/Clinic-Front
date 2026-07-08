/**
 * Calibrated two-finger gesture tuning (thumb + index).
 *
 * v2 "glove calibration": every span/motion value is expressed in HAND UNITS —
 * normalized by the wrist→middle-knuckle distance — so the same physical pinch
 * reads identically whether the hand is 30cm or 1m from the camera. Zoom is
 * absolute: the camera distance tracks the ratio of the current finger span to
 * the span captured when the pinch engaged (return fingers → return zoom).
 */
export const GESTURE_CONFIG = {
  minDetectionConfidence: 0.50,
  minTrackingConfidence:  0.60,

  // ── Hand-scale normalization ─────────────────────────────────────────────
  // handScale = dist(WRIST, MIDDLE_MCP). Frames with a smaller apparent hand
  // are too far / partially out of frame for reliable landmarks — skip them.
  handScaleMin:         0.06,
  handScaleAlpha:       0.30,   // EMA on handScale (normalization must not jitter)

  // ── Pose detection (hand units) ──────────────────────────────────────────
  pinchMaxSpan:         1.05,   // max thumb–index span to engage (≈ one hand-length)
  fingerExtendRatio:    1.05,

  // ── 1€ filters (lower cutoff = smoother; higher beta = faster when moving) ─
  filterMidCutoff:      1.65,
  filterMidBeta:        0.022,
  filterSpanCutoff:     1.40,
  filterSpanBeta:       0.012,

  // ── Orbit shaping (hand units) ───────────────────────────────────────────
  outputAlpha:          0.18,   // final velocity EMA — lower = steadier
  deadzoneNorm:         0.006,
  orbitGain:            0.38,
  orbitGamma:           1.25,   // >1 → slow hand = finer rotation, sweeps still fast

  // ── Zoom (absolute, span-ratio anchored) ─────────────────────────────────
  spanDeadzone:         0.004,
  pinchDominanceRatio:  2.2,    // span must dominate midpoint motion to zoom
  zoomLockMs:           160,
  zoomRatioDeadzone:    0.02,   // |ratio − 1| below this = hold current zoom
  zoomRatioMin:         0.45,   // fingers can command at most this range per pinch
  zoomRatioMax:         2.40,

  // Touch lock — thumb + index together saves cavity zoom anchor
  touchLockSpan:        0.24,
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

/** Viewer-side calibration (paired with mapper output). */
export const GESTURE_VIEWER_CALIBRATION = {
  rotateMultiplier:   1.05,   // was 1.72 — precision over speed
  dampingFactor:      0.46,
  // Absolute zoom: cameraRadius = anchorRadius / ratio^zoomGamma, clamped to
  // [fitRadius·zoomMinFit, fitRadius·zoomMaxFit], eased by zoomLerp per frame.
  zoomGamma:          1.35,
  zoomLerp:           0.22,
  zoomMinFit:         0.35,
  zoomMaxFit:         6.0,
} as const;
