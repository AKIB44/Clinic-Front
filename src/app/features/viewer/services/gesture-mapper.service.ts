import { Injectable } from '@angular/core';
import { GESTURE_CONFIG } from '../constants/gesture-config.const';
import {
  GestureCommand, GestureControlMode, GestureFrame, GestureProcessResult, NormalizedLandmark,
} from '../models/gesture.model';
import { OneEuroFilter } from './one-euro-filter';

const WRIST      = 0;
const THUMB_TIP  = 4;
const INDEX_MCP  = 5;
const INDEX_PIP  = 6;
const INDEX_TIP  = 8;
const MIDDLE_MCP = 9;

const dist2 = (a: NormalizedLandmark, b: NormalizedLandmark) =>
  Math.hypot(a.x - b.x, a.y - b.y);

@Injectable()
export class GestureMapperService {
  private readonly cfg = GESTURE_CONFIG;

  private lostFrames = 0;
  private lastAt = 0;
  private zoomLockUntil = 0;
  private touchFrames = 0;
  private lockCooldownUntil = 0;

  private midXFilter = new OneEuroFilter(
    this.cfg.filterMidCutoff, this.cfg.filterMidBeta,
  );
  private midYFilter = new OneEuroFilter(
    this.cfg.filterMidCutoff, this.cfg.filterMidBeta,
  );
  private spanFilter = new OneEuroFilter(
    this.cfg.filterSpanCutoff, this.cfg.filterSpanBeta,
  );

  private prevMidX = 0;
  private prevMidY = 0;
  private prevSpan = 0;
  private filtersReady = false;

  /** Smoothed wrist→middle-MCP distance — the depth-invariance reference. */
  private handScale = 0;

  /** Span (hand units) captured when the current pinch-zoom engaged. */
  private zoomSpanRef = 0;

  private outVel = { x: 0, y: 0 };

  readonly activeMode: { value: GestureControlMode } = { value: 'IDLE' };

  reset(): void {
    this.lostFrames = 0;
    this.lastAt = 0;
    this.zoomLockUntil = 0;
    this.touchFrames = 0;
    this.lockCooldownUntil = 0;
    this.filtersReady = false;
    this.handScale = 0;
    this.zoomSpanRef = 0;
    this.midXFilter.reset();
    this.midYFilter.reset();
    this.spanFilter.reset();
    this.outVel.x = 0;
    this.outVel.y = 0;
    this.activeMode.value = 'IDLE';
  }

  shouldResume(lms: NormalizedLandmark[]): boolean {
    return this.isTwoFingerPose(lms);
  }

  process(f: GestureFrame): GestureProcessResult {
    const lms = f.landmarks;
    const empty: GestureProcessResult = { commands: [], mode: 'IDLE' };

    if (!lms || lms.length < 21) {
      this.lostFrames++;
      if (this.lostFrames > this.cfg.handLostFrames) this.reset();
      return empty;
    }

    // Depth-invariance reference: normalize all spans & motion by hand size so
    // the gesture reads identically at any distance from the camera.
    const rawScale = dist2(lms[WRIST], lms[MIDDLE_MCP]);
    if (rawScale < this.cfg.handScaleMin) {
      // Hand too far / clipped — landmarks unreliable, treat as not seen.
      this.lostFrames++;
      if (this.lostFrames > this.cfg.handLostFrames) this.reset();
      return empty;
    }
    this.handScale = this.handScale > 0
      ? this.cfg.handScaleAlpha * rawScale + (1 - this.cfg.handScaleAlpha) * this.handScale
      : rawScale;

    if (!this.isTwoFingerPose(lms)) {
      this.lostFrames++;
      if (this.lostFrames > this.cfg.handLostFrames) this.reset();
      return empty;
    }

    this.lostFrames = 0;
    this.setMode('TWO_FINGER');

    const dtMs = this.lastAt > 0
      ? Math.min(48, Math.max(8, f.at - this.lastAt))
      : this.cfg.refFrameMs;
    this.lastAt = f.at;

    const cmd = this.twoFingerMotion(lms, dtMs, f.at);
    if (!cmd) return empty;

    return { commands: [cmd], mode: this.activeMode.value };
  }

  private isTwoFingerPose(lms: NormalizedLandmark[]): boolean {
    if (!this.indexExtended(lms)) return false;
    const scale = this.handScale || dist2(lms[WRIST], lms[MIDDLE_MCP]) || 1;
    return dist2(lms[THUMB_TIP], lms[INDEX_TIP]) / scale <= this.cfg.pinchMaxSpan;
  }

  private indexExtended(lms: NormalizedLandmark[]): boolean {
    const r = this.cfg.fingerExtendRatio;
    return dist2(lms[INDEX_TIP], lms[INDEX_MCP]) > dist2(lms[INDEX_PIP], lms[INDEX_MCP]) * r;
  }

