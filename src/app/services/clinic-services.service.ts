import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { authApiConfig } from '../auth/auth.config';
import { ClinicService } from '../models/clinic.model';

@Injectable({ providedIn: 'root' })
export class ClinicServicesService {
  private http = inject(HttpClient);
  private base = `${authApiConfig.baseUrl}/services`;

  /** All clinic services — used by schedule columns, booking, public views. */
  list(clinicId?: string): Observable<{ services: ClinicService[] }> {
    const params: Record<string, string> = {};
    if (clinicId) params['clinic_id'] = clinicId;
    return this.http.get<{ services: ClinicService[] }>(this.base, { params });
  }

  /** Doctor's own services only — used by My Services management page. */
  mine(): Observable<{ services: ClinicService[] }> {
    return this.http.get<{ services: ClinicService[] }>(`${this.base}/mine`);
  }

  create(payload: Partial<ClinicService>): Observable<{ service: ClinicService }> {
    return this.http.post<{ service: ClinicService }>(this.base, payload);
  }

  update(id: string, payload: Partial<ClinicService>): Observable<{ service: ClinicService }> {
    return this.http.put<{ service: ClinicService }>(`${this.base}/${id}`, payload);
  }

  toggle(id: string): Observable<{ service: ClinicService }> {
    return this.http.patch<{ service: ClinicService }>(`${this.base}/${id}/toggle`, {});
  }

  delete(id: string): Observable<unknown> {
    return this.http.delete(`${this.base}/${id}`);
  }
}
