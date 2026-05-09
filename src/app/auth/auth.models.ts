export type AppRole = 'admin' | 'doctor' | 'receptionist';
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
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: AuthUser;
}

export interface PermissionsResponse {
  permissions: Record<string, PermissionGrant>;
}

export interface SwitchClinicResponse {
  access_token: string;
  refresh_token: string;
}

export interface StepUpResponse {
  access_token: string;
}

export interface BreakGlassRequest {
  reason: string;
  durationMinutes?: number;
}

export interface BreakGlassResponse {
  access_token: string;
  session_id: string;
  expires_at: string;
}

export interface OtpRequestResponse {
  sent: boolean;
}

export interface OtpVerifyRequest {
  phone: string;
  otp: string;
}
