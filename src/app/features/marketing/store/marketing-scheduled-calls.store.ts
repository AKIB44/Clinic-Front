import { Injectable, inject, signal, computed } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { MarketingApiService } from '../services/marketing-api.service';
import { ScheduledCall, CalendarConnectStatus } from '../models/marketing.model';

/** Signal store for scheduled calls (Google Calendar synced meetings). */
@Injectable({ providedIn: 'root' })
export class MarketingScheduledCallsStore {
  private api = inject(MarketingApiService);

  readonly calls   = signal<ScheduledCall[]>([]);
  readonly status  = signal<CalendarConnectStatus | null>(null);
  readonly loading = signal(false);
  readonly error   = signal<string | null>(null);

  /** Upcoming calls grouped by calendar day, sorted by time — for the week view. */
  readonly byDay = computed<{ day: string; calls: ScheduledCall[] }[]>(() => {
    const groups = new Map<string, ScheduledCall[]>();
    for (const c of [...this.calls()].sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for))) {
      const day = c.scheduled_for.slice(0, 10);
      (groups.get(day) ?? groups.set(day, []).get(day)!).push(c);
    }
    return [...groups.entries()].map(([day, calls]) => ({ day, calls }));
  });

  load(filters: { status?: string; from?: string; to?: string } = {}): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.listScheduledCalls(filters)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (r) => this.calls.set(r.data),
        error: (e) => this.error.set(e?.error?.error ?? 'Failed to load scheduled calls.'),
      });
  }

  loadStatus(): void {
    this.api.calendarStatus().subscribe({
      next: (r) => this.status.set(r.data),
      error: () => {},
    });
  }

  upsert(call: ScheduledCall): void {
    const list = this.calls();
    const idx  = list.findIndex((c) => c.id === call.id);
    this.calls.set(idx >= 0 ? list.map((c) => (c.id === call.id ? call : c)) : [...list, call]);
  }
}
