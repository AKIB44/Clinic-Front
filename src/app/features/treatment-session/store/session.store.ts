import { Injectable, signal, computed, inject } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, finalize, map, shareReplay, tap } from 'rxjs/operators';
import {
  ClinicalSession,
  ClinicalNote,
  PatientContext,
  Examination,
  Diagnosis,
  ServicePerformed,
  ToothChart,
  TreatmentPlan,
  TreatmentPlanItem,
  Prescription,
  SessionAttachment,
  InvestigationOrder,
  LabOrder,
  MaterialConsumption,
  ConsentRecord,
  PreopRecord,
  PostopRecord,
  TpaPreauth,
  VarianceInfo,
  SessionStatus,
  SessionId,
  ValidationFailure,
  emptyNote,
  emptyExamination,
} from '../models/session.model';
import { SessionApiService } from '../services/session-api.service';
import { OfflineQueueService } from '../../../core/offline/offline-queue.service';
import { ToastService } from '../../../services/toast.service';

@Injectable({ providedIn: 'root' })
export class SessionStore {
  private api     = inject(SessionApiService);
  private offline = inject(OfflineQueueService);
  private toast   = inject(ToastService);

  private resumeInFlight$: Observable<void> | null = null;

  // ── Root session state ────────────────────────────────────────────────────
  readonly sessionId       = signal<SessionId | null>(null);
  readonly appointmentId   = signal<string | null>(null);
  readonly status          = signal<SessionStatus>('INITIALISED');
  readonly startedAt       = signal<string | null>(null);
  readonly sealedAt        = signal<string | null>(null);
  /** Cumulative paused time for this session (ms), from API + local cache. */
  readonly totalPausedMs   = signal(0);
  /** ISO timestamp when the current pause began (null while running). */
  readonly pausedAt        = signal<string | null>(null);
  readonly loading         = signal(false);
  readonly error           = signal<string | null>(null);

  // ── Patient context (populated on hydration, read-only after) ─────────────
  readonly patient         = signal<PatientContext | null>(null);

  // ── Clinical blocks ───────────────────────────────────────────────────────
  readonly examination     = signal<Examination>(emptyExamination());
  readonly diagnoses       = signal<Diagnosis[]>([]);
  readonly services        = signal<ServicePerformed[]>([]);
  readonly notes           = signal<ClinicalNote>(emptyNote());

  // ── Tooth chart ───────────────────────────────────────────────────────────
  readonly chart            = signal<ToothChart | null>(null);

  // ── Treatment plan ────────────────────────────────────────────────────────
  readonly plans            = signal<TreatmentPlan[]>([]);

  // ── Prescriptions ─────────────────────────────────────────────────────────
  readonly prescriptions    = signal<Prescription[]>([]);

  // ── Investigations ────────────────────────────────────────────────────────
  readonly investigations   = signal<InvestigationOrder[]>([]);

  // ── Materials cart ────────────────────────────────────────────────────────
  readonly cart             = signal<MaterialConsumption[]>([]);

  // ── Lab orders ────────────────────────────────────────────────────────────
  readonly labOrders        = signal<LabOrder[]>([]);

  // ── Attachments ───────────────────────────────────────────────────────────
  readonly attachments      = signal<SessionAttachment[]>([]);

  // ── Surgical gating (T5) ──────────────────────────────────────────────────
  readonly consents         = signal<ConsentRecord[]>([]);
  readonly preop            = signal<PreopRecord | null>(null);
  readonly postop           = signal<PostopRecord | null>(null);

  // ── TPA / Insurance (T6.6) ────────────────────────────────────────────────
  readonly tpa              = signal<TpaPreauth[]>([]);

  // ── Variance (T6.4) ──────────────────────────────────────────────────────
  readonly variance         = signal<VarianceInfo | null>(null);

  // ── Offline sync state (EC-16) ────────────────────────────────────────────
  // Delegates to the app-wide offline queue so the seal-gate and the canvas
  // "unsynced" pill reflect the real pending-replay count.
  readonly offlineQueueDepth = this.offline.queueDepth;

  // ── Derived ───────────────────────────────────────────────────────────────
  readonly isSealed = computed(() => !!this.sealedAt());
  readonly isPaused  = computed(() => this.status() === 'PAUSED');
  readonly resuming    = signal(false);

  readonly totalCharges = computed(() =>
    this.services().reduce((sum, s) =>
      s.status !== 'ABANDONED' ? sum + Number(s.final_charge) : sum, 0)
  );

