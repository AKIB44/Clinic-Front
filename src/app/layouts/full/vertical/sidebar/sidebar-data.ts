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
    permissions: ['appointment.view'],
  },

  // ── Patients ───────────────────────────────────────────────────────────────
  { navCap: 'Patients', permissions: ['patient.view'] },
  {
    displayName: 'Patient Search',
    iconName: 'user-search',
    bgcolor: 'accent',
    route: '/apps/contacts',
    permissions: ['patient.view'],
  },

  // ── Operations ─────────────────────────────────────────────────────────────
  { navCap: 'Operations' },
  {
    displayName: 'Prescriptions',
    iconName: 'pill',
    bgcolor: 'success',
    route: '/rx/new',
    permissions: ['prescription.create'],
  },
  {
    displayName: 'Invoices',
    iconName: 'file-invoice',
    bgcolor: 'warning',
    route: '/apps/invoice',
  },

  // ── Master — permission-gated (roles kept as fallback during migration) ─────
  {
    navCap: 'Master',
    roles: ['admin'],
    permissions: ['clinic.settings', 'staff.manage'],
  },
  {
    displayName: 'Clinic Profile',
    iconName: 'building',
    bgcolor: 'primary',
    route: '/master/clinic-profile',
    roles: ['admin'],
    permissions: ['clinic.settings'],
  },
  {
    displayName: 'Services',
    iconName: 'tooth',
    bgcolor: 'success',
    route: '/master/services',
    roles: ['admin'],
    permissions: ['clinic.settings'],
  },
  {
    displayName: 'User Management',
    iconName: 'users',
    bgcolor: 'warning',
    route: '/master/staff',
    roles: ['admin'],
    permissions: ['staff.manage'],
  },
  {
    displayName: 'RBAC Management',
    iconName: 'shield-lock',
    bgcolor: 'error',
    route: '/master/rbac',
    roles: ['admin'],
    permissions: ['staff.manage'],
  },
  {
    displayName: 'Chairs & Rooms',
    iconName: 'armchair',
    bgcolor: 'accent',
    route: '/master/chairs',
    roles: ['admin'],
    permissions: ['clinic.settings'],
  },
  {
    displayName: 'Rx Master Data',
    iconName: 'pill',
    bgcolor: 'success',
    route: '/master/rx-master',
    roles: ['admin'],
    permissions: ['clinic.settings'],
  },
  {
    displayName: 'Activity Log',
    iconName: 'history',
    bgcolor: 'accent',
    route: '/master/activity-log',
    roles: ['admin'],
    permissions: ['audit.view'],
  },

  // ── Booking ────────────────────────────────────────────────────────────────
  { navCap: 'Booking' },
  {
    displayName: 'New Appointment',
    iconName: 'calendar-plus',
    bgcolor: 'success',
    route: '/booking',
    permissions: ['appointment.create'],
  },

];
