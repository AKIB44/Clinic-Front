import {
  ChangeDetectionStrategy,
  Component,
  Input,
  computed,
  signal,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TablerIconsModule } from 'angular-tabler-icons';
import { SpecialtyCase, CaseType, CaseStatus } from '../../models/specialty.model';

const CASE_TYPE_LABELS: Record<CaseType, string> = {
  ORTHO:   'Orthodontics',
  IMPLANT: 'Implantology',
  PAEDO:   'Paediatric',
  ENDO:    'Endodontics',
  TMJ:     'TMJ',
};

const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  ACTIVE:      'Active',
  PAUSED:      'Paused',
  TRANSFERRED: 'Transferred',
  ABANDONED:   'Abandoned',
  COMPLETED:   'Completed',
};

@Component({
  selector: 'df-specialty-case-summary',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DatePipe, RouterLink, TablerIconsModule],
  templateUrl: './df-specialty-case-summary.component.html',
  styleUrl:    './df-specialty-case-summary.component.scss',
})
export class DfSpecialtyCaseSummaryComponent {
  @Input() case!: SpecialtyCase;

  readonly caseTypeLabels  = CASE_TYPE_LABELS;
  readonly caseStatusLabels = CASE_STATUS_LABELS;

  get caseTypeLabel(): string {
    return CASE_TYPE_LABELS[this.case?.case_type] ?? this.case?.case_type ?? '';
  }

  get statusLabel(): string {
    return CASE_STATUS_LABELS[this.case?.status] ?? this.case?.status ?? '';
  }

  get statusClass(): string {
    return `status-${(this.case?.status ?? '').toLowerCase()}`;
  }

  get typeClass(): string {
    return `type-${(this.case?.case_type ?? '').toLowerCase()}`;
  }

  /** Progress percentage: visits completed vs expected total (rough heuristic). */
  get progressPercent(): number {
    if (!this.case) return 0;
    if (this.case.status === 'COMPLETED') return 100;
    if (!this.case.expected_duration_months) return 0;

    const visits = this.case.visit_count ?? 0;
    // Assume ~2 visits per month as a heuristic estimate
    const estimated = this.case.expected_duration_months * 2;
    return Math.min(100, Math.round((visits / estimated) * 100));
  }

  get typeIcon(): string {
    const icons: Record<CaseType, string> = {
      ORTHO:   'braces-color',
      IMPLANT: 'tooth',
      PAEDO:   'baby-carriage',
      ENDO:    'virus-search',
      TMJ:     'skull',
    };
    return icons[this.case?.case_type] ?? 'stethoscope';
  }

  /** Deep-link to the module-specific case detail page. */
  get caseRoute(): string[] {
    const moduleMap: Record<CaseType, string> = {
      ORTHO:   'orthodontic',
      IMPLANT: 'implantology',
      PAEDO:   'paediatric',
      ENDO:    'endodontic',
      TMJ:     'tmj',
    };
    const module = moduleMap[this.case?.case_type];
    if (module) return ['/specialty', module, 'cases', this.case.id];
    return ['/specialty', 'cases', this.case.id];
  }
}
