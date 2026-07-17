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
  last_visit?: string;
  last_service?: string;
  // medical flags (migration 084)
  blood_group?: string | null;
  is_smoker?: boolean;
  is_diabetic?: boolean;
  is_hypertensive?: boolean;
  is_pregnant?: boolean;
  is_on_blood_thinner?: boolean;
  known_allergies?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  preferred_language?: string | null;
  occupation?: string | null;
  // family grouping by phone (migration 085)
  is_primary?: boolean;
}

/** A member of the same-phone family group. */
export interface FamilyMember {
  id: string;
  name: string;
  age: number | null;
  gender: string | null;
  is_primary: boolean;
}

export interface PatientAppointment {
  id: string;
  service_id: string;
  service_name: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  booking_source: string;
  notes: string | null;
  cancel_reason: string | null;
}

export interface PatientDetail {
  patient: Patient;
  appointments: PatientAppointment[];
}

export interface ServicePerformed {
  id: string;
  service_name: string;
  tooth_numbers: string[] | null;
  quantity: number;
  base_price: number | null;
  final_charge: number | null;
  status: string;
}

export interface PatientDiagnosis {
  id: string;
  diagnosis_text: string;
  icd10_code: string | null;
  tooth_numbers: string[] | null;
}

export interface PatientSession {
  id: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  sealed_at: string | null;
  doctor_name: string | null;
  services_performed: ServicePerformed[];
  diagnoses: PatientDiagnosis[];
  session_charge: number;
}

export interface TreatmentPlanItem {
  id: string;
  service_name: string;
  cost_min: number | null;
  cost_max: number | null;
  status: string;
  tooth_numbers: string[] | null;
}

export interface PatientTreatmentPlan {
  id: string;
  title: string;
  created_at: string;
  items: TreatmentPlanItem[];
}

export interface PatientLabOrder {
  id: string;
  service_name: string | null;
  shade: string | null;
  specifications: string | null;
  pickup_date: string | null;
  expected_delivery_date: string | null;
  lab_cost: number | null;
  status: string;
  session_date: string | null;
  created_at: string;
}

export interface BillingSummary {
  session_count: number;
  total_billed: number;
  procedure_count: number;
}

export interface PatientFullRecord {
  patient: Patient;
  appointments: PatientAppointment[];
  sessions: PatientSession[];
  treatment_plans: PatientTreatmentPlan[];
  lab_orders: PatientLabOrder[];
  billing: BillingSummary;
  family: FamilyMember[];
}

@Injectable({ providedIn: 'root' })
export class PatientsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${authApiConfig.baseUrl}/patients`;
  private readonly root = authApiConfig.baseUrl;

  list(params: {
    search?: string;
    service_id?: string;
    page?: number;
    limit?: number;
  } = {}): Observable<{ patients: Patient[]; total?: number }> {
    const p: Record<string, string> = {
      page:  String(params.page ?? 1),
      limit: String(params.limit ?? 20),
    };
    if (params.search)     p['search']     = params.search;
    if (params.service_id) p['service_id'] = params.service_id;
    return this.http.get<{ patients: Patient[]; total?: number }>(this.base, { params: p });
  }

  search(term: string): Observable<{ patients: Patient[] }> {
    return this.list({ search: term, limit: 10 });
  }

  lookupByPhone(phone: string): Observable<{ found: boolean; patient?: Patient }> {
    return this.search(phone).pipe(
      map((r) => ({
        found: (r.patients?.length ?? 0) > 0,
        patient: r.patients?.[0],
      }))
    );
  }

  getById(id: string, serviceId?: string): Observable<PatientDetail> {
    const params: Record<string, string> = {};
    if (serviceId) params['service_id'] = serviceId;
    return this.http.get<PatientDetail>(`${this.base}/${id}`, { params });
  }

  getFullRecord(id: string): Observable<PatientFullRecord> {
    return this.http.get<PatientFullRecord>(`${this.base}/${id}/record`);
  }

  update(id: string, payload: Partial<Patient>): Observable<{ patient: Patient }> {
    return this.http.put<{ patient: Patient }>(`${this.base}/${id}`, payload);
  }

  /** Make this patient the primary of its phone group (demotes the others). */
  makePrimary(id: string): Observable<{ patient: Patient; family: FamilyMember[] }> {
    return this.http.patch<{ patient: Patient; family: FamilyMember[] }>(`${this.base}/${id}/primary`, {});
  }

  /** Soft-delete (archive) a patient. History is preserved server-side. */
  delete(id: string): Observable<{ ok: boolean; id: string }> {
    return this.http.delete<{ ok: boolean; id: string }>(`${this.base}/${id}`);
  }

  /**
   * Generate (or fetch) the patient-facing invoice PDF for a clinical session and
   * return a short-lived presigned URL to view/download it.
   */
  getSessionInvoice(sessionId: string): Observable<{ url: string; invoice_no: string | null }> {
    return this.http.get<{ url: string; invoice_no: string | null }>(`${this.root}/sessions/${sessionId}/invoice`);
  }
}
