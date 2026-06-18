import { Injectable, signal, computed } from '@angular/core';
import { ModelFormat, LoadPhase, ModelStats } from '../models/viewer-state.model';
import { Measurement } from '../models/measurement.model';
import { Annotation } from '../models/annotation.model';
import { DentalViewKey } from '../constants/dental-views.const';

/**
 * Central signal store for the gesture 3D viewer (PRD §10). GV-1 drives the
 * model/viewer/performance state; gesture + measurement + annotation fields are
 * present (per the PRD shape) and activated in later phases.
 */
@Injectable()
export class ViewerStore {
  // ── model state ──────────────────────────────────────────────────────────
  readonly modelFormat       = signal<ModelFormat | null>(null);
  readonly modelName         = signal<string | null>(null);
  readonly phase             = signal<LoadPhase>('idle');
  readonly loadProgress      = signal(0);           // 0-100
  readonly modelError        = signal<string | null>(null);
  readonly modelStats        = signal<ModelStats | null>(null);

  // ── gesture state (GV-2) ─────────────────────────────────────────────────
  readonly gestureEnabled    = signal(false);
  readonly gestureDetected   = signal<string | null>(null);
  readonly gestureConfidence = signal(0);
  readonly gesturePaused     = signal(false);
  readonly cameraActive      = signal(false);
  readonly cameraPreviewVisible = signal(true);

  // ── viewer state ─────────────────────────────────────────────────────────
  readonly currentView       = signal<DentalViewKey>('ANTERIOR');
  readonly isFullscreen      = signal(false);
  readonly measureMode       = signal(false);
  readonly sectionPlaneActive = signal(false);
  readonly annotateMode      = signal(false);

  // ── before/after comparison + large-file (GV-4) ──────────────────────────
  readonly compareActive     = signal(false);
  readonly comparisonName    = signal<string | null>(null);
  readonly comparisonOpacity = signal(0.5);
  readonly comparisonVisible = signal(true);
  readonly isLargeModel      = signal(false);   // > LOD threshold (GEC-7)

  // ── measurements & annotations (GV-3) ────────────────────────────────────
  readonly measurements      = signal<Measurement[]>([]);
  readonly annotations       = signal<Annotation[]>([]);

  // ── performance ──────────────────────────────────────────────────────────
  readonly fps               = signal(0);
  readonly renderTime        = signal(0);
  readonly gestureLatency    = signal(0);

  // ── derived (PRD §10) ────────────────────────────────────────────────────
  readonly loaded = computed(() => this.phase() === 'ready');
  readonly gestureStatusColour = computed(() => {
    const c = this.gestureConfidence();
    if (c > 0.85) return 'green';
    if (c > 0.70) return 'yellow';
    return 'grey';
  });
  readonly canUseGestures = computed(() =>
    this.cameraActive() && this.gestureEnabled() && !this.gesturePaused());

  // ── commands ─────────────────────────────────────────────────────────────
  reset(): void {
    this.phase.set('idle'); this.loadProgress.set(0); this.modelError.set(null);
    this.modelStats.set(null); this.measurements.set([]); this.annotations.set([]);
    this.currentView.set('ANTERIOR');
  }
  toggleGesture(): void { this.gestureEnabled.update((v) => !v); }
  toggleCompare(): void { this.compareActive.update((v) => !v); }
  toggleMeasureMode(): void { this.measureMode.update((v) => !v); }
  toggleSectionPlane(): void { this.sectionPlaneActive.update((v) => !v); }
  toggleAnnotateMode(): void { this.annotateMode.update((v) => !v); }
  addMeasurement(m: Measurement): void { this.measurements.update((ms) => [...ms, m]); }
  addAnnotation(a: Annotation): void { this.annotations.update((as) => [...as, a]); }
}
