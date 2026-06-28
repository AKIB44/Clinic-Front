import {
  Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';
import { MaterialModule } from '../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MatDialog, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ToastService } from '../../../services/toast.service';
import { ClinicServicesService } from '../../../services/clinic-services.service';
import { PermissionService } from '../../../core/rbac/permission.service';
import { ClinicService } from '../../../models/clinic.model';

// ── Service form dialog ───────────────────────────────────────────────────────

export const SERVICE_DESCRIPTION_MAX = 200;

@Component({
  selector: 'service-form-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule],
  template: `
    <div class="dialog-title-row">
      <h2 mat-dialog-title>{{ data.service?.id ? 'Edit Service' : 'Add Service' }}</h2>
      <button mat-icon-button mat-dialog-close class="dialog-close" aria-label="Close">
        <mat-icon>close</mat-icon>
      </button>
    </div>
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
            [attr.maxlength]="descriptionMax"
            placeholder="Brief description of the procedure"></textarea>
          <mat-hint align="end">{{ descriptionLength }}/{{ descriptionMax }}</mat-hint>
          @if (form.get('description')?.hasError('maxlength')) {
            <mat-error>Description cannot exceed {{ descriptionMax }} characters</mat-error>
          }
        </mat-form-field>
        @if (isAdmin) {
          <div class="active-toggle-row" [class.active-toggle-row--on]="form.get('is_active')?.value">
            <div class="active-toggle-shell">
              <span class="active-toggle-state">{{ form.get('is_active')?.value ? 'On' : 'Off' }}</span>
              <mat-slide-toggle
                formControlName="is_active"
                class="dialog-active-toggle"
                hideIcon
                color="primary"
                (change)="onActiveToggle($event)">
                Active
              </mat-slide-toggle>
            </div>
            <span class="active-toggle-label">
              {{ form.get('is_active')?.value ? 'Service is enabled' : 'Service is disabled' }}
            </span>
          </div>
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
    .dialog-title-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding-right: 8px;
    }
    .dialog-title-row h2[mat-dialog-title] { margin: 0; flex: 1; min-width: 0; }
    .dialog-close { color: #64748b; flex-shrink: 0; }
    .dialog-form { display: flex; flex-direction: column; gap: 4px; min-width: 440px; padding-top: 8px; }
    .full-width { width: 100%; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .active-toggle-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 4px;
      padding: 10px 12px;
      border-radius: 10px;
      border: 1.5px solid #e2e8f0;
      background: #f8fafc;
    }
    .active-toggle-row--on {
      border-color: #22c55e;
      background: linear-gradient(135deg, #ecfdf5, #d1fae5);
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.7),
        0 2px 10px rgba(22, 163, 74, 0.28),
        0 0 0 3px rgba(34, 197, 94, 0.14);
    }
    .active-toggle-shell {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 4px 10px 4px 8px;
      border-radius: 999px;
      border: 1.5px solid #cbd5e1;
      background: #f1f5f9;
      box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.08);
    }
    .active-toggle-row--on .active-toggle-shell {
      border-color: #16a34a;
      background: #fff;
      box-shadow:
        inset 0 1px 2px rgba(22, 163, 74, 0.08),
        0 2px 6px rgba(22, 163, 74, 0.35);
    }
    .active-toggle-state {
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: #64748b;
      min-width: 20px;
    }
    .active-toggle-row--on .active-toggle-state { color: #15803d; }
    .active-toggle-label {
      font-size: 0.8rem;
      font-weight: 600;
      color: #94a3b8;
    }
    .active-toggle-row--on .active-toggle-label { color: #059669; }
    :host ::ng-deep .dialog-active-toggle .mdc-switch__track {
      opacity: 1 !important;
      border: 1px solid #94a3b8;
      box-shadow: inset 0 1px 3px rgba(15, 23, 42, 0.12);
    }
    :host ::ng-deep .dialog-active-toggle .mdc-switch--unselected .mdc-switch__track {
      background: #94a3b8 !important;
    }
    :host ::ng-deep .dialog-active-toggle .mdc-switch--selected .mdc-switch__track {
      background: #16a34a !important;
      border-color: #15803d;
      box-shadow:
        inset 0 1px 2px rgba(255, 255, 255, 0.3),
        0 2px 6px rgba(22, 163, 74, 0.45);
    }
    :host ::ng-deep .dialog-active-toggle .mdc-switch__shadow {
      box-shadow: 0 2px 4px rgba(15, 23, 42, 0.25) !important;
    }
    :host ::ng-deep .active-toggle-row--on .dialog-active-toggle .mdc-switch--selected .mdc-switch__shadow {
      box-shadow: 0 2px 8px rgba(22, 163, 74, 0.5) !important;
    }
  `]
})
export class ServiceFormDialog {
  dialogRef   = inject(MatDialogRef<ServiceFormDialog>);
  data        = inject<{ service: ClinicService | null; isAdmin: boolean }>(MAT_DIALOG_DATA);
  private svc   = inject(ClinicServicesService);
  private toast = inject(ToastService);

  saving  = false;
  isAdmin = this.data.isAdmin;
  readonly descriptionMax = SERVICE_DESCRIPTION_MAX;

  form = new FormGroup({
    name:             new FormControl(this.data.service?.name             ?? '', [Validators.required]),
    duration_minutes: new FormControl(this.data.service?.duration_minutes ?? 30, [Validators.required, Validators.min(1)]),
    price:            new FormControl(this.data.service?.price            ?? 0,  [Validators.required, Validators.min(0)]),
    description:      new FormControl(this.data.service?.description      ?? '', [Validators.maxLength(SERVICE_DESCRIPTION_MAX)]),
    is_active:        new FormControl(this.data.service?.is_active        ?? true),
  });

  get descriptionLength(): number {
    const v = this.form.get('description')?.value;
    return typeof v === 'string' ? v.length : 0;
  }

  onActiveToggle(event: MatSlideToggleChange): void {
    if (event.checked) {
      this.toast.success('Service enabled');
    } else {
      this.toast.deactivated('Service disabled');
    }
  }

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
      if (!result) return;
      const saved = result as ClinicService;
      if (service) {
        if (service.is_active !== saved.is_active) {
          if (saved.is_active) {
            this.toast.success(`${saved.name} enabled`);
          } else {
            this.toast.deactivated(`${saved.name} disabled`);
          }
        } else {
          this.toast.success('Service updated');
        }
      } else {
        this.toast.success('Service added');
      }
      this.load();
    });
  }

  toggle(service: ClinicService) {
    this.svc.toggle(service.id).subscribe({
      next: (r) => {
        const idx = this.services.findIndex(s => s.id === service.id);
        if (idx >= 0) this.services[idx] = r.service;
        this.services = [...this.services];
        if (r.service.is_active) {
          this.toast.success(`${r.service.name} enabled`);
        } else {
          this.toast.deactivated(`${r.service.name} disabled`);
        }
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
