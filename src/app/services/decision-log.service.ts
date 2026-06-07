import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { authApiConfig } from '../auth/auth.config';

export interface DecisionLogEntry {
  id:                  string;
  user_id:             string;
  user_name:           string | null;
  user_email:          string | null;
  role:                string;
  action:              string;
  resource_type:       string;
  resource_id:         string | null;
  decision:            'PERMIT' | 'DENY';
  policy_name:         string;
  policy_version:      number | null;
  reason:              string | null;
  attributes:          Record<string, unknown> | null;
  ip_address:          string | null;
  decided_at:          string;
}

export interface DecisionLogFilters {
  user_id?:        string;
  decision?:       'PERMIT' | 'DENY';
  resource_type?:  string;
  action?:         string;
  from?:           string;
  to?:             string;
  limit?:          number;
}

export interface DecisionLogResponse {
  entries: DecisionLogEntry[];
  stats:   { decision: string; n: number }[];
}

@Injectable({ providedIn: 'root' })
export class DecisionLogService {
  private readonly http = inject(HttpClient);
  private readonly base = `${authApiConfig.baseUrl}/decision-log`;

  search(filters: DecisionLogFilters = {}): Observable<DecisionLogResponse> {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v === undefined || v === null || v === '') continue;
      params = params.set(k, String(v));
    }
    return this.http.get<DecisionLogResponse>(this.base, { params });
  }
}
