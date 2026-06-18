import { Injectable, inject, signal, computed } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { MarketingApiService } from '../services/marketing-api.service';
import { Campaign } from '../models/marketing.model';

/** Signal store for marketing campaigns. */
@Injectable({ providedIn: 'root' })
export class MarketingCampaignsStore {
  private api = inject(MarketingApiService);

  readonly campaigns = signal<Campaign[]>([]);
  readonly filters   = signal<{ status?: string; channel?: string }>({});
  readonly loading   = signal(false);
  readonly error     = signal<string | null>(null);

  readonly activeCampaigns = computed(() => this.campaigns().filter((c) => c.status === 'active'));
  readonly totalBudgetPaise = computed(() => this.campaigns().reduce((sum, c) => sum + c.budget_paise, 0));

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.listCampaigns(this.filters())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (r) => this.campaigns.set(r.data),
        error: (e) => this.error.set(e?.error?.error ?? 'Failed to load campaigns.'),
      });
  }

  setFilters(filters: { status?: string; channel?: string }): void {
    this.filters.set(filters);
    this.load();
  }

  upsert(c: Campaign): void {
    const list = this.campaigns();
    const idx  = list.findIndex((x) => x.id === c.id);
    this.campaigns.set(idx >= 0 ? list.map((x) => (x.id === c.id ? c : x)) : [c, ...list]);
  }

  remove(id: string): void {
    this.campaigns.set(this.campaigns().filter((c) => c.id !== id));
  }

  find(id: string): Campaign | undefined {
    return this.campaigns().find((c) => c.id === id);
  }
}
