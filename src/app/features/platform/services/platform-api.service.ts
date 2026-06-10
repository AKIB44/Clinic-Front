import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { authApiConfig } from '../../../auth/auth.config';
import { SubscriptionPlan, PlanUpsert, ClinicSubscriptionRow, ProvisionClinicPayload, TenantStatus, DashboardMetrics, TenantDetail } from '../models/plan.model';

@Injectable({ providedIn: 'root' })
export class PlatformApiService {
  private http = inject(HttpClient);
  private base = `${authApiConfig.baseUrl}/platform`;

  /** GET /platform/plans */
  listPlans(): Observable<{ data: SubscriptionPlan[] }> {
    return this.http.get<{ data: SubscriptionPlan[] }>(`${this.base}/plans`);
  }

  /** POST /platform/plans */
  createPlan(payload: PlanUpsert): Observable<{ data: SubscriptionPlan }> {
    return this.http.post<{ data: SubscriptionPlan }>(`${this.base}/plans`, payload);
  }

  /** PATCH /platform/plans/:id */
  updatePlan(id: string, payload: Partial<PlanUpsert>): Observable<{ data: SubscriptionPlan }> {
    return this.http.patch<{ data: SubscriptionPlan }>(`${this.base}/plans/${id}`, payload);
  }

  /** DELETE /platform/plans/:id — soft archive */
  archivePlan(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/plans/${id}`);
  }

  /** GET /platform/subscriptions — clinics in the org × their subscription */
  listSubscriptions(): Observable<{ data: ClinicSubscriptionRow[]; subtotal_paise: number }> {
    return this.http.get<{ data: ClinicSubscriptionRow[]; subtotal_paise: number }>(`${this.base}/subscriptions`);
  }

  /** POST /platform/clinics/:clinicId/subscription — assign / change plan */
  assignPlan(clinicId: string, planId: string): Observable<{ data: unknown }> {
    return this.http.post<{ data: unknown }>(`${this.base}/clinics/${clinicId}/subscription`, { plan_id: planId });
  }

  /** POST /platform/clinics/provision — onboard a new clinic on trial */
  provisionClinic(payload: ProvisionClinicPayload): Observable<{ data: { clinic_id: string } }> {
    return this.http.post<{ data: { clinic_id: string } }>(`${this.base}/clinics/provision`, payload);
  }

  /** GET /platform/my-tenant-status — trial status for the active clinic */
  myTenantStatus(): Observable<TenantStatus> {
    return this.http.get<TenantStatus>(`${this.base}/my-tenant-status`);
  }

  // ── AC-4: dashboard + tenant lifecycle ──────────────────────────────────────
  dashboardMetrics(): Observable<DashboardMetrics> {
    return this.http.get<DashboardMetrics>(`${this.base}/dashboard/metrics`);
  }
  tenantDetail(clinicId: string): Observable<TenantDetail> {
    return this.http.get<TenantDetail>(`${this.base}/tenants/${clinicId}`);
  }
  suspendTenant(clinicId: string, reason?: string): Observable<{ data: unknown }> {
    return this.http.post<{ data: unknown }>(`${this.base}/tenants/${clinicId}/suspend`, { reason });
  }
  reactivateTenant(clinicId: string): Observable<{ data: unknown }> {
    return this.http.post<{ data: unknown }>(`${this.base}/tenants/${clinicId}/reactivate`, {});
  }
  extendTrial(clinicId: string, days: number): Observable<{ data: unknown }> {
    return this.http.post<{ data: unknown }>(`${this.base}/tenants/${clinicId}/extend-trial`, { days });
  }
  revokeTenant(clinicId: string, reason: string): Observable<{ data: unknown }> {
    return this.http.post<{ data: unknown }>(`${this.base}/tenants/${clinicId}/revoke`, { reason });
  }
}
