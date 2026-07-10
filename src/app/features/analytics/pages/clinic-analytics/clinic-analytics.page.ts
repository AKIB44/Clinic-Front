import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgApexchartsModule } from 'ng-apexcharts';
import { MaterialModule } from '../../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { AnalyticsApiService, AnalyticsOverview } from '../../services/analytics-api.service';
import { ResizableCardDirective } from './resizable-card.directive';

// Modernize palette — matches the template dashboards so charts feel native.
const C = {
  primary:   '#0085db',
  secondary: '#46caeb',
  success:   '#4bd08b',
  warning:   '#f8c076',
  error:     '#fb977d',
  muted:     '#e7ecf0',
};
const FONT = "'Plus Jakarta Sans', sans-serif";

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DECLINE_LABELS: Record<string, string> = {
  cost: 'Cost concerns', time: 'Time / scheduling', fear: 'Fear / anxiety',
  second_opinion: 'Second opinion', medical: 'Medical reasons',
};

@Component({
  selector: 'app-clinic-analytics',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, NgApexchartsModule, MaterialModule, TablerIconsModule, ResizableCardDirective],
  templateUrl: './clinic-analytics.page.html',
  styleUrl: './clinic-analytics.page.scss',
})
export class ClinicAnalyticsPage implements OnInit {
  private api = inject(AnalyticsApiService);

