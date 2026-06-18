import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NgApexchartsModule } from 'ng-apexcharts';
import { MaterialModule } from '../../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MarketingApiService } from '../../services/marketing-api.service';
import { ExpenseSummary, ExpenseCategory, EXPENSE_CATEGORY_LABELS } from '../../models/marketing.model';

@Component({
  selector: 'mkt-expense-summary',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterModule, NgApexchartsModule, MaterialModule, TablerIconsModule],
  templateUrl: './expense-summary.component.html',
  styleUrl: './expense-summary.component.scss',
})
export class ExpenseSummaryComponent implements OnInit {
  private api = inject(MarketingApiService);

  readonly summary = signal<ExpenseSummary | null>(null);
  readonly loading = signal(false);
  month = new Date().toISOString().slice(0, 7);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.expenseSummary(this.month).subscribe({
      next: (r) => { this.summary.set(r.data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  inr(paise: number | undefined | null): string {
    if (paise == null) return '—';
    return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }

  label(cat: ExpenseCategory): string {
    return EXPENSE_CATEGORY_LABELS[cat];
  }

  readonly chart = computed<any>(() => {
    const rows = this.summary()?.by_category ?? [];
    return {
      series: [{ name: 'Spend', data: rows.map((r) => Math.round(r.total_paise / 100)) }],
      chart: { type: 'bar', height: 320, fontFamily: "'Plus Jakarta Sans', sans-serif", toolbar: { show: false } },
      plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '55%' } },
      colors: ['#6d28d9'],
      dataLabels: { enabled: true, formatter: (v: number) => `₹${v.toLocaleString('en-IN')}` },
      xaxis: { categories: rows.map((r) => EXPENSE_CATEGORY_LABELS[r.category]) },
    };
  });

  readonly hasData = computed(() => (this.summary()?.by_category?.length ?? 0) > 0);
}
