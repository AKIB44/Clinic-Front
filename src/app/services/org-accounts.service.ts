import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { authApiConfig } from '../auth/auth.config';

export interface OrgSummary {
  clinics: number;
  active_staff: number;
  appointments: {
    completed: number;
    upcoming: number;
    period_total: number;
  };
  revenue: {
    total_revenue: number;
    period_revenue: number;
  };
}

export interface ClinicRevenue {
  clinic_id: string;
  clinic_name: string;
  is_active: boolean;
  completed_appointments: number;
  upcoming_appointments: number;
  total_revenue: number;
  period_revenue: number;
  last_completed_at?: string;
}

export interface ServiceRevenue {
  id: string;
  service_name: string;
  price: number;
  total_bookings: number;
  period_bookings: number;
  total_revenue: number;
  period_revenue: number;
}

@Injectable({ providedIn: 'root' })
export class OrgAccountsService {
  private http = inject(HttpClient);
  private base = `${authApiConfig.baseUrl}/org/accounts`;

  getSummary(period = 30): Observable<OrgSummary> {
    const params = new HttpParams().set('period', String(period));
    return this.http.get<OrgSummary>(`${this.base}/summary`, { params });
  }

  getRevenue(period = 30, clinicId?: string): Observable<{ clinics: ClinicRevenue[] }> {
    let params = new HttpParams().set('period', String(period));
    if (clinicId) params = params.set('clinic_id', clinicId);
    return this.http.get<{ clinics: ClinicRevenue[] }>(`${this.base}/revenue`, { params });
  }

  getTopServices(period = 30, clinicId?: string): Observable<{ services: ServiceRevenue[] }> {
    let params = new HttpParams().set('period', String(period));
    if (clinicId) params = params.set('clinic_id', clinicId);
    return this.http.get<{ services: ServiceRevenue[] }>(`${this.base}/revenue/services`, { params });
  }
}
