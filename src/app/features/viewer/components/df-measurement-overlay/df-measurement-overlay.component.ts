import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TablerIconsModule } from 'angular-tabler-icons';
import { ViewerStore } from '../../store/viewer.store';
import { MeasurementService } from '../../services/measurement.service';

@Component({
  selector: 'df-measurement-overlay',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TablerIconsModule],
  templateUrl: './df-measurement-overlay.component.html',
  styleUrl: './df-measurement-overlay.component.scss',
})
export class DfMeasurementOverlayComponent {
  readonly store = inject(ViewerStore);
  private measure = inject(MeasurementService);

  fmt(mm: number): string { return this.measure.format(mm); }

  remove(id: string): void {
    this.store.measurements.set(this.store.measurements().filter((m) => m.id !== id));
  }
  clear(): void { this.store.measurements.set([]); }
}
