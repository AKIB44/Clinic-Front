import {
  ChangeDetectionStrategy, ChangeDetectorRef,
  Component, OnInit, computed, inject, signal
} from '@angular/core';
import { CommonModule, DatePipe, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { PatientsService, Patient, PatientAppointment } from '../../../services/patients.service';
import { ClinicServicesService } from '../../../services/clinic-services.service';
import { ClinicService } from '../../../models/clinic.model';
import { RxHistoryTabComponent } from '../../rx/rx-history-tab/rx-history-tab.component';
import { format, parseISO } from 'date-fns';

type PatientTab = 'overview' | 'appointments' | 'prescriptions';

const STATUS_LABEL: Record<string, string> = {
  booked: 'Booked', confirmed: 'Confirmed', in_progress: 'In Progress',
  done: 'Done', no_show: 'No Show', cancelled: 'Cancelled',
};

@Component({
  selector: 'app-patient-record',
  standalone: true,
  imports: [
    CommonModule, DatePipe, TitleCasePipe, FormsModule,
    RouterLink, MaterialModule, TablerIconsModule, RxHistoryTabComponent,
  ],
  templateUrl: './patient-record.component.html',
  styleUrls: ['./patient-record.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientRecordComponent implements OnInit {
  private readonly route    = inject(ActivatedRoute);
  private readonly router   = inject(Router);
  private readonly patSvc   = inject(PatientsService);
  private readonly svcSvc   = inject(ClinicServicesService);
  private readonly cdr      = inject(ChangeDetectorRef);

  loading     = signal(true);
  errorMsg    = signal<string | null>(null);
  patient     = signal<Patient | null>(null);
  allAppts    = signal<PatientAppointment[]>([]);
  services    = signal<ClinicService[]>([]);
  activeTab   = signal<PatientTab>('overview');
  filterSvcId = signal('');

  readonly initials = computed(() => {
    const name = this.patient()?.name?.trim();
    if (!name) return 'P';
    return name.split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase()).join('');
  });

  readonly filteredAppts = computed(() => {
    const svcId = this.filterSvcId();
    return svcId ? this.allAppts().filter(a => a.service_id === svcId) : this.allAppts();
  });

  readonly statusLabel = STATUS_LABEL;

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.loading.set(false); this.errorMsg.set('Patient id is missing.'); return; }

    this.svcSvc.list().subscribe({
      next: r => { this.services.set((r.services ?? []).filter(s => s.is_active !== false)); this.cdr.markForCheck(); },
    });

    this.loadPatient(id);
  }

  private loadPatient(id: string) {
    this.loading.set(true);
    this.errorMsg.set(null);
    this.patSvc.getById(id).subscribe({
      next: res => {
        this.patient.set(res.patient);
        this.allAppts.set(res.appointments ?? []);
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

  goBack() {
    const from = this.route.snapshot.queryParamMap.get('from');
    this.router.navigate([from === 'schedule' ? '/schedule' : '/patients']);
  }

  formatDateTime(iso: string): string {
    try { return format(parseISO(iso.replace('Z', '')), 'EEE, d MMM yyyy · h:mm a'); } catch { return iso; }
  }

  statusClass(status: string): string { return `s-${status}`; }

  apptCountFor(svcId: string): number { return this.allAppts().filter(a => a.service_id === svcId).length; }
}
