import { AppRole } from '../auth/auth.models';

export interface Clinic {
  id: string;
  name: string;
  address: string;
  city: string;
  state?: string;
  phone: string;
  email: string;
  logo_url?: string;
  is_active: boolean;
  created_at?: string;
}

export interface ClinicService {
  id: string;
  clinic_id: string;
  name: string;
  duration_minutes: number;
  price: number;
  is_active: boolean;
  description?: string;
}

export interface Chair {
  id: string;
  clinic_id: string;
  name: string;
  is_active: boolean;
}

export interface StaffUser {
  id: string;
  clinic_id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: AppRole;
  is_active: boolean;
  created_at?: string;
}
