import { Routes } from '@angular/router';
import { roleGuard } from '../../auth/role.guard';

// All master routes require 'admin' role
export const MasterRoutes: Routes = [
  {
    path: 'clinic-profile',
    loadComponent: () => import('./clinic-profile/clinic-profile.component').then(m => m.ClinicProfileComponent),
    canActivate: [roleGuard(['admin'])],
  },
  {
    path: 'services',
    loadComponent: () => import('./services/services.component').then(m => m.ServicesMasterComponent),
    canActivate: [roleGuard(['admin'])],
  },
  {
    path: 'staff',
    loadComponent: () => import('./staff/staff.component').then(m => m.StaffMasterComponent),
    canActivate: [roleGuard(['admin'])],
  },
  {
    path: 'chairs',
    loadComponent: () => import('./chairs/chairs.component').then(m => m.ChairsMasterComponent),
    canActivate: [roleGuard(['admin'])],
  },
];
