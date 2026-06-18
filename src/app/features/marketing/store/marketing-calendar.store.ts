import { Injectable, inject, signal, computed } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { MarketingApiService } from '../services/marketing-api.service';
import { CalendarEntry, CalendarStatus } from '../models/marketing.model';

const STATUSES: CalendarStatus[] = ['draft', 'scheduled', 'posted', 'cancelled'];

/** Signal store for the content calendar (board grouped by status). */
@Injectable({ providedIn: 'root' })
export class MarketingCalendarStore {
  private api = inject(MarketingApiService);

  readonly entries = signal<CalendarEntry[]>([]);
  readonly loading = signal(false);
  readonly error   = signal<string | null>(null);

  /** Entries grouped by status, for the kanban columns. */
  readonly byStatus = computed<Record<CalendarStatus, CalendarEntry[]>>(() => {
    const grouped = { draft: [], scheduled: [], posted: [], cancelled: [] } as Record<CalendarStatus, CalendarEntry[]>;
    for (const e of this.entries()) grouped[e.status].push(e);
    return grouped;
  });

  readonly columns = STATUSES;

  load(filters: { from?: string; to?: string; channel?: string } = {}): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.listCalendar(filters)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (r) => this.entries.set(r.data),
        error: (e) => this.error.set(e?.error?.error ?? 'Failed to load calendar.'),
      });
  }

  upsert(entry: CalendarEntry): void {
    const list = this.entries();
    const idx  = list.findIndex((x) => x.id === entry.id);
    this.entries.set(idx >= 0 ? list.map((x) => (x.id === entry.id ? entry : x)) : [entry, ...list]);
  }

  remove(id: string): void {
    this.entries.set(this.entries().filter((e) => e.id !== id));
  }
}
