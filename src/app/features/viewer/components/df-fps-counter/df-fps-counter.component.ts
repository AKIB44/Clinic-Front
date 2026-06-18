import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ViewerStore } from '../../store/viewer.store';

@Component({
  selector: 'df-fps-counter',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './df-fps-counter.component.html',
  styleUrl: './df-fps-counter.component.scss',
})
export class DfFpsCounterComponent {
  readonly store = inject(ViewerStore);
}
