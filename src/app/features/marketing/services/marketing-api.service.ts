import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { authApiConfig } from '../../../auth/auth.config';
import {
  Campaign, CampaignUpsert, CampaignPerformance,
  CalendarEntry, CalendarUpsert, CalendarStatus,
  MarketingDashboardData,
  PipelineLead, LeadUpsert, LeadStage,
  LeadFeedback, LeadFeedbackUpsert, CallerFeedback, CallerFeedbackUpsert,
  AcceptanceRatioData,
  CallLog, CallLogUpsert, CallerQueueEntry, CallerOption, ActiveSubscriberCheck,
  Callback, CallbackUpsert,
  DigitalEnquiry, IngestKey,
  ScheduledCall, ScheduledCallUpsert, CallSlot, SlotsGenerate, CalendarConnectStatus,
  MarketingExpense, ExpenseSummary,
  ScrapedLead, LeadFinderProviderStatus, LeadFinderUsage,
  Segment, SegmentFilter, SegmentPreview, PromoCode, PromoUpsert, PromoRedemption,
  CampaignSendResult,
  OnboardingStep, TimelineEvent, PitchDocument,
} from '../models/marketing.model';

/** REST client for the marketing module (base path /v1/marketing). */
@Injectable({ providedIn: 'root' })
export class MarketingApiService {
  private http = inject(HttpClient);
  private base = `${authApiConfig.baseUrl}/marketing`;

  // ── Campaigns ───────────────────────────────────────────────────────────────
  listCampaigns(filters: { status?: string; channel?: string } = {}): Observable<{ data: Campaign[] }> {
    let params = new HttpParams();
    if (filters.status)  params = params.set('status', filters.status);
    if (filters.channel) params = params.set('channel', filters.channel);
    return this.http.get<{ data: Campaign[] }>(`${this.base}/campaigns`, { params });
  }
  getCampaign(id: string): Observable<{ data: Campaign }> {
    return this.http.get<{ data: Campaign }>(`${this.base}/campaigns/${id}`);
  }
  createCampaign(payload: CampaignUpsert): Observable<{ data: Campaign }> {
    return this.http.post<{ data: Campaign }>(`${this.base}/campaigns`, payload);
  }
  updateCampaign(id: string, payload: Partial<CampaignUpsert>): Observable<{ data: Campaign }> {
    return this.http.put<{ data: Campaign }>(`${this.base}/campaigns/${id}`, payload);
  }
  deleteCampaign(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/campaigns/${id}`);
  }
  sendCampaign(id: string): Observable<{ data: Campaign } & CampaignSendResult> {
    return this.http.post<{ data: Campaign } & CampaignSendResult>(`${this.base}/campaigns/${id}/send`, {});
  }
  campaignPerformance(id: string): Observable<{ data: CampaignPerformance }> {
    return this.http.get<{ data: CampaignPerformance }>(`${this.base}/campaigns/${id}/performance`);
  }

  // ── Content calendar ──────────────────────────────────────────────────────────
  listCalendar(filters: { from?: string; to?: string; channel?: string } = {}): Observable<{ data: CalendarEntry[] }> {
    let params = new HttpParams();
    if (filters.from)    params = params.set('from', filters.from);
    if (filters.to)      params = params.set('to', filters.to);
    if (filters.channel) params = params.set('channel', filters.channel);
    return this.http.get<{ data: CalendarEntry[] }>(`${this.base}/calendar`, { params });
  }
  createCalendar(payload: CalendarUpsert): Observable<{ data: CalendarEntry }> {
    return this.http.post<{ data: CalendarEntry }>(`${this.base}/calendar`, payload);
  }
  updateCalendar(id: string, payload: Partial<CalendarUpsert>): Observable<{ data: CalendarEntry }> {
    return this.http.put<{ data: CalendarEntry }>(`${this.base}/calendar/${id}`, payload);
  }
  patchCalendarStatus(id: string, status: CalendarStatus): Observable<{ data: CalendarEntry }> {
    return this.http.patch<{ data: CalendarEntry }>(`${this.base}/calendar/${id}/status`, { status });
  }
  deleteCalendar(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/calendar/${id}`);
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────────
  dashboard(): Observable<{ data: MarketingDashboardData }> {
    return this.http.get<{ data: MarketingDashboardData }>(`${this.base}/dashboard`);
  }

