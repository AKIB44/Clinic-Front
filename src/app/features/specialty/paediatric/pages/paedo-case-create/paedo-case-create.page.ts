import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatStepperModule } from '@angular/material/stepper';
import { MatCardModule } from '@angular/material/card';
import { DfPatientSearchComponent } from '../../../shared/components/df-patient-search/df-patient-search.component';
import { PaedoCaseApiService } from '../../services/paedo-case-api.service';
import { Patient, PatientsService } from '../../../../../services/patients.service';

@Component({
  selector: 'app-paedo-case-create',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatStepperModule, MatCardModule,
    DfPatientSearchComponent,
  ],
  templateUrl: './paedo-case-create.page.html',
  styleUrl: './paedo-case-create.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaedoCaseCreatePage {
  private readonly api = inject(PaedoCaseApiService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly selectedPatient = signal<Patient | null>(null);
  protected readonly prefilledPatient = signal<Patient | null>(null);
  private readonly route = inject(ActivatedRoute);
  private readonly patientsService = inject(PatientsService);

  constructor() {
    // Referral deep-link → pre-select + lock the patient (manual path unchanged).
    const pid = this.route.snapshot.queryParamMap.get("patientId");
    if (pid) {
      this.patientsService.getById(pid).subscribe({
        next: (res) => { this.prefilledPatient.set(res.patient); this.selectedPatient.set(res.patient); },
        error: () => { /* ignore — user can still search manually */ },
      });
    }
  }

  protected readonly detailsForm = this.fb.group({});

  protected get step1Valid(): boolean {
    return this.selectedPatient() !== null;
  }

  protected onPatientSelected(patient: Patient): void {
    this.selectedPatient.set(patient);
  }

  protected submit(): void {
    const patient = this.selectedPatient();
    if (!patient) return;
    this.saving.set(true);
    this.error.set(null);
    const payload = { patient_id: patient.id, ...this.detailsForm.value };
    this.api.createCase(payload as Record<string, unknown>).subscribe({
      next: (res) => this.router.navigate(['/specialty/paediatric/cases', res.id]),
      error: (e) => { this.error.set(e?.error?.error ?? e.message); this.saving.set(false); },
    });
  }
}
