import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { authApiConfig } from '../auth/auth.config';
import { Chair } from '../models/clinic.model';

@Injectable({ providedIn: 'root' })
export class ChairsService {
  private http = inject(HttpClient);
  private base = `${authApiConfig.baseUrl}/chairs`;

  list(clinicId?: string): Observable<{ chairs: Chair[] }> {
    const params: Record<string, string> = {};
    if (clinicId) params['clinic_id'] = clinicId;
    return this.http.get<{ chairs: Chair[] }>(this.base, { params });
  }

  create(payload: Partial<Chair>): Observable<{ chair: Chair }> {
    return this.http.post<{ chair: Chair }>(this.base, payload);
  }

  update(id: string, payload: Partial<Chair>): Observable<{ chair: Chair }> {
    return this.http.put<{ chair: Chair }>(`${this.base}/${id}`, payload);
  }

  delete(id: string): Observable<unknown> {
    return this.http.delete(`${this.base}/${id}`);
  }
}
