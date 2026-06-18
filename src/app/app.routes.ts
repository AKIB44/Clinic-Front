import { Routes } from '@angular/router';
import { authGuard } from './auth/auth.guard';
import { BlankComponent } from './layouts/blank/blank.component';
import { FullComponent } from './layouts/full/full.component';
import { ScheduleComponent } from './pages/schedule/schedule.component';
import { permissionGuard, anyPermissionGuard } from './core/rbac/permission.guard';
import { sessionAutoPauseGuard } from './features/treatment-session/guards/session-auto-pause.guard';
import { featureFlagGuard } from './core/feature-flag.guard';
import { GESTURE_VIEWER_FLAG } from './services/feature-flags.service';

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
        path: 'patients/:id/files',
        canActivate: [permissionGuard('patient.view')],
        loadComponent: () =>
          import('./features/patient-files/pages/patient-files/patient-files.page').then(
            (m) => m.PatientFilesPage
          ),
      },
      {
        path: 'viewer',
        canActivate: [permissionGuard('patient.view'), featureFlagGuard(GESTURE_VIEWER_FLAG)],
        loadComponent: () =>
          import('./features/viewer/pages/model-viewer-page/model-viewer-page.page').then(
            (m) => m.ModelViewerPage
          ),
      },
      {
        path: 'viewer/:patientId/:fileId',
        canActivate: [permissionGuard('patient.view'), featureFlagGuard(GESTURE_VIEWER_FLAG)],
        loadComponent: () =>
          import('./features/viewer/pages/model-viewer-page/model-viewer-page.page').then(
            (m) => m.ModelViewerPage
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
        path: 'platform',
        canActivate: [permissionGuard('platform.plan.manage')],
        loadChildren: () =>
          import('./features/platform/platform.routes').then((m) => m.PlatformRoutes),
      },
      {
        path: 'billing',
        canActivate: [permissionGuard('billing.view')],
        loadComponent: () =>
          import('./features/billing/pages/clinic-billing/clinic-billing.page').then(
            (m) => m.ClinicBillingPage
          ),
      },
      {
        path: 'marketing',
        canActivate: [permissionGuard('marketing.campaign.view')],
        loadChildren: () =>
          import('./features/marketing/marketing.routes').then((m) => m.MarketingRoutes),
      },
      {
        path: 'treatment/:sessionId',
        canActivate: [permissionGuard('appointment.view')],
        canDeactivate: [sessionAutoPauseGuard],
        loadComponent: () =>
          import('./features/treatment-session/pages/session-canvas.page').then(
            (m) => m.SessionCanvasPage
          ),
      },
      {
        path: 'specialty',
        canActivate: [permissionGuard('specialty.view')],
        children: [
          {
            path: 'cases/:id',
            loadComponent: () =>
              import('./features/specialty/shared/pages/specialty-case-detail/specialty-case-detail.page').then(
                (m) => m.SpecialtyCaseDetailPage
              ),
          },
          // Orthodontics
          { path: 'orthodontic/cases', loadComponent: () => import('./features/specialty/orthodontic/pages/ortho-case-list/ortho-case-list.page').then(m => m.OrthoCaseListPage) },
          { path: 'orthodontic/cases/new', loadComponent: () => import('./features/specialty/orthodontic/pages/ortho-case-create/ortho-case-create.page').then(m => m.OrthoCaseCreatePage) },
          { path: 'orthodontic/cases/:caseId', loadComponent: () => import('./features/specialty/orthodontic/pages/ortho-case-detail/ortho-case-detail.page').then(m => m.OrthoCaseDetailPage) },
          // Implantology
          { path: 'implantology/cases', loadComponent: () => import('./features/specialty/implantology/pages/implant-case-list/implant-case-list.page').then(m => m.ImplantCaseListPage) },
          { path: 'implantology/cases/new', loadComponent: () => import('./features/specialty/implantology/pages/implant-case-create/implant-case-create.page').then(m => m.ImplantCaseCreatePage) },
          { path: 'implantology/cases/:caseId', loadComponent: () => import('./features/specialty/implantology/pages/implant-case-detail/implant-case-detail.page').then(m => m.ImplantCaseDetailPage) },
          { path: 'implantology/recall-search', loadComponent: () => import('./features/specialty/implantology/pages/implant-recall-search/implant-recall-search.page').then(m => m.ImplantRecallSearchPage) },
          // Paediatric
          { path: 'paediatric/cases', loadComponent: () => import('./features/specialty/paediatric/pages/paedo-case-list/paedo-case-list.page').then(m => m.PaedoCaseListPage) },
          { path: 'paediatric/cases/new', loadComponent: () => import('./features/specialty/paediatric/pages/paedo-case-create/paedo-case-create.page').then(m => m.PaedoCaseCreatePage) },
          { path: 'paediatric/cases/:caseId', loadComponent: () => import('./features/specialty/paediatric/pages/paedo-case-detail/paedo-case-detail.page').then(m => m.PaedoCaseDetailPage) },
          // Endodontic
          { path: 'endodontic/cases', loadComponent: () => import('./features/specialty/endodontic/pages/endo-case-list/endo-case-list.page').then(m => m.EndoCaseListPage) },
          { path: 'endodontic/cases/new', loadComponent: () => import('./features/specialty/endodontic/pages/endo-case-create/endo-case-create.page').then(m => m.EndoCaseCreatePage) },
          { path: 'endodontic/cases/:caseId', loadComponent: () => import('./features/specialty/endodontic/pages/endo-case-detail/endo-case-detail.page').then(m => m.EndoCaseDetailPage) },
          // TMJ
          { path: 'tmj/cases', loadComponent: () => import('./features/specialty/tmj/pages/tmj-case-list/tmj-case-list.page').then(m => m.TmjCaseListPage) },
          { path: 'tmj/cases/new', loadComponent: () => import('./features/specialty/tmj/pages/tmj-case-create/tmj-case-create.page').then(m => m.TmjCaseCreatePage) },
          { path: 'tmj/cases/:caseId', loadComponent: () => import('./features/specialty/tmj/pages/tmj-case-detail/tmj-case-detail.page').then(m => m.TmjCaseDetailPage) },
        ],
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
