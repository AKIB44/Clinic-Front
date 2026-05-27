import {
  Component, OnInit, inject, signal, computed, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { SessionStore } from '../../store/session.store';
import { SessionApiService } from '../../services/session-api.service';
import { ToastService } from '../../../../services/toast.service';
import {
  ToothData, ToothCondition, ToothSurface, ToothChart, emptyToothData
} from '../../models/session.model';

// FDI Numbering
// Upper right: 11-18 | Upper left: 21-28
// Lower right: 41-48 | Lower left: 31-38
// Deciduous upper right: 51-55 | upper left: 61-65
// Deciduous lower right: 81-85 | lower left: 71-75

const UPPER_RIGHT_PERM = [18, 17, 16, 15, 14, 13, 12, 11];
const UPPER_LEFT_PERM  = [21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_LEFT_PERM  = [31, 32, 33, 34, 35, 36, 37, 38];
const LOWER_RIGHT_PERM = [48, 47, 46, 45, 44, 43, 42, 41];

const UPPER_RIGHT_DEC = [55, 54, 53, 52, 51];
const UPPER_LEFT_DEC  = [61, 62, 63, 64, 65];
const LOWER_LEFT_DEC  = [71, 72, 73, 74, 75];
const LOWER_RIGHT_DEC = [85, 84, 83, 82, 81];

export const CONDITION_META: Record<ToothCondition, { label: string; color: string; bg: string }> = {
  healthy:     { label: 'Healthy',     color: '#15803d', bg: '#f0fdf4' },
  caries:      { label: 'Caries',      color: '#b91c1c', bg: '#fff1f2' },
  filled:      { label: 'Filled',      color: '#1d4ed8', bg: '#eff6ff' },
  missing:     { label: 'Missing',     color: '#6b7280', bg: '#f3f4f6' },
  cracked:     { label: 'Cracked',     color: '#b45309', bg: '#fffbeb' },
  root_canal:  { label: 'Root Canal',  color: '#7c3aed', bg: '#faf5ff' },
  crown:       { label: 'Crown',       color: '#0369a1', bg: '#f0f9ff' },
  bridge:      { label: 'Bridge',      color: '#0891b2', bg: '#ecfeff' },
  implant:     { label: 'Implant',     color: '#0d9488', bg: '#f0fdfa' },
  impacted:    { label: 'Impacted',    color: '#c2410c', bg: '#fff7ed' },
  watch:       { label: 'Watch',       color: '#d97706', bg: '#fef3c7' },
};

@Component({
  selector: 'df-tooth-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MaterialModule, TablerIconsModule],
  templateUrl: './df-tooth-chart.component.html',
  styleUrl: './df-tooth-chart.component.scss',
})
export class DfToothChartComponent implements OnInit {
  readonly store = inject(SessionStore);
  private api    = inject(SessionApiService);
  private toast  = inject(ToastService);

  private localData = signal<Record<number, ToothData>>({});

  readonly collapsed    = signal(false);
  readonly saving       = signal(false);
  readonly saved        = signal(false);
  readonly selectedTooth = signal<number | null>(null);

  readonly annotatedCount = computed(() =>
    Object.values(this.localData()).filter(d => d.condition !== 'healthy').length
  );

  readonly upperRightPerm = UPPER_RIGHT_PERM;
  readonly upperLeftPerm  = UPPER_LEFT_PERM;
  readonly lowerLeftPerm  = LOWER_LEFT_PERM;
  readonly lowerRightPerm = LOWER_RIGHT_PERM;
  readonly upperRightDec  = UPPER_RIGHT_DEC;
  readonly upperLeftDec   = UPPER_LEFT_DEC;
  readonly lowerLeftDec   = LOWER_LEFT_DEC;
  readonly lowerRightDec  = LOWER_RIGHT_DEC;

  readonly allSurfaces: ToothSurface[] = ['mesial', 'distal', 'buccal', 'lingual', 'occlusal', 'incisal'];

  readonly mobilityGrades: { value: 0 | 1 | 2 | 3 | null; label: string }[] = [
    { value: null, label: '—' },
    { value: 0, label: '0' },
    { value: 1, label: '1' },
    { value: 2, label: '2' },
    { value: 3, label: '3' },
  ];

  readonly conditionEntries = Object.entries(CONDITION_META).map(([key, val]) => ({
    key: key as ToothCondition,
    ...val,
  }));

  ngOnInit(): void {
    const chart = this.store.chart();
    if (chart?.chart_data) {
      this.localData.set({ ...chart.chart_data });
    }
  }

  getData(tooth: number): ToothData {
    return this.localData()[tooth] ?? emptyToothData();
  }

  getColor(tooth: number): string {
    return CONDITION_META[this.getData(tooth).condition]?.color ?? '#cbd5e1';
  }

  getBg(tooth: number): string {
    const cond = this.getData(tooth).condition;
    return cond === 'healthy' ? '#fff' : CONDITION_META[cond]?.bg ?? '#fff';
  }

  selectTooth(tooth: number): void {
    if (this.store.isSealed()) return;
    this.selectedTooth.set(this.selectedTooth() === tooth ? null : tooth);
  }

  setCondition(tooth: number, condition: ToothCondition): void {
    this.localData.update(d => ({
      ...d,
      [tooth]: { ...this.getData(tooth), condition },
    }));
  }

  toggleSurface(tooth: number, surface: ToothSurface): void {
    const current = this.getData(tooth).surfaces;
    const next = current.includes(surface)
      ? current.filter(s => s !== surface)
      : [...current, surface];
    this.localData.update(d => ({ ...d, [tooth]: { ...this.getData(tooth), surfaces: next } }));
  }

  setMobility(tooth: number, mobility: 0 | 1 | 2 | 3 | null): void {
    this.localData.update(d => ({ ...d, [tooth]: { ...this.getData(tooth), mobility } }));
  }

  setNotes(tooth: number, notes: string): void {
    this.localData.update(d => ({ ...d, [tooth]: { ...this.getData(tooth), notes } }));
  }

  saveChart(): void {
    const sessionId = this.store.sessionId();
    if (!sessionId) return;

    this.saving.set(true);
    this.api.putChart(sessionId, this.localData() as Record<number, unknown>).subscribe({
      next: ({ chart }) => {
        this.store.setChart(chart);
        this.saving.set(false);
        this.saved.set(true);
        this.toast.success('Tooth chart saved.');
        setTimeout(() => this.saved.set(false), 2000);
      },
      error: () => {
        this.saving.set(false);
        this.toast.error('Tooth chart could not be saved. Please try again.');
      },
    });
  }
}
