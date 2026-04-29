import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { authApiConfig } from '../auth/auth.config';
import { ClinicService } from '../models/clinic.model';

@Injectable({ providedIn: 'root' })
export class ClinicServicesService {
  private http = inject(HttpClient);
  private base = `${authApiConfig.baseUrl}/services`;

  list(clinicId?: string): Observable<{ services: ClinicService[] }> {
    const params: Record<string, string> = {};
    if (clinicId) params['clinic_id'] = clinicId;
    return this.http.get<{ services: ClinicService[] }>(this.base, { params });
  }

  create(payload: Partial<ClinicService>): Observable<{ service: ClinicService }> {
    return this.http.post<{ service: ClinicService }>(this.base, payload);
  }

  update(id: string, payload: Partial<ClinicService>): Observable<{ service: ClinicService }> {
    return this.http.put<{ service: ClinicService }>(`${this.base}/${id}`, payload);
  }

  delete(id: string): Observable<unknown> {
    return this.http.delete(`${this.base}/${id}`);
  }
}
