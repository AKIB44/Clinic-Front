import {
  Component, ChangeDetectionStrategy, output, signal, inject, OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of, takeUntil } from 'rxjs';
import { PatientsService, Patient } from '../../../../../services/patients.service';

@Component({
  selector: 'df-patient-search',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    MatProgressSpinnerModule,
    MatIconModule,
  ],
  templateUrl: './df-patient-search.component.html',
  styleUrl: './df-patient-search.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DfPatientSearchComponent implements OnDestroy {
  private readonly patientsService = inject(PatientsService);
  private readonly destroy$ = new Subject<void>();

  /** Emits the full Patient object when user selects one from the dropdown. */
  readonly patientSelected = output<Patient>();

  readonly searchCtrl = new FormControl('');
  readonly results = signal<Patient[]>([]);
  readonly loading = signal(false);
  readonly selectedPatient = signal<Patient | null>(null);

  constructor() {
    this.searchCtrl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(term => {
        if (!term || term.length < 2 || typeof term !== 'string') {
          this.results.set([]);
          return of({ patients: [] });
        }
        this.loading.set(true);
        return this.patientsService.search(term);
      }),
      takeUntil(this.destroy$),
    ).subscribe({
      next: (res) => {
        this.results.set(res.patients ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected displayFn(patient: Patient | string | null): string {
    if (!patient || typeof patient === 'string') return patient as string ?? '';
    return `${patient.name} — ${patient.phone}`;
  }

  protected onOptionSelected(patient: Patient): void {
    this.selectedPatient.set(patient);
    this.patientSelected.emit(patient);
  }

  protected clearSelection(): void {
    this.selectedPatient.set(null);
    this.searchCtrl.setValue('');
    this.results.set([]);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
