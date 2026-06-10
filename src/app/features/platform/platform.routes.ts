import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/rbac/permission.guard';

export const PlatformRoutes: Routes = [
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./pages/platform-dashboard/platform-dashboard.page').then((m) => m.PlatformDashboardPage),
    canActivate: [permissionGuard('platform.plan.manage')],
  },
  {
    path: 'tenants/:clinicId',
    loadComponent: () =>
      import('./pages/platform-tenant-detail/platform-tenant-detail.page').then((m) => m.PlatformTenantDetailPage),
    canActivate: [permissionGuard('platform.plan.manage')],
  },
  {
    path: 'subscriptions',
    loadComponent: () =>
      import('./pages/platform-subscription-list/platform-subscription-list.page').then((m) => m.PlatformSubscriptionListPage),
    canActivate: [permissionGuard('platform.plan.manage')],
  },
  {
    path: 'plans',
    loadComponent: () =>
      import('./pages/platform-plan-list/platform-plan-list.page').then((m) => m.PlatformPlanListPage),
    canActivate: [permissionGuard('platform.plan.manage')],
  },
  {
    path: 'plans/new',
    loadComponent: () =>
      import('./pages/platform-plan-edit/platform-plan-edit.page').then((m) => m.PlatformPlanEditPage),
    canActivate: [permissionGuard('platform.plan.manage')],
  },
  {
    path: 'plans/:id/edit',
    loadComponent: () =>
      import('./pages/platform-plan-edit/platform-plan-edit.page').then((m) => m.PlatformPlanEditPage),
    canActivate: [permissionGuard('platform.plan.manage')],
  },
  { path: '', redirectTo: 'subscriptions', pathMatch: 'full' },
];
