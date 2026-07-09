import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { authApiConfig } from '../../../auth/auth.config';

export interface AnalyticsKpis {
  revenue_cur: number;
  revenue_prev: number;
  appts_cur: number;
  appts_prev: number;
  lost_appts_cur: number;
  new_patients_cur: number;
  new_patients_prev: number;
  avg_session_min: number;
  lab_spend_12m: number;
}

export interface RevenueTrendPoint  { month: string; revenue: number; sessions: number; }
export interface ServiceRevenueRow  { name: string | null; revenue: number; performed: number; avg_charge: number; }
export interface DoctorRevenueRow   { doctor: string | null; revenue: number; sessions: number; }
export interface LossBucket         { count: number; est_value: number; minutes?: number; }
export interface DeclineReasonRow   { reason: string | null; count: number; est_value: number; }
export interface WeekdayRow         { dow: number; count: number; }
export interface HourRow            { hour: number; count: number; }
export interface TimeByServiceRow   { name: string | null; performed: number; minutes: number; }
export interface TopPatientRow      { id: string; name: string; revenue: number; sessions: number; }

export interface AnalyticsOverview {
  kpis: AnalyticsKpis;
  revenue_trend: RevenueTrendPoint[];
  revenue_by_service: ServiceRevenueRow[];
  revenue_by_doctor: DoctorRevenueRow[];
  loss_factors: {
    cancelled: LossBucket;
    no_show: LossBucket;
    declined_plans: LossBucket & { by_reason: DeclineReasonRow[] };
    abandoned_services: LossBucket;
  };
  time_analysis: {
    by_weekday: WeekdayRow[];
    by_hour: HourRow[];
    time_by_service: TimeByServiceRow[];
  };
  top_patients: TopPatientRow[];
}

@Injectable({ providedIn: 'root' })
export class AnalyticsApiService {
  private http = inject(HttpClient);
  private base = `${authApiConfig.baseUrl}/analytics`;

  overview(): Observable<AnalyticsOverview> {
    return this.http.get<AnalyticsOverview>(`${this.base}/overview`);
  }
}
