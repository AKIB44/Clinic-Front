import { Injectable } from '@angular/core';
import { GESTURE_CONFIG } from '../constants/gesture-config.const';
import {
  GestureCommand, GestureControlMode, GestureFrame, GestureProcessResult, NormalizedLandmark,
} from '../models/gesture.model';
import { OneEuroFilter } from './one-euro-filter';

const THUMB_TIP = 4;
const INDEX_MCP = 5;
const INDEX_PIP = 6;
const INDEX_TIP = 8;

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

  private outVel = { x: 0, y: 0, pinch: 0 };

  readonly activeMode: { value: GestureControlMode } = { value: 'IDLE' };

  reset(): void {
    this.lostFrames = 0;
    this.lastAt = 0;
    this.zoomLockUntil = 0;
    this.touchFrames = 0;
    this.lockCooldownUntil = 0;
    this.filtersReady = false;
    this.midXFilter.reset();
    this.midYFilter.reset();
    this.spanFilter.reset();
    this.outVel.x = 0;
    this.outVel.y = 0;
    this.outVel.pinch = 0;
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
    return dist2(lms[THUMB_TIP], lms[INDEX_TIP]) <= this.cfg.pinchMaxSpan;
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
    const rawMidX = (thumb.x + index.x) * 0.5;
    const rawMidY = (thumb.y + index.y) * 0.5;
    const rawSpan = dist2(thumb, index);

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
    const midDx = (sx - this.prevMidX) / timeScale;
    const midDy = (sy - this.prevMidY) / timeScale;
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
      const va = this.cfg.outputAlpha;
      this.outVel.pinch = va * (spanDelta * this.cfg.pinchGain) + (1 - va) * this.outVel.pinch;

      if (Math.abs(this.outVel.pinch) < this.cfg.spanDeadzone) return null;

      this.setMode(this.outVel.pinch > 0 ? 'ZOOM_IN' : 'ZOOM_OUT');
      return { type: 'orbit', dx: 0, dy: 0, pinchDelta: this.outVel.pinch };
    }

    this.outVel.pinch *= 0.65;

    if (midMove < this.cfg.deadzoneNorm) {
      this.outVel.x *= 0.82;
      this.outVel.y *= 0.82;
      return null;
    }

    const g = this.cfg.orbitGain;
    const va = this.cfg.outputAlpha;
    this.outVel.x = va * (-midDx * g) + (1 - va) * this.outVel.x;
    this.outVel.y = va * (-midDy * g) + (1 - va) * this.outVel.y;

    if (Math.hypot(this.outVel.x, this.outVel.y) < this.cfg.deadzoneNorm) return null;

    this.setMode('ORBIT');
    return { type: 'orbit', dx: this.outVel.x, dy: this.outVel.y, pinchDelta: 0 };
  }

  private setMode(m: GestureControlMode): void {
    this.activeMode.value = m;
  }
}
