import {
  Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ClinicsService } from '../../../services/clinics.service';
import { Clinic } from '../../../models/clinic.model';

@Component({
  selector: 'app-clinic-profile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule, TablerIconsModule],
  templateUrl: './clinic-profile.component.html',
  styleUrls: ['./clinic-profile.component.scss'],
})
export class ClinicProfileComponent implements OnInit {
  private svc   = inject(ClinicsService);
  private snack = inject(MatSnackBar);
  private cdr   = inject(ChangeDetectorRef);

  loading = true;
  saving  = false;
  clinic: Clinic | null = null;

  form = new FormGroup({
    name:     new FormControl('', [Validators.required]),
    phone:    new FormControl('', [Validators.required]),
    email:    new FormControl('', [Validators.required, Validators.email]),
    address:  new FormControl('', [Validators.required]),
    city:     new FormControl('', [Validators.required]),
    state:    new FormControl(''),
    logo_url: new FormControl(''),
  });

  ngOnInit() {
    // Backend resolves clinic from JWT — no ID param needed
    this.svc.get().subscribe({
      next: (r) => {
        this.clinic = r.clinic;
        this.form.patchValue(r.clinic);
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => { this.loading = false; this.cdr.markForCheck(); },
    });
  }

  save() {
    if (this.form.invalid) return;
    this.saving = true;
    this.svc.update(this.form.value as Partial<Clinic>).subscribe({
      next: (r) => {
        this.clinic = r.clinic;
        this.saving = false;
        this.snack.open('Clinic profile updated', '', { duration: 3000 });
        this.cdr.markForCheck();
      },
      error: () => { this.saving = false; this.cdr.markForCheck(); },
    });
  }
}
