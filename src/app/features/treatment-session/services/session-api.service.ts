import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { authApiConfig } from '../../../auth/auth.config';
import {
  ClinicalSession,
  ClinicalNote,
  ServicePerformed,
  Examination,
  Diagnosis,
  ToothChart,
  TreatmentPlan,
  TreatmentPlanItem,
  PlanDeclineReason,
  Prescription,
  SessionAttachment,
  InvestigationOrder,
  InvestigationKind,
  LabOrder,
  LabOrderStatus,
} from '../models/session.model';

export interface StartTreatmentResponse {
  session: ClinicalSession;
  resumed?: boolean;
}

export interface SessionHydration {
  session: ClinicalSession;
  note: ClinicalNote | null;
}

export interface SoapPayload {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export interface AddServicePayload {
  service_id: string;
  plan_item_id?: string;
  tooth_numbers?: number[];
  quantity?: number;
  performed_by?: string;
  discount_pct?: number;
  discount_flat?: number;
  discount_reason?: string;
  notes?: string;
}

@Injectable({ providedIn: 'root' })
export class SessionApiService {
  private http = inject(HttpClient);
  private base = authApiConfig.baseUrl;

  /** Endpoint 1 — POST /appointments/:id/start-treatment */
  startTreatment(appointmentId: string, doctorId?: string): Observable<StartTreatmentResponse> {
    return this.http.post<StartTreatmentResponse>(
      `${this.base}/appointments/${appointmentId}/start-treatment`,
      doctorId ? { doctor_id: doctorId } : {}
    );
  }

  /** Endpoint 2 — GET /sessions/:id */
  getSession(sessionId: string): Observable<SessionHydration> {
    return this.http.get<SessionHydration>(`${this.base}/sessions/${sessionId}`);
  }

  /** Endpoint 22 — PATCH /sessions/:id/notes */
  upsertNotes(sessionId: string, soap: SoapPayload): Observable<{ note: ClinicalNote }> {
    return this.http.patch<{ note: ClinicalNote }>(
      `${this.base}/sessions/${sessionId}/notes`,
      soap
    );
  }

  /** GET /sessions/:id/services */
  getServices(sessionId: string): Observable<{ services: ServicePerformed[] }> {
    return this.http.get<{ services: ServicePerformed[] }>(
      `${this.base}/sessions/${sessionId}/services`
    );
  }

  /** Endpoint 15 — POST /sessions/:id/services */
  addService(sessionId: string, payload: AddServicePayload): Observable<{ service: ServicePerformed; plan_item?: TreatmentPlanItem | null }> {
    return this.http.post<{ service: ServicePerformed; plan_item?: TreatmentPlanItem | null }>(
      `${this.base}/sessions/${sessionId}/services`,
      payload
    );
  }

  /** Endpoint 16 — PATCH /services/:id */
  updateService(serviceId: string, body: { status: string; abandon_reason?: string; notes?: string }): Observable<{ service: ServicePerformed; plan_item?: TreatmentPlanItem | null }> {
    return this.http.patch<{ service: ServicePerformed; plan_item?: TreatmentPlanItem | null }>(
      `${this.base}/services/${serviceId}`,
      body
    );
  }

  /** GET /sessions/:id/examination */
  getExamination(sessionId: string): Observable<{ examination: Examination | null }> {
    return this.http.get<{ examination: Examination | null }>(`${this.base}/sessions/${sessionId}/examination`);
  }

  /** Endpoint 3 — PATCH /sessions/:id/examination */
  upsertExamination(sessionId: string, payload: Partial<Examination>): Observable<{ examination: Examination }> {
    return this.http.patch<{ examination: Examination }>(`${this.base}/sessions/${sessionId}/examination`, payload);
  }

  /** GET /sessions/:id/diagnoses */
  getDiagnoses(sessionId: string): Observable<{ diagnoses: Diagnosis[] }> {
    return this.http.get<{ diagnoses: Diagnosis[] }>(`${this.base}/sessions/${sessionId}/diagnoses`);
  }

