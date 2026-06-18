import { Component, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TablerIconsModule } from 'angular-tabler-icons';
import { ViewerStore } from '../../store/viewer.store';

@Component({
  selector: 'df-model-loading-indicator',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TablerIconsModule],
  templateUrl: './df-model-loading-indicator.component.html',
  styleUrl: './df-model-loading-indicator.component.scss',
})
export class DfModelLoadingIndicatorComponent {
  readonly store = inject(ViewerStore);

  readonly visible = computed(() => {
    const p = this.store.phase();
    return p !== 'idle' && p !== 'ready';
  });

  readonly label = computed(() => ({
    connecting: 'Connecting…',
    downloading: `Downloading model… ${this.store.loadProgress()}%`,
    decoding: 'Decoding geometry…',
    rendering: 'Rendering scene…',
    error: this.store.modelError() ?? 'Failed to load',
    idle: '', ready: '',
  }[this.store.phase()]));

  readonly pct = computed(() => {
    switch (this.store.phase()) {
      case 'connecting':  return 6;
      case 'downloading': return Math.round(6 + this.store.loadProgress() * 0.64);
      case 'decoding':    return 82;
      case 'rendering':   return 94;
      default:            return 0;
    }
  });
}
