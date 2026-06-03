export interface ImplantCaseDetail {
  caseId: string;
  [key: string]: unknown;
}

export interface ImplantCase {
  id: string;
  externalCaseNo: string | null;
  patientName: string;
  status: string;
  startedAt: string;
}
