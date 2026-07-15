import { BreakpointObserver, MediaMatcher } from '@angular/cdk/layout';
import { Component, OnInit, ViewChild, ViewEncapsulation, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { MatSidenav, MatSidenavContent } from '@angular/material/sidenav';
import { CoreService } from 'src/app/services/core.service';
import { AppSettings } from 'src/app/config';
import { filter } from 'rxjs/operators';
import { NavigationEnd, Router } from '@angular/router';
import { navItems as allNavItems } from './vertical/sidebar/sidebar-data';
import { RbacService } from '../../auth/rbac.service';
import { PermissionService } from '../../core/rbac/permission.service';
import { NavService } from '../../services/nav.service';
import { AuthService } from '../../auth/auth.service';
import { AppNavItemComponent } from './vertical/sidebar/nav-item/nav-item.component';
import { RouterModule } from '@angular/router';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from './vertical/sidebar/sidebar.component';
import { NgScrollbarModule } from 'ngx-scrollbar';
import { TablerIconsModule } from 'angular-tabler-icons';
import { HeaderComponent } from './vertical/header/header.component';
import { AppHorizontalHeaderComponent } from './horizontal/header/header.component';
import { AppHorizontalSidebarComponent } from './horizontal/sidebar/sidebar.component';
import { AppBreadcrumbComponent } from './shared/breadcrumb/breadcrumb.component';
import { CustomizerComponent } from './shared/customizer/customizer.component';
import { VoiceAssistantComponent } from '../../components/voice-assistant/voice-assistant.component';
import { OfflineQueueService } from '../../core/offline/offline-queue.service';
import { TenantStatusService } from '../../core/tenant/tenant-status.service';
import { GeolocationReporterService } from '../../services/geolocation-reporter.service';

const MOBILE_VIEW = 'screen and (max-width: 768px)';
const TABLET_VIEW = 'screen and (min-width: 769px) and (max-width: 1024px)';
const MONITOR_VIEW = 'screen and (min-width: 1024px)';
const BELOWMONITOR = 'screen and (max-width: 1023px)';

// for mobile app sidebar
interface apps {
  id: number;
  img: string;
  title: string;
  subtitle: string;
  link: string;
}

interface quicklinks {
  id: number;
  title: string;
  link: string;
}

@Component({
  selector: 'app-full',
  standalone: true,
  imports: [
    RouterModule,
    AppNavItemComponent,
    MaterialModule,
    CommonModule,
    SidebarComponent,
    NgScrollbarModule,
    TablerIconsModule,
    HeaderComponent,
    AppHorizontalHeaderComponent,
    AppHorizontalSidebarComponent,
    AppBreadcrumbComponent,
    CustomizerComponent,
    VoiceAssistantComponent,
  ],
  templateUrl: './full.component.html',
  styles: [`
    .df-offline-banner {
      position: fixed; top: 0; left: 0; right: 0; z-index: 1200;
      display: flex; align-items: center; justify-content: center; gap: 8px;
      padding: 6px 16px; font-size: 13px; font-weight: 500; line-height: 1.3;
      box-shadow: 0 1px 4px rgba(0,0,0,.15);
    }
    .df-offline-banner--off  { background: #b91c1c; color: #fff; }
    .df-offline-banner--sync { background: #0D7A5F; color: #fff; }
    .df-offline-count {
      background: rgba(255,255,255,.22); border-radius: 10px;
      padding: 1px 8px; font-size: 12px;
    }
    .df-spin { animation: df-spin 1s linear infinite; }
    @keyframes df-spin { to { transform: rotate(360deg); } }

    /* ── Trial / subscription status bar ───────────────────────────────── */
    .df-tenant-bar {
      position: relative; z-index: 1100;
      display: flex; align-items: center; justify-content: center; gap: 10px;
      padding: 7px 16px; font-size: 13px; font-weight: 500; line-height: 1.3;
    }
    .df-tenant-bar--trial   { background: #fffbeb; color: #92400e; border-bottom: 1px solid #fde68a; }
    .df-tenant-bar--blocked { background: #7f1d1d; color: #fff; }
    .df-tenant-cta {
      font-weight: 700; text-decoration: underline; cursor: pointer;
      color: inherit;
    }
    .df-tenant-bar--trial .df-tenant-cta { color: #92400e; }

    /* ── Animated "back online" greeting ───────────────────────────────── */
    .df-reconnect-overlay {
      position: fixed; inset: 0; z-index: 2000;
      display: flex; align-items: center; justify-content: center;
      background: rgba(15, 23, 42, .55); backdrop-filter: blur(4px);
      animation: df-overlay-in .35s ease both;
      cursor: pointer;
    }
    .df-reconnect-card {
      position: relative;
      display: flex; flex-direction: column; align-items: center; text-align: center;
      gap: 10px; padding: 36px 44px; border-radius: 20px;
      color: #fff; box-shadow: 0 24px 60px rgba(0,0,0,.35);
      animation: df-card-pop .5s cubic-bezier(.18,.89,.32,1.28) both;
    }
    .df-reconnect-card--online  { background: linear-gradient(150deg, #0D7A5F 0%, #0b6650 100%); }
    .df-reconnect-card--offline { background: linear-gradient(150deg, #b91c1c 0%, #7f1d1d 100%); }
    .df-reconnect-ring {
      position: absolute; top: 36px; left: 50%; margin-left: -38px;
      width: 76px; height: 76px; border-radius: 50%;
      border: 3px solid rgba(255,255,255,.5);
      animation: df-ring 1.4s ease-out infinite;
    }
    .df-reconnect-icon {
      width: 76px; height: 76px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      background: rgba(255,255,255,.18);
      animation: df-icon-pulse 1.6s ease-in-out infinite;
    }
    .df-reconnect-icon svg { width: 40px; height: 40px; }
    .df-reconnect-title { font-size: 22px; font-weight: 700; letter-spacing: .2px; }
    .df-reconnect-sub   { font-size: 13.5px; opacity: .9; }

    @keyframes df-overlay-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes df-card-pop {
      from { opacity: 0; transform: translateY(18px) scale(.9); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes df-icon-pulse {
      0%,100% { transform: scale(1); }
      50%     { transform: scale(1.08); }
    }
    @keyframes df-ring {
      0%   { transform: scale(.85); opacity: .7; }
      100% { transform: scale(1.6); opacity: 0; }
    }
  `],
  encapsulation: ViewEncapsulation.None,
})
export class FullComponent implements OnInit {
  private rbac        = inject(RbacService);
  private authService = inject(AuthService);
  private permissions = inject(PermissionService);
  readonly offline    = inject(OfflineQueueService);
  readonly tenant     = inject(TenantStatusService);
  private geoReporter = inject(GeolocationReporterService);

  get loggedInUserName(): string {
    const user = this.authService.getUser();
    const fullName = `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim();
    return fullName || user?.email || 'User';
  }

  get loggedInUserRole(): string {
    const role = this.authService.getUser()?.role;
    if (!role) return 'User';
    if (role === 'admin') return 'Admin';
    if (role === 'receptionist') return 'Receptionist';
    return 'Doctor';
  }

  get navItems() {
    return this.filterNav(allNavItems);
  }

  /**
   * Recursively filter the nav tree by permissions / roles.
   *
   * Rules:
   *  - When permissions are loaded AND the item declares `permissions: [...]`,
   *    permissions are authoritative — a matching role is NOT a fallback. This
   *    is the bug the previous OR-clause introduced: it left items visible to
   *    any logged-in user just because their role wasn't explicitly excluded.
   *  - When permissions aren't loaded yet (e.g. perms endpoint not seeded or
   *    network failed), fall back to `roles: [...]` if present; otherwise show.
   *  - Children are filtered with the same rules; a parent with children that
   *    all got filtered out is itself hidden (unless it has its own route).
   *  - navCap dividers respect their declared permissions too.
   */
  private filterNav(items: any[]): any[] {
    const role       = this.rbac.role;
    const perms      = this.permissions.perms();
    const permsReady = this.permissions.loaded() && Object.keys(perms).length > 0;

    const allowed = (item: any): boolean => {
      if (permsReady && item.permissions?.length) {
        return item.permissions.some((c: string) => c in perms);
      }
      if (item.roles?.length) {
        return !!role && item.roles.includes(role);
      }
      return true;
    };

    const out: any[] = [];
    for (const item of items) {
      if (!allowed(item)) continue;
      if (item.children?.length) {
        const filteredChildren = this.filterNav(item.children);
        if (!filteredChildren.length && !item.route) continue;
        out.push({ ...item, children: filteredChildren });
      } else {
        out.push(item);
      }
    }
    // Drop section headers (navCap) that have no real items beneath them. A
    // navCap is followed by zero-or-more menu items until the next navCap (or
    // end of list). If that run is empty, the header is just visual clutter.
    return out.filter((item, idx, arr) => {
      if (!item.navCap) return true;
      for (let j = idx + 1; j < arr.length; j++) {
        if (arr[j].navCap) return false; // hit next section → empty
        return true;                     // found at least one item
      }
      return false;                      // trailing navCap with nothing after it
    });
  }

  @ViewChild('leftsidenav')
  public sidenav: MatSidenav;
  resView = false;
  @ViewChild('content', { static: true }) content!: MatSidenavContent;
  //get options from service
  options = this.settings.getOptions();
  private layoutChangesSubscription = Subscription.EMPTY;
  private isMobileScreen = false;
  private isContentWidthFixed = true;
  private isCollapsedWidthFixed = false;
  private htmlElement!: HTMLHtmlElement;

  get isOver(): boolean {
    return this.isMobileScreen;
  }

  get isTablet(): boolean {
    return this.resView;
  }

  // for mobile app sidebar
  apps: apps[] = [
    {
      id: 1,
      img: '/assets/images/svgs/icon-dd-chat.svg',
      title: 'Chat Application',
      subtitle: 'Messages & Emails',
      link: '/apps/chat',
    },
    {
      id: 2,
      img: '/assets/images/svgs/icon-dd-cart.svg',
      title: 'eCommerce App',
      subtitle: 'Buy a Product',
      link: '/apps/email/inbox',
    },
    {
      id: 3,
      img: '/assets/images/svgs/icon-dd-invoice.svg',
      title: 'Invoice App',
      subtitle: 'Get latest invoice',
      link: '/apps/invoice',
    },
    {
      id: 4,
      img: '/assets/images/svgs/icon-dd-date.svg',
      title: 'Calendar App',
      subtitle: 'Get Dates',
      link: '/apps/calendar',
    },
    {
      id: 5,
      img: '/assets/images/svgs/icon-dd-mobile.svg',
      title: 'Contact Application',
      subtitle: '2 Unsaved Contacts',
      link: '/apps/contacts',
    },
    {
      id: 6,
      img: '/assets/images/svgs/icon-dd-lifebuoy.svg',
      title: 'Tickets App',
      subtitle: 'Create new ticket',
      link: '/apps/tickets',
    },
    {
      id: 7,
      img: '/assets/images/svgs/icon-dd-message-box.svg',
      title: 'Email App',
      subtitle: 'Get new emails',
      link: '/apps/email/inbox',
    },
    {
      id: 8,
      img: '/assets/images/svgs/icon-dd-application.svg',
      title: 'Courses',
      subtitle: 'Create new course',
      link: '/apps/courses',
    },
  ];

  quicklinks: quicklinks[] = [
    {
      id: 1,
      title: 'Pricing Page',
      link: '/theme-pages/pricing',
    },
    {
      id: 2,
      title: 'Authentication Design',
      link: '/authentication/side-login',
    },
    {
      id: 3,
      title: 'Register Now',
      link: '/authentication/side-register',
    },
    {
      id: 4,
      title: '404 Error Page',
      link: '/authentication/error',
    },
    {
      id: 5,
      title: 'Notes App',
      link: '/apps/notes',
    },
    {
      id: 6,
      title: 'Employee App',
      link: '/apps/employee',
    },
    {
      id: 7,
      title: 'Todo Application',
      link: '/apps/todo',
    },
    {
      id: 8,
      title: 'Treeview',
      link: '/theme-pages/treeview',
    },
  ];

  constructor(
    private settings: CoreService,
    private mediaMatcher: MediaMatcher,
    private router: Router,
    private breakpointObserver: BreakpointObserver,
    private navService: NavService
  ) {
    this.htmlElement = document.querySelector('html')!;
    // Apply the saved lock preference before the breakpoint observer runs, so it
    // doesn't get overwritten by the responsive defaults.
    this.restoreLock();
    this.layoutChangesSubscription = this.breakpointObserver
      .observe([MOBILE_VIEW, TABLET_VIEW, MONITOR_VIEW, BELOWMONITOR])
      .subscribe((state) => {
        // SidenavOpened must be reset true when layout changes
        this.options.sidenavOpened = true;
        this.isMobileScreen = state.breakpoints[BELOWMONITOR];
        if (this.options.sidenavCollapsed == false) {
          this.options.sidenavCollapsed = state.breakpoints[TABLET_VIEW];
        }
        this.isContentWidthFixed = state.breakpoints[MONITOR_VIEW];
        this.resView = state.breakpoints[BELOWMONITOR];
      });

    // Initialize project theme with options
    this.receiveOptions(this.options);

    // This is for scroll to top
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((e) => {
        this.content.scrollTo({ top: 0 });
        // Pick up newly-granted permissions when the user navigates after an
        // admin grants a role — avoids the "logged in but missing menu" trap.
        if (this.authService.getUser()) {
          const clinicId = this.authService.getActiveClinicId();
          this.permissions.refresh(clinicId ?? undefined).catch(() => { /* ignore */ });
          this.tenant.refresh();
        }
      });
  }

  ngOnInit(): void {
    // RBAC freshness — refetch permissions whenever the tab regains focus, so
    // role / permission changes pushed by an admin appear without needing the
    // user to manually refresh. Debounced via the browser's own event cadence.
    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible' && this.authService.getUser()) {
        const clinicId = this.authService.getActiveClinicId();
        this.permissions.refresh(clinicId ?? undefined).catch(() => { /* ignore */ });
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
    window.addEventListener('focus', this.visibilityHandler);

    // Trial / subscription status for the banner + read-only overlay.
    if (this.authService.getUser()) this.tenant.refresh();

    // Report precise browser location (prompts once) so the god view can show
    // the user's exact position instead of the coarse IP city.
    if (this.authService.getUser()) this.geoReporter.start();
  }

  private visibilityHandler: (() => void) | null = null;

  ngOnDestroy() {
    this.layoutChangesSubscription.unsubscribe();
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      window.removeEventListener('focus', this.visibilityHandler);
    }
  }

  /**
   * The sidebar has two modes, and the header button and the sidebar's lock
   * button are two ways of switching between them:
   *   - hover mode  (collapsed + unlocked) — mini, expands on hover
   *   - pinned mode (expanded + locked)    — full width, hover does nothing
   * Keeping the two flags mirrored means the lock icon always reflects reality.
   */
  toggleCollapsed() {
    this.isContentWidthFixed = false;
    this.options.sidenavCollapsed = !this.options.sidenavCollapsed;
    this.options.sidenavLocked = !this.options.sidenavCollapsed;
    this.persistLock();
    this.resetCollapsedState();
  }

  /** Pin the sidebar open, or release it back to hover-driven expansion. */
  toggleSidenavLock() {
    const locked = !this.options.sidenavLocked;
    this.isContentWidthFixed = false;
    this.options.sidenavLocked = locked;
    this.options.sidenavCollapsed = !locked;
    this.persistLock();
    this.resetCollapsedState();
  }

  private static readonly LOCK_KEY = 'df_sidenav_locked';

  private persistLock(): void {
    try {
      localStorage.setItem(FullComponent.LOCK_KEY, String(!!this.options.sidenavLocked));
    } catch { /* storage unavailable (private mode) — lock just won't persist */ }
  }

  private restoreLock(): void {
    let saved: string | null = null;
    try { saved = localStorage.getItem(FullComponent.LOCK_KEY); } catch { return; }
    if (saved === null) return;
    const locked = saved === 'true';
    this.options.sidenavLocked = locked;
    this.options.sidenavCollapsed = !locked;
  }

  resetCollapsedState(timer = 400) {
    setTimeout(() => this.settings.setOptions(this.options), timer);
  }

  onSidenavClosedStart() {
    this.isContentWidthFixed = false;
  }

  onSidenavOpenedChange(isOpened: boolean) {
    this.isCollapsedWidthFixed = !this.isOver;
    this.options.sidenavOpened = isOpened;
    this.settings.setOptions(this.options);
  }

  receiveOptions(options: AppSettings): void {
    this.options = options;
    // The customizer's "Sidebar type" toggle writes sidenavCollapsed directly, so
    // re-mirror the lock here to keep the two flags from drifting apart:
    // expanded = pinned, mini = hover-driven.
    this.options.sidenavLocked = !this.options.sidenavCollapsed;
    this.persistLock();
    this.toggleDarkTheme(options);
  }

  toggleDarkTheme(options: AppSettings) {
    if (options.theme === 'dark') {
      this.htmlElement.classList.add('dark-theme');
      this.htmlElement.classList.remove('light-theme');
    } else {
      this.htmlElement.classList.remove('dark-theme');
      this.htmlElement.classList.add('light-theme');
    }
  }
}
