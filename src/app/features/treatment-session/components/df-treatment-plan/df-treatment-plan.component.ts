import {
  Component, OnInit, inject, signal, computed, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { SessionStore } from '../../store/session.store';
import { SessionApiService } from '../../services/session-api.service';
import { ToastService } from '../../../../services/toast.service';
import { ClinicServicesService } from '../../../../services/clinic-services.service';
import { ClinicService } from '../../../../models/clinic.model';
import { isOfflineQueued } from '../../../../core/offline/offline-queue.service';
import {
  TreatmentPlan, TreatmentPlanItem, PlanPriority, PlanDeclineReason
} from '../../models/session.model';

const PRIORITY_META: Record<PlanPriority, { label: string; color: string; bg: string }> = {
  urgent:      { label: 'Urgent',      color: '#b91c1c', bg: '#fff1f2' },
  recommended: { label: 'Recommended', color: '#0369a1', bg: '#f0f9ff' },
  optional:    { label: 'Optional',    color: '#15803d', bg: '#f0fdf4' },
  cosmetic:    { label: 'Cosmetic',    color: '#7c3aed', bg: '#faf5ff' },
};

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  PROPOSED:    { label: 'Proposed',    color: '#64748b', bg: '#f1f5f9' },
  ACCEPTED:    { label: 'Accepted',    color: '#0369a1', bg: '#f0f9ff' },
  DECLINED:    { label: 'Declined',    color: '#b91c1c', bg: '#fff1f2' },
  IN_PROGRESS: { label: 'In Progress', color: '#d97706', bg: '#fffbeb' },
  DONE:        { label: 'Done',        color: '#15803d', bg: '#f0fdf4' },
  PARTIAL:     { label: 'Partial',     color: '#b45309', bg: '#fffbeb' },
  CANCELLED:   { label: 'Cancelled',   color: '#6b7280', bg: '#f3f4f6' },
};

const DECLINE_REASONS: { value: PlanDeclineReason; label: string }[] = [
  { value: 'cost',           label: 'Cost concerns' },
  { value: 'time',           label: 'Time / scheduling' },
  { value: 'fear',           label: 'Fear / anxiety' },
  { value: 'second_opinion', label: 'Seeking second opinion' },
  { value: 'medical',        label: 'Medical reasons' },
];

@Component({
  selector: 'df-treatment-plan',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule],
  templateUrl: './df-treatment-plan.component.html',
  styleUrl: './df-treatment-plan.component.scss',
})
export class DfTreatmentPlanComponent implements OnInit {
  readonly store  = inject(SessionStore);
  private api     = inject(SessionApiService);
  private toast   = inject(ToastService);
  private svcSvc  = inject(ClinicServicesService);

  readonly creating    = signal(false);
  readonly updating    = signal<string | null>(null);
  readonly addingTo    = signal<string | null>(null);
  readonly addingItem  = signal(false);
  readonly addError    = signal<string | null>(null);

  readonly decliningItem           = signal<TreatmentPlanItem | null>(null);
  readonly selectedDeclineReason   = signal<PlanDeclineReason | null>(null);

  addSearchTerm = '';
  addPriority: PlanPriority = 'recommended';
  addSessions  = 1;
  addCostMin: number | null = null;
  addCostMax: number | null = null;
  addNotes     = '';
  readonly addService    = signal<ClinicService | null>(null);
  readonly allServices   = signal<ClinicService[]>([]);
  readonly filteredServices = computed(() => {
    const term = this.addSearchTerm.toLowerCase().trim();
    if (!term) return this.allServices().slice(0, 8);
    return this.allServices().filter(s => s.name.toLowerCase().includes(term)).slice(0, 10);
  });

  readonly totalItems = computed(() =>
    this.store.plans().reduce((sum, p) => sum + p.items.length, 0)
  );

  readonly priorities: PlanPriority[] = ['urgent', 'recommended', 'optional', 'cosmetic'];
  readonly declineReasons = DECLINE_REASONS;

  ngOnInit(): void {
    this.svcSvc.list().subscribe({ next: ({ services }) => this.allServices.set(services) });
  }

  priorityMeta(p: PlanPriority) { return PRIORITY_META[p]; }
  statusMeta(s: string)         { return STATUS_META[s] ?? STATUS_META['PROPOSED']; }
  declineLabel(r: string)       { return DECLINE_REASONS.find(d => d.value === r)?.label ?? r; }
  displayFn(s: ClinicService | null) { return s?.name ?? ''; }
  onSearch() {}

  itemsByPriority(plan: TreatmentPlan, priority: PlanPriority): TreatmentPlanItem[] {
    return plan.items.filter(i => i.priority === priority);
  }