  // ── Pipeline leads ────────────────────────────────────────────────────────────
  listLeads(filters: { stage?: string; source?: string; disposition?: string } = {}): Observable<{ data: PipelineLead[] }> {
    let params = new HttpParams();
    if (filters.stage)       params = params.set('stage', filters.stage);
    if (filters.source)      params = params.set('source', filters.source);
    if (filters.disposition) params = params.set('disposition', filters.disposition);
    return this.http.get<{ data: PipelineLead[] }>(`${this.base}/pipeline`, { params });
  }
  getLead(id: string): Observable<{ data: PipelineLead }> {
    return this.http.get<{ data: PipelineLead }>(`${this.base}/pipeline/${id}`);
  }
  createLead(payload: LeadUpsert): Observable<{ data: PipelineLead }> {
    return this.http.post<{ data: PipelineLead }>(`${this.base}/pipeline`, payload);
  }
  updateLead(id: string, payload: Partial<LeadUpsert>): Observable<{ data: PipelineLead }> {
    return this.http.put<{ data: PipelineLead }>(`${this.base}/pipeline/${id}`, payload);
  }
  patchLeadStage(id: string, stage: LeadStage): Observable<{ data: PipelineLead }> {
    return this.http.patch<{ data: PipelineLead }>(`${this.base}/pipeline/${id}/stage`, { stage });
  }

  // ── Feedback ──────────────────────────────────────────────────────────────────
  listLeadFeedback(leadId: string): Observable<{ data: LeadFeedback[] }> {
    return this.http.get<{ data: LeadFeedback[] }>(`${this.base}/leads/${leadId}/feedback`);
  }
  createLeadFeedback(leadId: string, payload: LeadFeedbackUpsert): Observable<{ data: LeadFeedback }> {
    return this.http.post<{ data: LeadFeedback }>(`${this.base}/leads/${leadId}/feedback`, payload);
  }
  listCallerFeedback(leadId: string): Observable<{ data: CallerFeedback[] }> {
    return this.http.get<{ data: CallerFeedback[] }>(`${this.base}/leads/${leadId}/caller-feedback`);
  }
  createCallerFeedback(leadId: string, payload: CallerFeedbackUpsert): Observable<{ data: CallerFeedback }> {
    return this.http.post<{ data: CallerFeedback }>(`${this.base}/leads/${leadId}/caller-feedback`, payload);
  }

  // ── Acceptance ratio ──────────────────────────────────────────────────────────
  acceptanceRatio(filters: { author_id?: string; from?: string; to?: string } = {}): Observable<{ data: AcceptanceRatioData }> {
    let params = new HttpParams();
    if (filters.author_id) params = params.set('author_id', filters.author_id);
    if (filters.from)      params = params.set('from', filters.from);
    if (filters.to)        params = params.set('to', filters.to);
    return this.http.get<{ data: AcceptanceRatioData }>(`${this.base}/acceptance-ratio`, { params });
  }

