export interface PaedoCaseDetail {
  caseId: string;
  [key: string]: unknown;
}

export interface PaedoCase {
  id: string;
  externalCaseNo: string | null;
  patientName: string;
  status: string;
  startedAt: string;
}
