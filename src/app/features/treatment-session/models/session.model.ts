// Branded ID types — prevent passing the wrong UUID type
export type SessionId     = string & { readonly __brand: 'SessionId' };
export type AppointmentId = string & { readonly __brand: 'AppointmentId' };
export type PatientId     = string & { readonly __brand: 'PatientId' };
export type StaffId       = string & { readonly __brand: 'StaffId' };
export type ServiceId     = string & { readonly __brand: 'ServiceId' };
export type NoteId        = string & { readonly __brand: 'NoteId' };

export type SessionStatus =
  | 'INITIALISED'
  | 'EXAMINING'
  | 'CHARTING'
  | 'DIAGNOSING'
  | 'ORDERING_INVESTIGATIONS'
  | 'PERFORMING_SERVICES'
  | 'PAUSED'
  | 'COMPLETED'
  | 'ABANDONED';

export type ServiceStatus = 'IN_PROGRESS' | 'COMPLETED' | 'PARTIAL' | 'ABANDONED';

// ── API wire format — matches PostgreSQL column names (snake_case) ─────────────
// This follows the same convention used throughout the app (see Appointment interface).

export interface ClinicalSession {
  id: SessionId;
  appointment_id: AppointmentId;
  patient_id: PatientId;
  primary_doctor_id: StaffId;
  status: SessionStatus;
  started_at: string;
  ended_at: string | null;
  end_reason: string | null;
  sealed_at: string | null;
  sealed_by: StaffId | null;
  variance_reason: string | null;
  patient_ack_at: string | null;
  created_at: string;
  updated_at: string;
  paused_at?: string | null;
  total_paused_ms?: number;
  // joined fields from the hydration query
  patient_name?: string;
  patient_phone?: string;
  patient_age?: number | null;
  patient_gender?: string | null;
  patient_clinical_history?: string | null;
  scheduled_at?: string;
  appointment_status?: string;
  doctor_first_name?: string;
  doctor_last_name?: string;
}

export interface ClinicalNote {
  id: NoteId;
  session_id: SessionId;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  addenda: NoteAddendum[];
  updated_at: string;
}

export interface NoteAddendum {
  text: string;
  author_id: StaffId;
  timestamp: string;
  reason: string;
}

// ── In-memory view models (camelCase) used only inside the store/components ───

export interface PatientContext {
  id: PatientId;
  name: string;
  phone: string;
  age: number | null;
  gender: string | null;
  clinicalHistory: string | null;
}

// snake_case — matches API wire format
export interface Examination {
  id?: string;
  session_id?: string;
  chief_complaint: string;
  pain_score: number | null;
  pain_site: string | null;
  pain_trigger: string | null;
  intraoral_findings: Record<string, unknown>;
  extraoral_findings: Record<string, unknown>;
  soft_tissue_findings: Record<string, unknown>;
  occlusion_notes: string | null;
}

export interface Diagnosis {
  id: string;
  session_id: string;
  diagnosis_text: string;
  icd10_code: string | null;
  tooth_numbers: number[];
  kind: 'provisional' | 'differential' | 'final';
  created_at?: string;
}

export interface ServicePerformed {
  id: ServiceId;
  session_id: SessionId;
  catalog_item_id: string;
  catalogItemName?: string;
  tooth_numbers: number[];
  quantity: number;
  performed_by: StaffId;
  base_price: number;
  discount_pct: number;
  discount_flat: number;
  discount_reason: string | null;
  final_charge: number;
  gst_applicable: boolean;
  status: ServiceStatus;
  abandon_reason: string | null;
  notes: string | null;
  requiresConsent?: boolean;
  service_name?: string;
}

// ── Treatment Plan (T2.4) ─────────────────────────────────────────────────────

export type PlanPriority = 'urgent' | 'recommended' | 'optional' | 'cosmetic';
export type PlanItemStatus = 'PROPOSED' | 'ACCEPTED' | 'DECLINED' | 'IN_PROGRESS' | 'DONE' | 'PARTIAL' | 'CANCELLED';
export type PlanDeclineReason = 'cost' | 'time' | 'fear' | 'second_opinion' | 'medical';

