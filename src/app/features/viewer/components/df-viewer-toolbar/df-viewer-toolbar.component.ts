import { Component, Output, EventEmitter, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { ViewerStore } from '../../store/viewer.store';
import { DfViewPresetsMenuComponent } from '../df-view-presets-menu/df-view-presets-menu.component';
import { ViewerAction } from '../../models/viewer-state.model';
import { DentalViewKey } from '../../constants/dental-views.const';

@Component({
  selector: 'df-viewer-toolbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MaterialModule, TablerIconsModule, DfViewPresetsMenuComponent],
  templateUrl: './df-viewer-toolbar.component.html',
  styleUrl: './df-viewer-toolbar.component.scss',
})
export class DfViewerToolbarComponent {
  @Output() action = new EventEmitter<ViewerAction>();
  readonly store = inject(ViewerStore);

  emit(a: ViewerAction): void { this.action.emit(a); }
  snap(view: DentalViewKey): void { this.action.emit({ kind: 'snap', view }); }
}
