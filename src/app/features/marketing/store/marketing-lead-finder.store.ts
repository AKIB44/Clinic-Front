import { Injectable, inject, signal, computed } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { MarketingApiService } from '../services/marketing-api.service';
import { ScrapedLead, LeadFinderProviderStatus, LeadFinderUsage } from '../models/marketing.model';

/** Signal store for the Lead Finder (Google Maps discovery → screen → import). */
@Injectable({ providedIn: 'root' })
export class MarketingLeadFinderStore {
  private api = inject(MarketingApiService);

  readonly results  = signal<ScrapedLead[]>([]);
  readonly provider = signal<string | null>(null);
  readonly status   = signal<LeadFinderProviderStatus | null>(null);
  readonly usage    = signal<LeadFinderUsage | null>(null);
  readonly fromCache = signal(false);
  readonly loading  = signal(false);
  readonly error    = signal<string | null>(null);
  readonly selected = signal<Set<string>>(new Set());

  readonly importable = computed(() => this.results().filter((r) => r.status === 'passed'));
  readonly selectedCount = computed(() => this.selected().size);

  loadStatus(): void {
    this.api.leadFinderStatus().subscribe({ next: (r) => this.status.set(r.data), error: () => {} });
    this.api.leadFinderUsage().subscribe({ next: (r) => this.usage.set(r.data), error: () => {} });
  }

  loadResults(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.leadFinderResults()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (r) => { this.results.set(r.data); this.syncSelection(); },
        error: (e) => this.error.set(e?.error?.error ?? 'Failed to load results.'),
      });
  }

  search(query: string, city: string, limit: number): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.leadFinderSearch({ query, city: city || undefined, limit })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (r) => {
          this.provider.set(r.provider);
          this.fromCache.set(r.from_cache);
          this.usage.set(r.usage);
          this.loadResults();
        },
        error: (e) => this.error.set(e?.error?.message ?? e?.error?.error ?? 'Search failed.'),
      });
  }

  toggle(id: string): void {
    const next = new Set(this.selected());
    next.has(id) ? next.delete(id) : next.add(id);
    this.selected.set(next);
  }

  selectAllImportable(): void {
    this.selected.set(new Set(this.importable().map((r) => r.id)));
  }

  clearSelection(): void {
    this.selected.set(new Set());
  }

  /** Drop selections that are no longer importable (e.g. after a reload). */
  private syncSelection(): void {
    const ok = new Set(this.importable().map((r) => r.id));
    this.selected.set(new Set([...this.selected()].filter((id) => ok.has(id))));
  }

  removeLocal(id: string): void {
    this.results.set(this.results().filter((r) => r.id !== id));
  }
}
