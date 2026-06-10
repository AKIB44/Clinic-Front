import {
  Component, Output, EventEmitter, Input, ViewEncapsulation, inject, OnInit,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgScrollbarModule } from 'ngx-scrollbar';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatSidenavModule } from '@angular/material/sidenav';
import { AuthService } from 'src/app/auth/auth.service';
import { ClinicSwitcherComponent } from 'src/app/core/tenant/clinic-switcher.component';
import { PermissionService } from 'src/app/core/rbac/permission.service';
import { InventoryAlertsService } from 'src/app/services/inventory-alerts.service';

interface AppLink   { id: number; img: string; title: string; subtitle: string; link: string; }
interface QuickLink { id: number; title: string; link: string; }
interface Shortcut      { title: string; subtitle: string; link: string; icon: string; accent: string; perm: string; }
interface ShortcutGroup { label: string; items: Shortcut[]; }

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    RouterModule, CommonModule, NgScrollbarModule, TablerIconsModule,
    MaterialModule, FormsModule, MatMenuModule, MatSidenavModule,
    MatButtonModule, ClinicSwitcherComponent,
  ],
  templateUrl: './header.component.html',
  styles: [`
    /* Let the dropdown grow wider than Material's default 280px cap. */
    .mat-mdc-menu-panel.topbar-dd { max-width: min(94vw, 520px); }

    .sc-shortcuts {
      width: min(94vw, 520px);
      max-height: min(72vh, 620px);
      overflow-y: auto;
      padding: 6px 0 10px;
    }
    .sc-group-label {
      padding: 12px 18px 6px; font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: .05em; color: #94a3b8;
    }
    /* Auto-fit columns: more on wide menus (shorter), fewer on small screens. */
    .sc-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 8px; padding: 0 12px;
    }
    .sc-card {
      display: flex; flex-direction: column; align-items: center; text-align: center; gap: 6px;
      padding: 12px 8px; border: 1px solid #eef2f6; border-radius: 12px;
      text-decoration: none; transition: all .14s ease; cursor: pointer;
    }
    .sc-card:hover { border-color: #0d7a5f33; box-shadow: 0 6px 18px rgba(13,122,95,.12); transform: translateY(-2px); }
    .sc-card-icon {
      width: 44px; height: 44px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .sc-card-icon svg { width: 22px; height: 22px; }
    .sc-card-title { margin: 0; font-size: 13px; font-weight: 700; color: #0f172a; line-height: 1.2; }
    .sc-card-sub   { margin: 0; font-size: 10.5px; color: #94a3b8; line-height: 1.2; }

    @media (max-width: 480px) {
      .sc-grid { grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 6px; }
      .sc-card { padding: 10px 6px; }
      .sc-card-icon { width: 38px; height: 38px; }
      .sc-card-icon svg { width: 19px; height: 19px; }
    }
  `],
  encapsulation: ViewEncapsulation.None,
})
export class HeaderComponent implements OnInit {
  private authService    = inject(AuthService);
  private perms          = inject(PermissionService);
  readonly alertsSvc     = inject(InventoryAlertsService);
  private router         = inject(Router);
  private dialog         = inject(MatDialog);

  @Input() showToggle = true;
  @Input() toggleChecked = false;
  @Output() toggleMobileNav       = new EventEmitter<void>();
  @Output() toggleMobileFilterNav = new EventEmitter<void>();
  @Output() toggleCollapsed       = new EventEmitter<void>();

