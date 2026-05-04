import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MaterialModule } from '../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { PatientsService, Patient } from '../../../services/patients.service';
import { RxHistoryTabComponent } from '../../rx/rx-history-tab/rx-history-tab.component';

type PatientTab = 'overview' | 'prescriptions';

@Component({
  selector: 'app-patient-record',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    RouterLink,
    MaterialModule,
    TablerIconsModule,
    RxHistoryTabComponent,
  ],
  templateUrl: './patient-record.component.html',
  styleUrls: ['./patient-record.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientRecordComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly patientsService = inject(PatientsService);

  loading = signal(true);
  errorMsg = signal<string | null>(null);
  patient = signal<Patient | null>(null);
  activeTab = signal<PatientTab>('overview');

  readonly initials = computed(() => {
    const name = this.patient()?.name?.trim();
    if (!name) return 'P';
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading.set(false);
      this.errorMsg.set('Patient id is missing.');
      return;
    }
    this.loadPatient(id);
  }

  private loadPatient(id: string): void {
    this.loading.set(true);
    this.errorMsg.set(null);
    this.patientsService.getById(id).subscribe({
      next: (res) => {
        this.patient.set(res.patient);
        this.loading.set(false);
      },
      error: () => {
        this.errorMsg.set('Could not load patient record.');
        this.loading.set(false);
      },
    });
  }
}
