import { Injectable, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { BillingApiService } from '../services/billing-api.service';
import { BillingSummary, ClinicExpense, RevenueItem } from '../models/billing.model';

@Injectable({ providedIn: 'root' })
export class BillingStore {
  private api = inject(BillingApiService);

  readonly period   = signal<number>(30);
  readonly summary  = signal<BillingSummary | null>(null);
  readonly revenue  = signal<RevenueItem[]>([]);
  readonly expenses = signal<ClinicExpense[]>([]);
  readonly loading  = signal(false);
  readonly error    = signal<string | null>(null);

  load(periodDays = this.period()): void {
    this.period.set(periodDays);
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      summary:  this.api.getSummary(periodDays),
      revenue:  this.api.getRevenue(periodDays),
      expenses: this.api.getExpenses(periodDays),
    }).pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ summary, revenue, expenses }) => {
          this.summary.set(summary);
          this.revenue.set(revenue.data);
          this.expenses.set(expenses.data);
        },
        error: (e) => this.error.set(e?.error?.error ?? 'Failed to load billing.'),
      });
  }
}
