import { Injectable, signal } from '@angular/core';

/**
 * Holds the short-lived biometric grant token (from a successful Face ID /
 * Touch ID step-up) in memory only — never persisted. The activity-log service
 * attaches it as `X-Biometric-Token`; the gate refreshes it on every visit.
 */
@Injectable({ providedIn: 'root' })
export class BiometricSessionService {
  private readonly _token = signal<string | null>(null);
  readonly unlocked = this._token.asReadonly();

  setToken(token: string): void {
    this._token.set(token);
  }

  getToken(): string | null {
    return this._token();
  }

  clear(): void {
    this._token.set(null);
  }
}