  readonly inProgressServices = computed(() =>
    this.services().filter(s => s.status === 'IN_PROGRESS')
  );

  // Backend enforces the hard block at service-add time. Frontend uses this
  // as a soft indicator — if any consent records are missing we surface it in the seal check.
  readonly unconsentedFlaggedServices = computed(() => []);

  readonly canEndTreatment = computed(() => this.validateSeal().ok);

  // ── Commands ──────────────────────────────────────────────────────────────

  setChart(chart: ToothChart): void {
    this.chart.set(chart);
  }

  setPlans(plans: TreatmentPlan[]): void {
    this.plans.set(plans);
  }

  updatePlanItem(updated: TreatmentPlanItem): void {
    this.plans.update(list =>
      list.map(plan => ({
        ...plan,
        items: plan.items.map(item => item.id === updated.id ? { ...item, ...updated } : item),
      }))
    );
  }

  setPrescriptions(prescriptions: Prescription[]): void {
    this.prescriptions.set(prescriptions);
  }

  addPrescription(rx: Prescription): void {
    this.prescriptions.update(list => [...list, rx]);
  }

  setInvestigations(investigations: InvestigationOrder[]): void {
    this.investigations.set(investigations);
  }

  addInvestigation(inv: InvestigationOrder): void {
    this.investigations.update(list => [...list, inv]);
  }

  updateInvestigation(updated: InvestigationOrder): void {
    this.investigations.update(list =>
      list.map(i => i.id === updated.id ? updated : i)
    );
  }

  cancelInvestigation(id: string): void {
    this.investigations.update(list =>
      list.map(i => i.id === id ? { ...i, status: 'CANCELLED' as const } : i)
    );
  }

  setCart(cart: MaterialConsumption[]): void { this.cart.set(cart); }
  addCartItem(item: MaterialConsumption): void { this.cart.update(list => [...list, item]); }
  updateCartItem(updated: MaterialConsumption): void {
    this.cart.update(list => list.map(i => i.id === updated.id ? updated : i));
  }
  removeCartItem(id: string): void { this.cart.update(list => list.filter(i => i.id !== id)); }

  setLabOrders(labOrders: LabOrder[]): void {
    this.labOrders.set(labOrders);
  }

  addLabOrder(lo: LabOrder): void {
    this.labOrders.update(list => [...list, lo]);
  }

  updateLabOrder(updated: LabOrder): void {
    this.labOrders.update(list => list.map(lo => lo.id === updated.id ? updated : lo));
  }

  setTpa(tpa: TpaPreauth[]): void { this.tpa.set(tpa); }
  addTpa(t: TpaPreauth): void { this.tpa.update(list => [...list, t]); }
  updateTpa(updated: TpaPreauth): void {
    this.tpa.update(list => list.map(t => t.id === updated.id ? updated : t));
  }

  setVariance(v: VarianceInfo | null): void { this.variance.set(v); }

  setConsents(consents: ConsentRecord[]): void { this.consents.set(consents); }
  addConsent(consent: ConsentRecord): void { this.consents.update(list => [...list, consent]); }

  setPreop(preop: PreopRecord | null): void { this.preop.set(preop); }
  setPostop(postop: PostopRecord | null): void { this.postop.set(postop); }

  setAttachments(attachments: SessionAttachment[]): void {
    this.attachments.set(attachments);
  }

  addAttachment(attachment: SessionAttachment): void {
    this.attachments.update(list => [...list, attachment]);
  }

  removeAttachment(id: string): void {
    this.attachments.update(list => list.filter(a => a.id !== id));
  }

  addPlanItem(planId: string, item: TreatmentPlanItem): void {
    this.plans.update(list =>
      list.map(plan =>
        plan.id === planId ? { ...plan, items: [...plan.items, item] } : plan
      )
    );
  }

