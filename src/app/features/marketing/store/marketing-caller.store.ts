import { Injectable, inject, signal, computed } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { MarketingApiService } from '../services/marketing-api.service';
import { CallerQueueEntry, CallLog, Callback } from '../models/marketing.model';

/** Signal store for the caller workflow: queue + per-lead call logs + callbacks. */
@Injectable({ providedIn: 'root' })
export class MarketingCallerStore {
  private api = inject(MarketingApiService);

  readonly queue   = signal<CallerQueueEntry[]>([]);
  readonly callLogs = signal<Record<string, CallLog[]>>({});  // keyed by leadId
  readonly pendingCallbacks = signal<Callback[]>([]);
  readonly viewAll = signal(false);
  readonly loading = signal(false);
  readonly error   = signal<string | null>(null);

  /** Pending callbacks whose scheduled time has already passed. */
  readonly overdueCallbacks = computed(() =>
    this.pendingCallbacks().filter((c) => new Date(c.scheduled_for) < new Date()));

  /** Load the current caller's queue, or every caller's queue (marketing lead). */
  loadQueue(all = false): void {
    this.viewAll.set(all);
    this.loading.set(true);
    this.error.set(null);
    (all ? this.api.callerQueueAll() : this.api.callerQueue())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (r) => this.queue.set(r.data),
        error: (e) => this.error.set(e?.error?.error ?? 'Failed to load call queue.'),
      });
  }

  removeFromQueue(leadId: string): void {
    this.queue.set(this.queue().filter((q) => q.id !== leadId));
  }

  loadCallLogs(leadId: string): void {
    this.api.listCallLogs(leadId).subscribe({
      next: (r) => this.callLogs.set({ ...this.callLogs(), [leadId]: r.data }),
      error: () => {},
    });
  }

  addCallLog(leadId: string, log: CallLog): void {
    const cur = this.callLogs()[leadId] ?? [];
    this.callLogs.set({ ...this.callLogs(), [leadId]: [log, ...cur] });
  }

  loadPendingCallbacks(): void {
    this.api.listCallbacks({ status: 'pending' }).subscribe({
      next: (r) => this.pendingCallbacks.set(r.data),
      error: () => {},
    });
  }

  removeCallback(id: string): void {
    this.pendingCallbacks.set(this.pendingCallbacks().filter((c) => c.id !== id));
  }
}
