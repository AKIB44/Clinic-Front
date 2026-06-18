import { Component, Output, EventEmitter, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ViewerStore } from '../../store/viewer.store';
import { DENTAL_VIEW_ORDER, DENTAL_VIEW_LABELS, DentalViewKey } from '../../constants/dental-views.const';

@Component({
  selector: 'df-view-presets-menu',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './df-view-presets-menu.component.html',
  styleUrl: './df-view-presets-menu.component.scss',
})
export class DfViewPresetsMenuComponent {
  @Output() select = new EventEmitter<DentalViewKey>();
  readonly store = inject(ViewerStore);
  readonly views = DENTAL_VIEW_ORDER;
  readonly labels = DENTAL_VIEW_LABELS;
}
