import {
  Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, inject, signal, computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { FlatTreeControl } from '@angular/cdk/tree';
import { MatTreeFlattener, MatTreeFlatDataSource } from '@angular/material/tree';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MaterialModule } from '../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { OrgRolesService, RoleDefinition, PermissionDef } from '../../../services/org-roles.service';

// ── Tree node types ───────────────────────────────────────────────────────────

interface PermNode {
  code: string;
  label: string;
  permCode?: string;
  description?: string;
  isSensitive?: boolean;
  children?: PermNode[];
}

interface FlatPermNode {
  code: string;       // module-key for parents, permission code for leaves
  label: string;
  permCode?: string;
  description?: string;
  isSensitive?: boolean;
  level: number;
  expandable: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-roles',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule],
  templateUrl: './roles.component.html',
  styleUrls: ['./roles.component.scss'],
})
export class RolesComponent implements OnInit {
  private svc   = inject(OrgRolesService);
  private cdr   = inject(ChangeDetectorRef);
  private snack = inject(MatSnackBar);

  // ── Signals ──────────────────────────────────────────────────────────────
  roles              = signal<RoleDefinition[]>([]);
  allPermissions     = signal<PermissionDef[]>([]);
  loading            = signal<boolean>(false);
  error              = signal<string>('');
  selectedRole       = signal<RoleDefinition | null>(null);
  saving             = signal<boolean>(false);
  pendingPermissions = signal<string[]>([]);

  showCreateForm = signal<boolean>(false);
  editingRole    = signal<RoleDefinition | null>(null);

  // Create form fields
  createName        = '';
  createCode        = '';
  createDescription = '';

  // Edit form fields
  editName        = '';
  editDescription = '';

  // ── Mat Tree setup ────────────────────────────────────────────────────────

  private transformer = (node: PermNode, level: number): FlatPermNode => ({
    code:        node.code,
    label:       node.label,
    permCode:    node.permCode,
    description: node.description,
    isSensitive: node.isSensitive,
    level,
    expandable:  !!node.children?.length,
  });

  treeControl = new FlatTreeControl<FlatPermNode>(
    n => n.level,
    n => n.expandable,
  );

  private treeFlattener = new MatTreeFlattener<PermNode, FlatPermNode>(
    this.transformer,
    n => n.level,
    n => n.expandable,
    n => n.children,
  );

  dataSource = new MatTreeFlatDataSource(this.treeControl, this.treeFlattener);

  // Pre-computed map: module-code → child flat nodes (permission leaves)
  private moduleChildrenMap = new Map<string, FlatPermNode[]>();

  hasChild = (_: number, node: FlatPermNode) => node.expandable;

  // ── Derived ───────────────────────────────────────────────────────────────

