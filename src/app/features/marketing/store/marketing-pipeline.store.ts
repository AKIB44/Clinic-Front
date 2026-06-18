import { Injectable, inject, signal, computed } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { MarketingApiService } from '../services/marketing-api.service';
import { PipelineLead, LeadStage } from '../models/marketing.model';

const STAGES: LeadStage[] = ['new', 'marketing_qualified', 'routed_to_caller', 'called',
  'demo_scheduled', 'trial', 'onboarded', 'lost'];

/** Signal store for the lead/clinic pipeline. */
@Injectable({ providedIn: 'root' })
export class MarketingPipelineStore {
  private api = inject(MarketingApiService);

  readonly leads   = signal<PipelineLead[]>([]);
  readonly filters = signal<{ stage?: string; source?: string; disposition?: string }>({});
  readonly loading = signal(false);
  readonly error   = signal<string | null>(null);

  readonly stages = STAGES;

  /** Leads grouped by stage, for the kanban columns. */
  readonly byStage = computed<Record<LeadStage, PipelineLead[]>>(() => {
    const grouped = {} as Record<LeadStage, PipelineLead[]>;
    for (const s of STAGES) grouped[s] = [];
    for (const l of this.leads()) grouped[l.stage].push(l);
    return grouped;
  });

  /** Open opportunities = not onboarded and not lost. */
  readonly pipelineCount = computed(() =>
    this.leads().filter((l) => l.stage !== 'onboarded' && l.stage !== 'lost').length);

  /** Leads blocked by the active-subscriber guard (Phase 3 sets this flag). */
  readonly blockedLeads = computed(() => this.leads().filter((l) => l.is_active_subscriber));

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.listLeads(this.filters())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (r) => this.leads.set(r.data),
        error: (e) => this.error.set(e?.error?.error ?? 'Failed to load pipeline.'),
      });
  }

  setFilters(filters: { stage?: string; source?: string; disposition?: string }): void {
    this.filters.set(filters);
    this.load();
  }

  upsert(lead: PipelineLead): void {
    const list = this.leads();
    const idx  = list.findIndex((l) => l.id === lead.id);
    this.leads.set(idx >= 0 ? list.map((l) => (l.id === lead.id ? lead : l)) : [lead, ...list]);
  }

  find(id: string): PipelineLead | undefined {
    return this.leads().find((l) => l.id === id);
  }
}
