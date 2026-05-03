import { NavItem } from './nav-item/nav-item';

export const navItems: NavItem[] = [

  // ── Clinic ─────────────────────────────────────────────────────────────────
  { navCap: 'Clinic' },
  {
    displayName: 'Dashboard',
    iconName: 'layout-dashboard',
    bgcolor: 'primary',
    route: '/dashboards/dashboard1',
  },
  {
    displayName: "Today's Schedule",
    iconName: 'calendar-event',
    bgcolor: 'success',
    route: '/schedule',
  },

  // ── Patients ───────────────────────────────────────────────────────────────
  { navCap: 'Patients' },
  {
    displayName: 'Patient Search',
    iconName: 'user-search',
    bgcolor: 'accent',
    route: '/apps/contacts',
  },

  // ── Operations ─────────────────────────────────────────────────────────────
  { navCap: 'Operations' },
  {
    displayName: 'Invoices',
    iconName: 'file-invoice',
    bgcolor: 'warning',
    route: '/apps/invoice',
  },

  // ── Master — admin only ────────────────────────────────────────────────────
  {
    navCap: 'Master',
    roles: ['admin'],
  },
  {
    displayName: 'Clinic Profile',
    iconName: 'building',
    bgcolor: 'primary',
    route: '/master/clinic-profile',
    roles: ['admin'],
  },
  {
    displayName: 'Services',
    iconName: 'tooth',
    bgcolor: 'success',
    route: '/master/services',
    roles: ['admin'],
  },
  {
    displayName: 'Staff & Users',
    iconName: 'users',
    bgcolor: 'warning',
    route: '/master/staff',
    roles: ['admin'],
  },
  {
    displayName: 'Chairs & Rooms',
    iconName: 'armchair',
    bgcolor: 'accent',
    route: '/master/chairs',
    roles: ['admin'],
  },

  // ── Booking ────────────────────────────────────────────────────────────────
  { navCap: 'Booking' },
  {
    displayName: 'Patient Booking Form',
    iconName: 'clipboard-plus',
    bgcolor: 'success',
    route: '/booking',
  },

];
