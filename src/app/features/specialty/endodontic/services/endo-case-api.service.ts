import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { authApiConfig } from '../../../../auth/auth.config';

@Injectable({ providedIn: 'root' })
export class EndoCaseApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${authApiConfig.baseUrl}/specialty/endodontic`;

  createCase(payload: Record<string, unknown>): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(`${this.base}/cases`, payload);
  }

  getCase(id: string): Observable<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>(`${this.base}/cases/${id}`);
  }

  getActiveCases(): Observable<{ count: number; cases: unknown[] }> {
    return this.http.get<{ count: number; cases: unknown[] }>(`${this.base}/reports/active-cases`);
  }
}
