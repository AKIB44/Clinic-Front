import {
  Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MatDialog, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ToastService } from '../../../services/toast.service';
import { ClinicServicesService } from '../../../services/clinic-services.service';
import { PermissionService } from '../../../core/rbac/permission.service';
import { ClinicService } from '../../../models/clinic.model';

// ── Service form dialog ───────────────────────────────────────────────────────

@Component({
  selector: 'service-form-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule],
  template: `
    <h2 mat-dialog-title>{{ data.service?.id ? 'Edit Service' : 'Add Service' }}</h2>
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
          <textarea matInput formControlName="description" rows="3"
            placeholder="Brief description of the procedure"></textarea>
        </mat-form-field>
        @if (isAdmin) {
          <mat-slide-toggle formControlName="is_active" color="primary">Active</mat-slide-toggle>
        }
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
  dialogRef   = inject(MatDialogRef<ServiceFormDialog>);
  data        = inject<{ service: ClinicService | null; isAdmin: boolean }>(MAT_DIALOG_DATA);
  private svc = inject(ClinicServicesService);

  saving  = false;
  isAdmin = this.data.isAdmin;

  form = new FormGroup({
    name:             new FormControl(this.data.service?.name             ?? '', [Validators.required]),
    duration_minutes: new FormControl(this.data.service?.duration_minutes ?? 30, [Validators.required, Validators.min(1)]),
    price:            new FormControl(this.data.service?.price            ?? 0,  [Validators.required, Validators.min(0)]),
    description:      new FormControl(this.data.service?.description      ?? ''),
    is_active:        new FormControl(this.data.service?.is_active        ?? true),
  });

  save() {
    if (this.form.invalid) return;
    this.saving = true;
    const payload = this.form.value as Partial<ClinicService>;
    const req = this.data.service?.id
      ? this.svc.update(this.data.service.id, payload)
      : this.svc.create(payload);
    req.subscribe({
      next:  (r) => { this.saving = false; this.dialogRef.close(r.service); },
      error: ()  => { this.saving = false; },
    });
  }
}

// ── Services page ─────────────────────────────────────────────────────────────

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
  private perms  = inject(PermissionService);
  private dialog = inject(MatDialog);
  private toast  = inject(ToastService);
  private cdr    = inject(ChangeDetectorRef);

  /** true = clinic admin view (all services, full CRUD)
   *  false = doctor view (own services, no delete) */
  isAdmin = this.perms.has('clinic.settings');

  services: ClinicService[] = [];
  loading = true;

  get displayedColumns(): string[] {
    const cols = ['name', 'duration', 'price', 'status'];
    if (this.isAdmin) cols.push('doctor');
    cols.push('actions');
    return cols;
  }

  get pageTitle(): string {
    return this.isAdmin ? 'Dental Services' : 'My Services';
  }

  get pageSubtitle(): string {
    return this.isAdmin
      ? 'All procedures offered by the clinic'
      : 'Services you personally offer — add, edit or toggle availability';
  }

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    const call = this.isAdmin ? this.svc.list() : this.svc.mine();
    call.subscribe({
      next: (r) => { this.services = r.services; this.loading = false; this.cdr.markForCheck(); },
      error: ()  => { this.loading = false; this.cdr.markForCheck(); },
    });
  }

  openDialog(service?: ClinicService) {
    const ref = this.dialog.open(ServiceFormDialog, {
      data: { service: service ?? null, isAdmin: this.isAdmin },
      width: '520px',
    });
    ref.afterClosed().subscribe(result => {
      if (result) {
        this.toast.success(service ? 'Service updated' : 'Service added');
        this.load();
      }
    });
  }

  toggle(service: ClinicService) {
    this.svc.toggle(service.id).subscribe({
      next: (r) => {
        const idx = this.services.findIndex(s => s.id === service.id);
        if (idx >= 0) this.services[idx] = r.service;
        this.services = [...this.services];
        this.toast.success(r.service.is_active ? 'Service activated' : 'Service deactivated');
        this.cdr.markForCheck();
      },
      error: () => this.toast.error('Could not toggle service'),
    });
  }

  delete(service: ClinicService) {
    this.svc.delete(service.id).subscribe({
      next: () => { this.toast.success('Service removed'); this.load(); },
      error: (err) => {
        const msg = err?.error?.error || 'Cannot delete service';
        this.toast.error(msg);
      },
    });
  }

  canEdit(service: ClinicService): boolean {
    return this.isAdmin || service.doctor_id != null;
  }
}
