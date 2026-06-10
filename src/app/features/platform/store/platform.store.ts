import { Injectable, inject, signal } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { PlatformApiService } from '../services/platform-api.service';
import { SubscriptionPlan, ClinicSubscriptionRow } from '../models/plan.model';

/** Signal store for the org subscription-management feature (plans + clinic subscriptions). */
@Injectable({ providedIn: 'root' })
export class PlatformStore {
  private api = inject(PlatformApiService);

  readonly plans          = signal<SubscriptionPlan[]>([]);
  readonly subscriptions  = signal<ClinicSubscriptionRow[]>([]);
  readonly subtotalPaise  = signal<number>(0);
  readonly loading        = signal(false);
  readonly error          = signal<string | null>(null);

  loadPlans(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.listPlans()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (r) => this.plans.set(r.data),
        error: (e) => this.error.set(e?.error?.error ?? 'Failed to load plans.'),
      });
  }

  /** Insert or replace a plan in the local list. */
  upsert(plan: SubscriptionPlan): void {
    const list = this.plans();
    const idx  = list.findIndex((p) => p.id === plan.id);
    this.plans.set(idx >= 0
      ? list.map((p) => (p.id === plan.id ? plan : p))
      : [...list, plan].sort((a, b) => a.price_monthly_paise - b.price_monthly_paise));
  }

  remove(id: string): void {
    this.plans.set(this.plans().filter((p) => p.id !== id));
  }

  find(id: string): SubscriptionPlan | undefined {
    return this.plans().find((p) => p.id === id);
  }

  loadSubscriptions(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.listSubscriptions()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (r) => { this.subscriptions.set(r.data); this.subtotalPaise.set(r.subtotal_paise); },
        error: (e) => this.error.set(e?.error?.error ?? 'Failed to load subscriptions.'),
      });
  }
}
