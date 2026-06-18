import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/rbac/permission.guard';

export const MarketingRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./marketing-shell/marketing-shell.component').then((m) => m.MarketingShellComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./dashboard/marketing-dashboard.component').then((m) => m.MarketingDashboardComponent),
        canActivate: [permissionGuard('marketing.campaign.view')],
      },
      {
        path: 'campaigns',
        loadComponent: () =>
          import('./campaigns/campaign-list/campaign-list.component').then((m) => m.CampaignListComponent),
        canActivate: [permissionGuard('marketing.campaign.view')],
      },
      {
        path: 'campaigns/new',
        loadComponent: () =>
          import('./campaigns/campaign-form/campaign-form.component').then((m) => m.CampaignFormComponent),
        canActivate: [permissionGuard('marketing.campaign.create')],
      },
      {
        path: 'campaigns/:id/edit',
        loadComponent: () =>
          import('./campaigns/campaign-form/campaign-form.component').then((m) => m.CampaignFormComponent),
        canActivate: [permissionGuard('marketing.campaign.edit')],
      },
      {
        path: 'calendar',
        loadComponent: () =>
          import('./content-calendar/content-calendar.component').then((m) => m.ContentCalendarComponent),
        canActivate: [permissionGuard('marketing.calendar.view')],
      },
      {
        path: 'pipeline',
        loadComponent: () =>
          import('./pipeline/pipeline-board/pipeline-board.component').then((m) => m.PipelineBoardComponent),
        canActivate: [permissionGuard('marketing.pipeline.view')],
      },
      {
        path: 'pipeline/:id',
        loadComponent: () =>
          import('./pipeline/lead-detail/lead-detail.component').then((m) => m.LeadDetailComponent),
        canActivate: [permissionGuard('marketing.pipeline.view')],
      },
      {
        path: 'acceptance-ratio',
        loadComponent: () =>
          import('./feedback/acceptance-ratio/acceptance-ratio.component').then((m) => m.AcceptanceRatioComponent),
        canActivate: [permissionGuard('marketing.acceptance.view')],
      },
      {
        path: 'caller-queue',
        loadComponent: () =>
          import('./caller/caller-dashboard/caller-dashboard.component').then((m) => m.CallerDashboardComponent),
        canActivate: [permissionGuard('marketing.callqueue.view_own')],
      },
      {
        path: 'enquiries',
        loadComponent: () =>
          import('./digital-enquiries/enquiry-list/enquiry-list.component').then((m) => m.EnquiryListComponent),
        canActivate: [permissionGuard('marketing.enquiry.view')],
      },
      {
        path: 'enquiries/:id',
        loadComponent: () =>
          import('./digital-enquiries/enquiry-detail/enquiry-detail.component').then((m) => m.EnquiryDetailComponent),
        canActivate: [permissionGuard('marketing.enquiry.view')],
      },
      {
        path: 'scheduled-calls',
        loadComponent: () =>
          import('./scheduled-calls/scheduled-calls-view/scheduled-calls-view.component').then((m) => m.ScheduledCallsViewComponent),
        canActivate: [permissionGuard('marketing.scheduled_calls.view')],
      },
      {
        path: 'expenses',
        loadComponent: () =>
          import('./expenses/expense-list/expense-list.component').then((m) => m.ExpenseListComponent),
        canActivate: [permissionGuard('marketing.expense.view')],
      },
      {
        path: 'expenses-summary',
        loadComponent: () =>
          import('./expenses/expense-summary/expense-summary.component').then((m) => m.ExpenseSummaryComponent),
        canActivate: [permissionGuard('marketing.expense.view')],
      },
      {
        path: 'lead-finder',
        loadComponent: () =>
          import('./lead-finder/lead-finder.component').then((m) => m.LeadFinderComponent),
        canActivate: [permissionGuard('marketing.leadfinder.manage')],
      },
      {
        path: 'segments',
        loadComponent: () =>
          import('./segments/segment-list/segment-list.component').then((m) => m.SegmentListComponent),
        canActivate: [permissionGuard('marketing.segment.view')],
      },
      {
        path: 'promo-codes',
        loadComponent: () =>
          import('./promo-codes/promo-code-list/promo-code-list.component').then((m) => m.PromoCodeListComponent),
        canActivate: [permissionGuard('marketing.promocode.view')],
      },
      {
        path: 'pitch-library',
        loadComponent: () =>
          import('./pitch-library/pitch-list/pitch-list.component').then((m) => m.PitchListComponent),
        canActivate: [permissionGuard('marketing.pitch.view')],
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
];
