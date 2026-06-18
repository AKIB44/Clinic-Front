import { Component, Output, EventEmitter, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TablerIconsModule } from 'angular-tabler-icons';
import { ViewerStore } from '../../store/viewer.store';

/**
 * GV-4 — before/after comparison controls. Loads a second ("after") model that
 * overlays the primary one (auto-synced — same camera), with opacity + visibility
 * control. PRD §6.3 (overlay mode; side-by-side / slider-wipe are further work).
 */
@Component({
  selector: 'df-before-after-viewer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, TablerIconsModule],
  templateUrl: './df-before-after-viewer.component.html',
  styleUrl: './df-before-after-viewer.component.scss',
})
export class DfBeforeAfterViewerComponent {
  @Output() loadFile = new EventEmitter<File>();
  @Output() clear = new EventEmitter<void>();
  @Output() optimize = new EventEmitter<void>();

  readonly store = inject(ViewerStore);
  opacity = 50;

  onPick(ev: Event): void {
    const f = (ev.target as HTMLInputElement).files?.[0];
    if (f) this.loadFile.emit(f);
  }
  onOpacity(): void { this.store.comparisonOpacity.set(this.opacity / 100); }
  toggleVisible(): void { this.store.comparisonVisible.update((v) => !v); }
}
