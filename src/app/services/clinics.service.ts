import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { authApiConfig } from '../auth/auth.config';
import { Clinic } from '../models/clinic.model';

@Injectable({ providedIn: 'root' })
export class ClinicsService {
  private http = inject(HttpClient);
  private base = `${authApiConfig.baseUrl}/clinics`;

  list(): Observable<{ clinics: Clinic[] }> {
    return this.http.get<{ clinics: Clinic[] }>(this.base);
  }

  get(id: string): Observable<{ clinic: Clinic }> {
    return this.http.get<{ clinic: Clinic }>(`${this.base}/${id}`);
  }

  create(payload: Partial<Clinic>): Observable<{ clinic: Clinic }> {
    return this.http.post<{ clinic: Clinic }>(this.base, payload);
  }

  update(id: string, payload: Partial<Clinic>): Observable<{ clinic: Clinic }> {
    return this.http.put<{ clinic: Clinic }>(`${this.base}/${id}`, payload);
  }

  toggle(id: string, is_active: boolean): Observable<unknown> {
    return this.http.patch(`${this.base}/${id}`, { is_active });
  }
}
