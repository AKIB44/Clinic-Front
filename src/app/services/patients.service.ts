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
}

@Injectable({ providedIn: 'root' })
export class PatientsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${authApiConfig.baseUrl}/patients`;

  search(term: string): Observable<{ patients: Patient[] }> {
    return this.http.get<{ patients: Patient[] }>(this.base, {
      params: { search: term, limit: '10' },
    });
  }

  lookupByPhone(phone: string): Observable<{ found: boolean; patient?: Patient }> {
    return this.search(phone).pipe(
      map((r) => ({
        found: (r.patients?.length ?? 0) > 0,
        patient: r.patients?.[0],
      }))
    );
  }

  getById(id: string): Observable<{ patient: Patient }> {
    return this.http.get<{ patient: Patient }>(`${this.base}/${id}`);
  }
}
