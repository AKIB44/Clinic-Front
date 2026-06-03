import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { authApiConfig } from '../auth/auth.config';

export interface FeatureFlag {
  key:         string;
  label:       string;
  description: string;
  enabled:     boolean;
  updated_at:  string | null;
  updated_by:  string | null;
}

export const FRIDAY_FLAG = 'voice_assistant.friday';

@Injectable({ providedIn: 'root' })
export class FeatureFlagsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${authApiConfig.baseUrl}/feature-flags`;

  /** Public read-only signal — components subscribe with toSignal or direct call. */
  readonly flags  = signal<FeatureFlag[]>([]);
  readonly loaded = signal(false);

  /** Convenience: true when the named flag is enabled for this org. */
  isOn(key: string): boolean {
    return this.flags().some(f => f.key === key && f.enabled);
  }

  load(): Observable<{ flags: FeatureFlag[] }> {
    return this.http.get<{ flags: FeatureFlag[] }>(this.base).pipe(
      tap(({ flags }) => {
        this.flags.set(flags ?? []);
        this.loaded.set(true);
      }),
    );
  }

  setEnabled(key: string, enabled: boolean): Observable<{ flag: FeatureFlag }> {
    return this.http.patch<{ flag: FeatureFlag }>(`${this.base}/${key}`, { enabled }).pipe(
      tap(({ flag }) => {
        this.flags.update(list => list.map(f => f.key === flag.key ? { ...f, ...flag } : f));
      }),
    );
  }
}
