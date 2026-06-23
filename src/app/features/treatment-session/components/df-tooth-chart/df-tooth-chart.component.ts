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

interface OcclZone { surface: ToothSurface; d: string; }
interface ToothArt { roots: string[]; crown: string; grooves: string[]; }

// Realistic side-profile tooth geometry (viewBox 0 0 100 180; root top, crown bottom).
const TOOTH_ART: Record<'incisor' | 'canine' | 'premolar' | 'molar', ToothArt> = {
  incisor: {
    roots: ['M34,83 C33,60 39,30 50,20 C61,30 67,60 66,83 Z'],
    crown: 'M35,82 C30,85 29,94 29,106 C29,131 37,164 50,164 C63,164 71,131 71,106 C71,94 70,85 65,82 Z',
    grooves: ['M43,148 L44,104', 'M57,148 L56,104'],
  },
  canine: {
    roots: ['M33,84 C30,54 38,20 50,10 C62,20 70,54 67,84 Z'],
    crown: 'M35,82 C30,85 29,95 29,108 C29,133 38,167 50,172 C62,167 71,133 71,108 C71,95 70,85 65,82 Z',
    grooves: ['M50,168 L50,110'],
  },
  premolar: {
    roots: ['M32,84 C29,58 37,28 50,18 C63,28 71,58 68,84 Z'],
    crown: 'M34,82 C28,85 26,95 26,108 C26,130 33,150 42,152 C47,153 48,141 50,141 C52,141 53,153 58,152 C67,150 74,130 74,108 C74,95 72,85 66,82 Z',
    grooves: ['M50,141 L50,106', 'M34,120 Q50,113 66,120'],
  },
  molar: {
    roots: [
      'M32,83 C26,58 18,32 25,18 C33,32 40,58 47,83 Z',
      'M68,83 C74,58 82,32 75,18 C67,32 60,58 53,83 Z',
    ],
    crown: 'M27,82 C20,85 18,94 18,106 C18,130 25,150 31,150 C36,150 37,140 42,140 C46,140 47,150 50,150 C53,150 54,140 58,140 C63,140 64,150 69,150 C75,150 82,130 82,106 C82,94 80,85 73,82 Z',
    grooves: ['M50,150 L50,106', 'M19,116 Q50,108 81,116', 'M33,148 L33,110', 'M67,148 L67,110'],
  },
};

