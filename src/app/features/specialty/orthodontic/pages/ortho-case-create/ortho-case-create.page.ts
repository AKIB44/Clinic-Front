import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatStepperModule } from '@angular/material/stepper';
import { MatCardModule } from '@angular/material/card';
import { DfPatientSearchComponent } from '../../../shared/components/df-patient-search/df-patient-search.component';
import { OrthoCaseApiService } from '../../services/ortho-case-api.service';
import { Patient } from '../../../../../services/patients.service';

@Component({
  selector: 'app-ortho-case-create',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatStepperModule, MatCardModule,
    DfPatientSearchComponent,
  ],
  templateUrl: './ortho-case-create.page.html',
  styleUrl: './ortho-case-create.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrthoCaseCreatePage {
  private readonly api = inject(OrthoCaseApiService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly selectedPatient = signal<Patient | null>(null);

  protected readonly step2 = this.fb.group({
    appliance_type:           ['METAL_BRACES', Validators.required],
    expected_duration_months: [18],
    overjet_mm:               [null as number | null],
    overbite_mm:              [null as number | null],
  });

  protected readonly step3 = this.fb.group({
    treatment_objectives: [''],
  });

  protected readonly applianceTypes = [
    { value: 'METAL_BRACES',   label: 'Metal Braces' },
    { value: 'CERAMIC_BRACES', label: 'Ceramic Braces' },
    { value: 'SELF_LIGATING',  label: 'Self-Ligating' },
    { value: 'CLEAR_ALIGNERS', label: 'Clear Aligners' },
    { value: 'COMBINATION',    label: 'Combination' },
  ];

  protected onPatientSelected(patient: Patient): void {
    this.selectedPatient.set(patient);
  }

  protected get step1Valid(): boolean {
    return this.selectedPatient() !== null;
  }

  protected submit(): void {
    const patient = this.selectedPatient();
    if (!patient) return;
    this.saving.set(true);
    this.error.set(null);
    const payload = {
      patient_id: patient.id,
      ...this.step2.value,
      ...this.step3.value,
    };
    this.api.createCase(payload as Record<string, unknown>).subscribe({
      next: (res) => this.router.navigate(['/specialty/orthodontic/cases', res.id]),
      error: (e) => { this.error.set(e?.error?.error ?? e.message); this.saving.set(false); },
    });
  }
}
