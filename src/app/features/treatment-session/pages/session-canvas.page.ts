import {
  Component, OnInit, OnDestroy, inject, signal, computed, effect,
  ChangeDetectionStrategy, ChangeDetectorRef, ViewChildren, QueryList,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MatDialog } from '@angular/material/dialog';
import { SessionStore } from '../store/session.store';
import { SessionApiService } from '../services/session-api.service';
import { DfSoapNotesComponent } from '../components/df-soap-notes/df-soap-notes.component';
import { DfServicesBlockComponent } from '../components/df-services-block/df-services-block.component';
import { DfExaminationBlockComponent } from '../components/df-examination-block/df-examination-block.component';
import { DfDiagnosisBlockComponent } from '../components/df-diagnosis-block/df-diagnosis-block.component';
import { DfEndTreatmentModalComponent } from '../components/df-end-treatment-modal/df-end-treatment-modal.component';
import { DfAbandonModalComponent } from '../components/df-abandon-modal/df-abandon-modal.component';
import { DfToothChartComponent } from '../components/df-tooth-chart/df-tooth-chart.component';
import { DfTreatmentPlanComponent } from '../components/df-treatment-plan/df-treatment-plan.component';
import { DfPrescriptionBlockComponent } from '../components/df-prescription-block/df-prescription-block.component';
import { DfAttachmentsBlockComponent } from '../components/df-attachments-block/df-attachments-block.component';
import { DfInvestigationsBlockComponent } from '../components/df-investigations-block/df-investigations-block.component';
import { DfConsentBlockComponent } from '../components/df-consent-block/df-consent-block.component';
import { DfPreopChecklistComponent } from '../components/df-preop-checklist/df-preop-checklist.component';
import { DfPostopRecordComponent } from '../components/df-postop-record/df-postop-record.component';
import { DfTpaBlockComponent } from '../components/df-tpa-block/df-tpa-block.component';
import { DfSessionBlockComponent } from '../components/df-session-block/df-session-block.component';
import { DfReferSpecialtyComponent } from '../../specialty/shared/components/df-refer-specialty/df-refer-specialty.component';
import { forkJoin, of, switchMap, Observable } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';
import { ToastService } from '../../../services/toast.service';
import { formatApiError } from '../../../utils/api-error';
import { OfflineQueueService } from '../../../core/offline/offline-queue.service';
import type { BlockStatus } from '../components/df-session-block/df-session-block.component';
import type { SessionStatus } from '../models/session.model';

export interface ProgressStep {
  key:    string;
  label:  string;
  icon:   string;
  accent: string;
  status: BlockStatus;
}

@Component({
  selector: 'df-session-canvas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, MaterialModule, TablerIconsModule,
    DfSessionBlockComponent,
    DfExaminationBlockComponent, DfDiagnosisBlockComponent,
    DfServicesBlockComponent, DfSoapNotesComponent,
    DfToothChartComponent, DfTreatmentPlanComponent,
    DfPrescriptionBlockComponent, DfAttachmentsBlockComponent,
    DfInvestigationsBlockComponent,
    DfConsentBlockComponent, DfPreopChecklistComponent, DfPostopRecordComponent,
    DfTpaBlockComponent,
    DfReferSpecialtyComponent,
  ],
  templateUrl: './session-canvas.page.html',
  styleUrl: './session-canvas.page.scss',
})
export class SessionCanvasPage implements OnInit, OnDestroy {
  readonly store  = inject(SessionStore);
  private route   = inject(ActivatedRoute);
  private router  = inject(Router);
  private api     = inject(SessionApiService);
  private dialog  = inject(MatDialog);
  private toast   = inject(ToastService);
  private offline = inject(OfflineQueueService);
  private cdr     = inject(ChangeDetectorRef);

  private sessionId = '';
  private _lastSync = 0;

  // Re-hydrate after the offline queue drains so offline-created data appears.
  private _reloadOnSync = effect(() => {
    const ts = this.offline.lastSyncedAt();
    if (ts && ts !== this._lastSync && this.sessionId) {
      this._lastSync = ts;
      this.loadSession(this.sessionId);
    }
  });

  readonly pausing   = signal(false);
  readonly reopening = signal(false);
  readonly autoPausingLeave = signal(false);
  readonly activeStepKey = signal<string | null>(null);

  @ViewChildren(DfSessionBlockComponent) private sessionBlocks!: QueryList<DfSessionBlockComponent>;

