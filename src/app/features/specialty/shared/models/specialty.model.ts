export type CaseType = 'ORTHO' | 'IMPLANT' | 'PAEDO' | 'ENDO' | 'TMJ';

export type CaseStatus = 'ACTIVE' | 'PAUSED' | 'TRANSFERRED' | 'ABANDONED' | 'COMPLETED';

export type MilestoneKind =
  | 'CASE_OPENED'
  | 'CASE_PAUSED'
  | 'CASE_RESUMED'
  | 'CASE_COMPLETED'
  | 'CASE_TRANSFERRED'
  | 'CASE_ABANDONED'
  | 'VISIT_COMPLETED'
  | 'CLINICAL_NOTE'
  | 'PHOTO_SERIES'
  | 'STUDY_MODEL'
  | 'CONSENT_OBTAINED'
  | 'APPLIANCE_FITTED'
  | 'APPLIANCE_ADJUSTED'
  | 'APPLIANCE_REMOVED'
  | 'IMPLANT_PLACED'
  | 'IMPLANT_UNCOVERED'
  | 'CROWN_FITTED'
  | 'CUSTOM';

export interface SpecialtyCase {
  id: string;
  org_id: string;
  clinic_id: string;
  patient_id: string;
  case_type: CaseType;
  status: CaseStatus;
  primary_doctor_id: string;
  doctor_name?: string | null;
  treatment_plan_id: string | null;
  started_at: string;
  completed_at: string | null;
  expected_duration_months: number | null;
  case_summary: string | null;
  external_case_no: string | null;
  visit_count?: number;
  milestone_count?: number;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
  deleted_at: string | null;
}

export interface SpecialtyVisit {
  id: string;
  org_id: string;
  clinic_id: string;
  case_id: string;
  session_id: string | null;
  session_date?: string | null;
  doctor_name?: string | null;
  visit_number: number;
  visit_type: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
  deleted_at: string | null;
}

export interface SpecialtyMilestone {
  id: string;
  org_id: string;
  clinic_id: string;
  case_id: string;
  visit_id: string | null;
  kind: MilestoneKind;
  occurred_at: string;
  title: string;
  details: Record<string, unknown>;
  created_by_name?: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
  deleted_at: string | null;
}

export interface SpecialtyCaseDetail {
  case: SpecialtyCase;
  visits: SpecialtyVisit[];
  milestones: SpecialtyMilestone[];
}

export interface CreateCasePayload {
  patient_id: string;
  case_type: CaseType;
  primary_doctor_id?: string;
  treatment_plan_id?: string | null;
  started_at?: string;
  expected_duration_months?: number | null;
  case_summary?: string | null;
  external_case_no?: string | null;
}

export interface AddMilestonePayload {
  kind: MilestoneKind | string;
  title: string;
  occurred_at?: string;
  details?: Record<string, unknown>;
  visit_id?: string | null;
}
