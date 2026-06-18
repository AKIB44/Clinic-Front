import { Component, input, computed, effect, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { TablerIconsModule } from 'angular-tabler-icons';
import { Df3dViewerComponent } from '../df-3d-viewer/df-3d-viewer.component';
import { DfDicomViewerComponent } from '../df-dicom-viewer/df-dicom-viewer.component';
import { PatientFile, KIND_META, humanSize } from '../../models/patient-file.model';
import { FeatureFlagsService, GESTURE_VIEWER_FLAG } from '../../../../services/feature-flags.service';

@Component({
  selector: 'df-file-viewer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TablerIconsModule, Df3dViewerComponent, DfDicomViewerComponent],
  templateUrl: './df-file-viewer.component.html',
  styleUrl: './df-file-viewer.component.scss',
})
export class DfFileViewerComponent {
  private sanitizer = inject(DomSanitizer);
  private router = inject(Router);
  private featureFlags = inject(FeatureFlagsService);

  readonly file = input<PatientFile | null>(null);
  readonly patientId = input('');

  /** Gesture viewer is gated behind an org feature flag (DB-backed). */
  readonly gestureViewerEnabled = computed(() => this.featureFlags.isOn(GESTURE_VIEWER_FLAG));

  /** Launch the full gesture-controlled 3D viewer for this patient model. */
  openGestureViewer(): void {
    const f = this.file();
    if (!f || f.kind !== 'model3d' || !this.patientId() || !this.gestureViewerEnabled()) return;
    this.router.navigate(['/viewer', this.patientId(), f.id], { queryParams: { name: f.filename } });
  }

  readonly pdfUrl = computed(() => {
    const f = this.file();
    return f && f.kind === 'pdf' ? this.sanitizer.bypassSecurityTrustResourceUrl(f.url) : null;
  });

  // image zoom/pan
  readonly zoom = signal(1);
  readonly panX = signal(0);
  readonly panY = signal(0);
  private dragging = false; private sx = 0; private sy = 0;

  readonly humanSize = humanSize;
  meta(f: PatientFile) { return KIND_META[f.kind]; }

  constructor() {
    // Reset zoom/pan whenever the selected file changes.
    effect(() => { this.file(); this.resetZoom(); }, { allowSignalWrites: true });
  }

  onWheel(e: WheelEvent): void {
    e.preventDefault();
    const next = Math.min(8, Math.max(1, this.zoom() * (e.deltaY < 0 ? 1.15 : 0.87)));
    this.zoom.set(next);
    if (next === 1) { this.panX.set(0); this.panY.set(0); }
  }
  onDown(e: MouseEvent): void { if (this.zoom() <= 1) return; this.dragging = true; this.sx = e.clientX - this.panX(); this.sy = e.clientY - this.panY(); }
  onMove(e: MouseEvent): void { if (!this.dragging) return; this.panX.set(e.clientX - this.sx); this.panY.set(e.clientY - this.sy); }
  onUp(): void { this.dragging = false; }
  resetZoom(): void { this.zoom.set(1); this.panX.set(0); this.panY.set(0); }
}
