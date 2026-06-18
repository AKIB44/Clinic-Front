import { Injectable, inject, signal, computed } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { MarketingApiService } from '../services/marketing-api.service';
import { MarketingExpense } from '../models/marketing.model';

/** Signal store for the marketing expense ledger. */
@Injectable({ providedIn: 'root' })
export class MarketingExpensesStore {
  private api = inject(MarketingApiService);

  readonly expenses = signal<MarketingExpense[]>([]);
  readonly filters  = signal<{ category?: string; from?: string; to?: string }>({});
  readonly loading  = signal(false);
  readonly error    = signal<string | null>(null);

  readonly totalPaise = computed(() => this.expenses().reduce((sum, e) => sum + e.amount_paise, 0));

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.listExpenses(this.filters())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (r) => this.expenses.set(r.data),
        error: (e) => this.error.set(e?.error?.error ?? 'Failed to load expenses.'),
      });
  }

  setFilters(filters: { category?: string; from?: string; to?: string }): void {
    this.filters.set(filters);
    this.load();
  }

  prepend(expense: MarketingExpense): void {
    this.expenses.set([expense, ...this.expenses()]);
  }

  remove(id: string): void {
    this.expenses.set(this.expenses().filter((e) => e.id !== id));
  }
}
