import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { authApiConfig } from '../../../../auth/auth.config';

@Injectable({ providedIn: 'root' })
export class OrthoCaseApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${authApiConfig.baseUrl}/specialty/orthodontic`;

  createCase(payload: Record<string, unknown>): Observable<{ id: string; case: { id: string } }> {
    return this.http.post<{ id: string; case: { id: string } }>(`${this.base}/cases`, payload);
  }

  getCase(id: string): Observable<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>(`${this.base}/cases/${id}`);
  }

  updateDetail(id: string, detail: Record<string, unknown>): Observable<{ ok: boolean }> {
    return this.http.patch<{ ok: boolean }>(`${this.base}/cases/${id}/detail`, detail);
  }

  transitionPhase(id: string, phase: string, reason?: string): Observable<{ phase: string }> {
    return this.http.post<{ phase: string }>(`${this.base}/cases/${id}/phase-transition`, { phase, reason });
  }

  upsertVisitDetail(visitId: string, detail: Record<string, unknown>): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(`${this.base}/visits/${visitId}/detail`, detail);
  }

  getArchwires(caseId: string): Observable<unknown[]> {
    return this.http.get<unknown[]>(`${this.base}/cases/${caseId}/archwires`);
  }

  getActiveCases(): Observable<{ count: number; cases: unknown[] }> {
    return this.http.get<{ count: number; cases: unknown[] }>(`${this.base}/reports/active-cases`);
  }

  createRetentionPlan(caseId: string, plan: Record<string, unknown>): Observable<unknown> {
    return this.http.post<unknown>(`${this.base}/cases/${caseId}/retention-plan`, plan);
  }

  logCompliance(caseId: string, record: Record<string, unknown>): Observable<unknown> {
    return this.http.post<unknown>(`${this.base}/cases/${caseId}/compliance`, record);
  }
}
