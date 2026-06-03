export interface TmjCaseDetail {
  caseId: string;
  [key: string]: unknown;
}

export interface TmjCase {
  id: string;
  externalCaseNo: string | null;
  patientName: string;
  status: string;
  startedAt: string;
}
