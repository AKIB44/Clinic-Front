export interface RxMedicine {
  id:          number;
  genericName: string;
  brandName:   string | null;
  category:    string;
  dosageForm:  string;
  strength:    string;
  defaultDose: string | null;
  defaultDays: number | null;
  notes:       string | null;
}

export interface RxProcedure {
  id:            number;
  procedureCode: string;
  procedureName: string;
  svcId:         string;
  procedureStep: number | null;
  defaultNotes:  string | null;
  followupDays:  number | null;
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
  itemType:         'medicine' | 'procedure';
  refId:            number;
  sortOrder:        number;
  dosage?:          string;
  frequency?:       string;
  duration?:        string;
  quantity?:        string;
  procedureStatus?: ProcedureStatus;
  instructions?:    string;
}

export interface CreateRxPayload {
  patientId:      number | string;
  appointmentId:  number | string;
  diagnosis?:     string;
  clinicalNotes?: string;
  validDays?:     number;
  refillable?:    boolean;
  items:          LineItemPayload[];
}

export interface RxSummary {
  id:             number;
  prescriptionNo: string;
  diagnosis:      string | null;
  pdfGenerated:   boolean;
  waSent:         boolean;
  createdAt:      string;
  validDays:      number;
}

export interface PrescriptionContext {
  appointmentId:    number | string;
  patientId:        number | string;
  svcId:            string;
  patientName:      string;
  appointmentLabel: string;
}
