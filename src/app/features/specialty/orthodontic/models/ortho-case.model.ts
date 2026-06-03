export type OrthoPhase =
  | 'RECORDS' | 'TREATMENT_PLANNING' | 'BOND_UP' | 'LEVELING_ALIGNING'
  | 'WORKING' | 'FINISHING' | 'DEBOND' | 'RETENTION' | 'RETENTION_REVIEW';

export type OrthoApplianceType =
  | 'METAL_BRACES' | 'CERAMIC_BRACES' | 'SELF_LIGATING' | 'CLEAR_ALIGNERS' | 'COMBINATION';

export interface OrthoCaseDetail {
  caseId: string;
  applianceType: OrthoApplianceType;
  currentPhase: OrthoPhase;
  slotSize: string | null;
  angleClassMolar: string | null;
  angleClassCanine: string | null;
  overjetMm: number | null;
  overbitemm: number | null;
  openBite: boolean;
  crowdingUpperMm: number | null;
  crowdingLowerMm: number | null;
  spacingUpperMm: number | null;
  spacingLowerMm: number | null;
  extractionPlan: number[] | null;
  expectedDurationMonths: number | null;
  treatmentObjectives: string | null;
}

export interface OrthoCase {
  id: string;
  externalCaseNo: string | null;
  patientName: string;
  patientId: string;
  status: string;
  startedAt: string;
  caseDetail: OrthoCaseDetail;
}

export interface OrthoArchwireLog {
  id: string;
  caseId: string;
  visitId: string | null;
  arch: 'UPPER' | 'LOWER';
  wireDescription: string;
  placedAt: string;
  removedAt: string | null;
  notes: string | null;
}

export interface OrthoRetentionPlan {
  caseId: string;
  fixedUpper: boolean;
  fixedLower: boolean;
  removableType: string | null;
  wearSchedule: string | null;
  recallCadenceMonths: number;
  retentionStartedAt: string | null;
}

export interface OrthoComplianceRecord {
  id: string;
  caseId: string;
  source: string;
  reportingPeriodStart: string;
  reportingPeriodEnd: string;
  alignerHoursPerDayAvg: number | null;
  elasticCompliance: string | null;
  ohScore: number | null;
}

export interface OrthoAlignerTrayLog {
  id: string;
  caseId: string;
  trayNumber: number;
  arch: string;
  prescribedAt: string;
  expectedCompletedAt: string | null;
  actualCompletedAt: string | null;
}