export interface TreatmentPlanItem {
  id: string;
  plan_id: string;
  service_id: string;
  service_name?: string;
  linked_diagnosis_id: string | null;
  tooth_numbers: number[];
  estimated_sessions: number;
  done_sessions: number;
  cost_min: number | null;
  cost_max: number | null;
  priority: PlanPriority;
  status: PlanItemStatus;
  decline_reason: PlanDeclineReason | null;
  patient_facing_notes: string | null;
  created_at: string;
}

export interface TreatmentPlan {
  id: string;
  patient_id: string;
  title: string;
  items: TreatmentPlanItem[];
  created_at: string;
}

// ── Tooth Chart (T2.1) ────────────────────────────────────────────────────────

export type ToothCondition =
  | 'healthy'
  | 'caries'
  | 'filled'
  | 'missing'
  | 'cracked'
  | 'root_canal'
  | 'crown'
  | 'bridge'
  | 'implant'
  | 'impacted'
  | 'watch';

export type ToothSurface = 'mesial' | 'distal' | 'buccal' | 'lingual' | 'occlusal' | 'incisal';

export interface ToothData {
  condition: ToothCondition;
  surfaces: ToothSurface[];
  mobility: 0 | 1 | 2 | 3 | null;
  notes: string;
}

export interface ToothChart {
  id?: string;
  session_id?: string;
  chart_data: Record<number, ToothData>;
  updated_at?: string;
}

export function emptyToothData(): ToothData {
  return { condition: 'healthy', surfaces: [], mobility: null, notes: '' };
}

// ── Prescriptions (T2.5) ─────────────────────────────────────────────────────

export interface RxLineItem {
  id: number;
  medicine_id: number;
  medicine_name: string;
  generic_name: string;
  dosage_form: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  quantity: string | null;
  instructions: string | null;
}

export interface Prescription {
  id: string;
  prescription_no: string;
  indication: string;     // mapped from DB column `diagnosis`
  instructions: string | null;
  items: RxLineItem[];
  created_at: string;
  pdf_generated: boolean;
}

// ── Investigations (T3.1) ────────────────────────────────────────────────────

export type InvestigationStatus = 'ORDERED' | 'RECEIVED' | 'READ' | 'CANCELLED';

export type InvestigationKind =
  | 'iopa' | 'opg' | 'cbct' | 'ceph' | 'bitewing' | 'occlusal'
  | 'intraoral_photo' | 'intraoral_scan'
  | 'lab_cbc' | 'lab_rbs' | 'lab_fbs' | 'lab_hba1c' | 'lab_bt_ct' | 'lab_inr'
  | 'biopsy_incisional' | 'biopsy_excisional' | 'cytology';

export interface InvestigationOrder {
  id: string;
  session_id: string;
  clinic_id: string;
  ordered_by: string;
  kind: InvestigationKind;
  tooth_numbers: number[] | null;
  cbct_fov: 'small' | 'medium' | 'large' | null;
  vendor: string | null;
  clinical_indication: string;
  status: InvestigationStatus;
  s3_key: string | null;
  url: string | null;
  interpretation: string | null;
  received_at: string | null;
  vendor_report_id: string | null;
  created_at: string;
  updated_at: string;
}

// ── Inventory / Materials Cart (T4.x) ────────────────────────────────────────

export type CartItemState = 'RESERVED' | 'COMMITTED' | 'RETURNED' | 'WASTED';

export interface InventoryItem {
  id: string;
  name: string;
  generic_name: string | null;
  category: string;
  unit: string;
  is_traceable: boolean;
  is_implant: boolean;
  reorder_point: number;
  reorder_quantity: number;
}

export interface InventoryBatch {
  id: string;
  lot_number: string | null;
  expiry_date: string | null;
  unit: string;
  supplier: string | null;
  received_at: string;
  qty_on_hand: number;
}

export interface MaterialConsumption {
  id: string;
  session_id: string;
  service_id: string;
  clinic_id: string;
  inventory_item_id: string;
  batch_id: string | null;
  quantity: number;
  unit: string;
  lot_number: string | null;
  expiry_date: string | null;
  scanned: boolean;
  state: CartItemState;
  return_reason: string | null;
  waste_reason: string | null;
  // joined from inventory_item
  item_name: string;
  item_category: string;
  is_implant: boolean;
  is_traceable: boolean;
  created_at: string;
  updated_at: string;
}

// ── Lab Orders (T3.3) ────────────────────────────────────────────────────────

export type LabOrderStatus =
  | 'created' | 'picked_up' | 'in_progress'
  | 'delivered' | 'trial_returned' | 'completed' | 'cancelled';