  hydrate(data: { session: ClinicalSession; note: ClinicalNote | null; services?: ServicePerformed[]; examination?: Examination | null; diagnoses?: Diagnosis[]; chart?: ToothChart | null }): void {
    const { session, note } = data;

    // All fields are snake_case from the API — read them as-is
    this.sessionId.set(session.id);
    this.appointmentId.set(session.appointment_id);
    this.status.set(session.status);
    this.startedAt.set(session.started_at);
    this.sealedAt.set(session.sealed_at ?? null);
    this.syncTimerFromSession(session);

    this.patient.set({
      id: session.patient_id,
      name:           session.patient_name ?? '',
      phone:          session.patient_phone ?? '',
      age:            session.patient_age ?? null,
      gender:         session.patient_gender ?? null,
      clinicalHistory: session.patient_clinical_history ?? null,
    });

    this.notes.set(note ?? emptyNote());
    if (data.services)     this.services.set(data.services);
    if (data.examination)  this.examination.set(data.examination);
    if (data.diagnoses)    this.diagnoses.set(data.diagnoses);
    if (data.chart)        this.chart.set(data.chart);
  }

  updateNote(note: ClinicalNote): void {
    this.notes.set(note);
  }

  setServices(services: ServicePerformed[]): void {
    this.services.set(services);
  }

  addService(service: ServicePerformed): void {
    this.services.update(list => [...list, service]);
  }

  updateService(updated: ServicePerformed): void {
    this.services.update(list =>
      list.map(s => s.id === updated.id ? updated : s)
    );
  }

  setExamination(exam: Examination): void {
    this.examination.set(exam);
  }

  setDiagnoses(diagnoses: Diagnosis[]): void {
    this.diagnoses.set(diagnoses);
  }

  addDiagnosis(dx: Diagnosis): void {
    this.diagnoses.update(list => [...list, dx]);
  }

  removeDiagnosis(id: string): void {
    this.diagnoses.update(list => list.filter(d => d.id !== id));
  }

  setStatus(status: SessionStatus): void {
    this.status.set(status);
  }

  /**
   * Resume a paused session before clinical writes. No-op when already active.
   * Deduplicates concurrent resume calls (manual Resume + auto-resume on edit).
   */
  ensureResumedForEdit(): Observable<void> {
    if (this.isSealed()) {
      return throwError(() => new Error('Session is sealed'));
    }
    if (!this.isPaused()) {
      return of(undefined);
    }

    const sessionId = this.sessionId();
    if (!sessionId) {
      return throwError(() => new Error('No active session'));
    }

    if (!this.resumeInFlight$) {
      this.resuming.set(true);
      this.resumeInFlight$ = this.api.resumeSession(sessionId).pipe(
        tap(({ session }) => {
          this.applyResumedState(session);
          this.toast.success('Session resumed.');
        }),
        map(() => undefined),
        catchError((err) => {
          this.resumeInFlight$ = null;
          this.resuming.set(false);
          return throwError(() => err);
        }),
        finalize(() => {
          this.resumeInFlight$ = null;
          this.resuming.set(false);
        }),
        shareReplay({ bufferSize: 1, refCount: true }),
      );
    }

    return this.resumeInFlight$;
  }

  /** Align timer with server hydration; merge persisted client cache when API omits fields. */
  syncTimerFromSession(session: ClinicalSession): void {
    const cached = this.readTimerCache(session.id);
    let totalMs = 0;

    if (typeof session.total_paused_ms === 'number') {
      totalMs = Math.max(0, session.total_paused_ms);
    }
    if (cached) {
      totalMs = Math.max(totalMs, cached.totalPausedMs);
    }
    this.totalPausedMs.set(totalMs);

    const paused = session.status === 'PAUSED' || !!session.paused_at;
    if (paused) {
      const anchor = session.paused_at ?? cached?.pausedAtIso ?? session.updated_at ?? new Date().toISOString();
      this.pausedAt.set(anchor);
      this.writeTimerCache(session.id, totalMs, anchor);
      return;
    }

    // Resume may happen off-canvas (e.g. schedule "Resume Treatment") without calling resume here.
    if (cached?.pausedAtIso) {
      const pauseStartMs = new Date(cached.pausedAtIso).getTime();
      const resumeEndMs  = session.updated_at
        ? new Date(session.updated_at).getTime()
        : Date.now();
      if (resumeEndMs > pauseStartMs) {
        totalMs += resumeEndMs - pauseStartMs;
      }
    }

    this.totalPausedMs.set(totalMs);
    this.pausedAt.set(null);
    this.writeTimerCache(session.id, totalMs, null);
  }

  /** Freeze timer immediately when pause is initiated (before API returns). */
  beginPauseClock(): void {
    const anchor = new Date().toISOString();
    this.pausedAt.set(anchor);
    const sessionId = this.sessionId();
    if (sessionId) {
      this.writeTimerCache(sessionId, this.totalPausedMs(), anchor);
    }
  }

