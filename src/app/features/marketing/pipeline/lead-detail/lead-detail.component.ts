import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MaterialModule } from '../../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MarketingApiService } from '../../services/marketing-api.service';
import { MarketingPipelineStore } from '../../store/marketing-pipeline.store';
import { MarketingFeedbackStore } from '../../store/marketing-feedback.store';
import { MarketingCallerStore } from '../../store/marketing-caller.store';
import { ToastService } from '../../../../services/toast.service';
import { PermissionService } from '../../../../core/rbac/permission.service';
import { LeadFeedbackFormComponent } from '../../feedback/lead-feedback-form/lead-feedback-form.component';
import { CallerFeedbackFormComponent } from '../../feedback/caller-feedback-form/caller-feedback-form.component';
import { CallOutcomeFormComponent } from '../../caller/call-outcome-form/call-outcome-form.component';
import {
  PipelineLead, LeadStage, LeadDisposition,
  DISPOSITION_LABELS, REJECTION_REASON_LABELS, CALL_OUTCOME_LABELS, CallerOption,
  OnboardingStep, OnboardingStatus, TimelineEvent,
} from '../../models/marketing.model';

const STAGE_LABELS: Record<LeadStage, string> = {
  new: 'New', marketing_qualified: 'Qualified', routed_to_caller: 'Routed to caller',
  called: 'Called', demo_scheduled: 'Demo scheduled', trial: 'Trial',
  onboarded: 'Onboarded', lost: 'Lost',
};

@Component({
  selector: 'mkt-lead-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, RouterModule, MaterialModule, TablerIconsModule,
    LeadFeedbackFormComponent, CallerFeedbackFormComponent, CallOutcomeFormComponent,
  ],
  templateUrl: './lead-detail.component.html',
  styleUrl: './lead-detail.component.scss',
})
export class LeadDetailComponent implements OnInit {
  private route   = inject(ActivatedRoute);
  private router  = inject(Router);
  private api     = inject(MarketingApiService);
  private pipeline = inject(MarketingPipelineStore);
  readonly fb     = inject(MarketingFeedbackStore);
  readonly caller = inject(MarketingCallerStore);
  private toast   = inject(ToastService);
  private perms   = inject(PermissionService);

  readonly lead    = signal<PipelineLead | null>(null);
  readonly loading = signal(true);
  readonly callers = signal<CallerOption[]>([]);
  selectedCallerId = '';

  readonly stages = this.pipeline.stages;
  readonly stageLabels = STAGE_LABELS;
  readonly dispositions: LeadDisposition[] = ['accepted', 'rejected', 'pending'];
  readonly dispositionLabels = DISPOSITION_LABELS;
  readonly rejectionLabels = REJECTION_REASON_LABELS;
  readonly outcomeLabels = CALL_OUTCOME_LABELS;

  readonly canEditPipeline = this.perms.has('marketing.pipeline.edit');
  readonly canEditAcceptance = this.perms.has('marketing.acceptance.edit');
  readonly canLogFeedback = this.perms.has('marketing.feedback.create');
  readonly canViewCallerFeedback = this.perms.has('marketing.caller_feedback.view');
  readonly canLogCallerFeedback = this.perms.has('marketing.calloutcome.create');
  readonly canViewCalls = this.perms.hasAny('marketing.callqueue.view_own', 'marketing.callqueue.view_all');
  readonly canLogCallOutcome = this.perms.has('marketing.calloutcome.create');
  readonly canViewOnboarding = this.perms.has('marketing.onboarding.view');
  readonly canEditOnboarding = this.perms.has('marketing.onboarding.edit');
  readonly canEditPitch = this.perms.has('marketing.pitch.edit');

  readonly onboarding = signal<OnboardingStep[]>([]);
  readonly timeline = signal<TimelineEvent[]>([]);
  readonly generatingPitch = signal(false);
  readonly onboardingStatuses: OnboardingStatus[] = ['pending', 'in_progress', 'done'];

