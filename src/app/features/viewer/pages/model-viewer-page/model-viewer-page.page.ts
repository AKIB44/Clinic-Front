import {
  Component, ViewChild, AfterViewInit, OnDestroy, HostListener, NgZone, inject, signal, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MaterialModule } from '../../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { ToastService } from '../../../../services/toast.service';
import { ViewerStore } from '../../store/viewer.store';
import { ModelLoaderService } from '../../services/model-loader.service';
import { GestureEngineService } from '../../services/gesture-engine.service';
import { GestureMapperService } from '../../services/gesture-mapper.service';
import { MeasurementService } from '../../services/measurement.service';
import { ScreenshotService } from '../../services/screenshot.service';
import { DfGesture3dViewerComponent, SectionAxis } from '../../components/df-gesture-3d-viewer/df-gesture-3d-viewer.component';
import { DfViewerToolbarComponent } from '../../components/df-viewer-toolbar/df-viewer-toolbar.component';
import { DfFpsCounterComponent } from '../../components/df-fps-counter/df-fps-counter.component';
import { DfModelLoadingIndicatorComponent } from '../../components/df-model-loading-indicator/df-model-loading-indicator.component';
import { DfCameraPreviewComponent } from '../../components/df-camera-preview/df-camera-preview.component';
import { DfGestureStatusBadgeComponent } from '../../components/df-gesture-status-badge/df-gesture-status-badge.component';
import { DfMeasurementOverlayComponent } from '../../components/df-measurement-overlay/df-measurement-overlay.component';
import { DfSectionPlaneControlsComponent } from '../../components/df-section-plane-controls/df-section-plane-controls.component';
import { DfAnnotationLayerComponent } from '../../components/df-annotation-layer/df-annotation-layer.component';
import { DfBeforeAfterViewerComponent } from '../../components/df-before-after-viewer/df-before-after-viewer.component';
import { ViewerAction } from '../../models/viewer-state.model';
import { GestureFrame, GestureCommand } from '../../models/gesture.model';
import { DENTAL_VIEW_ORDER, DENTAL_VIEW_LABELS } from '../../constants/dental-views.const';

@Component({
  selector: 'app-model-viewer-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ViewerStore, ModelLoaderService, GestureEngineService, GestureMapperService, MeasurementService, ScreenshotService],
  imports: [
    CommonModule, MaterialModule, TablerIconsModule,
    DfGesture3dViewerComponent, DfViewerToolbarComponent,
    DfFpsCounterComponent, DfModelLoadingIndicatorComponent,
    DfCameraPreviewComponent, DfGestureStatusBadgeComponent,
    DfMeasurementOverlayComponent, DfSectionPlaneControlsComponent, DfAnnotationLayerComponent,
    DfBeforeAfterViewerComponent,
  ],
  templateUrl: './model-viewer-page.page.html',
  styleUrl: './model-viewer-page.page.scss',
})
export class ModelViewerPage implements AfterViewInit, OnDestroy {
  @ViewChild('viewer') viewer!: DfGesture3dViewerComponent;

  readonly store  = inject(ViewerStore);
  readonly engine = inject(GestureEngineService);
  private loader  = inject(ModelLoaderService);
  private mapper  = inject(GestureMapperService);
  private shot    = inject(ScreenshotService);
  private route   = inject(ActivatedRoute);
  private toast   = inject(ToastService);
  private zone    = inject(NgZone);

  readonly dragOver = signal(false);
  readonly pendingAnno = signal<[number, number, number] | null>(null);
  private patientId: string | null = null;
  private lastUiTs = 0;

  ngOnDestroy(): void { this.engine.destroy(); }

  ngAfterViewInit(): void {
    // Optional deep-link: /viewer/:patientId/:fileId?name=scan.stl
    const pid = this.route.snapshot.paramMap.get('patientId');
    const fid = this.route.snapshot.paramMap.get('fileId');
    const name = this.route.snapshot.queryParamMap.get('name') || 'model.stl';
    this.patientId = pid;
    if (pid && fid) this.loadFromCache(pid, fid, name);
  }