  // ── Caller workflow ─────────────────────────────────────────────────────────
  callers(): Observable<{ data: CallerOption[] }> {
    return this.http.get<{ data: CallerOption[] }>(`${this.base}/callers`);
  }
  assignCaller(leadId: string, callerId: string): Observable<{ data: PipelineLead }> {
    return this.http.patch<{ data: PipelineLead }>(`${this.base}/pipeline/${leadId}/assign-caller`, { caller_id: callerId });
  }
  checkActiveSubscriber(body: { phone?: string; email?: string; clinic_name?: string }): Observable<{ data: ActiveSubscriberCheck }> {
    return this.http.post<{ data: ActiveSubscriberCheck }>(`${this.base}/internal/check-active-subscriber`, body);
  }
  callerQueue(): Observable<{ data: CallerQueueEntry[] }> {
    return this.http.get<{ data: CallerQueueEntry[] }>(`${this.base}/caller-queue`);
  }
  callerQueueAll(): Observable<{ data: CallerQueueEntry[] }> {
    return this.http.get<{ data: CallerQueueEntry[] }>(`${this.base}/caller-queue/all`);
  }
  createCallLog(payload: CallLogUpsert): Observable<{ data: CallLog; lead: PipelineLead; callback: Callback | null }> {
    return this.http.post<{ data: CallLog; lead: PipelineLead; callback: Callback | null }>(`${this.base}/call-logs`, payload);
  }
  listCallLogs(leadId: string): Observable<{ data: CallLog[] }> {
    return this.http.get<{ data: CallLog[] }>(`${this.base}/call-logs`, { params: new HttpParams().set('lead_id', leadId) });
  }

  // ── Callbacks ─────────────────────────────────────────────────────────────────
  createCallback(payload: CallbackUpsert): Observable<{ data: Callback }> {
    return this.http.post<{ data: Callback }>(`${this.base}/callbacks`, payload);
  }
  listCallbacks(filters: { status?: string; from?: string; to?: string } = {}): Observable<{ data: Callback[] }> {
    let params = new HttpParams();
    if (filters.status) params = params.set('status', filters.status);
    if (filters.from)   params = params.set('from', filters.from);
    if (filters.to)     params = params.set('to', filters.to);
    return this.http.get<{ data: Callback[] }>(`${this.base}/callbacks`, { params });
  }
  patchCallback(id: string, patch: { status?: string; scheduled_for?: string; notes?: string }): Observable<{ data: Callback }> {
    return this.http.patch<{ data: Callback }>(`${this.base}/callbacks/${id}`, patch);
  }

  // ── Digital enquiries ─────────────────────────────────────────────────────────
  listEnquiries(filters: { source?: string; is_duplicate?: boolean } = {}): Observable<{ data: DigitalEnquiry[] }> {
    let params = new HttpParams();
    if (filters.source) params = params.set('source', filters.source);
    if (filters.is_duplicate !== undefined) params = params.set('is_duplicate', String(filters.is_duplicate));
    return this.http.get<{ data: DigitalEnquiry[] }>(`${this.base}/enquiries`, { params });
  }
  getEnquiry(id: string): Observable<{ data: DigitalEnquiry }> {
    return this.http.get<{ data: DigitalEnquiry }>(`${this.base}/enquiries/${id}`);
  }
  convertEnquiry(id: string, leadId?: string): Observable<{ data: DigitalEnquiry; lead: PipelineLead }> {
    return this.http.patch<{ data: DigitalEnquiry; lead: PipelineLead }>(`${this.base}/enquiries/${id}/convert`, leadId ? { lead_id: leadId } : {});
  }
  markEnquiryDuplicate(id: string, isDuplicate: boolean): Observable<{ data: DigitalEnquiry }> {
    return this.http.patch<{ data: DigitalEnquiry }>(`${this.base}/enquiries/${id}`, { is_duplicate: isDuplicate });
  }
  enquiryKey(): Observable<{ data: IngestKey }> {
    return this.http.get<{ data: IngestKey }>(`${this.base}/enquiries/key`);
  }
  rotateEnquiryKey(): Observable<{ data: IngestKey }> {
    return this.http.post<{ data: IngestKey }>(`${this.base}/enquiries/key/rotate`, {});
  }

