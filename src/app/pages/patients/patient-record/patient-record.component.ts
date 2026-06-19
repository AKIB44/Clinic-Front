import {
  ChangeDetectionStrategy, ChangeDetectorRef,
  Component, OnInit, computed, inject, signal,
} from '@angular/core';
import { CommonModule, DatePipe, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import {
  PatientsService, PatientFullRecord, PatientSession,
  PatientAppointment, PatientLabOrder,
} from '../../../services/patients.service';
import { ClinicServicesService } from '../../../services/clinic-services.service';
import { ClinicService } from '../../../models/clinic.model';
import { RxHistoryTabComponent } from '../../rx/rx-history-tab/rx-history-tab.component';
import { SpecialtyApiService } from '../../../features/specialty/shared/services/specialty-api.service';
import { DfSpecialtyCaseSummaryComponent } from '../../../features/specialty/shared/components/df-specialty-case-summary/df-specialty-case-summary.component';
import { SpecialtyCase } from '../../../features/specialty/shared/models/specialty.model';
import { format, parseISO } from 'date-fns';
import { formatAppointmentDateTime12h } from '../../../utils/appointment-time';

type PatientTab = 'overview' | 'appointments' | 'sessions' | 'plans' | 'prescriptions' | 'billing' | 'specialty';

const STATUS_LABEL: Record<string, string> = {
  booked: 'Booked', confirmed: 'Confirmed', in_progress: 'In Progress',
  done: 'Done', no_show: 'No Show', cancelled: 'Cancelled',
};

const SESSION_STATUS_LABEL: Record<string, string> = {
  open: 'Open', completed: 'Completed', sealed: 'Sealed', cancelled: 'Cancelled',
};

const PLAN_ITEM_STATUS_LABEL: Record<string, string> = {
  PROPOSED: 'Proposed', ACCEPTED: 'Accepted', DECLINED: 'Declined',
  IN_PROGRESS: 'In Progress', DONE: 'Done', PARTIAL: 'Partial', CANCELLED: 'Cancelled',
};

const LAB_STATUS_LABEL: Record<string, string> = {
  pending: 'Pending', in_progress: 'In Progress', ready: 'Ready',
  delivered: 'Delivered', cancelled: 'Cancelled',
};

@Component({
  selector: 'app-patient-record',
  standalone: true,
  imports: [
    CommonModule, DatePipe, TitleCasePipe, FormsModule,
    RouterLink, MaterialModule, TablerIconsModule, RxHistoryTabComponent,
    DfSpecialtyCaseSummaryComponent,
  ],
  templateUrl: './patient-record.component.html',
  styleUrls: ['./patient-record.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientRecordComponent implements OnInit {
  private readonly route        = inject(ActivatedRoute);
  private readonly router       = inject(Router);
  private readonly patSvc       = inject(PatientsService);
  private readonly svcSvc       = inject(ClinicServicesService);
  private readonly specialtyApi = inject(SpecialtyApiService);
  private readonly cdr          = inject(ChangeDetectorRef);

  loading  = signal(true);
  errorMsg = signal<string | null>(null);
  record   = signal<PatientFullRecord | null>(null);
  services = signal<ClinicService[]>([]);
  activeTab    = signal<PatientTab>('overview');
  filterSvcId  = signal('');

  specialtyCases        = signal<SpecialtyCase[]>([]);
  specialtyLoading      = signal(false);
  specialtyLoaded       = signal(false);

  readonly patient = computed(() => this.record()?.patient ?? null);

  readonly initials = computed(() => {
    const name = this.patient()?.name?.trim();
    if (!name) return 'P';
    return name.split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase()).join('');
  });

  readonly allAppts = computed(() => this.record()?.appointments ?? []);

  readonly filteredAppts = computed(() => {
    const svcId = this.filterSvcId();
    return svcId ? this.allAppts().filter(a => a.service_id === svcId) : this.allAppts();
  });

  readonly activePlansCount = computed(() =>
    (this.record()?.treatment_plans ?? []).filter(p =>
      p.items.some(i => i.status === 'PROPOSED' || i.status === 'ACCEPTED' || i.status === 'IN_PROGRESS')
    ).length
  );

  readonly statusLabel          = STATUS_LABEL;
  readonly sessionStatusLabel   = SESSION_STATUS_LABEL;
  readonly planItemStatusLabel  = PLAN_ITEM_STATUS_LABEL;
  readonly labStatusLabel       = LAB_STATUS_LABEL;

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.loading.set(false); this.errorMsg.set('Patient id is missing.'); return; }

    this.svcSvc.list().subscribe({
      next: r => { this.services.set((r.services ?? []).filter(s => s.is_active !== false)); this.cdr.markForCheck(); },
    });

    this.loadRecord(id);
  }

  private loadRecord(id: string) {
    this.loading.set(true);
    this.errorMsg.set(null);
    this.patSvc.getFullRecord(id).subscribe({
      next: res => {
        this.record.set(res);
        this.loading.set(false);
        this.cdr.markForCheck();
      },
      error: () => {
        this.errorMsg.set('Could not load patient record.');
        this.loading.set(false);
        this.cdr.markForCheck();
      },
    });
  }

  loadSpecialtyCases(patientId: string): void {
    if (this.specialtyLoaded() || this.specialtyLoading()) return;
    this.specialtyLoading.set(true);
    this.specialtyApi.getCasesForPatient(patientId).subscribe({
      next: res => {
        this.specialtyCases.set(res.cases ?? []);
        this.specialtyLoading.set(false);
        this.specialtyLoaded.set(true);
        this.cdr.markForCheck();
      },
      error: () => {
        this.specialtyLoading.set(false);
        this.specialtyLoaded.set(true);
        this.cdr.markForCheck();
      },
    });
  }

  onTabChange(tab: PatientTab): void {
    this.activeTab.set(tab);
    if (tab === 'specialty') {
      const id = this.patient()?.id;
      if (id) this.loadSpecialtyCases(id);
    }
  }

  goBack() {
    const from = this.route.snapshot.queryParamMap.get('from');
    this.router.navigate([from === 'schedule' ? '/schedule' : '/patients']);
  }

  formatDateTime(iso: string): string {
    return formatAppointmentDateTime12h(iso);
  }

  formatDate(iso: string): string {
    try { return format(parseISO(iso.replace('Z', '')), 'd MMM yyyy'); } catch { return iso; }
  }

  statusClass(status: string): string { return `s-${status}`; }

  sessionStatusClass(s: string): string {
    return { open: 'ss-open', completed: 'ss-done', sealed: 'ss-sealed', cancelled: 'ss-cancelled' }[s] ?? 'ss-open';
  }

  planItemStatusClass(s: string): string {
    return {
      DONE: 'pi-done', PARTIAL: 'pi-done',
      IN_PROGRESS: 'pi-progress', ACCEPTED: 'pi-progress',
      PROPOSED: 'pi-pending',
      DECLINED: 'pi-skipped', CANCELLED: 'pi-skipped',
    }[s] ?? '';
  }

  labStatusClass(s: string): string {
    return { ready: 'ls-ready', delivered: 'ls-done', pending: 'ls-pending', in_progress: 'ls-progress', cancelled: 'ls-cancelled' }[s] ?? '';
  }

  apptCountFor(svcId: string): number { return this.allAppts().filter(a => a.service_id === svcId).length; }

  toothDisplay(teeth: string[] | null): string {
    if (!teeth?.length) return '';
    return teeth.join(', ');
  }

  sessionBilledLabel(s: PatientSession): string {
    const total = s.services_performed.reduce((sum, sp) => sum + (sp.final_charge ?? 0), 0);
    return total > 0 ? `₹${total.toLocaleString('en-IN')}` : '—';
  }

  planCostMin(items: { cost_min: number | null }[]): number {
    return items.reduce((s, i) => s + (i.cost_min ?? 0), 0);
  }

  planCostMax(items: { cost_max: number | null }[]): number {
    return items.reduce((s, i) => s + (i.cost_max ?? 0), 0);
  }

  labOrdersWithCost(): PatientLabOrder[] {
    return (this.record()?.lab_orders ?? []).filter(lo => lo.lab_cost != null);
  }

  sessionSvcNames(s: PatientSession): string {
    const names = s.services_performed.slice(0, 2).map(sp => sp.service_name).join(', ');
    const extra = s.services_performed.length > 2 ? ` +${s.services_performed.length - 2}` : '';
    return names + extra;
  }

  sessionHasMore(s: PatientSession): boolean {
    return s.services_performed.length > 2;
  }

  sessionExtraCount(s: PatientSession): number {
    return s.services_performed.length - 2;
  }

  sessionsWithCharge(): PatientSession[] {
    return (this.record()?.sessions ?? []).filter(s => +s.session_charge > 0);
  }
}
