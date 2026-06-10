// Subscription plan — platform billing product catalog (PRD_07 §4.1).
// Wire format is snake_case (matches backend); used as-is in view models.

export type BillingCycle = 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

export interface SubscriptionPlan {
  id: string;
  slug: string;
  display_name: string;
  description: string | null;
  price_monthly_paise: number;
  price_yearly_paise: number | null;
  billing_cycle: BillingCycle;
  currency: string;
  gst_pct: number;
  razorpay_plan_id: string | null;
  max_staff: number | null;
  max_patients: number | null;
  max_daily_appointments: number | null;
  max_storage_gb: number | null;
  features_included: string[];
  features_excluded: string[];
  is_active: boolean;
  is_visible: boolean;
  is_custom: boolean;
  trial_days: number;
  grace_period_days: number;
  created_at: string;
  updated_at: string;
}

/** Payload for create/update (slug only sent on create). */
export interface PlanUpsert {
  slug?: string;
  display_name: string;
  description?: string | null;
  price_monthly_paise: number;
  price_yearly_paise?: number | null;
  billing_cycle: BillingCycle;
  gst_pct: number;
  max_staff?: number | null;
  max_patients?: number | null;
  max_daily_appointments?: number | null;
  max_storage_gb?: number | null;
  features_included: string[];
  is_active: boolean;
  is_visible: boolean;
  is_custom: boolean;
  trial_days: number;
  grace_period_days: number;
}

/** One clinic's current subscription, as shown in the org subscription list. */
export interface ClinicSubscriptionRow {
  clinic_id: string;
  clinic_name: string;
  tenant_status: string | null;
  subscription_id: string | null;
  status: string | null;
  amount_paise: number | null;
  total_paise: number | null;
  next_billing_date: string | null;
  plan_id: string | null;
  plan_slug: string | null;
  plan_name: string | null;
}

/** Payload to provision a new clinic on a trial. */
export interface ProvisionClinicPayload {
  clinic_name: string;
  phone: string;
  email: string;
  city?: string;
  subdomain?: string;
  owner_first_name: string;
  owner_last_name?: string;
  owner_email: string;
  owner_password: string;
  plan_id: string;
}

/** Trial / lifecycle status for the active clinic. */
export interface TenantStatus {
  tenant_status: string | null;
  trial_ends_at: string | null;
  days_remaining: number | null;
}

/** Subscription dashboard metrics. */
export interface DashboardMetrics {
  mrr_paise: number;
  billing_paise: number;
  counts: { active: number; trialing: number; suspended: number; total: number };
  expiring_soon: { clinic_id: string; clinic_name: string; days_remaining: number }[];
}

/** Per-clinic tenant detail. */
export interface TenantDetail {
  clinic: {
    id: string; name: string; subdomain: string | null; tenant_status: string;
    trial_started_at: string | null; trial_ends_at: string | null;
    activated_at: string | null; suspended_at: string | null;
    revoked_at: string | null; revoke_reason: string | null;
  };
  subscription: {
    id: string; status: string; amount_paise: number; total_paise: number;
    trial_end: string | null; next_billing_date: string | null;
    plan_name: string | null; plan_slug: string | null;
  } | null;
  usage: { staff_count: number; patient_count: number; max_staff: number | null; max_patients: number | null };
  contacts: { id: string; name: string; role_title: string | null; phone: string; email: string | null; is_primary: boolean }[];
  access_log: { action: string; from_status: string | null; to_status: string | null; reason: string | null; occurred_at: string }[];
}

/** Known feature slugs (PRD_07 §7). Drives the feature picker. */
export const PLAN_FEATURES: { slug: string; label: string }[] = [
  { slug: 'BOOKING',              label: 'Booking & scheduling' },
  { slug: 'CHARTING',             label: 'Tooth charting' },
  { slug: 'BILLING',              label: 'Clinical billing & invoicing' },
  { slug: 'PRESCRIPTIONS',        label: 'Prescriptions' },
  { slug: 'BASIC_REPORTS',        label: 'Basic reports' },
  { slug: 'SPECIALTY_MODULES',    label: 'Specialty modules' },
  { slug: 'INVENTORY',            label: 'Inventory management' },
  { slug: 'LAB_ORDERS',           label: 'Lab orders' },
  { slug: 'ADVANCED_REPORTS',     label: 'Advanced reports & analytics' },
  { slug: 'WHATSAPP_API',         label: 'WhatsApp Business API' },
  { slug: 'VOICE_AGENT',          label: 'Voice agent (AI)' },
  { slug: 'HARDWARE_INTEGRATION', label: 'Hardware integration' },
  { slug: 'MULTI_DOCTOR',         label: 'Multi-doctor support' },
  { slug: 'PRIORITY_SUPPORT',     label: 'Priority support' },
];
