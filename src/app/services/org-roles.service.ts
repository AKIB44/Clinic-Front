import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { authApiConfig } from '../auth/auth.config';

export interface RoleDefinition {
  id: string;
  code: string;
  name: string;
  description?: string;
  is_system: boolean;
  org_id?: string;
  permissions: string[];
}

export interface PermissionDef {
  code: string;
  module: string;
  action: string;
  description: string;
  is_sensitive: boolean;
}

@Injectable({ providedIn: 'root' })
export class OrgRolesService {
  private http = inject(HttpClient);
  private base = `${authApiConfig.baseUrl}/org/roles`;
  private rbacBase = `${authApiConfig.baseUrl}/rbac`;

  listRoles(): Observable<{ roles: RoleDefinition[] }> {
    return this.http.get<{ roles: RoleDefinition[] }>(`${this.base}`);
  }

  createRole(payload: { name: string; code: string; description?: string }): Observable<{ role: RoleDefinition }> {
    return this.http.post<{ role: RoleDefinition }>(`${this.base}`, payload);
  }

  updateRole(id: string, payload: { name?: string; description?: string }): Observable<{ role: RoleDefinition }> {
    return this.http.patch<{ role: RoleDefinition }>(`${this.base}/${id}`, payload);
  }

  deleteRole(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.base}/${id}`);
  }

  setPermissions(id: string, permissions: string[]): Observable<{ role: RoleDefinition }> {
    return this.http.put<{ role: RoleDefinition }>(`${this.base}/${id}/permissions`, { permissions });
  }

  listAllPermissions(): Observable<{ permissions: PermissionDef[] }> {
    return this.http.get<{ permissions: PermissionDef[] }>(`${this.rbacBase}/permissions`);
  }
}
