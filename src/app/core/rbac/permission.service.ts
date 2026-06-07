import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { authApiConfig } from '../../auth/auth.config';
import {
  PermissionsResponse, PermissionGrant, AbacAction, AbacResource,
} from '../../auth/auth.models';

@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly http = inject(HttpClient);

  private readonly _perms = signal<Record<string, PermissionGrant>>({});
  readonly perms  = this._perms.asReadonly();
  readonly loaded = signal(false);

  // ── ABAC manifest signals ──────────────────────────────────────────────
  readonly role            = signal<string | null>(null);
  readonly hierarchyLevel  = signal<number>(0);
  readonly specialtyTags   = signal<string[]>([]);
  readonly branchId        = signal<string | null>(null);
  readonly actions         = signal<Record<string, string[]>>({});
  readonly fieldVisibility = signal<Record<string, string[]>>({});

  async refresh(clinicId?: string): Promise<void> {
    const params = clinicId ? `?clinicId=${clinicId}` : '';
    try {
      const res = await firstValueFrom(
        this.http.get<PermissionsResponse>(
          `${authApiConfig.baseUrl}/auth/me/permissions${params}`
        )
      );
      this._perms.set(res.permissions ?? {});
      this.role.set(res.role ?? null);
      this.hierarchyLevel.set(res.hierarchyLevel ?? 0);
      this.specialtyTags.set(res.specialtyTags ?? []);
      this.branchId.set(res.branchId ?? null);
      this.actions.set(res.actions ?? {});
      this.fieldVisibility.set(res.fieldVisibility ?? {});
    } catch {
      // Endpoint unavailable (migrations not run yet) — reset everything
      // so consumers fall back to role-based checks.
      this._perms.set({});
      this.role.set(null);
      this.actions.set({});
      this.fieldVisibility.set({});
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
    this.role.set(null);
    this.hierarchyLevel.set(0);
    this.specialtyTags.set([]);
    this.branchId.set(null);
    this.actions.set({});
    this.fieldVisibility.set({});
    this.loaded.set(false);
  }

  // ── ABAC helpers (PRD §9.2) ────────────────────────────────────────────
  /** True when the manifest grants `action` on `resource`. */
  can(action: AbacAction, resource: AbacResource): boolean {
    return (this.actions()[resource] ?? []).includes(action);
  }
  canRead   = (r: AbacResource) => this.can('read', r);
  canCreate = (r: AbacResource) => this.can('create', r);
  canUpdate = (r: AbacResource) => this.can('update', r);
  canDelete = (r: AbacResource) => this.can('delete', r);

  /** True if the role can see the resource family, or a specific field on it. */
  fieldVisible(resource: AbacResource, field?: string): boolean {
    const fields = this.fieldVisibility()[resource];
    if (!fields)            return true;     // missing manifest entry → permissive (older backend)
    if (fields.includes('*')) return true;
    if (fields.length === 0) return false;
    if (!field)              return true;    // resource visible at all
    return fields.includes(field);
  }
}