  // ── Elapsed time ──────────────────────────────────────────────────────────
  private _tick               = signal(Date.now());
  private _timer?: ReturnType<typeof setInterval>;

  readonly elapsedLabel = computed(() => {
    const start = this.store.startedAt();
    if (!start) return '—';

    const now        = this._tick();
    const startMs    = new Date(start).getTime();
    let pausedMs     = this.store.totalPausedMs();
    const pauseStart = this.store.pausedAt();
    if (pauseStart) {
      pausedMs += now - new Date(pauseStart).getTime();
    }

    const secs = Math.max(0, Math.floor((now - startMs - pausedMs) / 1000));
    const h    = Math.floor(secs / 3600);
    const m    = Math.floor((secs % 3600) / 60);
    const s    = secs % 60;
    return h > 0
      ? `${h}h ${String(m).padStart(2,'0')}m`
      : `${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`;
  });

  // ── Block statuses (used for sidebar progress + wrapper status dots) ──────
  readonly examStatus = computed<BlockStatus>(() =>
    this.store.examination().chief_complaint ? 'complete' : 'empty');

  readonly chartStatus = computed<BlockStatus>(() =>
    this.store.chart() ? 'complete' : 'empty');

  readonly diagnosisStatus = computed<BlockStatus>(() =>
    this.store.diagnoses().length > 0 ? 'complete' : 'empty');

  readonly investigationsStatus = computed<BlockStatus>(() =>
    this.store.investigations().length > 0 ? 'active' : 'empty');

  readonly tpaStatus = computed<BlockStatus>(() =>
    this.store.tpa().length > 0 ? 'active' : 'empty');

  readonly consentStatus = computed<BlockStatus>(() =>
    this.store.consents().length > 0 ? 'complete' : 'empty');

  readonly preopStatus = computed<BlockStatus>(() =>
    this.store.preop() ? 'complete' : 'empty');

  readonly plansStatus = computed<BlockStatus>(() =>
    this.store.plans().some(p => p.items?.length > 0) ? 'complete' : 'empty');

  readonly servicesStatus = computed<BlockStatus>(() => {
    const svcs = this.store.services();
    if (svcs.length === 0) return 'empty';
    return this.store.inProgressServices().length > 0 ? 'active' : 'complete';
  });

  readonly postopStatus = computed<BlockStatus>(() =>
    this.store.postop() ? 'complete' : 'empty');

  readonly prescriptionsStatus = computed<BlockStatus>(() =>
    this.store.prescriptions().length > 0 ? 'complete' : 'empty');

  readonly attachmentsStatus = computed<BlockStatus>(() =>
    this.store.attachments().length > 0 ? 'complete' : 'empty');

  readonly soapStatus = computed<BlockStatus>(() =>
    this.store.notes().subjective ? 'complete' : 'empty');

  readonly progressSteps = computed<ProgressStep[]>(() => [
    { key: 'exam',           label: 'Examination',     icon: 'stethoscope',     accent: '#6366f1', status: this.examStatus()           },
    { key: 'chart',          label: 'Tooth Chart',     icon: 'dental',          accent: '#06b6d4', status: this.chartStatus()          },
    { key: 'diagnosis',      label: 'Diagnosis',       icon: 'brain',           accent: '#8b5cf6', status: this.diagnosisStatus()      },
    { key: 'investigations', label: 'Investigations',  icon: 'flask',           accent: '#f59e0b', status: this.investigationsStatus() },
    { key: 'tpa',            label: 'TPA / Insurance', icon: 'shield-check',    accent: '#10b981', status: this.tpaStatus()            },
    { key: 'consent',        label: 'Consent',         icon: 'file-certificate', accent: '#ef4444', status: this.consentStatus()       },
    { key: 'preop',          label: 'Pre-op',          icon: 'clipboard-check', accent: '#f97316', status: this.preopStatus()          },
    { key: 'plans',          label: 'Treatment Plan',  icon: 'layout-list',     accent: '#3b82f6', status: this.plansStatus()          },
    { key: 'services',       label: 'Services',        icon: 'tool',            accent: '#22c55e', status: this.servicesStatus()       },
    { key: 'postop',         label: 'Post-op',         icon: 'heart-rate-monitor', accent: '#ec4899', status: this.postopStatus()     },
    { key: 'prescriptions',  label: 'Prescription',   icon: 'pill',            accent: '#14b8a6', status: this.prescriptionsStatus()  },
    { key: 'attachments',    label: 'Attachments',     icon: 'paperclip',       accent: '#64748b', status: this.attachmentsStatus()    },
    { key: 'soap',           label: 'SOAP Notes',      icon: 'notes',           accent: '#a855f7', status: this.soapStatus()           },
  ]);

