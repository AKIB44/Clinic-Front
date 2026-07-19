import {
  Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, inject, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MatDialog, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { forkJoin } from 'rxjs';
import { ToastService } from '../../../services/toast.service';
import { ClinicsService } from '../../../services/clinics.service';
import { RbacAdminService, Role, RbacUser } from '../../../core/rbac/rbac-admin.service';
import { Clinic } from '../../../models/clinic.model';
import { clinicEmailValidators, clinicPhoneValidators, normalizeIndianMobile } from '../../../utils/form-validators';

// ── Confirm dialog ────────────────────────────────────────────────────────────

@Component({
  selector: 'confirm-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule],
  template: `
    <div class="confirm-wrap">
      <div class="confirm-icon">
        <i-tabler [name]="data.icon ?? 'alert-triangle'" size="32"></i-tabler>
      </div>
      <h2 mat-dialog-title>{{ data.title }}</h2>
      <mat-dialog-content>
        <p class="confirm-body">{{ data.body }}</p>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-stroked-button mat-dialog-close>Cancel</button>
        <button mat-flat-button [color]="data.confirmColor ?? 'warn'" [mat-dialog-close]="true">
          {{ data.confirmLabel ?? 'Confirm' }}
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .confirm-wrap  { padding: 8px 4px 0; min-width: 320px; max-width: 420px; }
    .confirm-icon  { color: #f59e0b; margin-bottom: 4px; }
    h2[mat-dialog-title] { margin: 0 0 4px; font-size: 17px; font-weight: 700; }
    .confirm-body  { color: #64748b; font-size: 14px; margin: 0; }
  `]
})
export class ConfirmDialog {
  dialogRef = inject(MatDialogRef<ConfirmDialog>);
  data      = inject<{ title: string; body: string; confirmLabel?: string; confirmColor?: string; icon?: string }>(MAT_DIALOG_DATA);
}

