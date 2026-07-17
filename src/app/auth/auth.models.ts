export type AppRole =
  | 'super_admin'
  | 'admin'
  | 'clinic_admin'
  | 'org_admin'
  | 'manager'
  | 'doctor'
  | 'hygienist'
  | 'assistant'
  | 'reception'
  | 'receptionist'
  | 'lab_tech'
  | 'patient';
export type PermissionScope = 'own' | 'clinic' | 'org' | 'platform';

export interface ClinicRef {
  id: string;
  name: string;
}

export interface PermissionGrant {
  scope: PermissionScope;
}

export interface AuthUser {
  id: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  role?: AppRole;
  is_org_admin?: boolean;
  // Legacy single-clinic field (kept for backward compat)
  clinic_id?: string;
  // RBAC fields
  org_id?: string;
  active_clinic_id?: string;
  available_clinics?: Array<string | ClinicRef>;
  rv?: number;
}

export interface LoginRequest {
  email: string;
  password: string;
  /** Cloudflare Turnstile widget token — required only when captcha is enabled. */
  captcha_token?: string;
}

export interface AuthConfig {
  captchaProvider: string;
  captchaEnabled: boolean;
  turnstileSiteKey: string | null;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: AuthUser;
}

export interface PermissionsResponse {
  permissions: Record<string, PermissionGrant>;
  // ABAC manifest (PRD §9.1) — optional so older backends still parse.
  role?:            string;
  hierarchyLevel?:  number;
  specialtyTags?:   string[];
  branchId?:        string | null;
  actions?:         Record<string, string[]>;
  fieldVisibility?: Record<string, string[]>;
}

export type AbacAction =
  | 'read' | 'create' | 'update' | 'delete'
  | 'export' | 'seal' | 'reopen'
  | 'approve_discount'
  | 'assign' | 'transfer' | 'archive';

export type AbacResource =
  | 'session' | 'patient' | 'clinical_note' | 'examination' | 'diagnosis'
  | 'prescription' | 'charge_line' | 'payment' | 'invoice'
  | 'service_performed' | 'booking' | 'specialty_case' | 'treatment_plan'
  | 'inventory_item' | 'stock_movement' | 'lab_order';

export interface SwitchClinicResponse {
  access_token: string;
  refresh_token: string;
}

export interface StepUpResponse {
  access_token: string;
}


export interface OtpRequestResponse {
  sent: boolean;
}

export interface OtpVerifyRequest {
  phone: string;
  otp: string;
}

// MFA
export interface MfaChallengeResponse {
  mfa_required: true;
  mfa_token: string;
}

export type LoginOrMfaResponse = LoginResponse | MfaChallengeResponse;

export function isMfaChallenge(r: LoginOrMfaResponse): r is MfaChallengeResponse {
  return (r as MfaChallengeResponse).mfa_required === true;
}

export interface MfaStatusResponse  { mfa_enabled: boolean; }
export interface MfaSetupResponse   { secret: string; qr_data_url: string; already_enabled: boolean; }
export interface MfaEnableRequest   { code: string; }
export interface MfaDisableRequest  { password: string; code: string; }