  readonly leadId = computed(() => this.lead()?.id ?? '');
  readonly leadFeedbacks = computed(() => this.fb.leadFeedbacks()[this.leadId()] ?? []);
  readonly callerFeedbacks = computed(() => this.fb.callerFeedbacks()[this.leadId()] ?? []);
  readonly callLogs = computed(() => this.caller.callLogs()[this.leadId()] ?? []);
  readonly onboardingDone = computed(() => this.onboarding().filter((s) => s.status === 'done').length);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.api.getLead(id).subscribe({
      next: (r) => {
        this.lead.set(r.data);
        this.selectedCallerId = r.data.assigned_caller_id ?? '';
        this.loading.set(false);
        this.fb.loadForLead(id);
        if (this.canViewCalls) this.caller.loadCallLogs(id);
        if (this.canEditPipeline) {
          this.api.callers().subscribe({ next: (c) => this.callers.set(c.data), error: () => {} });
        }
        if (this.canViewOnboarding) {
          this.api.listOnboarding(id).subscribe({ next: (o) => this.onboarding.set(o.data), error: () => {} });
        }
        this.api.leadTimeline(id).subscribe({ next: (t) => this.timeline.set(t.data), error: () => {} });
      },
      error: (e) => {
        this.loading.set(false);
        this.toast.error(e?.error?.error ?? 'Lead not found.');
        this.router.navigate(['/marketing/pipeline']);
      },
    });
  }

  assignCaller(): void {
    if (!this.selectedCallerId) { this.toast.error('Pick a caller first.'); return; }
    this.api.assignCaller(this.leadId(), this.selectedCallerId).subscribe({
      next: (r) => { this.lead.set(r.data); this.pipeline.upsert(r.data); this.toast.success('Lead routed to caller.'); },
      error: (e) => {
        if (e?.status === 409) {
          // Active-clinic guard tripped — reflect the blocked state.
          const l = this.lead();
          if (l) this.lead.set({ ...l, is_active_subscriber: true });
          this.toast.error(e?.error?.message ?? 'This clinic is already an active subscriber.');
        } else {
          this.toast.error(e?.error?.error ?? 'Could not assign caller.');
        }
      },
    });
  }

  onCallLogged(lead: PipelineLead): void {
    this.lead.set(lead);
    this.pipeline.upsert(lead);
  }

  callerName(id: string | null): string {
    const c = this.callers().find((x) => x.id === id);
    return c ? `${c.first_name} ${c.last_name}`.trim() : '—';
  }

  changeStage(stage: LeadStage): void {
    const id = this.leadId();
    this.api.patchLeadStage(id, stage).subscribe({
      next: (r) => { this.lead.set(r.data); this.pipeline.upsert(r.data); this.toast.success('Stage updated.'); },
      error: (e) => this.toast.error(e?.error?.error ?? 'Could not update stage.'),
    });
  }

  changeDisposition(final_disposition: LeadDisposition): void {
    const id = this.leadId();
    this.api.updateLead(id, { final_disposition }).subscribe({
      next: (r) => { this.lead.set(r.data); this.pipeline.upsert(r.data); this.toast.success('Disposition updated.'); },
      error: (e) => this.toast.error(e?.error?.error ?? 'Could not update disposition.'),
    });
  }

  authorName(f: { first_name: string | null; last_name: string | null }): string {
    return `${f.first_name ?? ''} ${f.last_name ?? ''}`.trim() || 'Unknown';
  }

  // ── Onboarding ───────────────────────────────────────────────────────────────
  seedOnboarding(): void {
    this.api.seedOnboarding(this.leadId()).subscribe({
      next: (r) => { this.onboarding.set(r.data); this.toast.success('Checklist added.'); },
      error: (e) => this.toast.error(e?.error?.error ?? 'Could not create checklist.'),
    });
  }

  setStepStatus(step: OnboardingStep, status: OnboardingStatus): void {
    this.api.patchOnboardingStep(step.id, { status }).subscribe({
      next: (r) => this.onboarding.set(this.onboarding().map((s) => (s.id === step.id ? r.data : s))),
      error: (e) => this.toast.error(e?.error?.error ?? 'Could not update step.'),
    });
  }

  // ── Pitch ────────────────────────────────────────────────────────────────────
  generatePitch(): void {
    this.generatingPitch.set(true);
    this.api.generatePitchDoc(this.leadId()).subscribe({
      next: (r) => { this.generatingPitch.set(false); window.open(r.url, '_blank'); this.toast.success('Pitch PDF generated.'); },
      error: (e) => { this.generatingPitch.set(false); this.toast.error(e?.error?.error ?? 'Could not generate pitch.'); },
    });
  }

  timelineIcon(type: string): string {
    return ({ marketing_feedback: 'message', caller_feedback: 'phone', call: 'phone-call',
      callback: 'clock', scheduled_call: 'calendar-event' } as Record<string, string>)[type] || 'point';
  }

  back(): void {
    this.router.navigate(['/marketing/pipeline']);
  }
}
