import {
  Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MatDialog, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ClinicServicesService } from '../../../services/clinic-services.service';
import { RbacService } from '../../../auth/rbac.service';
import { ClinicService } from '../../../models/clinic.model';

@Component({
  selector: 'service-form-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule],
  template: `
    <h2 mat-dialog-title>{{ data?.id ? 'Edit Service' : 'Add Service' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Service Name</mat-label>
          <input matInput formControlName="name" placeholder="e.g. Root Canal">
        </mat-form-field>
        <div class="two-col">
          <mat-form-field appearance="outline">
            <mat-label>Duration (minutes)</mat-label>
            <input matInput type="number" formControlName="duration_minutes" min="1">
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Price (₹)</mat-label>
            <input matInput type="number" formControlName="price" min="0">
          </mat-form-field>
        </div>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Description</mat-label>
          <textarea matInput formControlName="description" rows="3"></textarea>
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
    .dialog-form { display: flex; flex-direction: column; gap: 4px; min-width: 440px; padding-top: 8px; }
    .full-width { width: 100%; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  `]
})
export class ServiceFormDialog {
  dialogRef = inject(MatDialogRef<ServiceFormDialog>);
  data      = inject<ClinicService | null>(MAT_DIALOG_DATA);
  private svc = inject(ClinicServicesService);

  saving = false;
  form = new FormGroup({
    name:             new FormControl(this.data?.name             ?? '', [Validators.required]),
    duration_minutes: new FormControl(this.data?.duration_minutes ?? 30, [Validators.required, Validators.min(1)]),
    price:            new FormControl(this.data?.price            ?? 0,  [Validators.required, Validators.min(0)]),
    description:      new FormControl(this.data?.description      ?? ''),
    is_active:        new FormControl(this.data?.is_active        ?? true),
  });

  save() {
    if (this.form.invalid) return;
    this.saving = true;
    const req = this.data?.id
      ? this.svc.update(this.data.id, this.form.value as Partial<ClinicService>)
      : this.svc.create(this.form.value as Partial<ClinicService>);
    req.subscribe({
      next: (r: any) => { this.saving = false; this.dialogRef.close(r.service); },
      error: ()      => { this.saving = false; },
    });
  }
}

@Component({
  selector: 'app-services-master',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MaterialModule, TablerIconsModule],
  templateUrl: './services.component.html',
  styleUrls: ['./services.component.scss'],
})
export class ServicesMasterComponent implements OnInit {
  private svc    = inject(ClinicServicesService);
  private rbac   = inject(RbacService);
  private dialog = inject(MatDialog);
  private snack  = inject(MatSnackBar);
  private cdr    = inject(ChangeDetectorRef);

  services: ClinicService[] = [];
  loading = true;
  displayedColumns = ['name', 'duration', 'price', 'status', 'actions'];

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.svc.list(this.rbac.clinicId).subscribe({
      next: (r) => { this.services = r.services; this.loading = false; this.cdr.markForCheck(); },
      error: ()  => { this.loading = false; this.cdr.markForCheck(); },
    });
  }

  openDialog(service?: ClinicService) {
    const ref = this.dialog.open(ServiceFormDialog, { data: service ?? null, width: '520px' });
    ref.afterClosed().subscribe(result => {
      if (result) {
        this.snack.open(service ? 'Service updated' : 'Service added', '', { duration: 3000 });
        this.load();
      }
    });
  }

  delete(service: ClinicService) {
    this.svc.delete(service.id).subscribe(() => {
      this.snack.open('Service removed', '', { duration: 3000 });
      this.load();
    });
  }
}
