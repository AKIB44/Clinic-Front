import { AppRole } from '../auth/auth.models';

export interface Clinic {
  id: string;
  name: string;
  address: string;
  city: string;
  state?: string;
  phone: string;
  email: string;
  logo_s3_key?: string | null;
  logo_url?: string | null;
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
  doctor_id?: string | null;
  doctor_name?: string | null;
}

export interface Chair {
  id: string;
  clinic_id: string;
  name: string;
  is_active: boolean;
  operational_status: 'operational' | 'under_service' | 'out_of_order';
  service_interval_days: number;
  last_serviced_at: string | null;
  next_service_due: string | null;
  service_status: 'ok' | 'due_soon' | 'overdue' | 'no_schedule';
  created_at: string;
}

export interface ChairServiceLog {
  id: string;
  chair_id: string;
  chair_name?: string;
  clinic_id: string;
  service_type: string;
  serviced_at: string;
  serviced_by: string | null;
  notes: string | null;
  cost: number | null;
  next_due_date: string | null;
  created_at: string;
}

export interface LogServicePayload {
  service_type: string;
  serviced_at: string;
  serviced_by?: string;
  notes?: string;
  cost?: number | null;
  operational_status?: string;
  next_due_date?: string;
}

export interface StaffUser {
  id: string;
  clinic_id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: AppRole;
  designation?: string | null;
  is_active: boolean;
  created_at?: string;
}
