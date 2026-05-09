import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { authApiConfig } from '../../auth/auth.config';

export interface Role {
  id: string;
  code: string;
  name: string;
}

export interface RbacUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  legacy_role: string;
  designation?: string;
  is_active: boolean;
  role_id: string | null;
  role_code: string | null;
  role_name: string | null;
  override_count: number;
}

export interface PermissionDef {
  code: string;
  module: string;
  action: string;
  description: string;
  is_sensitive: boolean;
}

export interface PermissionOverride {
  id: string;
  permission_code: string;
  effect: 'allow' | 'deny';
  scope: string;
  reason: string;
}

export interface UserPermissionsResult {
  effective: Record<string, { scope: string }>;
  overrides: PermissionOverride[];
  allPermissions: PermissionDef[];
}

@Injectable({ providedIn: 'root' })
export class RbacAdminService {
  private base = `${authApiConfig.baseUrl}/rbac`;

  constructor(private http: HttpClient) {}

  getRoles(): Observable<{ roles: Role[] }> {
    return this.http.get<{ roles: Role[] }>(`${this.base}/roles`);
  }

  getUsers(): Observable<{ users: RbacUser[] }> {
    return this.http.get<{ users: RbacUser[] }>(`${this.base}/users`);
  }

  assignRole(userId: string, roleId: string, roleCode: string): Observable<any> {
    return this.http.put(`${this.base}/users/${userId}/role`, { roleId, roleCode });
  }

  getPermissions(userId: string): Observable<UserPermissionsResult> {
    return this.http.get<UserPermissionsResult>(`${this.base}/users/${userId}/permissions`);
  }

  getOverrides(userId: string): Observable<{ overrides: PermissionOverride[] }> {
    return this.http.get<{ overrides: PermissionOverride[] }>(`${this.base}/users/${userId}/overrides`);
  }

  setOverride(
    userId: string,
    permissionCode: string,
    effect: 'allow' | 'deny',
    reason: string
  ): Observable<any> {
    return this.http.post(`${this.base}/users/${userId}/overrides`, {
      permissionCode,
      effect,
      reason,
    });
  }

  deleteOverride(userId: string, overrideId: string): Observable<any> {
    return this.http.delete(`${this.base}/users/${userId}/overrides/${overrideId}`);
  }
}
