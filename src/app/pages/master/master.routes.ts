import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/rbac/permission.guard';

export const MasterRoutes: Routes = [
  {
    path: 'clinics',
    loadComponent: () => import('./clinics/clinics.component').then(m => m.ClinicsComponent),
    canActivate: [permissionGuard('org.manage')],
  },
  {
    path: 'clinic-profile',
    loadComponent: () => import('./clinic-profile/clinic-profile.component').then(m => m.ClinicProfileComponent),
    canActivate: [permissionGuard('clinic.settings')],
  },
  {
    path: 'services',
    loadComponent: () => import('./services/services.component').then(m => m.ServicesMasterComponent),
    canActivate: [permissionGuard('clinic.settings')],
  },
  {
    path: 'staff',
    loadComponent: () => import('./staff/staff.component').then(m => m.StaffMasterComponent),
    canActivate: [permissionGuard('staff.manage')],
  },
  {
    path: 'chairs',
    loadComponent: () => import('./chairs/chairs.component').then(m => m.ChairsMasterComponent),
    canActivate: [permissionGuard('clinic.settings')],
  },
  {
    path: 'rx-master',
    loadComponent: () => import('./rx-master/rx-master.component').then(m => m.RxMasterComponent),
    canActivate: [permissionGuard('clinic.settings')],
  },
  {
    path: 'rbac',
    loadComponent: () => import('./rbac-management/rbac-management.component').then(m => m.RbacManagementComponent),
    canActivate: [permissionGuard('staff.manage')],
  },
  {
    path: 'activity-log',
    loadComponent: () => import('./activity-log/activity-log.component').then(m => m.ActivityLogComponent),
    canActivate: [permissionGuard('audit.view')],
  },
  {
    path: 'inventory',
    loadComponent: () => import('./inventory/inventory.component').then(m => m.InventoryComponent),
    canActivate: [permissionGuard('inventory.adjust')],
  },
];
