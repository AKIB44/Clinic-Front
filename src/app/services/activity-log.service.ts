import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { authApiConfig } from '../auth/auth.config';
import { BiometricSessionService } from '../auth/biometric-session.service';

export interface ActivityLog {
  id: number;
  user_id: string | null;
  clinic_id: string;
  user_name: string | null;
  user_email: string | null;
  method: string;
  path: string;
  action: string | null;
  details: string | null;
  entity_type: string | null;
  entity_id: string | null;
  status_code: number;
  duration_ms: number | null;
  ip_address: string | null;
  user_agent: string | null;
  request_body: any | null;
  created_at: string;
}

export interface ActivityLogParams {
  page?: number;
  limit?: number;
  user_id?: string;
  entity_type?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}

@Injectable({ providedIn: 'root' })
export class ActivityLogService {
  private http = inject(HttpClient);
  private biometric = inject(BiometricSessionService);
  private base = `${authApiConfig.baseUrl}/activity-log`;

  getLogs(params: ActivityLogParams = {}): Observable<{ logs: ActivityLog[]; total: number }> {
    let p = new HttpParams();
    if (params.page)        p = p.set('page',        params.page);
    if (params.limit)       p = p.set('limit',       params.limit);
    if (params.user_id)     p = p.set('user_id',     params.user_id);
    if (params.entity_type) p = p.set('entity_type', params.entity_type);
    if (params.date_from)   p = p.set('date_from',   params.date_from);
    if (params.date_to)     p = p.set('date_to',     params.date_to);
    if (params.search)      p = p.set('search',      params.search);

    // Biometric step-up grant (Face ID / Touch ID) — required by the backend.
    const token = this.biometric.getToken();
    const headers = token ? new HttpHeaders({ 'X-Biometric-Token': token }) : undefined;

    return this.http.get<{ logs: ActivityLog[]; total: number }>(this.base, { params: p, headers });
  }
}