  readonly loading = signal(true);
  readonly error   = signal<string | null>(null);
  readonly data    = signal<AnalyticsOverview | null>(null);

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.overview().subscribe({
      next: (d) => { this.data.set(d); this.loading.set(false); },
      error: () => { this.error.set('Could not load analytics.'); this.loading.set(false); },
    });
  }

  inr(v: number | null | undefined): string {
    if (v == null) return '—';
    return `₹${Math.round(v).toLocaleString('en-IN')}`;
  }

  declineLabel(r: string | null): string { return r ? (DECLINE_LABELS[r] ?? r) : 'Unspecified'; }

  /** % change vs previous period; null when previous is 0 (no baseline). */
  delta(cur: number, prev: number): number | null {
    if (!prev) return null;
    return Math.round(((cur - prev) / prev) * 100);
  }

  readonly noShowRate = computed(() => {
    const k = this.data()?.kpis;
    if (!k || !k.appts_cur) return 0;
    return Math.round((k.lost_appts_cur / k.appts_cur) * 100);
  });

  readonly totalLoss = computed(() => {
    const l = this.data()?.loss_factors;
    if (!l) return 0;
    return l.cancelled.est_value + l.no_show.est_value
         + l.declined_plans.est_value + l.abandoned_services.est_value;
  });

  readonly lostChairHours = computed(() => {
    const l = this.data()?.loss_factors;
    if (!l) return 0;
    return Math.round(((l.cancelled.minutes ?? 0) + (l.no_show.minutes ?? 0)) / 60);
  });

  // ── Revenue trend (12 months, area) ─────────────────────────────────────
  readonly trendChart = computed<any>(() => {
    const rows = this.data()?.revenue_trend ?? [];
    return {
      series: [
        { name: 'Revenue', type: 'area', data: rows.map(r => Math.round(r.revenue)) },
        { name: 'Sessions', type: 'line', data: rows.map(r => r.sessions) },
      ],
      chart: { height: '100%', type: 'line', fontFamily: FONT, toolbar: { show: false }, stacked: false },
      colors: [C.primary, C.success],
      stroke: { curve: 'smooth', width: [2, 3] },
      fill: { type: ['gradient', 'solid'], gradient: { shadeIntensity: 0, opacityFrom: 0.25, opacityTo: 0.02 } },
      dataLabels: { enabled: false },
      xaxis: { categories: rows.map(r => r.month), labels: { style: { fontFamily: FONT } } },
      yaxis: [
        { labels: { formatter: (v: number) => `₹${(v / 1000).toFixed(0)}k` } },
        { opposite: true, labels: { formatter: (v: number) => `${Math.round(v)}` } },
      ],
      legend: { position: 'top', horizontalAlign: 'right', fontFamily: FONT },
      grid: { borderColor: C.muted, strokeDashArray: 3 },
      tooltip: { y: [{ formatter: (v: number) => `₹${v.toLocaleString('en-IN')}` }, { formatter: (v: number) => `${v} sessions` }] },
    };
  });

  // ── Revenue by service (horizontal bar) ─────────────────────────────────
  readonly serviceChart = computed<any>(() => {
    const rows = this.data()?.revenue_by_service ?? [];
    return {
      series: [{ name: 'Revenue', data: rows.map(r => Math.round(r.revenue)) }],
      chart: { type: 'bar', height: '100%', fontFamily: FONT, toolbar: { show: false } },
      plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '60%' } },
      colors: [C.primary],
      dataLabels: { enabled: true, formatter: (v: number) => `₹${(v / 1000).toFixed(0)}k`, style: { fontFamily: FONT } },
      xaxis: { categories: rows.map(r => r.name ?? 'Other'), labels: { style: { fontFamily: FONT } } },
      grid: { borderColor: C.muted, strokeDashArray: 3 },
      tooltip: { y: { formatter: (v: number) => `₹${v.toLocaleString('en-IN')}` } },
    };
  });

  // ── Loss factors (donut) ────────────────────────────────────────────────
  readonly lossChart = computed<any>(() => {
    const l = this.data()?.loss_factors;
    const vals = [
      Math.round(l?.no_show.est_value ?? 0),
      Math.round(l?.cancelled.est_value ?? 0),
      Math.round(l?.declined_plans.est_value ?? 0),
      Math.round(l?.abandoned_services.est_value ?? 0),
    ];
    return {
      series: vals,
      labels: ['No-shows', 'Cancellations', 'Declined plans', 'Abandoned services'],
      chart: { type: 'donut', height: 260, fontFamily: FONT },
      colors: [C.error, C.warning, C.secondary, C.muted],
      dataLabels: { enabled: false },
      legend: { position: 'bottom', fontFamily: FONT },
      plotOptions: { pie: { donut: { size: '72%' } } },
      tooltip: { y: { formatter: (v: number) => `₹${v.toLocaleString('en-IN')}` } },
    };
  });

  // ── Busiest weekdays (column) ───────────────────────────────────────────
  readonly weekdayChart = computed<any>(() => {
    const rows = this.data()?.time_analysis.by_weekday ?? [];
    const byDow = new Map(rows.map(r => [r.dow, r.count]));
    return {
      series: [{ name: 'Appointments', data: WEEKDAY_LABELS.map((_, i) => byDow.get(i) ?? 0) }],
      chart: { type: 'bar', height: '100%', fontFamily: FONT, toolbar: { show: false } },
      plotOptions: { bar: { columnWidth: '45%', borderRadius: 4 } },
      colors: [C.secondary],
      dataLabels: { enabled: false },
      xaxis: { categories: WEEKDAY_LABELS, labels: { style: { fontFamily: FONT } } },
      grid: { borderColor: C.muted, strokeDashArray: 3 },
    };
  });

  // ── Busiest hours (column) ──────────────────────────────────────────────
  readonly hourChart = computed<any>(() => {
    const rows = this.data()?.time_analysis.by_hour ?? [];
    const byHour = new Map(rows.map(r => [r.hour, r.count]));
    const hours = Array.from({ length: 13 }, (_, i) => i + 8); // 8am–8pm clinic window
    return {
      series: [{ name: 'Appointments', data: hours.map(h => byHour.get(h) ?? 0) }],
      chart: { type: 'bar', height: '100%', fontFamily: FONT, toolbar: { show: false } },
      plotOptions: { bar: { columnWidth: '55%', borderRadius: 4 } },
      colors: [C.primary],
      dataLabels: { enabled: false },
      xaxis: {
        categories: hours.map(h => h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`),
        labels: { style: { fontFamily: FONT } },
      },
      grid: { borderColor: C.muted, strokeDashArray: 3 },
    };
  });

  // ── Revenue by doctor (column) ──────────────────────────────────────────
  readonly doctorChart = computed<any>(() => {
    const rows = this.data()?.revenue_by_doctor ?? [];
    return {
      series: [{ name: 'Revenue', data: rows.map(r => Math.round(r.revenue)) }],
      chart: { type: 'bar', height: '100%', fontFamily: FONT, toolbar: { show: false } },
      plotOptions: { bar: { columnWidth: '40%', borderRadius: 4, distributed: true } },
      colors: [C.primary, C.secondary, C.success, C.warning, C.error, '#8763da', '#0085db', '#46caeb'],
      dataLabels: { enabled: false },
      legend: { show: false },
      xaxis: { categories: rows.map(r => r.doctor || 'Unassigned'), labels: { style: { fontFamily: FONT } } },
      grid: { borderColor: C.muted, strokeDashArray: 3 },
      tooltip: { y: { formatter: (v: number) => `₹${v.toLocaleString('en-IN')}` } },
    };
  });

  // ── Chair time by service (donut) ───────────────────────────────────────
  readonly timeSpentChart = computed<any>(() => {
    const rows = this.data()?.time_analysis.time_by_service ?? [];
    return {
      series: rows.map(r => r.minutes),
      labels: rows.map(r => r.name ?? 'Other'),
      chart: { type: 'donut', height: '100%', fontFamily: FONT },
      colors: [C.primary, C.secondary, C.success, C.warning, C.error, '#8763da', '#5d87ff', C.muted],
      dataLabels: { enabled: false },
      legend: { position: 'bottom', fontFamily: FONT },
      plotOptions: { pie: { donut: { size: '72%' } } },
      tooltip: { y: { formatter: (v: number) => `${Math.round(v / 60)}h ${v % 60}m` } },
    };
  });
}
