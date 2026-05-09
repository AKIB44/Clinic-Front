import { Injectable, inject, signal, computed, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { authApiConfig } from '../../auth/auth.config';
import { AuthStorageService } from '../../auth/auth-storage.service';
import { BreakGlassRequest, BreakGlassResponse } from '../../auth/auth.models';

@Injectable({ providedIn: 'root' })
export class BreakGlassService implements OnDestroy {
  private readonly http    = inject(HttpClient);
  private readonly storage = inject(AuthStorageService);

  private readonly _sessionId = signal<string | null>(null);
  private readonly _expiresAt = signal<Date | null>(null);
  private _timer: ReturnType<typeof setTimeout> | null = null;

  readonly sessionId  = this._sessionId.asReadonly();
  readonly expiresAt  = this._expiresAt.asReadonly();
  readonly isActive   = computed(() => {
    const exp = this._expiresAt();
    return exp !== null && exp > new Date();
  });

  msRemaining(): number {
    const exp = this._expiresAt();
    if (!exp) return 0;
    return Math.max(0, exp.getTime() - Date.now());
  }

  async request(req: BreakGlassRequest): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<BreakGlassResponse>(
        `${authApiConfig.baseUrl}/auth/break-glass`,
        req
      )
    );
    this.storage.updateAccessToken(res.access_token);
    this._sessionId.set(res.session_id);
    const exp = new Date(res.expires_at);
    this._expiresAt.set(exp);
    this._scheduleExpiry(exp.getTime() - Date.now());
  }

  async end(): Promise<void> {
    const id = this._sessionId();
    if (!id) return;
    try {
      await firstValueFrom(
        this.http.post<void>(`${authApiConfig.baseUrl}/auth/break-glass/end`, { session_id: id })
      );
    } finally {
      this._clear();
    }
  }

  clear(): void { this._clear(); }

  private _scheduleExpiry(ms: number): void {
    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => this._clear(), ms);
  }

  private _clear(): void {
    this._sessionId.set(null);
    this._expiresAt.set(null);
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
  }

  ngOnDestroy(): void { this._clear(); }
}