  // ── dental tools (GV-3) ────────────────────────────────────────────────────
  onAnnotationPick(p: [number, number, number]): void { this.pendingAnno.set(p); }
  onAnnoCreate(e: { position: [number, number, number]; text: string }): void {
    this.store.addAnnotation({ id: crypto.randomUUID(), position: e.position, text: e.text });
    this.pendingAnno.set(null);
  }
  onSectionAxis(a: SectionAxis): void { this.viewer.setSectionAxis(a); }
  onSectionPos(p: number): void { this.viewer.setSectionPos(p); }

  // ── file input / drag-drop ─────────────────────────────────────────────────
  onPick(ev: Event): void {
    const f = (ev.target as HTMLInputElement).files?.[0];
    if (f) this.loadFile(f);
  }

  @HostListener('dragover', ['$event'])
  onDragOver(e: DragEvent): void { e.preventDefault(); this.dragOver.set(true); }
  @HostListener('dragleave', ['$event'])
  onDragLeave(e: DragEvent): void { e.preventDefault(); this.dragOver.set(false); }
  @HostListener('drop', ['$event'])
  onDrop(e: DragEvent): void {
    e.preventDefault(); this.dragOver.set(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) this.loadFile(f);
  }

  private async loadFile(file: File): Promise<void> {
    const fmt = this.loader.formatOf(file.name);
    if (!fmt) { this.toast.error('Unsupported file — use STL, GLB, PLY or OBJ.'); return; }
    this.store.phase.set('decoding');
    try {
      const buf = await file.arrayBuffer();
      await this.viewer.loadBuffer(buf, fmt, file.name);
    } catch { this.viewer.fail('read error'); }
  }

  private loadFromCache(patientId: string, fileId: string, name: string): void {
    const fmt = this.loader.formatOf(name);
    if (!fmt) { this.toast.error('Unsupported file format.'); return; }
    this.store.phase.set('connecting');
    this.loader.loadFromCache(patientId, fileId).subscribe({
      next: (ev) => {
        if (!ev.buffer) { this.store.phase.set('downloading'); this.store.loadProgress.set(ev.progress); return; }
        this.viewer.loadBuffer(ev.buffer, fmt, name);
      },
      error: () => this.viewer.fail('download error'),
    });
  }

  // ── toolbar + keyboard actions ─────────────────────────────────────────────
  onAction(a: ViewerAction): void {
    switch (a.kind) {
      case 'reset':            this.viewer.resetView(); break;
      case 'fullscreen':       this.viewer.toggleFullscreen(); break;
      case 'snap':             this.viewer.snapToView(a.view); break;
      case 'screenshot':       this.takeScreenshot(); break;
      case 'toggle-gesture':   this.toggleGestures(); break;
      case 'toggle-measure':   this.store.toggleMeasureMode(); break;
      case 'toggle-section':   this.store.toggleSectionPlane(); break;
      case 'toggle-annotate':  this.store.toggleAnnotateMode(); break;
      case 'toggle-compare':   this.store.toggleCompare(); break;
    }
  }

  // ── before/after comparison (GV-4) ─────────────────────────────────────────
  async onLoadComparison(file: File): Promise<void> {
    const fmt = this.loader.formatOf(file.name);
    if (!fmt) { this.toast.error('Unsupported file — use STL, GLB, PLY or OBJ.'); return; }
    const ok = await this.viewer.loadComparison(await file.arrayBuffer(), fmt, file.name);
    this.toast[ok ? 'success' : 'error'](ok ? 'Overlay loaded.' : 'Could not load overlay model.');
  }
  clearComparison(): void { this.viewer.clearComparison(); }
  optimizeModel(): void { this.toast.info('Optimising…'); setTimeout(() => { this.viewer.optimizeModel(); this.toast.success('Model optimised.'); }, 30); }

  /** Screen-reader announcement (aria-live) for the current dental view. */
  readonly viewAnnouncement = () => `View: ${DENTAL_VIEW_LABELS[this.store.currentView()]}`;

