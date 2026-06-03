import {
  ChangeDetectionStrategy,
  Component,
  Input,
  computed,
  signal,
} from '@angular/core';
import { CommonModule, DatePipe, KeyValuePipe, TitleCasePipe, LowerCasePipe } from '@angular/common';
import { TablerIconsModule } from 'angular-tabler-icons';
import { SpecialtyMilestone, MilestoneKind } from '../../models/specialty.model';

const KIND_ICONS: Partial<Record<MilestoneKind, string>> = {
  CASE_OPENED:         'plus-circle',
  CASE_PAUSED:         'player-pause',
  CASE_RESUMED:        'player-play',
  CASE_COMPLETED:      'circle-check',
  CASE_TRANSFERRED:    'arrows-exchange',
  CASE_ABANDONED:      'x-circle',
  VISIT_COMPLETED:     'calendar-check',
  CLINICAL_NOTE:       'notes',
  PHOTO_SERIES:        'camera',
  STUDY_MODEL:         'cube',
  CONSENT_OBTAINED:    'file-check',
  APPLIANCE_FITTED:    'tool',
  APPLIANCE_ADJUSTED:  'adjustments',
  APPLIANCE_REMOVED:   'minus-circle',
  IMPLANT_PLACED:      'bolt',
  IMPLANT_UNCOVERED:   'eye',
  CROWN_FITTED:        'crown',
  CUSTOM:              'star',
};

const KIND_COLORS: Partial<Record<MilestoneKind, string>> = {
  CASE_OPENED:    '#3b82f6',
  CASE_COMPLETED: '#10b981',
  CASE_ABANDONED: '#ef4444',
  CASE_PAUSED:    '#f59e0b',
  CASE_RESUMED:   '#3b82f6',
  CASE_TRANSFERRED: '#8b5cf6',
  VISIT_COMPLETED: '#6366f1',
};

@Component({
  selector: 'df-specialty-case-timeline',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DatePipe, KeyValuePipe, TitleCasePipe, LowerCasePipe, TablerIconsModule],
  templateUrl: './df-specialty-case-timeline.component.html',
  styleUrl:    './df-specialty-case-timeline.component.scss',
})
export class DfSpecialtyCaseTimelineComponent {
  @Input() milestones: SpecialtyMilestone[] = [];

  iconFor(kind: string): string {
    return KIND_ICONS[kind as MilestoneKind] ?? 'point';
  }

  colorFor(kind: string): string {
    return KIND_COLORS[kind as MilestoneKind] ?? '#6b7280';
  }

  hasDetails(m: SpecialtyMilestone): boolean {
    return m.details != null && Object.keys(m.details).length > 0;
  }
}