  // ── Scheduled calls / calendar sync ───────────────────────────────────────────
  calendarStatus(): Observable<{ data: CalendarConnectStatus }> {
    return this.http.get<{ data: CalendarConnectStatus }>(`${this.base}/scheduled-calls/calendar-status`);
  }
  listScheduledCalls(filters: { status?: string; from?: string; to?: string } = {}): Observable<{ data: ScheduledCall[] }> {
    let params = new HttpParams();
    if (filters.status) params = params.set('status', filters.status);
    if (filters.from)   params = params.set('from', filters.from);
    if (filters.to)     params = params.set('to', filters.to);
    return this.http.get<{ data: ScheduledCall[] }>(`${this.base}/scheduled-calls`, { params });
  }
  createScheduledCall(payload: ScheduledCallUpsert): Observable<{ data: ScheduledCall }> {
    return this.http.post<{ data: ScheduledCall }>(`${this.base}/scheduled-calls`, payload);
  }
  patchScheduledCall(id: string, patch: { status?: string; scheduled_for?: string; post_call_notes?: string }): Observable<{ data: ScheduledCall }> {
    return this.http.patch<{ data: ScheduledCall }>(`${this.base}/scheduled-calls/${id}`, patch);
  }
  listSlots(filters: { from?: string; to?: string } = {}): Observable<{ data: CallSlot[] }> {
    let params = new HttpParams();
    if (filters.from) params = params.set('from', filters.from);
    if (filters.to)   params = params.set('to', filters.to);
    return this.http.get<{ data: CallSlot[] }>(`${this.base}/scheduled-calls/slots`, { params });
  }
  generateSlots(payload: SlotsGenerate): Observable<{ data: CallSlot[]; created: number }> {
    return this.http.post<{ data: CallSlot[]; created: number }>(`${this.base}/scheduled-calls/slots/generate`, payload);
  }