  /** Undo optimistic pause freeze when the pause API fails. */
  revertPauseClock(): void {
    this.pausedAt.set(null);
    const sessionId = this.sessionId();
    if (sessionId) {
      this.writeTimerCache(sessionId, this.totalPausedMs(), null);
    }
  }

  /** Apply server pause response and persist cumulative paused time. */
  applyPausedState(session: ClinicalSession): void {
    this.status.set(session.status === 'PAUSED' || session.paused_at ? 'PAUSED' : session.status);

    let totalMs = this.totalPausedMs();
    if (typeof session.total_paused_ms === 'number') {
      totalMs = Math.max(totalMs, Math.max(0, session.total_paused_ms));
    }
    this.totalPausedMs.set(totalMs);

    const anchor = session.paused_at ?? session.updated_at ?? this.pausedAt() ?? new Date().toISOString();
    this.pausedAt.set(anchor);
    this.writeTimerCache(session.id, totalMs, anchor);
  }

  /** Apply server resume response and fold the open pause interval into total paused time. */
  applyResumedState(session: ClinicalSession): void {
    this.status.set(session.status);

    let totalMs = this.totalPausedMs();
    if (typeof session.total_paused_ms === 'number') {
      totalMs = Math.max(totalMs, Math.max(0, session.total_paused_ms));
    } else {
      const pauseStart = this.pausedAt();
      if (pauseStart) {
        totalMs += Date.now() - new Date(pauseStart).getTime();
      }
    }

    this.totalPausedMs.set(Math.max(0, totalMs));
    this.pausedAt.set(null);
    this.writeTimerCache(session.id, totalMs, null);
  }

  reset(): void {
    this.sessionId.set(null);
    this.appointmentId.set(null);
    this.status.set('INITIALISED');
    this.startedAt.set(null);
    this.sealedAt.set(null);
    this.totalPausedMs.set(0);
    this.pausedAt.set(null);
    this.patient.set(null);
    this.examination.set(emptyExamination());
    this.diagnoses.set([]);
    this.services.set([]);
    this.notes.set(emptyNote());
    this.chart.set(null);
    this.plans.set([]);
    this.prescriptions.set([]);
    this.investigations.set([]);
    this.cart.set([]);
    this.labOrders.set([]);
    this.attachments.set([]);
    this.consents.set([]);
    this.preop.set(null);
    this.postop.set(null);
    this.tpa.set([]);
    this.variance.set(null);
    this.error.set(null);
    this.loading.set(false);
  }

  // ── Public validation (used by end-treatment modal) ──────────────────────

  validateSealPublic(): ValidationFailure[] {
    return this.validateSeal().failures;
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private timerCacheKey(sessionId: string): string {
    return `df:session-timer:${sessionId}`;
  }

  private readTimerCache(sessionId: string): { totalPausedMs: number; pausedAtIso: string | null } | null {
    try {
      const raw = sessionStorage.getItem(this.timerCacheKey(sessionId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { totalPausedMs?: number; pausedAtIso?: string | null };
      if (typeof parsed.totalPausedMs !== 'number') return null;
      return {
        totalPausedMs: Math.max(0, parsed.totalPausedMs),
        pausedAtIso: parsed.pausedAtIso ?? null,
      };
    } catch {
      return null;
    }
  }

  private writeTimerCache(sessionId: string, totalPausedMs: number, pausedAtIso: string | null): void {
    try {
      sessionStorage.setItem(
        this.timerCacheKey(sessionId),
        JSON.stringify({ totalPausedMs: Math.max(0, totalPausedMs), pausedAtIso }),
      );
    } catch {
      // sessionStorage may be unavailable in private mode / quota exceeded
    }
  }

  private validateSeal(): { ok: boolean; failures: ValidationFailure[] } {
    const failures: ValidationFailure[] = [];

    if (this.offlineQueueDepth() > 0) {
      failures.push({ block: 'sync', message: 'Unsynced changes — wait for reconnect' });
    }
    if (this.inProgressServices().length > 0) {
      failures.push({
        block: 'services',
        message: `${this.inProgressServices().length} service(s) still in progress`,
      });
    }
    if (this.unconsentedFlaggedServices().length > 0) {
      failures.push({ block: 'consents', message: 'Consents missing for flagged services' });
    }

    return { ok: failures.length === 0, failures };
  }
}
