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

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    RouterModule, CommonModule, NgScrollbarModule, TablerIconsModule,
    MaterialModule, FormsModule, MatMenuModule, MatSidenavModule,
    MatButtonModule, ClinicSwitcherComponent,
  ],
  templateUrl: './header.component.html',
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
