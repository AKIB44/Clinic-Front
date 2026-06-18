import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TablerIconsModule } from 'angular-tabler-icons';
import { PermissionService } from '../../../core/rbac/permission.service';

interface MarketingNavItem {
  label: string;
  link: string;
  icon: string;
  perm: string;
}

@Component({
  selector: 'marketing-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, TablerIconsModule],
  templateUrl: './marketing-shell.component.html',
  styleUrl: './marketing-shell.component.scss',
})
export class MarketingShellComponent {
  private perms = inject(PermissionService);

  private readonly allNav: MarketingNavItem[] = [
    { label: 'Dashboard',  link: 'dashboard',        icon: 'layout-dashboard', perm: 'marketing.campaign.view' },
    { label: 'Campaigns',  link: 'campaigns',        icon: 'speakerphone',     perm: 'marketing.campaign.view' },
    { label: 'Calendar',   link: 'calendar',         icon: 'calendar-event',   perm: 'marketing.calendar.view' },
    { label: 'Segments',   link: 'segments',         icon: 'users-group',      perm: 'marketing.segment.view' },
    { label: 'Promo Codes', link: 'promo-codes',     icon: 'discount',         perm: 'marketing.promocode.view' },
    { label: 'Pipeline',    link: 'pipeline',         icon: 'layout-kanban',    perm: 'marketing.pipeline.view' },
    { label: 'Lead Finder', link: 'lead-finder',      icon: 'map-search',       perm: 'marketing.leadfinder.manage' },
    { label: 'Pitch Library', link: 'pitch-library',  icon: 'presentation',     perm: 'marketing.pitch.view' },
    { label: 'Call Queue',  link: 'caller-queue',     icon: 'phone-call',       perm: 'marketing.callqueue.view_own' },
    { label: 'Enquiries',  link: 'enquiries',        icon: 'world-www',        perm: 'marketing.enquiry.view' },
    { label: 'Scheduled',  link: 'scheduled-calls',  icon: 'calendar-time',    perm: 'marketing.scheduled_calls.view' },
    { label: 'Expenses',   link: 'expenses',         icon: 'receipt',          perm: 'marketing.expense.view' },
    { label: 'Acceptance', link: 'acceptance-ratio', icon: 'chart-donut',      perm: 'marketing.acceptance.view' },
  ];

  get nav(): MarketingNavItem[] {
    return this.allNav.filter((i) => this.perms.has(i.perm));
  }
}
