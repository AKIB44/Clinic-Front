import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { authApiConfig } from '../auth/auth.config';
import { StaffUser } from '../models/clinic.model';

@Injectable({ providedIn: 'root' })
export class StaffService {
  private http = inject(HttpClient);
  private base = `${authApiConfig.baseUrl}/staff`;

  // Backend scopes by JWT — no clinic_id param needed
  list(): Observable<{ users: StaffUser[] }> {
    return this.http.get<{ users: StaffUser[] }>(this.base);
  }

  create(payload: Partial<StaffUser> & { password?: string }): Observable<{ user: StaffUser }> {
    return this.http.post<{ user: StaffUser }>(this.base, payload);
  }

  update(id: string, payload: Partial<StaffUser>): Observable<{ user: StaffUser }> {
    return this.http.put<{ user: StaffUser }>(`${this.base}/${id}`, payload);
  }

  toggle(id: string, is_active: boolean): Observable<unknown> {
    return this.http.patch(`${this.base}/${id}`, { is_active });
  }

  deleteUser(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
