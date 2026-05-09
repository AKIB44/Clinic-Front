import {
  Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, inject, Inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators, FormsModule } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MatDialog, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { StaffService } from '../../../services/staff.service';
import { RbacAdminService, RbacUser, Role, UserPermissionsResult, PermissionDef, PermissionOverride } from '../../../core/rbac/rbac-admin.service';
import { AuthStorageService } from '../../../auth/auth-storage.service';

// ─── Confirmation Dialog ───────────────────────────────────────────────────────

@Component({
  selector: 'user-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <p>{{ data.message }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-stroked-button mat-dialog-close>Cancel</button>
      <button mat-flat-button [color]="data.confirmColor || 'warn'" [mat-dialog-close]="true">
        {{ data.confirmLabel || 'Confirm' }}
      </button>
    </mat-dialog-actions>
  `,
})
export class UserConfirmDialog {
  data = inject<{ title: string; message: string; confirmLabel?: string; confirmColor?: string }>(MAT_DIALOG_DATA);
}

// ─── User Form Dialog ──────────────────────────────────────────────────────────

@Component({
  selector: 'user-form-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule],
  template: `
    <h2 mat-dialog-title>{{ data?.id ? 'Edit User' : 'Add User' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">
        <div class="two-col">
          <mat-form-field appearance="outline">
            <mat-label>First Name</mat-label>
            <input matInput formControlName="first_name">
            <mat-error *ngIf="form.get('first_name')?.hasError('required')">Required</mat-error>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Last Name</mat-label>
            <input matInput formControlName="last_name">
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Email</mat-label>
          <input matInput formControlName="email" type="email">
          <mat-error *ngIf="form.get('email')?.hasError('required')">Required</mat-error>
          <mat-error *ngIf="form.get('email')?.hasError('email')">Invalid email</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Role</mat-label>
          <mat-select formControlName="role_id">
            <mat-option *ngFor="let r of roles" [value]="r.id">{{ r.name }}</mat-option>
          </mat-select>
          <mat-error *ngIf="form.get('role_id')?.hasError('required')">Required</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Designation</mat-label>
          <input matInput formControlName="designation" placeholder="e.g. BDS, MDS - Orthodontics">
          <mat-hint>Printed below the doctor's name on prescriptions</mat-hint>
        </mat-form-field>

        @if (!data?.id) {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Temporary Password</mat-label>
            <input matInput formControlName="password" type="password">
            <mat-error *ngIf="form.get('password')?.hasError('required')">Required</mat-error>
            <mat-error *ngIf="form.get('password')?.hasError('minlength')">Minimum 8 characters</mat-error>
          </mat-form-field>
        }

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
    .dialog-form { display: flex; flex-direction: column; gap: 8px; min-width: 460px; padding-top: 8px; }
    .full-width { width: 100%; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  `]
})
export class UserFormDialog implements OnInit {
  dialogRef = inject(MatDialogRef<UserFormDialog>);
  data = inject<(RbacUser & { legacy_role?: string }) | null>(MAT_DIALOG_DATA);
  private staffSvc = inject(StaffService);
  private rbacSvc = inject(RbacAdminService);
  private snack = inject(MatSnackBar);

  saving = false;
  roles: Role[] = [];

  // Map RBAC code back to legacy role for backend POST/PUT
  private readonly rbacToLegacy: Record<string, string> = {
    clinic_admin: 'admin',
    doctor: 'doctor',
    reception: 'receptionist',
    org_admin: 'admin',
    lab_tech: 'receptionist',
    accountant: 'receptionist',
  };

  form = new FormGroup({
    first_name:  new FormControl(this.data?.first_name ?? '', [Validators.required]),
    last_name:   new FormControl(this.data?.last_name ?? ''),
    email:       new FormControl(this.data?.email ?? '', [Validators.required, Validators.email]),
    role_id:     new FormControl(this.data?.role_id ?? '', [Validators.required]),
    designation: new FormControl((this.data as any)?.designation ?? '', [Validators.maxLength(100)]),
    password:    new FormControl('', this.data?.id ? [] : [Validators.required, Validators.minLength(8)]),
    is_active:   new FormControl(this.data?.is_active ?? true),
  });

  ngOnInit() {
    this.rbacSvc.getRoles().subscribe({
      next: (r) => {
        this.roles = r.roles;
        // Pre-select role for edit
        if (this.data?.role_id) {
          this.form.patchValue({ role_id: this.data.role_id });
        }
      },
      error: () => this.snack.open('Failed to load roles', 'Close', { duration: 3000 }),
    });
  }

  save() {
    if (this.form.invalid) return;
    this.saving = true;

    const { first_name, last_name, email, role_id, designation, password, is_active } = this.form.value;
    const selectedRole = this.roles.find(r => r.id === role_id);
    const legacyRole = selectedRole ? (this.rbacToLegacy[selectedRole.code] || 'receptionist') : 'receptionist';

    if (this.data?.id) {
      // Edit
      const payload: any = { first_name, last_name, email, role: legacyRole, designation, is_active };
      this.staffSvc.update(this.data.id, payload).subscribe({
        next: () => {
          this.saving = false;
          this.dialogRef.close(true);
        },
        error: (err) => {
          this.saving = false;
          const msg = err?.error?.error || 'Failed to update user';
          this.snack.open(msg, 'Close', { duration: 4000 });
        },
      });
    } else {
      // Create
      const payload: any = { first_name, last_name, email, role: legacyRole, designation, password, is_active };
      this.staffSvc.create(payload).subscribe({
        next: () => {
          this.saving = false;
          this.dialogRef.close(true);
        },
        error: (err) => {
          this.saving = false;
          const msg = err?.error?.error || 'Failed to create user';
          this.snack.open(msg, 'Close', { duration: 4000 });
        },
      });
    }
  }
}

// ─── User Permissions Dialog ───────────────────────────────────────────────────

interface PermGroup {
  module: string;
  perms: Array<{
    def: PermissionDef;
    effect: 'role' | 'allow' | 'deny' | 'none';
    overrideId: string | null;
  }>;
}

@Component({
  selector: 'user-permissions-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, MaterialModule, TablerIconsModule],
  template: `
    <h2 mat-dialog-title>
      Permissions — {{ data.first_name }} {{ data.last_name }}
      <small class="role-label">{{ data.role_name || data.role_code }}</small>
    </h2>
    <mat-dialog-content class="perm-dialog-content">
      @if (loading) {
        <div class="center-loader"><mat-spinner diameter="36"></mat-spinner></div>
      } @else {
        <div *ngFor="let group of permGroups" class="perm-group">
          <div class="module-header">{{ group.module | uppercase }}</div>
          <div class="perm-row" *ngFor="let p of group.perms">
            <div class="perm-info">
              <span class="perm-code">{{ p.def.code }}</span>
              <span class="perm-desc">{{ p.def.description }}</span>
            </div>
            <div class="perm-controls">
              <span class="effect-chip" [ngClass]="'effect-' + p.effect">
                {{ effectLabel[p.effect] }}
              </span>
              <button mat-icon-button matTooltip="Allow" (click)="setOverride(p, 'allow')"
                      [disabled]="saving" [class.active-action]="p.effect === 'allow'">
                <i-tabler name="check" size="16"></i-tabler>
              </button>
              <button mat-icon-button matTooltip="Deny" (click)="setOverride(p, 'deny')"
                      [disabled]="saving" [class.active-action]="p.effect === 'deny'">
                <i-tabler name="x" size="16"></i-tabler>
              </button>
              @if (p.overrideId) {
                <button mat-icon-button matTooltip="Remove override" (click)="removeOverride(p)"
                        [disabled]="saving">
                  <i-tabler name="trash" size="16"></i-tabler>
                </button>
              }
            </div>
          </div>
        </div>
        @if (permGroups.length === 0) {
          <p class="empty-perms">No permissions found for this user.</p>
        }
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-stroked-button mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .perm-dialog-content { min-width: 560px; max-height: 70vh; }
    .role-label { font-size: .8rem; font-weight: 400; color: #888; margin-left: 12px; }
    .center-loader { display: flex; justify-content: center; padding: 40px; }
    .perm-group { margin-bottom: 20px; }
    .module-header {
      font-size: .72rem; font-weight: 700; letter-spacing: 1px;
      color: #9e9e9e; padding: 6px 0 4px; border-bottom: 1px solid #eee; margin-bottom: 4px;
    }
    .perm-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 6px 0; gap: 12px;
    }
    .perm-info { display: flex; flex-direction: column; flex: 1; min-width: 0; }
    .perm-code { font-size: .8rem; font-weight: 600; color: #333; }
    .perm-desc { font-size: .75rem; color: #757575; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .perm-controls { display: flex; align-items: center; gap: 2px; }
    .effect-chip {
      display: inline-block; border-radius: 12px; padding: 2px 8px; font-size: .7rem; font-weight: 700;
      white-space: nowrap;
    }
    .effect-role  { background: #e3f2fd; color: #1565c0; }
    .effect-allow { background: #e8f5e9; color: #2e7d32; }
    .effect-deny  { background: #fce4ec; color: #b71c1c; }
    .effect-none  { background: #f5f5f5; color: #757575; }
    .active-action { color: #1976d2; }
    .empty-perms { text-align: center; padding: 40px; color: #9e9e9e; }
  `]
})
export class UserPermissionsDialog implements OnInit {
  dialogRef = inject(MatDialogRef<UserPermissionsDialog>);
  data = inject<RbacUser>(MAT_DIALOG_DATA);
  private rbacSvc = inject(RbacAdminService);
  private snack = inject(MatSnackBar);

  loading = true;
  saving = false;
  permGroups: PermGroup[] = [];

  readonly effectLabel: Record<string, string> = {
    role:  'From Role',
    allow: 'Allow Override',
    deny:  'Deny Override',
    none:  'No Access',
  };

  ngOnInit() {
    this.loadPermissions();
  }

  loadPermissions() {
    this.loading = true;
    this.rbacSvc.getPermissions(this.data.id).subscribe({
      next: (result: UserPermissionsResult) => {
        this.buildGroups(result);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.snack.open('Failed to load permissions', 'Close', { duration: 3000 });
      },
    });
  }

  private buildGroups(result: UserPermissionsResult) {
    const overrideMap = new Map<string, PermissionOverride>();
    for (const ov of result.overrides) {
      overrideMap.set(ov.permission_code, ov);
    }

    const groups: Record<string, PermGroup> = {};
    for (const def of result.allPermissions) {
      const override = overrideMap.get(def.code);
      let effect: 'role' | 'allow' | 'deny' | 'none';
      if (override) {
        effect = override.effect === 'allow' ? 'allow' : 'deny';
      } else if (result.effective[def.code]) {
        effect = 'role';
      } else {
        effect = 'none';
      }

      if (!groups[def.module]) {
        groups[def.module] = { module: def.module, perms: [] };
      }
      groups[def.module].perms.push({
        def,
        effect,
        overrideId: override?.id ?? null,
      });
    }

    this.permGroups = Object.values(groups).sort((a, b) => a.module.localeCompare(b.module));
  }

  setOverride(p: PermGroup['perms'][0], effect: 'allow' | 'deny') {
    this.saving = true;
    this.rbacSvc.setOverride(this.data.id, p.def.code, effect, '').subscribe({
      next: () => {
        this.saving = false;
        this.snack.open(`Permission ${effect === 'allow' ? 'allowed' : 'denied'}`, 'Close', { duration: 2000 });
        this.loadPermissions();
      },
      error: () => {
        this.saving = false;
        this.snack.open('Failed to set override', 'Close', { duration: 3000 });
      },
    });
  }

  removeOverride(p: PermGroup['perms'][0]) {
    if (!p.overrideId) return;
    this.saving = true;
    this.rbacSvc.deleteOverride(this.data.id, p.overrideId).subscribe({
      next: () => {
        this.saving = false;
        this.snack.open('Override removed', 'Close', { duration: 2000 });
        this.loadPermissions();
      },
      error: () => {
        this.saving = false;
        this.snack.open('Failed to remove override', 'Close', { duration: 3000 });
      },
    });
  }
}

// ─── Main Component ────────────────────────────────────────────────────────────

@Component({
  selector: 'app-staff-master',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, MaterialModule, TablerIconsModule],
  templateUrl: './staff.component.html',
  styleUrls: ['./staff.component.scss'],
})
export class StaffMasterComponent implements OnInit {
  private staffSvc    = inject(StaffService);
  private rbacSvc     = inject(RbacAdminService);
  private dialog      = inject(MatDialog);
  private snack       = inject(MatSnackBar);
  private cdr         = inject(ChangeDetectorRef);
  private authStorage = inject(AuthStorageService);

  users: RbacUser[] = [];
  filteredUsers: RbacUser[] = [];
  loading = true;
  searchQuery = '';
  roleFilter = '';
  availableRoles: string[] = [];

  displayedColumns = ['user', 'role', 'designation', 'overrides', 'status', 'actions'];

  readonly roleColors: Record<string, string> = {
    clinic_admin: 'role-admin',
    doctor:       'role-doctor',
    reception:    'role-reception',
    org_admin:    'role-org',
    lab_tech:     'role-lab',
    accountant:   'role-accountant',
  };

  readonly roleLabels: Record<string, string> = {
    clinic_admin: 'Clinic Admin',
    doctor:       'Doctor',
    reception:    'Reception',
    org_admin:    'Org Admin',
    lab_tech:     'Lab Tech',
    accountant:   'Accountant',
  };

  ngOnInit() {
    this.loadUsers();
  }

  loadUsers() {
    this.loading = true;
    this.rbacSvc.getUsers().subscribe({
      next: (r) => {
        this.users = r.users;
        this.availableRoles = [...new Set(r.users.map(u => u.role_code).filter(Boolean) as string[])];
        this.applyFilter();
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.snack.open('Failed to load users', 'Close', { duration: 3000 });
        this.cdr.markForCheck();
      },
    });
  }

  applyFilter() {
    const q = this.searchQuery.toLowerCase().trim();
    this.filteredUsers = this.users.filter(u => {
      const name = `${u.first_name} ${u.last_name}`.toLowerCase();
      const matchSearch = !q || name.includes(q) || u.email.toLowerCase().includes(q);
      const matchRole = !this.roleFilter || u.role_code === this.roleFilter;
      return matchSearch && matchRole;
    });
    this.cdr.markForCheck();
  }

  getInitials(user: RbacUser): string {
    return `${(user.first_name || '')[0] || ''}${(user.last_name || '')[0] || ''}`.toUpperCase();
  }

  openAddDialog() {
    const ref = this.dialog.open(UserFormDialog, { data: null, width: '540px' });
    ref.afterClosed().subscribe(result => {
      if (result) {
        this.snack.open('User added successfully', 'Close', { duration: 3000 });
        this.loadUsers();
      }
    });
  }

  openEditDialog(user: RbacUser) {
    const ref = this.dialog.open(UserFormDialog, { data: user, width: '540px' });
    ref.afterClosed().subscribe(result => {
      if (result) {
        this.snack.open('User updated successfully', 'Close', { duration: 3000 });
        this.loadUsers();
      }
    });
  }

  openDeleteDialog(user: RbacUser) {
    const currentUser = this.authStorage.getUser();
    if (currentUser?.id === user.id) {
      this.snack.open('Cannot delete your own account', 'Close', { duration: 3000 });
      return;
    }

    const ref = this.dialog.open(UserConfirmDialog, {
      data: {
        title: 'Delete User',
        message: `Are you sure you want to delete ${user.first_name} ${user.last_name}? This will deactivate the account and revoke all roles.`,
        confirmLabel: 'Delete',
        confirmColor: 'warn',
      },
      width: '420px',
    });

    ref.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.staffSvc.deleteUser(user.id).subscribe({
          next: () => {
            this.snack.open('User deleted', 'Close', { duration: 3000 });
            this.loadUsers();
          },
          error: (err) => {
            const msg = err?.error?.error || 'Failed to delete user';
            this.snack.open(msg, 'Close', { duration: 4000 });
          },
        });
      }
    });
  }

  openPermissionsDialog(user: RbacUser) {
    this.dialog.open(UserPermissionsDialog, { data: user, width: '640px', maxHeight: '90vh' });
  }

  toggleActive(user: RbacUser) {
    const newState = !user.is_active;
    this.staffSvc.toggle(user.id, newState).subscribe({
      next: () => {
        this.snack.open(newState ? 'User activated' : 'User deactivated', 'Close', { duration: 2500 });
        this.loadUsers();
      },
      error: () => this.snack.open('Failed to update status', 'Close', { duration: 3000 }),
    });
  }
}
