import { Component, Output, EventEmitter, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TablerIconsModule } from 'angular-tabler-icons';
import { ViewerStore } from '../../store/viewer.store';

export type SectionAxis = 'x' | 'y' | 'z';

@Component({
  selector: 'df-section-plane-controls',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, TablerIconsModule],
  templateUrl: './df-section-plane-controls.component.html',
  styleUrl: './df-section-plane-controls.component.scss',
})
export class DfSectionPlaneControlsComponent {
  @Output() axisChange = new EventEmitter<SectionAxis>();
  @Output() posChange = new EventEmitter<number>();

  readonly store = inject(ViewerStore);
  readonly axes: SectionAxis[] = ['x', 'y', 'z'];
  readonly axis = signal<SectionAxis>('x');
  pos = 50;

  setAxis(a: SectionAxis): void { this.axis.set(a); this.axisChange.emit(a); }
  onPos(): void { this.posChange.emit(this.pos / 100); }
  close(): void { this.store.sectionPlaneActive.set(false); }
}
