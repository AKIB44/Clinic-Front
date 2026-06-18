import { Injectable, inject, signal } from '@angular/core';
import { finalize, forkJoin } from 'rxjs';
import { MarketingApiService } from '../services/marketing-api.service';
import { LeadFeedback, CallerFeedback, AcceptanceRatioData } from '../models/marketing.model';

/** Signal store for dual-source lead feedback + acceptance-ratio analytics. */
@Injectable({ providedIn: 'root' })
export class MarketingFeedbackStore {
  private api = inject(MarketingApiService);

  // Keyed by leadId.
  readonly leadFeedbacks   = signal<Record<string, LeadFeedback[]>>({});
  readonly callerFeedbacks = signal<Record<string, CallerFeedback[]>>({});

  readonly acceptanceRatio = signal<AcceptanceRatioData | null>(null);
  readonly loading         = signal(false);
  readonly error           = signal<string | null>(null);

  /** Load both feedback streams for a lead. */
  loadForLead(leadId: string): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      lead:   this.api.listLeadFeedback(leadId),
      caller: this.api.listCallerFeedback(leadId),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (r) => {
          this.leadFeedbacks.set({ ...this.leadFeedbacks(), [leadId]: r.lead.data });
          this.callerFeedbacks.set({ ...this.callerFeedbacks(), [leadId]: r.caller.data });
        },
        error: (e) => this.error.set(e?.error?.error ?? 'Failed to load feedback.'),
      });
  }

  addLeadFeedback(leadId: string, fb: LeadFeedback): void {
    const cur = this.leadFeedbacks()[leadId] ?? [];
    this.leadFeedbacks.set({ ...this.leadFeedbacks(), [leadId]: [fb, ...cur] });
  }

  addCallerFeedback(leadId: string, fb: CallerFeedback): void {
    const cur = this.callerFeedbacks()[leadId] ?? [];
    this.callerFeedbacks.set({ ...this.callerFeedbacks(), [leadId]: [fb, ...cur] });
  }

  loadAcceptanceRatio(filters: { author_id?: string; from?: string; to?: string } = {}): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.acceptanceRatio(filters)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (r) => this.acceptanceRatio.set(r.data),
        error: (e) => this.error.set(e?.error?.error ?? 'Failed to load acceptance ratio.'),
      });
  }
}
