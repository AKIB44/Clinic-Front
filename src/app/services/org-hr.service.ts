import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { authApiConfig } from '../auth/auth.config';

export interface OrgStaff {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  role?: string;
  designation?: string;
  is_active: boolean;
  status_rbac: string;
  last_login_at?: string;
  created_at: string;
  clinic_id?: string;
  clinic_name?: string;
  roles?: { name: string; code: string }[];
}

@Injectable({ providedIn: 'root' })
export class OrgHrService {
  private http = inject(HttpClient);
  private base = `${authApiConfig.baseUrl}/org/hr`;

  listStaff(opts: {
    search?: string;
    clinic_id?: string;
    is_active?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Observable<{ staff: OrgStaff[]; total: number }> {
    let params = new HttpParams();
    if (opts.search)    params = params.set('search',    opts.search);
    if (opts.clinic_id) params = params.set('clinic_id', opts.clinic_id);
    if (opts.is_active !== undefined) params = params.set('is_active', String(opts.is_active));
    if (opts.limit  !== undefined) params = params.set('limit',  String(opts.limit));
    if (opts.offset !== undefined) params = params.set('offset', String(opts.offset));
    return this.http.get<{ staff: OrgStaff[]; total: number }>(`${this.base}/staff`, { params });
  }

  updateStaff(
    id: string,
    payload: Partial<{ is_active: boolean; designation: string; status_rbac: string }>
  ): Observable<{ ok: boolean }> {
    return this.http.patch<{ ok: boolean }>(`${this.base}/staff/${id}`, payload);
  }
}