  createPlan(): void {
    const patientId = this.store.patient()?.id;
    if (!patientId) return;
    this.creating.set(true);
    // Mint the id client-side so an offline create can be shown immediately and
    // replayed with a stable id (the backend accepts it via COALESCE).
    const id = crypto.randomUUID();
    this.api.createPlan(patientId, { id }).subscribe({
      next: ({ plan }) => {
        this.creating.set(false);
        this.store.setPlans([{ ...plan, items: [] }, ...this.store.plans()]);
        this.toast.success('Treatment plan created.');
      },
      error: (err) => {
        this.creating.set(false);
        if (isOfflineQueued(err)) {
          this.store.setPlans([
            { id, patient_id: patientId, title: 'Treatment Plan', items: [], created_at: new Date().toISOString() },
            ...this.store.plans(),
          ]);
          this.toast.success('Plan saved offline — will sync when you’re back online.');
        } else {
          this.toast.error('Failed to create treatment plan.');
        }
      },
    });
  }

  startAdd(planId: string): void {
    this.addingTo.set(planId);
    this.addSearchTerm = '';
    this.addService.set(null);
    this.addPriority = 'recommended';
    this.addSessions = 1;
    this.addCostMin  = null;
    this.addCostMax  = null;
    this.addNotes    = '';
    this.addError.set(null);
  }

  cancelAdd(): void {
    this.addingTo.set(null);
    this.addError.set(null);
  }

  confirmAddItem(planId: string): void {
    const svc = this.addService();
    if (!svc) return;
    this.addingItem.set(true);
    this.addError.set(null);
    const id = crypto.randomUUID();
    this.api.addPlanItem(planId, {
      id,
      service_id:           svc.id,
      priority:             this.addPriority,
      estimated_sessions:   this.addSessions || 1,
      cost_min:             this.addCostMin ?? undefined,
      cost_max:             this.addCostMax ?? undefined,
      patient_facing_notes: this.addNotes || undefined,
    }).subscribe({
      next: ({ item }) => {
        this.addingItem.set(false);
        this.store.addPlanItem(planId, { ...item, service_name: svc.name });
        this.cancelAdd();
        this.toast.success(`${svc.name} added to plan.`);
      },
      error: (err) => {
        this.addingItem.set(false);
        if (isOfflineQueued(err)) {
          this.store.addPlanItem(planId, {
            id,
            plan_id:              planId,
            service_id:           svc.id,
            service_name:         svc.name,
            linked_diagnosis_id:  null,
            tooth_numbers:        [],
            estimated_sessions:   this.addSessions || 1,
            done_sessions:        0,
            cost_min:             this.addCostMin ?? null,
            cost_max:             this.addCostMax ?? null,
            priority:             this.addPriority,
            status:               'PROPOSED',
            decline_reason:       null,
            patient_facing_notes: this.addNotes || null,
            created_at:           new Date().toISOString(),
          });
          this.cancelAdd();
          this.toast.success(`${svc.name} added offline — will sync when you’re back online.`);
        } else {
          const msg = err?.error?.error ?? 'Failed to add plan item.';
          this.addError.set(msg);
          this.toast.error(msg);
        }
      },
    });
  }

  acceptItem(item: TreatmentPlanItem): void {
    this.updating.set(item.id);
    this.api.updatePlanItem(item.id, { status: 'ACCEPTED' }).subscribe({
      next: ({ item: updated }) => {
        this.updating.set(null);
        this.store.updatePlanItem(updated);
        this.toast.success('Plan item accepted.');
      },
      error: (err) => {
        this.updating.set(null);
        if (isOfflineQueued(err)) {
          this.store.updatePlanItem({ ...item, status: 'ACCEPTED' });
          this.toast.success('Accepted offline — will sync when you’re back online.');
        } else {
          this.toast.error('Failed to update plan item.');
        }
      },
    });
  }

  declineItem(item: TreatmentPlanItem): void {
    this.decliningItem.set(item);
    this.selectedDeclineReason.set(null);
  }

  cancelDecline(): void {
    this.decliningItem.set(null);
    this.selectedDeclineReason.set(null);
  }

  confirmDecline(): void {
    const item   = this.decliningItem();
    const reason = this.selectedDeclineReason();
    if (!item || !reason) return;
    this.updating.set(item.id);
    this.api.updatePlanItem(item.id, { status: 'DECLINED', decline_reason: reason }).subscribe({
      next: ({ item: updated }) => {
        this.updating.set(null);
        this.store.updatePlanItem(updated);
        this.cancelDecline();
        this.toast.warn('Plan item declined.');
      },
      error: (err) => {
        this.updating.set(null);
        if (isOfflineQueued(err)) {
          this.store.updatePlanItem({ ...item, status: 'DECLINED', decline_reason: reason });
          this.cancelDecline();
          this.toast.warn('Declined offline — will sync when you’re back online.');
        } else {
          this.toast.error('Failed to decline plan item.');
        }
      },
    });
  }
}
