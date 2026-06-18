import { Injectable, inject, signal } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { MarketingApiService } from '../services/marketing-api.service';
import { MarketingDashboardData } from '../models/marketing.model';

/** Signal store for the marketing dashboard landing page. */
@Injectable({ providedIn: 'root' })
export class MarketingDashboardStore {
  private api = inject(MarketingApiService);

  readonly data    = signal<MarketingDashboardData | null>(null);
  readonly loading = signal(false);
  readonly error   = signal<string | null>(null);

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.dashboard()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (r) => this.data.set(r.data),
        error: (e) => this.error.set(e?.error?.error ?? 'Failed to load dashboard.'),
      });
  }
}
