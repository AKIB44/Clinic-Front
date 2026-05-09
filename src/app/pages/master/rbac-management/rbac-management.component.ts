import {
  Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, inject,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatCardModule } from '@angular/material/card';
import { MatMenuModule } from '@angular/material/menu';
import { MatFormFieldModule } from '@angular/material/form-field';
import {
  RbacAdminService,
  Role,
  RbacUser,
  PermissionDef,
  PermissionOverride,
  UserPermissionsResult,
} from '../../../core/rbac/rbac-admin.service';
import { AuthService } from '../../../auth/auth.service';
import { AuthStorageService } from '../../../auth/auth-storage.service';
import { PermissionService } from '../../../core/rbac/permission.service';

interface PermissionRow {
  def: PermissionDef;
  fromRole: boolean;
  override: PermissionOverride | null;
}

interface ModuleGroup {
  module: string;
  rows: PermissionRow[];
}

@Component({
  selector: 'app-rbac-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatTableModule,
    MatTabsModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatSelectModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatCardModule,
    MatMenuModule,
    MatFormFieldModule,
  ],
  templateUrl: './rbac-management.component.html',
  styleUrls: ['./rbac-management.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RbacManagementComponent implements OnInit {
  private svc         = inject(RbacAdminService);
  private snack       = inject(MatSnackBar);
  private cdr         = inject(ChangeDetectorRef);
  private auth        = inject(AuthService);
  private authStorage = inject(AuthStorageService);
  private permissions = inject(PermissionService);

  // ── State ──────────────────────────────────────────────────────────────────
  loadingUsers  = false;
  loadingPerms  = false;

  roles: Role[]     = [];
  users: RbacUser[] = [];

  displayedColumns = ['user', 'role', 'overrides', 'actions'];

  // Role assignment inline
  changingRoleUserId: string | null = null;
  selectedRoleId: string | null     = null;
  savingRole                        = false;

  // Permission matrix
  selectedUser: RbacUser | null    = null;
  permResult: UserPermissionsResult | null = null;
  moduleGroups: ModuleGroup[]      = [];

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadAll();
  }

  refresh(): void {
    this.loadAll();
    if (this.selectedUser) {
      this.loadPermissions(this.selectedUser);
    }
  }

  private loadAll(): void {
    this.loadingUsers = true;
    this.svc.getRoles().subscribe({
      next: (r) => { this.roles = r.roles; this.cdr.markForCheck(); },
      error: (e) => this.showError('Failed to load roles', e),
    });
    this.svc.getUsers().subscribe({
      next: (r) => {
        this.users = r.users;
        this.loadingUsers = false;
        this.cdr.markForCheck();
      },
      error: (e) => {
        this.loadingUsers = false;
        this.showError('Failed to load users', e);
      },
    });
  }

  // ── Role tab ──────────────────────────────────────────────────────────────
  startChangeRole(user: RbacUser): void {
    this.changingRoleUserId = user.id;
    this.selectedRoleId     = user.role_id;
    this.cdr.markForCheck();
  }

  cancelChangeRole(): void {
    this.changingRoleUserId = null;
    this.selectedRoleId     = null;
    this.cdr.markForCheck();
  }

  confirmChangeRole(user: RbacUser): void {
    if (!this.selectedRoleId) return;
    const role = this.roles.find(r => r.id === this.selectedRoleId);
    if (!role) return;

    this.savingRole = true;
    this.svc.assignRole(user.id, role.id, role.code).subscribe({
      next: async () => {
        // If the changed user is the currently logged-in user, the role_version
        // in the DB was bumped. Refresh the token now so subsequent requests
        // carry the updated rv and don't get rejected with token_stale.
        const currentUserId = this.authStorage.getUser()?.id;
        if (user.id === currentUserId) {
          const refreshToken = this.authStorage.getRefreshToken();
          if (refreshToken) {
            try {
              await firstValueFrom(this.auth.refresh(refreshToken));
              await this.permissions.refresh(this.auth.getActiveClinicId() ?? undefined);
            } catch { /* refresh failed — user will be prompted to re-login on next request */ }
          }
        }
        this.savingRole          = false;
        this.changingRoleUserId  = null;
        this.selectedRoleId      = null;
        this.snack.open(`Role updated for ${user.first_name} ${user.last_name}`, 'OK', { duration: 3000 });
        this.loadAll();
      },
      error: (e) => {
        this.savingRole = false;
        this.showError('Failed to update role', e);
      },
    });
  }

  getRoleDisplayName(user: RbacUser): string {
    return user.role_name ?? user.legacy_role ?? '—';
  }

  getRoleChipClass(user: RbacUser): string {
    const code = user.role_code ?? user.legacy_role;
    if (code === 'clinic_admin' || code === 'admin') return 'chip-admin';
    if (code === 'doctor') return 'chip-doctor';
    return 'chip-reception';
  }

  // ── Permission tab ────────────────────────────────────────────────────────
  selectUserForOverrides(user: RbacUser): void {
    this.selectedUser = user;
    this.loadPermissions(user);
  }

  private loadPermissions(user: RbacUser): void {
    this.loadingPerms = true;
    this.permResult   = null;
    this.moduleGroups = [];
    this.cdr.markForCheck();

    this.svc.getPermissions(user.id).subscribe({
      next: (result) => {
        this.permResult   = result;
        this.moduleGroups = this.buildModuleGroups(result);
        this.loadingPerms = false;
        this.cdr.markForCheck();
      },
      error: (e) => {
        this.loadingPerms = false;
        this.showError('Failed to load permissions', e);
      },
    });
  }

  private buildModuleGroups(result: UserPermissionsResult): ModuleGroup[] {
    const overrideByCode = new Map<string, PermissionOverride>();
    for (const o of result.overrides) {
      overrideByCode.set(o.permission_code, o);
    }

    const groupMap = new Map<string, PermissionRow[]>();
    for (const def of result.allPermissions) {
      const override  = overrideByCode.get(def.code) ?? null;
      const fromRole  = !!result.effective[def.code] && !override;
      const row: PermissionRow = { def, fromRole, override };

      if (!groupMap.has(def.module)) groupMap.set(def.module, []);
      groupMap.get(def.module)!.push(row);
    }

    return Array.from(groupMap.entries()).map(([module, rows]) => ({ module, rows }));
  }

  setOverride(permCode: string, effect: 'allow' | 'deny'): void {
    if (!this.selectedUser) return;
    this.svc.setOverride(this.selectedUser.id, permCode, effect, '').subscribe({
      next: () => {
        this.snack.open(`Override set: ${permCode} → ${effect}`, 'OK', { duration: 3000 });
        this.loadPermissions(this.selectedUser!);
        // Reload user list to update override count
        this.loadAll();
      },
      error: (e) => this.showError('Failed to set override', e),
    });
  }

  removeOverride(overrideId: string): void {
    if (!this.selectedUser) return;
    this.svc.deleteOverride(this.selectedUser.id, overrideId).subscribe({
      next: () => {
        this.snack.open('Override removed', 'OK', { duration: 3000 });
        this.loadPermissions(this.selectedUser!);
        this.loadAll();
      },
      error: (e) => this.showError('Failed to remove override', e),
    });
  }

  getEffectiveStatus(row: PermissionRow): 'from-role' | 'allow' | 'deny' | 'no-access' {
    if (row.override?.effect === 'allow') return 'allow';
    if (row.override?.effect === 'deny')  return 'deny';
    if (row.fromRole)                      return 'from-role';
    return 'no-access';
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  private showError(msg: string, err: any): void {
    const detail = err?.error?.error ?? err?.message ?? 'Unknown error';
    this.snack.open(`${msg}: ${detail}`, 'Dismiss', { duration: 5000 });
    this.cdr.markForCheck();
  }
}
