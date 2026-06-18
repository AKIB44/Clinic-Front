import { Injectable, inject, signal } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { MarketingApiService } from '../services/marketing-api.service';
import { Segment } from '../models/marketing.model';

/** Signal store for audience segments. */
@Injectable({ providedIn: 'root' })
export class MarketingSegmentsStore {
  private api = inject(MarketingApiService);

  readonly segments = signal<Segment[]>([]);
  readonly loading  = signal(false);
  readonly error    = signal<string | null>(null);

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.listSegments()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (r) => this.segments.set(r.data),
        error: (e) => this.error.set(e?.error?.error ?? 'Failed to load segments.'),
      });
  }

  prepend(s: Segment): void {
    this.segments.set([s, ...this.segments()]);
  }

  remove(id: string): void {
    this.segments.set(this.segments().filter((s) => s.id !== id));
  }
}
