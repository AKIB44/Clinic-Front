import { Component, OnInit, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgApexchartsModule } from 'ng-apexcharts';
import { MaterialModule } from '../../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MarketingFeedbackStore } from '../../store/marketing-feedback.store';
import { REJECTION_REASON_LABELS, RejectionReason } from '../../models/marketing.model';

@Component({
  selector: 'mkt-acceptance-ratio',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, NgApexchartsModule, MaterialModule, TablerIconsModule],
  templateUrl: './acceptance-ratio.component.html',
  styleUrl: './acceptance-ratio.component.scss',
})
export class AcceptanceRatioComponent implements OnInit {
  readonly store = inject(MarketingFeedbackStore);

  from = '';
  to = '';

  ngOnInit(): void {
    this.store.loadAcceptanceRatio();
  }

  apply(): void {
    this.store.loadAcceptanceRatio({ from: this.from || undefined, to: this.to || undefined });
  }

  /** Donut: accepted / rejected / pending. */
  readonly donut = computed<any>(() => {
    const d = this.store.acceptanceRatio();
    return {
      series: d ? [d.accepted, d.rejected, d.pending] : [0, 0, 0],
      chart: { type: 'donut', height: 280, fontFamily: "'Plus Jakarta Sans', sans-serif" },
      labels: ['Accepted', 'Rejected', 'Pending'],
      colors: ['#0d7a5f', '#b91c1c', '#f59e0b'],
      legend: { position: 'bottom' },
      dataLabels: { enabled: true },
      stroke: { width: 0 },
    };
  });

  /** Bar: rejection reasons ranked by frequency. */
  readonly bar = computed<any>(() => {
    const d = this.store.acceptanceRatio();
    const rows = d?.breakdown_by_reason ?? [];
    return {
      series: [{ name: 'Leads', data: rows.map((r) => r.count) }],
      chart: { type: 'bar', height: 300, fontFamily: "'Plus Jakarta Sans', sans-serif", toolbar: { show: false } },
      plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '60%' } },
      colors: ['#6d28d9'],
      dataLabels: { enabled: true },
      xaxis: { categories: rows.map((r) => REJECTION_REASON_LABELS[r.reason as RejectionReason] ?? r.reason) },
    };
  });

  readonly hasBreakdown = computed(() => (this.store.acceptanceRatio()?.breakdown_by_reason?.length ?? 0) > 0);
}