  get loggedInUserName(): string {
    const user = this.authService.getUser();
    return `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || user?.email || 'User';
  }

  get loggedInUserRole(): string {
    const user = this.authService.getUser();
    if (user?.is_org_admin) return 'Org Admin';
    const role = user?.role;
    if (!role) return 'User';
    if (role === 'admin') return 'Admin';
    if (role === 'receptionist') return 'Receptionist';
    return 'Doctor';
  }

  get loggedInUserEmail(): string {
    return this.authService.getUser()?.email || '';
  }

  get userInitials(): string {
    const user = this.authService.getUser();
    const first = user?.first_name?.[0] ?? '';
    const last  = user?.last_name?.[0]  ?? '';
    return (first + last).toUpperCase() || (user?.email?.[0] ?? 'U').toUpperCase();
  }

  get isOrgAdmin(): boolean {
    return this.perms.has('org.manage');
  }

  get canSeeInventoryAlerts(): boolean {
    return this.perms.has('inventory.adjust');
  }

  // ── Shortcuts dropdown (permission-gated) ───────────────────────────────────
  private readonly allShortcutGroups: ShortcutGroup[] = [
    {
      label: 'Subscription Management',
      items: [
        { title: 'Dashboard',            subtitle: 'MRR & metrics',    link: '/platform/dashboard',     icon: 'chart-bar',     accent: 'info',    perm: 'platform.plan.manage' },
        { title: 'Subscriptions',        subtitle: 'Plans per clinic', link: '/platform/subscriptions', icon: 'building-store', accent: 'primary', perm: 'platform.plan.manage' },
        { title: 'Plans',                subtitle: 'Manage catalog',   link: '/platform/plans',         icon: 'receipt-2',     accent: 'success', perm: 'platform.plan.manage' },
      ],
    },
    {
      label: 'Administration',
      items: [
        { title: 'Billing',          subtitle: 'Revenue & expense', link: '/billing',                  icon: 'report-money', accent: 'success', perm: 'billing.view' },
        { title: 'Human Resources',  subtitle: 'Staff & roles',     link: '/org-master/hr',            icon: 'users',        accent: 'primary', perm: 'org.manage' },
        { title: 'Role Management',  subtitle: 'Roles & access',    link: '/org-master/roles',         icon: 'shield-lock',  accent: 'info',    perm: 'org.manage' },
        { title: 'Staff Attributes', subtitle: 'Access attributes', link: '/org-master/staff-attrs',   icon: 'shield-check', accent: 'warning', perm: 'staff.manage' },
        { title: 'Decision Log',     subtitle: 'Access audit',      link: '/org-master/decision-log',  icon: 'file-search',  accent: 'accent',  perm: 'audit.view' },
        { title: 'Feature Flags',    subtitle: 'Toggle features',   link: '/org-master/feature-flags', icon: 'toggle-right', accent: 'accent',  perm: 'feature_flag.manage' },
        { title: 'Release Notes',    subtitle: "What's new",        link: '/org-master/release-notes', icon: 'sparkles',     accent: 'error',   perm: 'org.manage' },
      ],
    },
  ];

  /** Groups with only the items the current user is permitted to see; empty groups dropped. */
  get shortcutGroups(): ShortcutGroup[] {
    return this.allShortcutGroups
      .map((g) => ({ label: g.label, items: g.items.filter((i) => this.perms.has(i.perm)) }))
      .filter((g) => g.items.length > 0);
  }

  get hasShortcuts(): boolean {
    return this.shortcutGroups.length > 0;
  }

  ngOnInit(): void {
    if (this.canSeeInventoryAlerts) {
      this.alertsSvc.refresh();
    }
  }

  logout(): void {
    // Clear session immediately so the interceptor doesn't try to refresh.
    // Navigate regardless of whether the server-side logout call succeeds.
    this.authService.logout().subscribe({
      next:     () => this.router.navigate(['/authentication/login']),
      complete: () => this.router.navigate(['/authentication/login']),
      error:    () => this.router.navigate(['/authentication/login']),
    });
  }

  apps: AppLink[] = [
    { id: 1, img: '/assets/images/svgs/icon-dd-chat.svg',        title: 'Chat Application', subtitle: 'Messages & Emails',      link: '/apps/chat' },
    { id: 2, img: '/assets/images/svgs/icon-dd-cart.svg',        title: 'Todo App',         subtitle: 'Completed task',         link: '/apps/todo' },
    { id: 3, img: '/assets/images/svgs/icon-dd-invoice.svg',     title: 'Invoice App',      subtitle: 'Get latest invoice',     link: '/apps/invoice' },
    { id: 4, img: '/assets/images/svgs/icon-dd-date.svg',        title: 'Calendar App',     subtitle: 'Get Dates',              link: '/apps/calendar' },
    { id: 5, img: '/assets/images/svgs/icon-dd-mobile.svg',      title: 'Contact Application', subtitle: '2 Unsaved Contacts', link: '/apps/contacts' },
    { id: 6, img: '/assets/images/svgs/icon-dd-lifebuoy.svg',    title: 'Tickets App',      subtitle: 'Create new ticket',      link: '/apps/tickets' },
    { id: 7, img: '/assets/images/svgs/icon-dd-message-box.svg', title: 'Email App',        subtitle: 'Get new emails',         link: '/apps/email/inbox' },
    { id: 8, img: '/assets/images/svgs/icon-dd-application.svg', title: 'Courses',          subtitle: 'Create new course',      link: '/apps/courses' },
  ];

  quicklinks: QuickLink[] = [
    { id: 1, title: 'Pricing Page',           link: '/theme-pages/pricing' },
    { id: 2, title: 'Authentication Design',  link: '/authentication/login' },
    { id: 3, title: 'Register Now',           link: '/authentication/side-register' },
    { id: 4, title: '404 Error Page',         link: '/authentication/error' },
    { id: 5, title: 'Notes App',              link: '/apps/notes' },
    { id: 6, title: 'Employee App',           link: '/apps/employee' },
    { id: 7, title: 'Todo Application',       link: '/apps/todo' },
    { id: 8, title: 'Treeview',               link: '/theme-pages/treeview' },
  ];
}
