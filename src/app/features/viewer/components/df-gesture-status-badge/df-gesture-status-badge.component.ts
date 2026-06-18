import { Component, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TablerIconsModule } from 'angular-tabler-icons';
import { ViewerStore } from '../../store/viewer.store';
import { GESTURE_MODE_LABELS } from '../../constants/gesture-config.const';

@Component({
  selector: 'df-gesture-status-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TablerIconsModule],
  templateUrl: './df-gesture-status-badge.component.html',
  styleUrl: './df-gesture-status-badge.component.scss',
})
export class DfGestureStatusBadgeComponent {
  readonly store = inject(ViewerStore);

  readonly label = computed(() => {
    if (this.store.gesturePaused()) return GESTURE_MODE_LABELS['PAUSED'];
    const g = this.store.gestureDetected();
    return g ? (GESTURE_MODE_LABELS[g] ?? g) : GESTURE_MODE_LABELS['IDLE'];
  });
  readonly colour = computed(() => this.store.gestureStatusColour());
  readonly pct = computed(() => Math.round(this.store.gestureConfidence() * 100));
}