  // ── gesture control (GV-2) ─────────────────────────────────────────────────
  private async toggleGestures(): Promise<void> {
    if (this.store.gestureEnabled()) { this.stopGestures(); return; }
    this.store.gestureEnabled.set(true);
    this.toast.info('Starting camera…');
    const ok = await this.engine.start();
    if (!ok) {
      this.store.gestureEnabled.set(false);
      this.toast.error(this.engine.cameraError() ?? 'Could not start gesture control.');
      return;
    }
    this.store.cameraActive.set(true);
    this.store.gesturePaused.set(false);
    this.mapper.reset();
    this.viewer.setGestureOrbitActive(true);
    this.engine.setFrameHandler((f) => this.onGestureFrame(f));
    this.toast.success('Thumb + index: touch together to lock detail, pinch to zoom, drag to rotate.');
  }

  private stopGestures(): void {
    this.engine.setFrameHandler(null);
    this.engine.stop();
    this.viewer.setGestureOrbitActive(false);
    this.store.gestureEnabled.set(false);
    this.store.cameraActive.set(false);
    this.store.gesturePaused.set(false);
    this.store.gestureDetected.set(null);
    this.store.gestureConfidence.set(0);
  }

  /** Runs OUTSIDE the Angular zone (high frequency). Continuous transforms apply
   *  directly to three.js; discrete commands + throttled UI re-enter the zone. */
  private onGestureFrame(f: GestureFrame): void {
    const lms = f.landmarks;
    if (this.store.gesturePaused()) {
      if (lms && this.mapper.shouldResume(lms)) {
        this.zone.run(() => {
          this.store.gesturePaused.set(false);
          this.mapper.reset();
          this.toast.info('Gestures resumed.');
        });
      }
    } else {
      const result = this.mapper.process(f);
      for (const cmd of result.commands) this.applyGesture(cmd);
    }

    if (f.at - this.lastUiTs > 100) {
      this.lastUiTs = f.at;
      const mode = this.mapper.activeMode.value;
      this.zone.run(() => {
        this.store.gestureDetected.set(mode === 'IDLE' ? null : mode);
        this.store.gestureConfidence.set(f.confidence > 0 ? f.confidence : (lms ? 0.9 : 0));
      });
    }
  }

  private applyGesture(cmd: GestureCommand): void {
    if (cmd.type === 'lockAnchor') {
      this.viewer.lockGestureAnchor();
      this.zone.run(() => this.toast.info('Detail view locked — pinch to zoom from here.'));
      return;
    }
    if (cmd.type === 'orbit') {
      this.viewer.applyGestureOrbit(cmd.dx, cmd.dy, cmd.pinchDelta);
    }
  }

  private takeScreenshot(): void {
    if (!this.store.loaded()) return;
    const url = this.viewer.screenshot();
    const fname = `${(this.store.modelName() || 'model').replace(/\.\w+$/, '')}-${this.store.currentView().toLowerCase()}.png`;
    // From a patient model → upload to S3 as a patient-file attachment; else download.
    if (this.patientId) {
      const file = this.shot.dataUrlToFile(url, fname);
      this.shot.uploadToPatient(this.patientId, file).subscribe({
        next: () => this.toast.success('Screenshot saved to patient files.'),
        error: () => { this.shot.download(url, fname); this.toast.info('Saved locally (upload unavailable).'); },
      });
    } else {
      this.shot.download(url, fname);
      this.toast.success('Screenshot saved.');
    }
  }

  @HostListener('window:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const k = e.key.toLowerCase();
    if (k === 'r') this.viewer?.resetView();
    else if (k === 'f') this.viewer?.toggleFullscreen();
    else if (k === 'm') this.store.toggleMeasureMode();
    else if (k === 'c') this.store.toggleSectionPlane();
    else if (k === 'g') this.onAction({ kind: 'toggle-gesture' });
    else if (k >= '1' && k <= '8') this.viewer?.snapToIndex(+k - 1);
    else return;
    e.preventDefault();
  }

  protected readonly viewCount = DENTAL_VIEW_ORDER.length;
}
