export interface RxMedicine {
  id:           number;
  generic_name: string;
  brand_name:   string | null;
  category:     string;
  dosage_form:  string;
  strength:     string;
  default_dose: string | null;
  default_days: number | null;
  notes:        string | null;
}

export interface RxProcedure {
  id:             number;
  procedure_code: string;
  procedure_name: string;
  svc_id:         string;
  procedure_step: number | null;
  default_notes:  string | null;
  followup_days:  number | null;
}

export interface RxDefaults {
  medicines:  RxMedicine[];
  procedures: RxProcedure[];
}

export type ProcedureStatus = 'planned' | 'done' | 'skipped';

export interface MedFormItem extends RxMedicine {
  dosage:       string;
  frequency:    string;
  duration:     string;
  quantity:     string;
  instructions: string;
}

export interface ProcFormItem extends RxProcedure {
  status: ProcedureStatus;
}

export interface LineItemPayload {
  item_type:        'medicine' | 'procedure';
  ref_id:           number;
  sort_order:       number;
  dosage?:          string;
  frequency?:       string;
  duration?:        string;
  quantity?:        string;
  procedure_status?: ProcedureStatus;
  instructions?:    string;
}

export interface CreateRxPayload {
  patient_id:      number | string;
  appointment_id:  number | string;
  diagnosis?:      string;
  clinical_notes?: string;
  valid_days?:     number;
  refillable?:     boolean;
  items:           LineItemPayload[];
}

export interface RxSummary {
  id:              number;
  prescription_no: string;
  diagnosis:       string | null;
  pdf_generated:   boolean;
  wa_sent:         boolean;
  created_at:      string;
  valid_days:      number;
}

export interface PrescriptionContext {
  appointment_id:    number | string;
  patient_id:        number | string;
  svc_id:            string;
  patient_name:      string;
  appointment_label: string;
}
