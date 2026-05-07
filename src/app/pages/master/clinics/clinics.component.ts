import {
  Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MatDialog, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ToastService } from '../../../services/toast.service';
import { ClinicsService } from '../../../services/clinics.service';
import { Clinic } from '../../../models/clinic.model';

@Component({
  selector: 'clinic-form-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule],
  template: `
    <h2 mat-dialog-title>{{ data?.id ? 'Edit Clinic' : 'Add Clinic' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Clinic Name</mat-label>
          <input matInput formControlName="name" placeholder="e.g. Sharayu Dental">
        </mat-form-field>
        <div class="two-col">
          <mat-form-field appearance="outline">
            <mat-label>Phone</mat-label>
            <input matInput formControlName="phone">
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Email</mat-label>
            <input matInput formControlName="email" type="email">
          </mat-form-field>
        </div>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Address</mat-label>
          <input matInput formControlName="address">
        </mat-form-field>
        <div class="two-col">
          <mat-form-field appearance="outline">
            <mat-label>City</mat-label>
            <input matInput formControlName="city">
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>State</mat-label>
            <input matInput formControlName="state">
          </mat-form-field>
        </div>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Logo URL</mat-label>
          <input matInput formControlName="logo_url" placeholder="https://...">
        </mat-form-field>
        <mat-slide-toggle formControlName="is_active" color="primary">Active</mat-slide-toggle>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-stroked-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" [disabled]="form.invalid || saving" (click)="save()">
        {{ saving ? 'Saving…' : 'Save' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-form { display: flex; flex-direction: column; gap: 4px; min-width: 480px; padding-top: 8px; }
    .full-width { width: 100%; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    mat-slide-toggle { margin-bottom: 8px; }
    @media (max-width: 540px) { .dialog-form { min-width: unset; } .two-col { grid-template-columns: 1fr; } }
  `]
})
export class ClinicFormDialog {
  dialogRef = inject(MatDialogRef<ClinicFormDialog>);
  data      = inject<Clinic | null>(MAT_DIALOG_DATA);
  private svc = inject(ClinicsService);

  saving = false;
  form = new FormGroup({
    name:      new FormControl(this.data?.name      ?? '', [Validators.required]),
    phone:     new FormControl(this.data?.phone     ?? '', [Validators.required]),
    email:     new FormControl(this.data?.email     ?? '', [Validators.required, Validators.email]),
    address:   new FormControl(this.data?.address   ?? '', [Validators.required]),
    city:      new FormControl(this.data?.city      ?? '', [Validators.required]),
    state:     new FormControl(this.data?.state     ?? ''),
    logo_url:  new FormControl(this.data?.logo_url  ?? ''),
    is_active: new FormControl(this.data?.is_active ?? true),
  });

  save() {
    if (this.form.invalid) return;
    this.saving = true;
    const payload = this.form.value as Partial<Clinic>;
    const req = this.data?.id
      ? this.svc.update(this.data.id, payload)
      : this.svc.create(payload);
    req.subscribe({
      next: (r) => { this.saving = false; this.dialogRef.close(r.clinic); },
      error: () => { this.saving = false; },
    });
  }
}

@Component({
  selector: 'app-clinics',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MaterialModule, TablerIconsModule],
  templateUrl: './clinics.component.html',
  styleUrls: ['./clinics.component.scss'],
})
export class ClinicsComponent implements OnInit {
  private svc    = inject(ClinicsService);
  private dialog = inject(MatDialog);
  private toast  = inject(ToastService);
  private cdr    = inject(ChangeDetectorRef);

  clinics: Clinic[] = [];
  loading = true;
  displayedColumns = ['name', 'city', 'phone', 'email', 'status', 'actions'];

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.svc.list().subscribe({
      next: (r) => { this.clinics = r.clinics; this.loading = false; this.cdr.markForCheck(); },
      error: () => {
        this.loading = false;
        this.toast.error('Unable to load clinics. Please check API/auth and try again.');
        this.cdr.markForCheck();
      },
    });
  }

  openDialog(clinic?: Clinic) {
    const ref = this.dialog.open(ClinicFormDialog, { data: clinic ?? null, width: '560px' });
    ref.afterClosed().subscribe(result => {
      if (result) {
        this.toast.success(clinic ? 'Clinic updated' : 'Clinic created');
        this.load();
      }
    });
  }

  toggle(clinic: Clinic) {
    this.svc.toggle(clinic.id, !clinic.is_active).subscribe(() => this.load());
  }
}
