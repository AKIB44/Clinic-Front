import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { authApiConfig } from '../auth/auth.config';
import { Clinic } from '../models/clinic.model';

export type ClinicPayload = Pick<Clinic, 'name' | 'phone' | 'email' | 'address' | 'city'> & { state?: string };

@Injectable({ providedIn: 'root' })
export class ClinicsService {
  private http = inject(HttpClient);

  // ── Single-clinic (active clinic profile) ────────────────────────────────

  private singleBase = `${authApiConfig.baseUrl}/clinic`;

  get(): Observable<{ clinic: Clinic }> {
    return this.http.get<{ clinic: Clinic }>(this.singleBase);
  }

  updateActive(payload: Partial<Clinic>): Observable<{ clinic: Clinic }> {
    return this.http.put<{ clinic: Clinic }>(this.singleBase, payload);
  }

  uploadLogo(file: File): Observable<{ logo_url: string; logo_s3_key: string }> {
    const form = new FormData();
    form.append('logo', file);
    return this.http.post<{ logo_url: string; logo_s3_key: string }>(`${this.singleBase}/logo`, form);
  }

  removeLogo(): Observable<void> {
    return this.http.delete<void>(`${this.singleBase}/logo`);
  }

  // ── Org-level multi-clinic management (org.manage permission) ────────────

  private orgBase = `${authApiConfig.baseUrl}/clinics`;

  list(): Observable<{ clinics: Clinic[] }> {
    return this.http.get<{ clinics: Clinic[] }>(this.orgBase);
  }

  create(payload: ClinicPayload): Observable<{ clinic: Clinic }> {
    return this.http.post<{ clinic: Clinic }>(this.orgBase, payload);
  }

  update(id: string, payload: Partial<ClinicPayload & { is_active: boolean }>): Observable<{ clinic: Clinic }> {
    return this.http.patch<{ clinic: Clinic }>(`${this.orgBase}/${id}`, payload);
  }

  toggle(id: string, is_active: boolean): Observable<{ clinic: Clinic }> {
    return this.http.patch<{ clinic: Clinic }>(`${this.orgBase}/${id}`, { is_active });
  }

  // ── Per-clinic user/role management ──────────────────────────────────────

  getClinicUsers(clinicId: string): Observable<{ users: any[] }> {
    return this.http.get<{ users: any[] }>(`${this.orgBase}/${clinicId}/users`);
  }

  assignClinicRole(clinicId: string, userId: string, roleId: string, roleCode: string): Observable<{ ok: boolean }> {
    return this.http.put<{ ok: boolean }>(`${this.orgBase}/${clinicId}/users/${userId}/role`, { roleId, roleCode });
  }
}
