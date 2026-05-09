import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { authApiConfig } from '../../auth/auth.config';
import { PermissionsResponse, PermissionGrant } from '../../auth/auth.models';

@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly http = inject(HttpClient);

  private readonly _perms = signal<Record<string, PermissionGrant>>({});
  readonly perms = this._perms.asReadonly();
  readonly loaded = signal(false);

  async refresh(clinicId?: string): Promise<void> {
    const params = clinicId ? `?clinicId=${clinicId}` : '';
    try {
      const res = await firstValueFrom(
        this.http.get<PermissionsResponse>(
          `${authApiConfig.baseUrl}/auth/me/permissions${params}`
        )
      );
      this._perms.set(res.permissions ?? {});
    } catch {
      // Endpoint unavailable (migrations not run yet) — leave perms empty
      // so nav falls back to role-based filtering.
      this._perms.set({});
    }
    this.loaded.set(true);
  }

  has(code: string): boolean {
    return code in this._perms();
  }

  hasAny(...codes: string[]): boolean {
    return codes.some(c => this.has(c));
  }

  hasAll(...codes: string[]): boolean {
    return codes.every(c => this.has(c));
  }

  scope(code: string): string | undefined {
    return this._perms()[code]?.scope;
  }

  clear(): void {
    this._perms.set({});
    this.loaded.set(false);
  }
}