  readonly completedCount = computed(() =>
    this.progressSteps().filter(s => s.status === 'complete').length);

  readonly progressPct = computed(() =>
    Math.round(this.completedCount() / this.progressSteps().length * 100));

  readonly examSummary = computed<string | null>(() => {
    const cc = this.store.examination().chief_complaint;
    return cc ? cc.slice(0, 55) + (cc.length > 55 ? '…' : '') : null;
  });

  readonly diagnosisSummary = computed<string | null>(() => {
    const dx = this.store.diagnoses();
    if (dx.length === 0) return null;
    return dx.map(d => d.icd10_code ?? d.diagnosis_text).slice(0, 3).join(', ');
  });

  readonly servicesSummary = computed<string | null>(() => {
    const svcs = this.store.services();
    if (svcs.length === 0) return null;
    const done = svcs.filter(s => s.status === 'COMPLETED').length;
    return `${svcs.length} service${svcs.length > 1 ? 's' : ''} · ${done} completed`;
  });

  readonly totalChargesLabel = computed(() => {
    const t = this.store.totalCharges();
    return t > 0 ? `₹ ${t.toLocaleString('en-IN')}` : '—';
  });

  readonly patientInitials = computed(() => {
    const name = this.store.patient()?.name ?? '';
    return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  });

  navigateToStep(key: string): void {
    this.activeStepKey.set(key);
    const block = this.sessionBlocks?.find(b => b.blockKey() === key);
    if (!block) return;

    const wasOpen = block.isExpanded();
    block.open();

    const scroll = () => {
      block.scrollIntoView();
      this.cdr.markForCheck();
    };

    if (wasOpen) {
      scroll();
    } else {
      setTimeout(scroll, 260);
    }
  }

  ngOnInit(): void {
    this._timer = setInterval(() => this._tick.set(Date.now()), 1000);

    this.sessionId = this.route.snapshot.paramMap.get('sessionId') ?? '';
    this.loadSession(this.sessionId);
  }

  /** Re-hydrate the whole session from the server. Called on init and again
   *  after the offline queue drains, so offline-created data appears. */
  private loadSession(sessionId: string): void {
    if (!sessionId) return;
    this.store.loading.set(true);
    this.store.error.set(null);

    forkJoin({
      hydration:   this.api.getSession(sessionId),
      services:    this.api.getServices(sessionId).pipe(catchError(() => of({ services: [] }))),
      examination: this.api.getExamination(sessionId).pipe(catchError(() => of({ examination: null }))),
      diagnoses:   this.api.getDiagnoses(sessionId).pipe(catchError(() => of({ diagnoses: [] }))),
      chart:       this.api.getChart(sessionId).pipe(catchError(() => of({ chart: null }))),
    }).pipe(
      switchMap(({ hydration, services, examination, diagnoses, chart }) => {
        this.store.hydrate({
          ...hydration,
          services:    services.services,
          examination: examination.examination,
          diagnoses:   diagnoses.diagnoses,
          chart:       chart.chart,
        });
        const patientId = hydration.session.patient_id;
        const sid       = hydration.session.id;
        return forkJoin({
          plans:          this.api.getPlans(patientId).pipe(catchError(() => of({ plans: [] }))),
          prescriptions:  this.api.getPrescriptions(sid).pipe(catchError(() => of({ prescriptions: [] }))),
          attachments:    this.api.getAttachments(sid).pipe(catchError(() => of({ attachments: [] }))),
          investigations: this.api.getInvestigations(sid).pipe(catchError(() => of({ investigations: [] }))),
          labOrders:      this.api.getLabOrders(sid).pipe(catchError(() => of({ lab_orders: [] }))),
          cart:           this.api.getCart(sid).pipe(catchError(() => of({ cart: [] }))),
          consents:       this.api.getConsents(sid).pipe(catchError(() => of({ consents: [] }))),
          preop:          this.api.getPreop(sid).pipe(catchError(() => of({ preop: null }))),
          postop:         this.api.getPostop(sid).pipe(catchError(() => of({ postop: null }))),
          tpa:            this.api.getTpa(sid).pipe(catchError(() => of({ tpa: [] }))),
        });
      })
    ).subscribe({
      next: ({ plans, prescriptions, attachments, investigations, labOrders, cart,
               consents, preop, postop, tpa }) => {
        this.store.setPlans(plans.plans);
        this.store.setPrescriptions(prescriptions.prescriptions);
        this.store.setAttachments(attachments.attachments);
        this.store.setInvestigations(investigations.investigations);
        this.store.setLabOrders(labOrders.lab_orders);
        this.store.setCart(cart.cart);
        this.store.setConsents(consents.consents);
        this.store.setPreop(preop.preop);
        this.store.setPostop(postop.postop);
        this.store.setTpa(tpa.tpa);
        this.store.loading.set(false);
      },
      error: (err) => {
        this.store.loading.set(false);
        this.store.error.set(formatApiError(err, 'Failed to load session.'));
      },
    });
  }