  permissionsChanged = computed<boolean>(() => {
    const role = this.selectedRole();
    if (!role) return false;
    const orig    = [...(role.permissions || [])].sort().join(',');
    const pending = [...this.pendingPermissions()].sort().join(',');
    return orig !== pending;
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadAll();
  }

  loadAll(): void {
    this.loading.set(true);
    this.error.set('');
    this.cdr.markForCheck();

    forkJoin({
      roles: this.svc.listRoles(),
      perms: this.svc.listAllPermissions(),
    }).subscribe({
      next: ({ roles, perms }) => {
        this.roles.set(roles.roles || []);
        this.allPermissions.set(perms.permissions || []);
        this.buildTree();

        const sel = this.selectedRole();
        if (sel) {
          const refreshed = this.roles().find(r => r.id === sel.id);
          if (refreshed) {
            this.selectedRole.set(refreshed);
            this.pendingPermissions.set([...refreshed.permissions]);
          }
        }
        this.loading.set(false);
        this.cdr.markForCheck();
      },
      error: () => {
        this.error.set('Failed to load roles. Please try again.');
        this.loading.set(false);
        this.cdr.markForCheck();
      },
    });
  }

  // ── Tree building ─────────────────────────────────────────────────────────

  private buildTree(): void {
    const moduleMap = new Map<string, PermNode>();
    for (const p of this.allPermissions()) {
      if (!moduleMap.has(p.module)) {
        moduleMap.set(p.module, {
          code:  `__mod__${p.module}`,
          label: p.module.charAt(0).toUpperCase() + p.module.slice(1).replace(/_/g, ' '),
          children: [],
        });
      }
      moduleMap.get(p.module)!.children!.push({
        code:        `__mod__${p.module}`,  // parent key (for mapping)
        permCode:    p.code,
        label:       p.description || p.action,
        description: p.code,
        isSensitive: p.is_sensitive,
      });
    }

    const tree = Array.from(moduleMap.values())
      .sort((a, b) => a.label.localeCompare(b.label));

    this.dataSource.data = tree;
    this.treeControl.expandAll();

    // Build fast lookup: module-code → leaf flat nodes
    this.moduleChildrenMap.clear();
    const flatNodes = this.treeControl.dataNodes || [];
    for (const flat of flatNodes) {
      if (!flat.expandable) {
        const modKey = flat.code;  // code holds parent key for leaves
        const list   = this.moduleChildrenMap.get(modKey) || [];
        list.push(flat);
        this.moduleChildrenMap.set(modKey, list);
      }
    }
  }

  // ── Tree checkbox helpers ─────────────────────────────────────────────────

  isLeafChecked(node: FlatPermNode): boolean {
    return this.pendingPermissions().includes(node.permCode!);
  }

  moduleAllChecked(node: FlatPermNode): boolean {
    const children = this.moduleChildrenMap.get(node.code) || [];
    return children.length > 0 && children.every(c => this.pendingPermissions().includes(c.permCode!));
  }

  modulePartialChecked(node: FlatPermNode): boolean {
    const children = this.moduleChildrenMap.get(node.code) || [];
    const n = children.filter(c => this.pendingPermissions().includes(c.permCode!)).length;
    return n > 0 && n < children.length;
  }

  toggleLeaf(node: FlatPermNode): void {
    const code    = node.permCode!;
    const current = this.pendingPermissions();
    if (current.includes(code)) {
      this.pendingPermissions.set(current.filter(c => c !== code));
    } else {
      this.pendingPermissions.set([...current, code]);
    }
  }

  toggleModule(node: FlatPermNode): void {
    const children  = this.moduleChildrenMap.get(node.code) || [];
    const allOn     = this.moduleAllChecked(node);
    const current   = this.pendingPermissions();
    const childCodes = children.map(c => c.permCode!);
    if (allOn) {
      this.pendingPermissions.set(current.filter(c => !childCodes.includes(c)));
    } else {
      const toAdd = childCodes.filter(c => !current.includes(c));
      this.pendingPermissions.set([...current, ...toAdd]);
    }
  }

  moduleChildCount(node: FlatPermNode): number {
    return (this.moduleChildrenMap.get(node.code) || []).length;
  }

  moduleCheckedCount(node: FlatPermNode): number {
    const children = this.moduleChildrenMap.get(node.code) || [];
    return children.filter(c => this.pendingPermissions().includes(c.permCode!)).length;
  }

  // ── Role selection ────────────────────────────────────────────────────────

  selectRole(r: RoleDefinition): void {
    this.selectedRole.set(r);
    this.pendingPermissions.set([...r.permissions]);
    this.editingRole.set(null);
    this.showCreateForm.set(false);
    this.cdr.markForCheck();
  }

  // ── Save permissions ──────────────────────────────────────────────────────

  savePermissions(): void {
    const role = this.selectedRole();
    if (!role) return;
    this.saving.set(true);
    this.cdr.markForCheck();

    this.svc.setPermissions(role.id, this.pendingPermissions()).subscribe({
      next: ({ role: updated }) => {
        this.saving.set(false);
        this.selectedRole.set(updated);
        this.pendingPermissions.set([...updated.permissions]);
        this.snack.open('Permissions saved', 'Close', { duration: 3000 });
        this.loadAll();
      },
      error: () => {
        this.saving.set(false);
        this.snack.open('Failed to save permissions', 'Close', { duration: 4000 });
        this.cdr.markForCheck();
      },
    });
  }

  // ── Create role ───────────────────────────────────────────────────────────

  openCreateDialog(): void {
    this.showCreateForm.set(true);
    this.createName = '';
    this.createCode = '';
    this.createDescription = '';
    this.editingRole.set(null);
    this.cdr.markForCheck();
  }

  cancelCreate(): void {
    this.showCreateForm.set(false);
    this.cdr.markForCheck();
  }

  onNameInput(): void {
    this.createCode = this.createName
      .toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  }

  submitCreate(): void {
    if (!this.createName.trim() || !this.createCode.trim()) return;
    this.saving.set(true);
    this.cdr.markForCheck();

    this.svc.createRole({
      name:        this.createName.trim(),
      code:        this.createCode.trim(),
      description: this.createDescription.trim() || undefined,
    }).subscribe({
      next: ({ role }) => {
        this.saving.set(false);
        this.showCreateForm.set(false);
        this.snack.open(`Role "${role.name}" created`, 'Close', { duration: 3000 });
        this.loadAll();
      },
      error: (err) => {
        this.saving.set(false);
        const msg = err?.error?.code === 'code_taken'
          ? 'Role code already exists. Choose a different code.'
          : 'Failed to create role';
        this.snack.open(msg, 'Close', { duration: 4000 });
        this.cdr.markForCheck();
      },
    });
  }

  // ── Edit role ─────────────────────────────────────────────────────────────

  openEditDialog(r: RoleDefinition): void {
    this.editingRole.set(r);
    this.editName        = r.name;
    this.editDescription = r.description || '';
    this.showCreateForm.set(false);
    this.cdr.markForCheck();
  }

  cancelEdit(): void {
    this.editingRole.set(null);
    this.cdr.markForCheck();
  }

  submitEdit(): void {
    const role = this.editingRole();
    if (!role) return;
    this.saving.set(true);
    this.cdr.markForCheck();

    this.svc.updateRole(role.id, {
      name:        this.editName.trim(),
      description: this.editDescription.trim() || undefined,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.editingRole.set(null);
        this.snack.open('Role updated', 'Close', { duration: 3000 });
        this.loadAll();
      },
      error: () => {
        this.saving.set(false);
        this.snack.open('Failed to update role', 'Close', { duration: 4000 });
        this.cdr.markForCheck();
      },
    });
  }

  // ── Delete role ───────────────────────────────────────────────────────────

  deleteRole(r: RoleDefinition): void {
    if (!confirm(`Delete role "${r.name}"? This cannot be undone.`)) return;
    this.svc.deleteRole(r.id).subscribe({
      next: () => {
        if (this.selectedRole()?.id === r.id) {
          this.selectedRole.set(null);
          this.pendingPermissions.set([]);
        }
        this.snack.open(`Role "${r.name}" deleted`, 'Close', { duration: 3000 });
        this.loadAll();
      },
      error: (err) => {
        const msg = err?.error?.code === 'role_in_use'
          ? 'Cannot delete: role is currently assigned to users'
          : 'Failed to delete role';
        this.snack.open(msg, 'Close', { duration: 4000 });
      },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  permissionCount(r: RoleDefinition): number {
    return r.permissions?.length || 0;
  }
}
