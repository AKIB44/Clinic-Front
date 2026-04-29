export type AppRole = 'super_admin' | 'clinic_admin' | 'doctor' | 'receptionist';

export interface AuthUser {
  id: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  role?: AppRole;
  clinic_id?: string;
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
