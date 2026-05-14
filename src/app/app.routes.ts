import { Routes } from '@angular/router';
import { authGuard } from './auth/auth.guard';
import { BlankComponent } from './layouts/blank/blank.component';
import { FullComponent } from './layouts/full/full.component';
import { ScheduleComponent } from './pages/schedule/schedule.component';
import { permissionGuard, anyPermissionGuard } from './core/rbac/permission.guard';

export const routes: Routes = [
  // Admin — all routes behind authGuard
  {
    path: '',
    component: FullComponent,
    canActivateChild: [authGuard],
    children: [
      {
        path: '',
        redirectTo: '/schedule',
        pathMatch: 'full',
      },
      {
        path: 'schedule',
        component: ScheduleComponent,
      },
      {
        path: 'booking',
        canActivate: [permissionGuard('appointment.create')],
        loadComponent: () =>
          import('./pages/booking/booking.component').then(
            (m) => m.BookingComponent
          ),
      },
      {
        path: 'patients',
        canActivate: [permissionGuard('patient.view')],
        loadComponent: () =>
          import('./pages/patients/patient-list/patient-list.component').then(
            (m) => m.PatientListComponent
          ),
      },
      {
        path: 'patients/:id',
        canActivate: [permissionGuard('patient.view')],
        loadComponent: () =>
          import('./pages/patients/patient-record/patient-record.component').then(
            (m) => m.PatientRecordComponent
          ),
      },
      {
        path: 'rx/new',
        canActivate: [permissionGuard('prescription.create')],
        loadComponent: () =>
          import('./pages/rx/prescription-form/prescription-form.component').then(
            (m) => m.PrescriptionFormComponent
          ),
      },
      {
        path: 'rx/:id/edit',
        canActivate: [permissionGuard('prescription.create')],
        loadComponent: () =>
          import('./pages/rx/prescription-form/prescription-form.component').then(
            (m) => m.PrescriptionFormComponent
          ),
      },
      {
        path: 'my-services',
        canActivate: [permissionGuard('service.manage_own')],
        loadComponent: () =>
          import('./pages/master/services/services.component').then(
            (m) => m.ServicesMasterComponent
          ),
      },
      {
        path: 'master',
        canActivate: [anyPermissionGuard('clinic.settings', 'staff.manage')],
        loadChildren: () =>
          import('./pages/master/master.routes').then((m) => m.MasterRoutes),
      },
      {
        path: 'org-master',
        canActivate: [permissionGuard('org.manage')],
        loadChildren: () =>
          import('./pages/org-master/org-master.routes').then((m) => m.OrgMasterRoutes),
      },
      {
        path: 'dashboards',
        loadChildren: () =>
          import('./pages/dashboards/dashboards.routes').then((m) => m.DashboardsRoutes),
      },
      {
        path: 'apps',
        loadChildren: () =>
          import('./pages/apps/apps.routes').then((m) => m.AppsRoutes),
      },
      {
        path: 'theme-pages',
        loadChildren: () =>
          import('./pages/theme-pages/theme-pages.routes').then((m) => m.ThemePagesRoutes),
      },
    ],
  },

  // Public / unauthenticated pages (blank layout)
  {
    path: '',
    component: BlankComponent,
    children: [
      {
        path: 'authentication',
        loadChildren: () =>
          import('./pages/authentication/authentication.routes').then(
            (m) => m.AuthenticationRoutes
          ),
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'authentication/error',
  },
];
