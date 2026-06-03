import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/rbac/permission.guard';

export const OrgMasterRoutes: Routes = [
  {
    path: 'hr',
    loadComponent: () => import('./hr/hr.component').then(m => m.HrComponent),
    canActivate: [permissionGuard('org.manage')],
  },
  {
    path: 'accounts',
    loadComponent: () => import('./accounts/accounts.component').then(m => m.AccountsComponent),
    canActivate: [permissionGuard('org.manage')],
  },
  {
    path: 'roles',
    loadComponent: () => import('./roles/roles.component').then(m => m.RolesComponent),
    canActivate: [permissionGuard('org.manage')],
  },
  {
    path: 'release-notes',
    loadComponent: () => import('./release-notes/release-notes.component').then(m => m.ReleaseNotesComponent),
    canActivate: [permissionGuard('org.manage')],
  },
  {
    path: 'feature-flags',
    loadComponent: () => import('./feature-flags/feature-flags.component').then(m => m.FeatureFlagsAdminComponent),
    canActivate: [permissionGuard('feature_flag.manage')],
  },
  { path: '', redirectTo: 'hr', pathMatch: 'full' },
];