// ── Clinic form dialog ────────────────────────────────────────────────────────

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
            <input matInput formControlName="phone" type="tel" inputmode="numeric" maxlength="10"
                   placeholder="9876543210" (input)="onPhoneInput($event)">
            @if (form.get('phone')?.touched && form.get('phone')?.hasError('required')) {
              <mat-error>Mobile number is required</mat-error>
            }
            @if (form.get('phone')?.touched && form.get('phone')?.hasError('pattern')) {
              <mat-error>Enter a valid 10-digit mobile number</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Email</mat-label>
            <input matInput formControlName="email" type="email" placeholder="clinic@example.com">
            @if (form.get('email')?.touched && form.get('email')?.hasError('required')) {
              <mat-error>Email is required</mat-error>
            }
            @if (form.get('email')?.touched && form.get('email')?.hasError('email')) {
              <mat-error>Enter a valid email address</mat-error>
            }
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
    .full-width  { width: 100%; }
    .two-col     { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    @media (max-width: 540px) { .dialog-form { min-width: unset; } .two-col { grid-template-columns: 1fr; } }
  `]
})
export class ClinicFormDialog {
  dialogRef   = inject(MatDialogRef<ClinicFormDialog>);
  data        = inject<Clinic | null>(MAT_DIALOG_DATA);
  private svc = inject(ClinicsService);

  saving = false;
  form = new FormGroup({
    name:    new FormControl(this.data?.name    ?? '', [Validators.required]),
    phone:   new FormControl(normalizeIndianMobile(this.data?.phone), clinicPhoneValidators),
    email:   new FormControl(this.data?.email   ?? '', clinicEmailValidators),
    address: new FormControl(this.data?.address ?? '', [Validators.required]),
    city:    new FormControl(this.data?.city    ?? '', [Validators.required]),
    state:   new FormControl(this.data?.state   ?? ''),
  });

  onPhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = normalizeIndianMobile(input.value);
    if (input.value !== digits) {
      this.form.get('phone')!.setValue(digits, { emitEvent: false });
      input.value = digits;
    }
  }

  save() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.saving = true;
    const payload = this.form.value as any;
    const req = this.data?.id
      ? this.svc.update(this.data.id, payload)
      : this.svc.create(payload);
    req.subscribe({
      next: (r) => { this.saving = false; this.dialogRef.close(r.clinic); },
      error: () => { this.saving = false; },
    });
  }
}

// ── Clinics page ──────────────────────────────────────────────────────────────

interface StaffPanel {
  clinicId:     string;
  loading:      boolean;
  users:        RbacUser[];
  roles:        Role[];
  savingUserId: string | null;
  selectedRoles: Record<string, string>; // userId → roleId
}

@Component({
  selector: 'app-clinics',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule],
  templateUrl: './clinics.component.html',
  styleUrls: ['./clinics.component.scss'],
})
export class ClinicsComponent implements OnInit {
  private svc      = inject(ClinicsService);
  private rbacSvc  = inject(RbacAdminService);
  private dialog   = inject(MatDialog);
  private toast    = inject(ToastService);
  private cdr      = inject(ChangeDetectorRef);

  clinics: Clinic[]    = [];
  loading              = true;
  displayedColumns     = ['name', 'city', 'phone', 'email', 'status', 'actions'];

  // Staff panels: one per expanded clinic
  staffPanels = new Map<string, StaffPanel>();
  expandedClinicId: string | null = null;

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.svc.list().subscribe({
      next: (r) => {
        this.clinics = r.clinics;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.toast.error('Unable to load clinics. Check permissions (org.manage required).');
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
    const deactivating = clinic.is_active;
    if (deactivating) {
      const ref = this.dialog.open(ConfirmDialog, {
        data: {
          title:        'Deactivate clinic?',
          body:         `"${clinic.name}" will be marked inactive. Staff will lose access until it is reactivated.`,
          confirmLabel: 'Deactivate',
          confirmColor: 'warn',
          icon:         'alert-triangle',
        },
        width: '420px',
        autoFocus: false,
      });
      ref.afterClosed().subscribe(confirmed => {
        if (confirmed) this.doToggle(clinic, false);
      });
    } else {
      this.doToggle(clinic, true);
    }
  }

  private doToggle(clinic: Clinic, is_active: boolean) {
    this.svc.toggle(clinic.id, is_active).subscribe({
      next: () => this.load(),
      error: () => this.toast.error('Failed to update status'),
    });
  }

  // ── Staff panel ───────────────────────────────────────────────────────────

  toggleStaffPanel(clinic: Clinic) {
    if (this.expandedClinicId === clinic.id) {
      this.expandedClinicId = null;
      this.cdr.markForCheck();
      return;
    }
    this.expandedClinicId = clinic.id;

    if (!this.staffPanels.has(clinic.id)) {
      const panel: StaffPanel = {
        clinicId: clinic.id,
        loading: true,
        users: [],
        roles: [],
        savingUserId: null,
        selectedRoles: {},
      };
      this.staffPanels.set(clinic.id, panel);
      this.cdr.markForCheck();
      this.loadStaff(clinic.id);
    } else {
      this.cdr.markForCheck();
    }
  }

  private loadStaff(clinicId: string) {
    forkJoin({
      users: this.svc.getClinicUsers(clinicId),
      roles: this.rbacSvc.getRoles(),
    }).subscribe({
      next: ({ users, roles }) => {
        const panel = this.staffPanels.get(clinicId)!;
        panel.users   = users.users;
        panel.roles   = roles.roles;
        panel.loading = false;
        // Pre-fill selected roles from current assignments
        for (const u of panel.users) {
          if (u.role_id) panel.selectedRoles[u.id] = u.role_id;
        }
        this.cdr.markForCheck();
      },
      error: () => {
        const panel = this.staffPanels.get(clinicId)!;
        panel.loading = false;
        this.toast.error('Failed to load staff for this clinic');
        this.cdr.markForCheck();
      },
    });
  }

  panelFor(clinicId: string): StaffPanel | undefined {
    return this.staffPanels.get(clinicId);
  }

  saveRole(clinicId: string, user: RbacUser) {
    const panel = this.staffPanels.get(clinicId);
    if (!panel) return;
    const roleId = panel.selectedRoles[user.id];
    if (!roleId) return;
    const role = panel.roles.find(r => r.id === roleId);
    if (!role) return;

    panel.savingUserId = user.id;
    this.cdr.markForCheck();

    this.svc.assignClinicRole(clinicId, user.id, role.id, role.code).subscribe({
      next: () => {
        panel.savingUserId = null;
        this.toast.success(`Role updated for ${user.first_name} ${user.last_name}`);
        // Refresh staff list
        this.loadStaff(clinicId);
      },
      error: () => {
        panel.savingUserId = null;
        this.toast.error('Failed to update role');
        this.cdr.markForCheck();
      },
    });
  }

  roleBadgeClass(roleCode: string | null): string {
    if (roleCode === 'clinic_admin' || roleCode === 'admin') return 'badge-admin';
    if (roleCode === 'doctor') return 'badge-doctor';
    return 'badge-reception';
  }
}