  /** Endpoint 5 — POST /sessions/:id/diagnoses */
  addDiagnosis(sessionId: string, payload: { diagnosis_text: string; icd10_code?: string; tooth_numbers?: number[]; kind?: string }): Observable<{ diagnosis: Diagnosis }> {
    return this.http.post<{ diagnosis: Diagnosis }>(`${this.base}/sessions/${sessionId}/diagnoses`, payload);
  }

  /** Endpoint 6 — DELETE /sessions/:id/diagnoses/:dxId */
  deleteDiagnosis(sessionId: string, dxId: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.base}/sessions/${sessionId}/diagnoses/${dxId}`);
  }

  /** GET /patients/:id/treatment-plans */
  getPlans(patientId: string): Observable<{ plans: TreatmentPlan[] }> {
    return this.http.get<{ plans: TreatmentPlan[] }>(`${this.base}/patients/${patientId}/treatment-plans`);
  }

  /** POST /patients/:id/treatment-plans */
  createPlan(patientId: string, title?: string): Observable<{ plan: TreatmentPlan }> {
    return this.http.post<{ plan: TreatmentPlan }>(
      `${this.base}/patients/${patientId}/treatment-plans`,
      title ? { title } : {}
    );
  }

  /** POST /treatment-plans/:id/items */
  addPlanItem(planId: string, payload: {
    service_id: string;
    tooth_numbers?: number[];
    estimated_sessions?: number;
    cost_min?: number;
    cost_max?: number;
    priority?: string;
    patient_facing_notes?: string;
    linked_diagnosis_id?: string;
  }): Observable<{ item: TreatmentPlanItem }> {
    return this.http.post<{ item: TreatmentPlanItem }>(
      `${this.base}/treatment-plans/${planId}/items`,
      payload
    );
  }

  /** PATCH /treatment-plan-items/:id */
  updatePlanItem(itemId: string, payload: {
    status: string;
    decline_reason?: PlanDeclineReason;
    patient_facing_notes?: string;
  }): Observable<{ item: TreatmentPlanItem }> {
    return this.http.patch<{ item: TreatmentPlanItem }>(
      `${this.base}/treatment-plan-items/${itemId}`,
      payload
    );
  }

  /** GET /sessions/:id/chart */
  getChart(sessionId: string): Observable<{ chart: ToothChart | null }> {
    return this.http.get<{ chart: ToothChart | null }>(`${this.base}/sessions/${sessionId}/chart`);
  }

  /** PUT /sessions/:id/chart */
  putChart(sessionId: string, chartData: Record<number, unknown>): Observable<{ chart: ToothChart }> {
    return this.http.put<{ chart: ToothChart }>(`${this.base}/sessions/${sessionId}/chart`, { chart_data: chartData });
  }

  /** GET /sessions/:id/prescriptions */
  getPrescriptions(sessionId: string): Observable<{ prescriptions: Prescription[] }> {
    return this.http.get<{ prescriptions: Prescription[] }>(
      `${this.base}/sessions/${sessionId}/prescriptions`
    );
  }

  /** POST /sessions/:id/prescriptions */
  addPrescription(sessionId: string, payload: {
    diagnosis: string;
    clinical_notes?: string;
    items: { medicine_id: number; dosage?: string; frequency?: string; duration?: string; quantity?: string; instructions?: string }[];
  }): Observable<{ prescription: Prescription }> {
    return this.http.post<{ prescription: Prescription }>(
      `${this.base}/sessions/${sessionId}/prescriptions`,
      payload
    );
  }

  /** GET /sessions/:id/investigations */
  getInvestigations(sessionId: string): Observable<{ investigations: InvestigationOrder[] }> {
    return this.http.get<{ investigations: InvestigationOrder[] }>(
      `${this.base}/sessions/${sessionId}/investigations`
    );
  }

  /** POST /sessions/:id/investigations */
  addInvestigation(sessionId: string, payload: {
    kind: InvestigationKind;
    clinical_indication: string;
    tooth_numbers?: number[];
    cbct_fov?: string;
    vendor?: string;
  }): Observable<{ investigation: InvestigationOrder }> {
    return this.http.post<{ investigation: InvestigationOrder }>(
      `${this.base}/sessions/${sessionId}/investigations`,
      payload
    );
  }

  /** PATCH /investigations/:id/receive */
  receiveInvestigation(invId: string, payload: {
    interpretation: string;
    s3_key?: string | null;
    vendor_report_id?: string;
    received_at?: string;
  }): Observable<{ investigation: InvestigationOrder }> {
    return this.http.patch<{ investigation: InvestigationOrder }>(
      `${this.base}/investigations/${invId}/receive`,
      payload
    );
  }

  /** DELETE /investigations/:id */
  cancelInvestigation(invId: string): Observable<{ cancelled: boolean }> {
    return this.http.delete<{ cancelled: boolean }>(
      `${this.base}/investigations/${invId}`
    );
  }

  /** POST /investigations/:id/sign — presigned PUT for report file */
  signInvestigationUpload(invId: string, filename: string, contentType: string): Observable<{ upload_url: string; s3_key: string }> {
    return this.http.post<{ upload_url: string; s3_key: string }>(
      `${this.base}/investigations/${invId}/sign`,
      { filename, content_type: contentType }
    );
  }

  /** GET /sessions/:id/lab-orders */
  getLabOrders(sessionId: string): Observable<{ lab_orders: LabOrder[] }> {
    return this.http.get<{ lab_orders: LabOrder[] }>(
      `${this.base}/sessions/${sessionId}/lab-orders`
    );
  }

  /** POST /services/:id/lab-orders */
  addLabOrder(serviceId: string, payload: {
    shade?: string;
    expected_delivery_date?: string;
    pickup_date?: string;
    lab_cost?: number;
    notes?: string;
    specifications?: Record<string, unknown>;
  }): Observable<{ lab_order: LabOrder }> {
    return this.http.post<{ lab_order: LabOrder }>(
      `${this.base}/services/${serviceId}/lab-orders`,
      payload
    );
  }

  /** PATCH /lab-orders/:id */
  updateLabOrder(labOrderId: string, payload: {
    status?: LabOrderStatus;
    shade?: string;
    expected_delivery_date?: string | null;
    pickup_date?: string | null;
    lab_cost?: number | null;
    trial_sessions_count?: number;
    notes?: string;
    specifications?: Record<string, unknown>;
  }): Observable<{ lab_order: LabOrder }> {
    return this.http.patch<{ lab_order: LabOrder }>(
      `${this.base}/lab-orders/${labOrderId}`,
      payload
    );
  }

  /** POST /sessions/:id/attachments/sign — request a presigned S3 PUT URL */
  signAttachment(sessionId: string, filename: string, contentType: string): Observable<{ upload_url: string; s3_key: string }> {
    return this.http.post<{ upload_url: string; s3_key: string }>(
      `${this.base}/sessions/${sessionId}/attachments/sign`,
      { filename, content_type: contentType }
    );
  }

  /** POST /sessions/:id/attachments — register after upload */
  confirmAttachment(sessionId: string, payload: { s3_key: string; filename: string; content_type: string; file_size?: number }): Observable<{ attachment: SessionAttachment }> {
    return this.http.post<{ attachment: SessionAttachment }>(
      `${this.base}/sessions/${sessionId}/attachments`,
      payload
    );
  }

  /** GET /sessions/:id/attachments */
  getAttachments(sessionId: string): Observable<{ attachments: SessionAttachment[] }> {
    return this.http.get<{ attachments: SessionAttachment[] }>(
      `${this.base}/sessions/${sessionId}/attachments`
    );
  }

  /** DELETE /sessions/:id/attachments/:attachmentId */
  deleteAttachment(sessionId: string, attachmentId: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(
      `${this.base}/sessions/${sessionId}/attachments/${attachmentId}`
    );
  }

  /** Endpoint 30 — POST /sessions/:id/end-treatment */
  endTreatment(sessionId: string, varianceReason?: string): Observable<{ session: ClinicalSession }> {
    return this.http.post<{ session: ClinicalSession }>(
      `${this.base}/sessions/${sessionId}/end-treatment`,
      varianceReason ? { variance_reason: varianceReason } : {}
    );
  }
}
