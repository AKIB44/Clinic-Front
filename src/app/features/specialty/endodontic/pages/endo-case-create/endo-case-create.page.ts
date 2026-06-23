import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatStepperModule } from '@angular/material/stepper';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { DfPatientSearchComponent } from '../../../shared/components/df-patient-search/df-patient-search.component';
import { EndoCaseApiService } from '../../services/endo-case-api.service';
import { Patient, PatientsService } from '../../../../../services/patients.service';

@Component({
  selector: 'app-endo-case-create',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatStepperModule, MatCardModule, MatCheckboxModule,
    DfPatientSearchComponent,
  ],
  templateUrl: './endo-case-create.page.html',
  styleUrl: './endo-case-create.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EndoCaseCreatePage {
  private readonly api = inject(EndoCaseApiService);
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

  protected readonly protocols = [
    { value: 'SINGLE_VISIT', label: 'Single visit' },
    { value: 'TWO_VISIT',    label: 'Two visit' },
    { value: 'MULTI_VISIT',  label: 'Multi visit' },
  ];
  protected readonly pulpDiagnoses = [
    'Normal Pulp', 'Reversible Pulpitis', 'Symptomatic Irreversible Pulpitis',
    'Asymptomatic Irreversible Pulpitis', 'Pulp Necrosis', 'Previously Treated', 'Previously Initiated',
  ];
  protected readonly periapicalDiagnoses = [
    'Normal Apical Tissues', 'Symptomatic Apical Periodontitis', 'Asymptomatic Apical Periodontitis',
    'Acute Apical Abscess', 'Chronic Apical Abscess', 'Condensing Osteitis',
  ];

  protected readonly detailsForm = this.fb.group({
    fdi_tooth:            [null as number | null, [Validators.required, Validators.min(11), Validators.max(85)]],
    protocol:             ['SINGLE_VISIT', Validators.required],
    expected_canal_count: [1, [Validators.min(1), Validators.max(6)]],
    is_retreatment:       [false],
    is_apicoectomy:       [false],
    pulp_diagnosis:       [''],
    periapical_diagnosis: [''],
    presentation_notes:   [''],
  });

  protected get step1Valid(): boolean {
    return this.selectedPatient() !== null;
  }

  protected onPatientSelected(patient: Patient): void {
    this.selectedPatient.set(patient);
  }

  protected submit(): void {
    const patient = this.selectedPatient();
    if (!patient || this.detailsForm.invalid) return;
    this.saving.set(true);
    this.error.set(null);
    const raw = { patient_id: patient.id, ...this.detailsForm.value };
    const payload = Object.fromEntries(
      Object.entries(raw).filter(([, v]) => v !== null && v !== undefined && v !== ''),
    );
    this.api.createCase(payload as Record<string, unknown>).subscribe({
      next: (res) => this.router.navigate(['/specialty/endodontic/cases', res.id]),
      error: (e) => { this.error.set(e?.error?.error ?? e.message); this.saving.set(false); },
    });
  }
}