  // ── Expenses ──────────────────────────────────────────────────────────────────
  listExpenses(filters: { category?: string; campaign_id?: string; from?: string; to?: string } = {}): Observable<{ data: MarketingExpense[] }> {
    let params = new HttpParams();
    if (filters.category)    params = params.set('category', filters.category);
    if (filters.campaign_id) params = params.set('campaign_id', filters.campaign_id);
    if (filters.from)        params = params.set('from', filters.from);
    if (filters.to)          params = params.set('to', filters.to);
    return this.http.get<{ data: MarketingExpense[] }>(`${this.base}/expenses`, { params });
  }
  createExpense(form: FormData): Observable<{ data: MarketingExpense }> {
    return this.http.post<{ data: MarketingExpense }>(`${this.base}/expenses`, form);
  }
  updateExpense(id: string, payload: Partial<Omit<MarketingExpense, 'id' | 'campaign_name' | 'has_receipt' | 'created_at'>>): Observable<{ data: MarketingExpense }> {
    return this.http.put<{ data: MarketingExpense }>(`${this.base}/expenses/${id}`, payload);
  }
  deleteExpense(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/expenses/${id}`);
  }
  expenseSummary(month?: string): Observable<{ data: ExpenseSummary }> {
    let params = new HttpParams();
    if (month) params = params.set('month', month);
    return this.http.get<{ data: ExpenseSummary }>(`${this.base}/expenses/summary`, { params });
  }
  expenseReceiptUrl(id: string): Observable<{ data: { url: string } }> {
    return this.http.get<{ data: { url: string } }>(`${this.base}/expenses/${id}/receipt`);
  }

  // ── Lead Finder ───────────────────────────────────────────────────────────────
  leadFinderStatus(): Observable<{ data: LeadFinderProviderStatus }> {
    return this.http.get<{ data: LeadFinderProviderStatus }>(`${this.base}/lead-finder/status`);
  }
  leadFinderResults(status?: string): Observable<{ data: ScrapedLead[] }> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    return this.http.get<{ data: ScrapedLead[] }>(`${this.base}/lead-finder/results`, { params });
  }
  leadFinderUsage(): Observable<{ data: LeadFinderUsage }> {
    return this.http.get<{ data: LeadFinderUsage }>(`${this.base}/lead-finder/usage`);
  }
  leadFinderSearch(body: { query: string; city?: string; limit?: number }): Observable<{ data: ScrapedLead[]; provider: string; summary: Record<string, number>; from_cache: boolean; calls_used: number; usage: LeadFinderUsage }> {
    return this.http.post<{ data: ScrapedLead[]; provider: string; summary: Record<string, number>; from_cache: boolean; calls_used: number; usage: LeadFinderUsage }>(`${this.base}/lead-finder/search`, body);
  }
  leadFinderImport(ids: string[]): Observable<{ data: { imported: number } }> {
    return this.http.post<{ data: { imported: number } }>(`${this.base}/lead-finder/import`, { ids });
  }
  leadFinderDiscard(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/lead-finder/results/${id}`);
  }

  // ── Segments ──────────────────────────────────────────────────────────────────
  listSegments(): Observable<{ data: Segment[] }> {
    return this.http.get<{ data: Segment[] }>(`${this.base}/segments`);
  }
  previewSegment(filter: SegmentFilter): Observable<{ data: SegmentPreview }> {
    return this.http.post<{ data: SegmentPreview }>(`${this.base}/segments/preview`, { filter_json: filter });
  }
  createSegment(name: string, filter: SegmentFilter): Observable<{ data: Segment }> {
    return this.http.post<{ data: Segment }>(`${this.base}/segments`, { name, filter_json: filter });
  }
  deleteSegment(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/segments/${id}`);
  }

  // ── Promo codes ───────────────────────────────────────────────────────────────
  listPromoCodes(): Observable<{ data: PromoCode[] }> {
    return this.http.get<{ data: PromoCode[] }>(`${this.base}/promo-codes`);
  }
  createPromoCode(payload: PromoUpsert): Observable<{ data: PromoCode }> {
    return this.http.post<{ data: PromoCode }>(`${this.base}/promo-codes`, payload);
  }
  updatePromoCode(id: string, payload: PromoUpsert): Observable<{ data: PromoCode }> {
    return this.http.put<{ data: PromoCode }>(`${this.base}/promo-codes/${id}`, payload);
  }
  promoRedemptions(id: string): Observable<{ data: PromoRedemption[] }> {
    return this.http.get<{ data: PromoRedemption[] }>(`${this.base}/promo-codes/${id}/redemptions`);
  }

  // ── Onboarding + timeline ─────────────────────────────────────────────────────
  listOnboarding(leadId: string): Observable<{ data: OnboardingStep[] }> {
    return this.http.get<{ data: OnboardingStep[] }>(`${this.base}/pipeline/${leadId}/onboarding`);
  }
  seedOnboarding(leadId: string): Observable<{ data: OnboardingStep[] }> {
    return this.http.post<{ data: OnboardingStep[] }>(`${this.base}/pipeline/${leadId}/onboarding`, {});
  }
  patchOnboardingStep(stepId: string, patch: { status?: string; owner_id?: string; due_date?: string }): Observable<{ data: OnboardingStep }> {
    return this.http.patch<{ data: OnboardingStep }>(`${this.base}/onboarding-steps/${stepId}`, patch);
  }
  leadTimeline(leadId: string): Observable<{ data: TimelineEvent[] }> {
    return this.http.get<{ data: TimelineEvent[] }>(`${this.base}/pipeline/${leadId}/timeline`);
  }

  // ── Pitch library ─────────────────────────────────────────────────────────────
  listPitchDocs(): Observable<{ data: PitchDocument[] }> {
    return this.http.get<{ data: PitchDocument[] }>(`${this.base}/pitch-documents`);
  }
  uploadPitchDoc(form: FormData): Observable<{ data: PitchDocument }> {
    return this.http.post<{ data: PitchDocument }>(`${this.base}/pitch-documents`, form);
  }
  generatePitchDoc(leadId: string, title?: string): Observable<{ data: PitchDocument; url: string }> {
    return this.http.post<{ data: PitchDocument; url: string }>(`${this.base}/pitch-documents/generate`, { lead_id: leadId, title });
  }
  pitchDownloadUrl(id: string): Observable<{ data: { url: string } }> {
    return this.http.get<{ data: { url: string } }>(`${this.base}/pitch-documents/${id}/download`);
  }
  deletePitchDoc(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/pitch-documents/${id}`);
  }
}
