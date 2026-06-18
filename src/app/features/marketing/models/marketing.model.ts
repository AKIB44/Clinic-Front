// Marketing module — wire models (PRD_MARKETING_STRATEGY_MODULE).
// Wire format is snake_case (matches backend); used as-is in view models.
// Money is in paise (INT), per the codebase convention.

export type CampaignGoal    = 'bookings' | 'awareness' | 'lead_gen';
export type CampaignChannel = 'whatsapp' | 'instagram' | 'facebook' | 'offline';
export type CampaignStatus  = 'draft' | 'scheduled' | 'active' | 'completed' | 'archived';

export interface Campaign {
  id: string;
  org_id: string;
  clinic_id: string;
  name: string;
  goal: CampaignGoal;
  channel: CampaignChannel;
  status: CampaignStatus;
  budget_paise: number;
  start_date: string | null;
  end_date: string | null;
  promo_code_id: string | null;
  segment_id: string | null;
  wa_template_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Create/update payload (all optional fields omitted when empty). */
export interface CampaignUpsert {
  name: string;
  goal: CampaignGoal;
  channel: CampaignChannel;
  status?: CampaignStatus;
  budget_paise: number;
  start_date?: string | null;
  end_date?: string | null;
  promo_code_id?: string | null;
  segment_id?: string | null;
  wa_template_id?: string | null;
}

export interface CampaignPerformance {
  campaign_id: string;
  sends: number;
  clicks: number;
  bookings: number;
  revenue: number;
  conversion_rate: number;
  roi: number;
}

export type CalendarChannel = 'instagram' | 'facebook' | 'whatsapp_status' | 'other';
export type CalendarStatus  = 'draft' | 'scheduled' | 'posted' | 'cancelled';

export interface CalendarEntry {
  id: string;
  org_id: string;
  clinic_id: string;
  campaign_id: string | null;
  channel: CalendarChannel;
  title: string;
  caption: string | null;
  media_url: string | null;
  scheduled_for: string | null;
  status: CalendarStatus;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalendarUpsert {
  campaign_id?: string | null;
  channel: CalendarChannel;
  title: string;
  caption?: string | null;
  media_url?: string | null;
  scheduled_for?: string | null;
  status?: CalendarStatus;
  owner_id?: string | null;
}

export interface MarketingDashboardData {
  mrr: number;
  marketing_spend_mtd_paise: number;
  pipeline_count: number;
  active_campaign_count: number;
  active_budget_paise: number;
  scheduled_posts: number;
  // v2 tiles — populated as the caller / calendar-sync phases land.
  pending_callbacks: number;
  scheduled_calls_today: number;
  wa_reach_last_broadcast: number;
  team_today: { user_id: string; user_name: string; task_title: string; status: string }[];
  campaign_conversions: { campaign_id: string; name: string; clicks: number; bookings: number }[];
}

// ── v2 pipeline lead (PRD_MARKETING_STRATEGY_MODULE_V2 §6.2) ──────────────────
export type LeadStage =
  | 'new' | 'marketing_qualified' | 'routed_to_caller' | 'called'
  | 'demo_scheduled' | 'trial' | 'onboarded' | 'lost';
export type LeadSource = 'manual' | 'digital' | 'referral';
export type LeadDisposition = 'accepted' | 'rejected' | 'pending';

export interface PipelineLead {
  id: string;
  org_id: string;
  clinic_id: string;
  clinic_name: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  city: string | null;
  stage: LeadStage;
  source: LeadSource;
  utm_campaign: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  final_disposition: LeadDisposition | null;
  is_active_subscriber: boolean;
  subscriber_checked_at: string | null;
  assigned_caller_id: string | null;
  notes: string | null;
  next_followup: string | null;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadUpsert {
  clinic_name: string;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  city?: string | null;
  stage?: LeadStage;
  source?: LeadSource;
  notes?: string | null;
  next_followup?: string | null;
  final_disposition?: LeadDisposition | null;
}

// ── v2 feedback & acceptance ratio (PRD §6.13–6.15, §5.4) ─────────────────────
export type Disposition =
  | 'interested' | 'price_concern' | 'data_privacy' | 'timing'
  | 'competitor' | 'features' | 'trust' | 'no_decision_maker' | 'other';
export type RejectionReason = Exclude<Disposition, 'interested'>;
export type Sentiment = 'positive' | 'neutral' | 'negative';

/** Fixed rejection-reason taxonomy with display labels (PRD §5.4). */
export const REJECTION_REASON_LABELS: Record<RejectionReason, string> = {
  price_concern: 'Price too high / budget',
  data_privacy: 'Patient-data privacy',
  timing: 'Not ready / contract ongoing',
  competitor: 'Using a competitor',
  features: 'Missing features',
  trust: 'Trust / brand credibility',
  no_decision_maker: 'No decision maker reached',
  other: 'Other',
};

export const DISPOSITION_LABELS: Record<Disposition, string> = {
  interested: 'Interested',
  ...REJECTION_REASON_LABELS,
};

export interface LeadFeedback {
  id: string;
  lead_id: string;
  author_id: string;
  first_name: string | null;
  last_name: string | null;
  feedback_text: string;
  disposition: Disposition;
  rejection_reason: RejectionReason | null;
  rejection_notes: string | null;
  created_at: string;
}

export interface LeadFeedbackUpsert {
  feedback_text: string;
  disposition: Disposition;
  rejection_reason?: RejectionReason | null;
  rejection_notes?: string | null;
}

export interface CallerFeedback {
  id: string;
  lead_id: string;
  call_log_id: string | null;
  caller_id: string;
  first_name: string | null;
  last_name: string | null;
  sentiment: Sentiment;
  feedback_text: string;
  key_objection: RejectionReason | null;
  follow_up_needed: boolean;
  created_at: string;
}

export interface CallerFeedbackUpsert {
  call_log_id?: string | null;
  sentiment: Sentiment;
  feedback_text: string;
  key_objection?: RejectionReason | null;
  follow_up_needed: boolean;
}

export interface AcceptanceRatioData {
  total: number;
  accepted: number;
  rejected: number;
  pending: number;
  ratio: number;
  breakdown_by_reason: { reason: RejectionReason; count: number }[];
}

// ── v2 caller workflow (PRD §6.14, §7.6) ─────────────────────────────────────
export type CallOutcome =
  | 'reached_interested' | 'reached_not_interested' | 'reached_callback'
  | 'not_reached_busy' | 'not_reached_no_answer' | 'not_reached_switched_off';

export const CALL_OUTCOME_LABELS: Record<CallOutcome, string> = {
  reached_interested: 'Reached — interested',
  reached_not_interested: 'Reached — not interested',
  reached_callback: 'Reached — call back later',
  not_reached_busy: 'Not reached — busy',
  not_reached_no_answer: 'Not reached — no answer',
  not_reached_switched_off: 'Not reached — switched off',
};

export interface CallLog {
  id: string;
  lead_id: string;
  caller_id: string;
  first_name: string | null;
  last_name: string | null;
  called_at: string;
  duration_secs: number | null;
  outcome: CallOutcome;
  notes: string | null;
  attempt_number: number;
}

export interface CallLogUpsert {
  lead_id: string;
  outcome: CallOutcome;
  notes?: string | null;
  duration_secs?: number | null;
  // Required when outcome = 'reached_callback'.
  callback_scheduled_for?: string | null;
  callback_notes?: string | null;
}

/** A pipeline lead enriched with call-queue metadata for the caller view. */
export interface CallerQueueEntry extends PipelineLead {
  last_call_outcome: CallOutcome | null;
  call_attempt_count: number;
  next_callback_at: string | null;
}

// ── v2 callbacks (PRD §6.16, §7.7) ───────────────────────────────────────────
export type CallbackStatus = 'pending' | 'called' | 'rescheduled' | 'cancelled';

export interface Callback {
  id: string;
  lead_id: string;
  call_log_id: string | null;
  caller_id: string;
  scheduled_for: string;
  status: CallbackStatus;
  notes: string | null;
  // joined from the lead for queue display
  clinic_name?: string;
  contact_name?: string | null;
  contact_phone?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CallbackUpsert {
  lead_id: string;
  call_log_id?: string | null;
  scheduled_for: string;
  notes?: string | null;
}

// ── v2 digital enquiries (PRD §6.17, §7.9) ───────────────────────────────────
export type EnquirySource = 'website' | 'referral' | 'social';

export interface DigitalEnquiry {
  id: string;
  source: EnquirySource;
  utm_campaign: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  clinic_name: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  message: string | null;
  lead_id: string | null;
  is_duplicate: boolean;
  received_at: string;
}

export interface IngestKey {
  id: string;
  api_key: string;
  label: string | null;
  active: boolean;
  created_at: string;
}

// ── v2 scheduled calls / calendar sync (PRD §6.18, §7.10) ────────────────────
export type ScheduledCallStatus = 'upcoming' | 'completed' | 'no_show' | 'rescheduled';
export type CallSyncStatus = 'pending' | 'synced' | 'error';

export interface ScheduledCall {
  id: string;
  lead_id: string | null;
  assigned_to_id: string | null;
  first_name: string | null;
  last_name: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  clinic_name: string | null;
  scheduled_for: string;
  duration_minutes: number;
  google_event_id: string | null;
  google_meet_link: string | null;
  sync_status: CallSyncStatus;
  status: ScheduledCallStatus;
  post_call_notes: string | null;
}

export interface ScheduledCallUpsert {
  lead_id?: string | null;
  assigned_to_id?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  clinic_name?: string | null;
  scheduled_for: string;
  duration_minutes?: number;
}

export interface CallSlot {
  id: string;
  assigned_to_id: string | null;
  slot_start: string;
  slot_end: string;
  slot_token: string;
  is_booked: boolean;
}

export interface SlotsGenerate {
  from: string;
  to: string;
  slot_duration_minutes?: number;
  assigned_to_id?: string | null;
  daily_start_hour?: number;
  daily_end_hour?: number;
}

export interface CalendarConnectStatus {
  enabled: boolean;
  connected: boolean;
}

// ── v2 structured expenses (PRD §6.19, §7.12) ────────────────────────────────
export type ExpenseCategory =
  | 'ad_spend' | 'events' | 'printing' | 'travel'
  | 'tools_subscriptions' | 'caller_incentives' | 'other';
export type PaymentMode = 'upi' | 'card' | 'cash' | 'bank_transfer';

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  ad_spend: 'Ad spend',
  events: 'Events',
  printing: 'Printing',
  travel: 'Travel',
  tools_subscriptions: 'Tools & subscriptions',
  caller_incentives: 'Caller incentives',
  other: 'Other',
};

export interface MarketingExpense {
  id: string;
  category: ExpenseCategory;
  vendor: string | null;
  description: string | null;
  amount_paise: number;
  spent_on: string;
  campaign_id: string | null;
  campaign_name: string | null;
  lead_id: string | null;
  payment_mode: PaymentMode | null;
  notes: string | null;
  has_receipt: boolean;
  created_at: string;
}

export interface ExpenseSummary {
  month: string;
  this_month_paise: number;
  last_month_paise: number;
  delta_paise: number;
  by_category: { category: ExpenseCategory; total_paise: number; count: number }[];
}

// ── Lead Finder (Google Maps discovery → screen → import) ────────────────────
export type ScrapedLeadStatus =
  | 'passed' | 'no_phone' | 'invalid_phone' | 'duplicate' | 'imported' | 'rejected';
export type LeadProvider = 'places' | 'scrape' | 'mock';

export const SCRAPED_STATUS_LABELS: Record<ScrapedLeadStatus, string> = {
  passed: 'Ready',
  no_phone: 'No phone',
  invalid_phone: 'Bad phone',
  duplicate: 'Duplicate',
  imported: 'Imported',
  rejected: 'Rejected',
};

export interface ScrapedLead {
  id: string;
  search_query: string | null;
  search_city: string | null;
  provider: LeadProvider;
  name: string;
  address: string | null;
  phone_raw: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  category: string | null;
  place_id: string | null;
  enriched: boolean;
  status: ScrapedLeadStatus;
  reject_reason: string | null;
  lead_id: string | null;
  created_at: string;
}

export interface LeadFinderLimits {
  daily_search_cap: number;
  daily_call_cap: number;
  cooldown_sec: number;
  cache_ttl_hours: number;
}

export interface LeadFinderProviderStatus {
  scraper_available: boolean;
  places_enabled: boolean;
  active_provider: LeadProvider;
  limits: LeadFinderLimits;
}

export interface LeadFinderUsage {
  date: string;
  searches_used: number;
  api_calls_used: number;
  searches_remaining: number;
  calls_remaining: number;
  last_search_at: string | null;
  limits: LeadFinderLimits;
}

// ── v2 audience segments (PRD §5.3) ──────────────────────────────────────────
export interface SegmentFilter {
  city?: string | null;
  gender?: 'male' | 'female' | 'other' | null;
  has_email?: boolean;
  min_visits?: number | null;
  last_visit_before?: string | null;
  last_visit_after?: string | null;
}

export interface Segment {
  id: string;
  name: string;
  filter_json: SegmentFilter;
  guest_count: number;
  created_at: string;
}

export interface SegmentPreview {
  count: number;
  sample: { id: string; name: string; phone: string; email: string | null; visits: number; last_visit: string | null }[];
}

// ── v2 promo codes (PRD §5.4) ────────────────────────────────────────────────
export type DiscountType = 'percent' | 'flat';

export interface PromoCode {
  id: string;
  code: string;
  discount_type: DiscountType;
  discount_value: number;
  applies_to: string | null;
  max_redemptions: number | null;
  redeemed_count: number;
  valid_from: string | null;
  valid_until: string | null;
  active: boolean;
  created_at: string;
}

export interface PromoUpsert {
  code?: string;
  discount_type?: DiscountType;
  discount_value?: number;
  applies_to?: string | null;
  max_redemptions?: number | null;
  valid_from?: string | null;
  valid_until?: string | null;
  active?: boolean;
}

export interface PromoRedemption {
  id: string;
  patient_id: string | null;
  patient_name: string | null;
  reference: string | null;
  discount_paise: number | null;
  redeemed_at: string;
}

export interface CampaignSendResult {
  recipients: number;
  sent: number;
  failed: number;
  provider: string;
  dispatched: boolean;
  message: string;
}

// ── v2 onboarding, timeline & pitch (PRD §5.7–5.8, §10.2) ────────────────────
export type OnboardingStatus = 'pending' | 'in_progress' | 'done';

export interface OnboardingStep {
  id: string;
  lead_id: string;
  step_name: string;
  step_order: number;
  owner_id: string | null;
  first_name: string | null;
  last_name: string | null;
  status: OnboardingStatus;
  due_date: string | null;
  completed_at: string | null;
}

export interface TimelineEvent {
  type: 'marketing_feedback' | 'caller_feedback' | 'call' | 'callback' | 'scheduled_call';
  at: string;
  actor: string | null;
  label: string | null;
  detail: string | null;
}

export interface PitchDocument {
  id: string;
  title: string;
  version: string;
  content_type: string | null;
  generated: boolean;
  lead_id: string | null;
  lead_name: string | null;
  has_file: boolean;
  created_at: string;
}

export interface CallerOption {
  id: string;
  first_name: string;
  last_name: string;
}

export interface ActiveSubscriberCheck {
  is_active: boolean;
  subscriber_since?: string | null;
  plan?: string | null;
}
