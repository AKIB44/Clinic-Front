export interface EndoCaseDetail {
  caseId: string;
  [key: string]: unknown;
}

export interface EndoCase {
  id: string;
  externalCaseNo: string | null;
  patientName: string;
  status: string;
  startedAt: string;
}