export interface LabOrder {
  id: string;
  session_id: string;
  service_id: string;
  clinic_id: string;
  created_by: string;
  shade: string | null;
  specifications: Record<string, unknown>;
  pickup_date: string | null;
  expected_delivery_date: string | null;
  lab_cost: number | null;
  status: LabOrderStatus;
  trial_sessions_count: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ── Surgical Gating (T5) ─────────────────────────────────────────────────────

export interface ConsentTemplate {
  id: string;
  procedure_type: string;
  title: string;
  body_html: string;
  version: number;
}

export interface ConsentRecord {
  id: string;
  session_id: string;
  patient_id: string;
  template_id: string | null;
  template_title: string | null;
  template_body: string | null;
  procedure_type: string;
  service_id: string | null;
  patient_signature_url: string;
  witness_signature_url: string | null;
  signature_hash: string | null;
  is_minor: boolean;
  guardian_name: string | null;
  signed_at: string;
  notes: string | null;
}

export interface PreopRecord {
  id: string;
  session_id: string;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  pulse: number | null;
  spo2: number | null;
  temperature: number | null;
  blood_sugar: number | null;
  inr_value: number | null;
  allergies_confirmed_at: string | null;
  medical_clearance_url: string | null;
  antibiotic_prophylaxis_given: boolean;
  antibiotic_drug: string | null;
  antibiotic_dose: string | null;
  antibiotic_given_at: string | null;
  npo_hours: number | null;
  anaesthesia_plan: 'local' | 'sedation' | 'ga';
  anaesthesia_agent: string | null;
  anaesthesia_dose: string | null;
  surgical_site_marked: boolean;
  override_reason: string | null;
  is_complete: boolean;
  notes: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PostopComplication {
  type: string;
  severity: 'mild' | 'moderate' | 'severe';
  action_taken: string;
}

export interface RecoveryVital {
  time: string;
  bp_sys: number | null;
  bp_dia: number | null;
  pulse: number | null;
  spo2: number | null;
}

export interface PostopRecord {
  id: string;
  session_id: string;
  complications: PostopComplication[];
  suture_count: number | null;
  suture_type: 'resorbable' | 'non-resorbable' | null;
  suture_removal_date: string | null;
  specimen_sent: boolean;
  specimen_lab_id: string | null;
  specimen_request_slip_no: string | null;
  specimen_expected_report_date: string | null;
  recovery_vitals: RecoveryVital[];
  postop_instructions_given: boolean;
  postop_instructions_text: string | null;
  patient_acknowledged_at: string | null;
  follow_up_date: string | null;
  follow_up_notes: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ── Attachments (T2.6) ───────────────────────────────────────────────────────

export interface SessionAttachment {
  id: string;
  session_id: string;
  clinic_id: string;
  uploaded_by: string;
  s3_key: string;
  filename: string;
  content_type: string;
  file_size: number | null;
  created_at: string;
  url: string; // presigned GET URL, refreshed on each list call
}

export interface ValidationFailure {
  block: string;
  message: string;
  blockId?: string;
}

// ── TPA / Insurance (T6.6) ───────────────────────────────────────────────────

export type TpaStatus = 'PENDING' | 'APPROVED' | 'PARTIALLY_APPROVED' | 'REJECTED' | 'CANCELLED';

export interface TpaPreauth {
  id: string;
  session_id: string;
  insurer_name: string;
  policy_number: string | null;
  preauth_number: string | null;
  approved_amount: number | null;
  approved_services: unknown[];
  copay_pct: number;
  copay_flat: number;
  status: TpaStatus;
  submitted_at: string | null;
  responded_at: string | null;
  rejection_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ── Variance info (T6.4) ─────────────────────────────────────────────────────

export interface VarianceInfo {
  final_total: number;
  accepted_estimate: number;
  variance_flag: boolean;
  threshold_pct: number;
}

export function emptyNote(): ClinicalNote {
  return {
    id: '' as NoteId,
    session_id: '' as SessionId,
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
    addenda: [],
    updated_at: '',
  };
}

export function emptyExamination(): Examination {
  return {
    chief_complaint: '',
    pain_score: null,
    pain_site: null,
    pain_trigger: null,
    intraoral_findings: {},
    extraoral_findings: {},
    soft_tissue_findings: {},
    occlusion_notes: null,
  };
}