  private twoFingerMotion(
    lms: NormalizedLandmark[], dtMs: number, at: number,
  ): GestureCommand | null {
    const thumb = lms[THUMB_TIP];
    const index = lms[INDEX_TIP];
    const scale = this.handScale;
    // Span is a relative quantity — normalize by hand size BEFORE filtering so
    // it is depth-invariant. Midpoint stays in image space (dividing a position
    // by a drifting scale would inject phantom motion); its *deltas* are
    // normalized below instead.
    const rawMidX = (thumb.x + index.x) * 0.5;
    const rawMidY = (thumb.y + index.y) * 0.5;
    const rawSpan = dist2(thumb, index) / scale;

    const sx = this.midXFilter.filter(rawMidX, dtMs);
    const sy = this.midYFilter.filter(rawMidY, dtMs);
    const smoothSpan = this.spanFilter.filter(rawSpan, dtMs);

    if (!this.filtersReady) {
      this.prevMidX = sx;
      this.prevMidY = sy;
      this.prevSpan = smoothSpan;
      this.filtersReady = true;
      return null;
    }

    const timeScale = dtMs / this.cfg.refFrameMs;
    const midDx = (sx - this.prevMidX) / timeScale / scale;
    const midDy = (sy - this.prevMidY) / timeScale / scale;
    const spanDelta = (smoothSpan - this.prevSpan) / timeScale;
    this.prevMidX = sx;
    this.prevMidY = sy;
    this.prevSpan = smoothSpan;

    const midMove = Math.hypot(midDx, midDy);
    const spanMove = Math.abs(spanDelta);

    // Thumb + index touch together → lock cavity detail anchor at this view.
    if (at >= this.lockCooldownUntil
        && smoothSpan <= this.cfg.touchLockSpan
        && midMove < this.cfg.deadzoneNorm * 2.5) {
      this.touchFrames++;
      if (this.touchFrames >= this.cfg.touchLockFrames) {
        this.touchFrames = 0;
        this.lockCooldownUntil = at + this.cfg.touchLockCooldownMs;
        this.setMode('ANCHOR_LOCKED');
        return { type: 'lockAnchor' };
      }
    } else if (smoothSpan > this.cfg.touchLockSpan * 1.4) {
      this.touchFrames = 0;
    }

    const pinchDominant =
      spanMove > this.cfg.spanDeadzone &&
      spanMove > midMove * this.cfg.pinchDominanceRatio;

    if (pinchDominant) this.zoomLockUntil = at + this.cfg.zoomLockMs;

    const zoomOnly = at < this.zoomLockUntil || pinchDominant;

    if (zoomOnly) {
      this.outVel.x *= 0.7;
      this.outVel.y *= 0.7;

      // Absolute zoom: anchor the span when the pinch engages, then command
      // the ratio of current span to that anchor. Fingers back to the anchor
      // span → zoom back to the anchor level — repeatable, no velocity drift.
      if (this.zoomSpanRef <= 0) {
        this.zoomSpanRef = smoothSpan;
        return null; // anchor frame — nothing to apply yet
      }
      let ratio = smoothSpan / this.zoomSpanRef;
      ratio = Math.min(this.cfg.zoomRatioMax, Math.max(this.cfg.zoomRatioMin, ratio));
      if (Math.abs(ratio - 1) < this.cfg.zoomRatioDeadzone) ratio = 1;

      this.setMode(ratio >= 1 ? 'ZOOM_IN' : 'ZOOM_OUT');
      return { type: 'zoomTo', ratio };
    }

    // Zoom disengaged — next pinch re-anchors at the new span.
    this.zoomSpanRef = 0;

    if (midMove < this.cfg.deadzoneNorm) {
      this.outVel.x *= 0.82;
      this.outVel.y *= 0.82;
      return null;
    }

    const va = this.cfg.outputAlpha;
    this.outVel.x = va * (-midDx) + (1 - va) * this.outVel.x;
    this.outVel.y = va * (-midDy) + (1 - va) * this.outVel.y;

    const mag = Math.hypot(this.outVel.x, this.outVel.y);
    if (mag < this.cfg.deadzoneNorm) return null;

    // Precision response: |v|^gamma keeps slow deliberate motion fine-grained
    // while full sweeps still rotate briskly.
    const shaped = Math.pow(mag, this.cfg.orbitGamma) * this.cfg.orbitGain;
    const k = shaped / mag;

    this.setMode('ORBIT');
    return { type: 'orbit', dx: this.outVel.x * k, dy: this.outVel.y * k };
  }

  private setMode(m: GestureControlMode): void {
    this.activeMode.value = m;
  }
}