// 5-surface occlusal diagram (36×36 box): centre table + 4 trapezoids.
const OCCL_PATHS = {
  top:    'M3,3 L33,3 L24,12 L12,12 Z',
  right:  'M33,3 L33,33 L24,24 L24,12 Z',
  bottom: 'M3,33 L33,33 L24,24 L12,24 Z',
  left:   'M3,3 L3,33 L12,24 L12,12 Z',
  center: 'M12,12 L24,12 L24,24 L12,24 Z',
};

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

  readonly saving       = signal(false);
  readonly saved        = signal(false);
  readonly selectedTooth = signal<number | null>(null);

  /** Which dentition the arch shows. Toggled in the header. */
  readonly dentition = signal<'permanent' | 'primary'>('permanent');

  readonly annotatedCount = computed(() =>
    Object.values(this.localData()).filter(d => d.condition !== 'healthy').length
  );

  // Visible quadrants follow the dentition toggle.
  readonly upperRight = computed(() => this.dentition() === 'permanent' ? UPPER_RIGHT_PERM : UPPER_RIGHT_DEC);
  readonly upperLeft  = computed(() => this.dentition() === 'permanent' ? UPPER_LEFT_PERM  : UPPER_LEFT_DEC);
  readonly lowerRight = computed(() => this.dentition() === 'permanent' ? LOWER_RIGHT_PERM : LOWER_RIGHT_DEC);
  readonly lowerLeft  = computed(() => this.dentition() === 'permanent' ? LOWER_LEFT_PERM  : LOWER_LEFT_DEC);

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

  /** Anatomical class of a tooth from its FDI position — drives the SVG shape. */
  toothType(fdi: number): 'incisor' | 'canine' | 'premolar' | 'molar' {
    const pos = fdi % 10;
    const deciduous = fdi >= 51 && fdi <= 85;
    if (pos <= 2) return 'incisor';
    if (pos === 3) return 'canine';
    // Deciduous arch has no premolars — positions 4 & 5 are primary molars.
    if (deciduous) return 'molar';
    return pos <= 5 ? 'premolar' : 'molar';
  }

  /**
   * Crown fill. Teeth keep their natural enamel shade — the condition colour
   * lives on the occlusal map. Only prosthetic restorations (crown/bridge)
   * tint the crown itself; missing is drawn as a dashed outline via CSS.
   */
  crownFill(tooth: number): string {
    const cond = this.getData(tooth).condition;
    if (cond === 'crown' || cond === 'bridge') return CONDITION_META[cond]?.bg ?? 'url(#enamelGrad)';
    return 'url(#enamelGrad)';
  }

  crownStroke(tooth: number): string {
    const cond = this.getData(tooth).condition;
    if (cond === 'crown' || cond === 'bridge') return CONDITION_META[cond]?.color ?? '#d9c39a';
    return '#d3bd95';
  }

  markerColor(tooth: number): string {
    return CONDITION_META[this.getData(tooth).condition]?.color ?? '#94a3b8';
  }

  conditionLabelOf(tooth: number): string {
    return CONDITION_META[this.getData(tooth).condition]?.label ?? 'Healthy';
  }

  /** Surface for the centre table — incisal for anterior teeth, occlusal for posterior. */
  centerSurface(fdi: number): ToothSurface {
    const t = this.toothType(fdi);
    return t === 'incisor' || t === 'canine' ? 'incisal' : 'occlusal';
  }

  /** Clickable surface zones of the occlusal map, oriented by quadrant (mesial faces midline). */
  occlusalZones(fdi: number): OcclZone[] {
    const q = Math.floor(fdi / 10);
    const mesialOnRight = q === 1 || q === 4 || q === 5 || q === 8;
    return [
      { surface: 'buccal',  d: OCCL_PATHS.top },
      { surface: 'lingual', d: OCCL_PATHS.bottom },
      { surface: mesialOnRight ? 'mesial' : 'distal', d: OCCL_PATHS.right },
      { surface: mesialOnRight ? 'distal' : 'mesial', d: OCCL_PATHS.left },
      { surface: this.centerSurface(fdi), d: OCCL_PATHS.center },
    ];
  }

  isSurface(tooth: number, surface: ToothSurface): boolean {
    return this.getData(tooth).surfaces.includes(surface);
  }

  surfaceFill(tooth: number, surface: ToothSurface): string {
    if (!this.isSurface(tooth, surface)) return '#ffffff';
    const cond = this.getData(tooth).condition;
    return cond === 'healthy' ? '#3b82f6' : CONDITION_META[cond]?.color ?? '#3b82f6';
  }

  /** Toggle a surface straight from the chart; also opens the tooth's detail panel. */
  toggleSurfaceOn(tooth: number, surface: ToothSurface): void {
    if (this.store.isSealed()) return;
    this.selectedTooth.set(tooth);
    this.toggleSurface(tooth, surface);
  }

  /** Side-profile geometry for the tooth's anatomical view. */
  toothArt(fdi: number): ToothArt {
    return TOOTH_ART[this.toothType(fdi)];
  }

  /** Root-canal filling lines drawn down the roots (viewBox 0 0 100 180). */
  canalPaths(fdi: number): string[] {
    switch (this.toothType(fdi)) {
      case 'molar': return ['M40,80 C33,58 26,34 30,22', 'M60,80 C67,58 74,34 70,22'];
      default:      return ['M50,80 L50,24'];
    }
  }

  setDentition(d: 'permanent' | 'primary'): void {
    if (this.dentition() === d) return;
    this.dentition.set(d);
    this.selectedTooth.set(null);
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
