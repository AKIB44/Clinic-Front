import { Injectable, NgZone, inject, signal } from '@angular/core';
import type { GestureRecognizer as MPGestureRecognizer } from '@mediapipe/tasks-vision';
import { GESTURE_CONFIG } from '../constants/gesture-config.const';
import { GestureFrame, NormalizedLandmark } from '../models/gesture.model';

// MediaPipe assets (CDN-cached — PRD §16 mitigation; matches installed version).
const WASM_URL  = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';

/**
 * GV-2 — MediaPipe Gesture Recognizer engine (PRD §11). Lazily loads the WASM +
 * model only when gesture mode is first turned on. Runs the camera + recognition
 * loop OUTSIDE the Angular zone for performance; the raw per-frame result is
 * pushed to a handler (for the mapper), while UI signals (gesture/confidence)
 * drive the status badge. Landmarks are exposed as a plain ref the camera
 * preview reads in its own draw loop (no signal churn at 30-60 fps).
 */
@Injectable()
export class GestureEngineService {
  private zone = inject(NgZone);

  readonly ready       = signal(false);
  readonly cameraError = signal<string | null>(null);
  readonly gesture     = signal<string | null>(null);
  readonly confidence  = signal(0);
  readonly handedness  = signal<'Left' | 'Right' | null>(null);

  /** Latest hand landmarks (plain ref for the preview overlay). */
  latestLandmarks: NormalizedLandmark[][] | null = null;
  stream: MediaStream | null = null;
  readonly video = document.createElement('video');

  private recognizer: MPGestureRecognizer | null = null;
  private rafId = 0;
  private running = false;
  private lastTs = -1;
  private frameHandler: ((f: GestureFrame) => void) | null = null;

  setFrameHandler(fn: ((f: GestureFrame) => void) | null): void { this.frameHandler = fn; }

  /** Lazy-create the recognizer (WASM + model). Safe to call repeatedly. */
  private async ensureRecognizer(): Promise<void> {
    if (this.recognizer) return;
    const vision = await import('@mediapipe/tasks-vision');
    const fileset = await vision.FilesetResolver.forVisionTasks(WASM_URL);
    this.recognizer = await vision.GestureRecognizer.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numHands: 1,
      minHandDetectionConfidence: GESTURE_CONFIG.minDetectionConfidence,
      minHandPresenceConfidence:  GESTURE_CONFIG.minTrackingConfidence,
      minTrackingConfidence:      GESTURE_CONFIG.minTrackingConfidence,
    });
    this.ready.set(true);
  }

  /** Request the front camera + start recognition. Resolves once tracking begins. */
  async start(): Promise<boolean> {
    this.cameraError.set(null);
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false,
      });
    } catch (e: any) {
      const denied = e?.name === 'NotAllowedError';
      this.cameraError.set(denied
        ? 'Camera permission denied — use mouse or touch to interact.'
        : 'No camera detected — use mouse or touch to interact.');
      return false;
    }

    this.video.srcObject = this.stream;
    this.video.muted = true; this.video.playsInline = true;
    await this.video.play().catch(() => {});

    try { await this.ensureRecognizer(); }
    catch (e) { this.cameraError.set('Could not load the gesture model. Check your connection.'); this.stop(); return false; }

    this.running = true;
    this.zone.runOutsideAngular(() => this.loop());
    return true;
  }

  private loop = (): void => {
    if (!this.running || !this.recognizer) return;
    const ts = performance.now();
    if (this.video.readyState >= 2 && ts !== this.lastTs) {
      this.lastTs = ts;
      try {
        const res = this.recognizer.recognizeForVideo(this.video, ts);
        const top = res.gestures[0]?.[0];
        const gestureName = top?.categoryName ?? null;
        const conf = top?.score ?? 0;
        this.latestLandmarks = res.landmarks?.length ? (res.landmarks as unknown as NormalizedLandmark[][]) : null;
        const hand = (res.handedness[0]?.[0]?.categoryName as 'Left' | 'Right') ?? null;

        // UI signals (cheap; only the badge reacts)
        this.gesture.set(gestureName);
        this.confidence.set(conf);
        this.handedness.set(hand);

        this.frameHandler?.({
          gesture: gestureName ?? 'None',
          confidence: conf,
          handedness: hand,
          landmarks: this.latestLandmarks?.[0] ?? null,
          at: ts,
        });
      } catch { /* transient recognize errors are ignored */ }
    }
    this.rafId = requestAnimationFrame(this.loop);
  };

  stop(): void {
    this.running = false;
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = 0; }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
    this.gesture.set(null); this.confidence.set(0); this.latestLandmarks = null;
  }

  destroy(): void {
    this.stop();
    this.recognizer?.close();
    this.recognizer = null;
    this.ready.set(false);
  }
}
