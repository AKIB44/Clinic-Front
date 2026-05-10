import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { authApiConfig } from '../auth/auth.config';

export interface Patient {
  id: string;
  name: string;
  phone: string;
  email?: string;
  dob?: string;
  gender?: 'male' | 'female' | 'other';
  address?: string;
  age?: number;
  clinical_history?: string;
  last_visit?: string;
  last_service?: string;
}

export interface PatientAppointment {
  id: string;
  service_id: string;
  service_name: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  booking_source: string;
  notes: string | null;
  cancel_reason: string | null;
}

export interface PatientDetail {
  patient: Patient;
  appointments: PatientAppointment[];
}

@Injectable({ providedIn: 'root' })
export class PatientsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${authApiConfig.baseUrl}/patients`;

  list(params: { search?: string; service_id?: string; limit?: number } = {}): Observable<{ patients: Patient[] }> {
    const p: Record<string, string> = { limit: String(params.limit ?? 50) };
    if (params.search)     p['search']     = params.search;
    if (params.service_id) p['service_id'] = params.service_id;
    return this.http.get<{ patients: Patient[] }>(this.base, { params: p });
  }

  search(term: string): Observable<{ patients: Patient[] }> {
    return this.list({ search: term, limit: 10 });
  }

  lookupByPhone(phone: string): Observable<{ found: boolean; patient?: Patient }> {
    return this.search(phone).pipe(
      map((r) => ({
        found: (r.patients?.length ?? 0) > 0,
        patient: r.patients?.[0],
      }))
    );
  }

  getById(id: string, serviceId?: string): Observable<PatientDetail> {
    const params: Record<string, string> = {};
    if (serviceId) params['service_id'] = serviceId;
    return this.http.get<PatientDetail>(`${this.base}/${id}`, { params });
  }
}
