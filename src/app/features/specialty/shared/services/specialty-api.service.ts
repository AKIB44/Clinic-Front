import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { authApiConfig } from '../../../../auth/auth.config';
import {
  SpecialtyCase,
  SpecialtyCaseDetail,
  SpecialtyMilestone,
  CaseStatus,
  CreateCasePayload,
  AddMilestonePayload,
} from '../models/specialty.model';

@Injectable({ providedIn: 'root' })
export class SpecialtyApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${authApiConfig.baseUrl}/specialty`;

  getCasesForPatient(patientId: string, status?: CaseStatus): Observable<{ cases: SpecialtyCase[] }> {
    const params: Record<string, string> = {};
    if (status) params['status'] = status;
    return this.http.get<{ cases: SpecialtyCase[] }>(
      `${this.base}/patients/${patientId}/cases`,
      { params }
    );
  }

  getCase(id: string): Observable<SpecialtyCaseDetail> {
    return this.http.get<SpecialtyCaseDetail>(`${this.base}/cases/${id}`);
  }

  createCase(payload: CreateCasePayload): Observable<{ case: SpecialtyCase }> {
    return this.http.post<{ case: SpecialtyCase }>(`${this.base}/cases`, payload);
  }

  updateCase(id: string, payload: Partial<CreateCasePayload>): Observable<{ case: SpecialtyCase }> {
    return this.http.patch<{ case: SpecialtyCase }>(`${this.base}/cases/${id}`, payload);
  }

  updateCaseStatus(id: string, status: CaseStatus, reason?: string): Observable<{ case: SpecialtyCase }> {
    return this.http.patch<{ case: SpecialtyCase }>(`${this.base}/cases/${id}/status`, { status, reason });
  }

  addMilestone(caseId: string, milestone: AddMilestonePayload): Observable<{ milestone: SpecialtyMilestone }> {
    return this.http.post<{ milestone: SpecialtyMilestone }>(
      `${this.base}/cases/${caseId}/milestones`,
      milestone
    );
  }

  getCaseTimeline(id: string): Observable<SpecialtyCaseDetail> {
    return this.http.get<SpecialtyCaseDetail>(`${this.base}/cases/${id}/timeline`);
  }
}
