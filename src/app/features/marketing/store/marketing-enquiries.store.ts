import { Injectable, inject, signal, computed } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { MarketingApiService } from '../services/marketing-api.service';
import { DigitalEnquiry } from '../models/marketing.model';

/** Signal store for digital enquiries (website / referral ingest). */
@Injectable({ providedIn: 'root' })
export class MarketingEnquiriesStore {
  private api = inject(MarketingApiService);

  readonly enquiries = signal<DigitalEnquiry[]>([]);
  readonly filters   = signal<{ source?: string; is_duplicate?: boolean }>({});
  readonly loading   = signal(false);
  readonly error     = signal<string | null>(null);

  /** New = not yet converted to a lead and not a duplicate. */
  readonly newEnquiries = computed(() => this.enquiries().filter((e) => !e.lead_id && !e.is_duplicate));
  readonly unprocessedCount = computed(() => this.newEnquiries().length);

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.listEnquiries(this.filters())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (r) => this.enquiries.set(r.data),
        error: (e) => this.error.set(e?.error?.error ?? 'Failed to load enquiries.'),
      });
  }

  setFilters(filters: { source?: string; is_duplicate?: boolean }): void {
    this.filters.set(filters);
    this.load();
  }

  upsert(enquiry: DigitalEnquiry): void {
    this.enquiries.set(this.enquiries().map((e) => (e.id === enquiry.id ? enquiry : e)));
  }
}
