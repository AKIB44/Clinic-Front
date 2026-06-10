import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { authApiConfig } from '../../auth/auth.config';
import { TenantStatus } from '../../features/platform/models/plan.model';

const BLOCKED = ['SUSPENDED', 'REVOKED', 'CHURNED'];

/**
 * Trial / lifecycle status of the active clinic, polled from
 * GET /platform/my-tenant-status. Drives the trial banner and the read-only
 * overlay in the app shell.
 */
@Injectable({ providedIn: 'root' })
export class TenantStatusService {
  private http = inject(HttpClient);
  private base = `${authApiConfig.baseUrl}/platform`;

  readonly status        = signal<string | null>(null);
  readonly daysRemaining = signal<number | null>(null);
  readonly trialEndsAt   = signal<string | null>(null);

  /** True only for an actual ongoing trial (has an end date). */
  readonly isTrial   = computed(() => this.status() === 'TRIAL' && this.trialEndsAt() != null);
  /** True when the subscription has lapsed → app is read-only. */
  readonly isBlocked = computed(() => BLOCKED.includes(this.status() ?? ''));

  refresh(): void {
    this.http.get<TenantStatus>(`${this.base}/my-tenant-status`).subscribe({
      next: (r) => {
        this.status.set(r.tenant_status);
        this.daysRemaining.set(r.days_remaining);
        this.trialEndsAt.set(r.trial_ends_at);
      },
      error: () => { /* ignore — banner just stays hidden */ },
    });
  }
}
