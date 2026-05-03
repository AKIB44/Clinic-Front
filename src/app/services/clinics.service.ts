import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { authApiConfig } from '../auth/auth.config';
import { Clinic } from '../models/clinic.model';

// MVP: single clinic per admin — all calls scoped by JWT on the backend
@Injectable({ providedIn: 'root' })
export class ClinicsService {
  private http = inject(HttpClient);
  private base = `${authApiConfig.baseUrl}/clinic`;

  get(): Observable<{ clinic: Clinic }> {
    return this.http.get<{ clinic: Clinic }>(this.base);
  }

  update(payload: Partial<Clinic>): Observable<{ clinic: Clinic }> {
    return this.http.put<{ clinic: Clinic }>(this.base, payload);
  }
}