  ngOnDestroy(): void {
    clearInterval(this._timer);
    this.store.reset();
  }

  /** Route guard entry — auto-pause before navigating away from the canvas. */
  canDeactivate(): boolean | Observable<boolean> {
    if (!this.shouldAutoPauseOnLeave()) {
      return true;
    }
    return this.autoPauseOnLeave$();
  }

  goBack(): void {
    this.router.navigate(['/schedule']);
  }

  openEndTreatment(): void {
    this.dialog.open(DfEndTreatmentModalComponent, {
      width: '520px',
      disableClose: true,
    });
  }

  openAbandon(): void {
    this.dialog.open(DfAbandonModalComponent, {
      width: '460px',
      disableClose: true,
    });
  }

  pauseSession(): void {
    const sessionId = this.store.sessionId();
    if (!sessionId || this.pausing() || this.autoPausingLeave()) return;
    this.pausing.set(true);
    this.store.beginPauseClock();
    this.api.pauseSession(sessionId).subscribe({
      next: ({ session }) => {
        this.pausing.set(false);
        this.store.applyPausedState(session);
        this.toast.success('Session paused.');
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.pausing.set(false);
        if (this.store.isAlreadyPausedError(err)) {
          this.store.syncPausedFromServer();
          this.toast.info('Session is already paused.');
          this.cdr.markForCheck();
          return;
        }
        this.store.revertPauseClock();
        this.toast.error(formatApiError(err, 'Could not pause session.'));
        this.cdr.markForCheck();
      },
    });
  }

  resumeSession(): void {
    if (!this.store.sessionId() || this.pausing() || this.store.resuming()) return;
    if (!this.store.isPaused()) return;

    this.pausing.set(true);
    this.store.ensureResumedForEdit().subscribe({
      next: () => {
        this.pausing.set(false);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.pausing.set(false);
        this.toast.error(formatApiError(err, 'Could not resume session.'));
        this.cdr.markForCheck();
      },
    });
  }

  reopenSession(): void {
    const sessionId = this.store.sessionId();
    if (!sessionId || this.reopening()) return;
    this.reopening.set(true);
    this.api.reopenSession(sessionId).subscribe({
      next: ({ session }) => {
        this.reopening.set(false);
        this.store.status.set(session.status);
        this.store.sealedAt.set(null);
        this.toast.success('Session reopened.');
      },
      error: (err) => {
        this.reopening.set(false);
        this.toast.error(formatApiError(err, 'Could not reopen session.'));
      },
    });
  }

  private shouldAutoPauseOnLeave(): boolean {
    if (!this.store.sessionId() || this.store.loading() || this.store.error()) return false;
    if (this.store.isSealed()) return false;
    if (this.store.isPaused()) return false;
    return !this.isTerminalStatus(this.store.status());
  }

  private isTerminalStatus(status: SessionStatus): boolean {
    return status === 'PAUSED' || status === 'COMPLETED' || status === 'ABANDONED';
  }

  private autoPauseOnLeave$(): Observable<boolean> {
    const sessionId = this.store.sessionId();
    if (!sessionId) return of(true);

    this.autoPausingLeave.set(true);
    this.store.beginPauseClock();
    this.cdr.markForCheck();

    return this.api.pauseSession(sessionId).pipe(
      map(({ session }) => {
        this.store.applyPausedState(session);
        this.toast.info('Session auto-paused. You can resume it from the schedule.');
        return true;
      }),
      catchError((err) => {
        if (this.store.isAlreadyPausedError(err)) {
          this.store.syncPausedFromServer();
          return of(true);
        }
        this.store.revertPauseClock();
        this.toast.error(formatApiError(err, 'Could not auto-pause session. Please pause manually before leaving.'));
        return of(false);
      }),
      finalize(() => {
        this.autoPausingLeave.set(false);
        this.cdr.markForCheck();
      }),
    );
  }
}
