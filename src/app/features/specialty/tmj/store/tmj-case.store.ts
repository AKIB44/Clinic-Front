import { Injectable, signal, inject } from '@angular/core';
import { TmjCaseApiService } from '../services/tmj-case-api.service';

@Injectable({ providedIn: 'root' })
export class TmjCaseStore {
  private readonly api = inject(TmjCaseApiService);
  readonly caseId   = signal<string | null>(null);
  readonly caseData = signal<Record<string, unknown> | null>(null);
  readonly loading  = signal(false);
  readonly error    = signal<string | null>(null);

  async loadCase(id: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const data = await this.api.getCase(id).toPromise() as Record<string, unknown>;
      this.caseId.set(id);
      this.caseData.set(data);
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Load failed');
    } finally {
      this.loading.set(false);
    }
  }
}
