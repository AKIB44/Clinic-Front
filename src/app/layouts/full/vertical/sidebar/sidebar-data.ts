import { NavItem } from './nav-item/nav-item';

export const navItems: NavItem[] = [

  // ── Clinic ─────────────────────────────────────────────────────────────────
  { navCap: 'Clinic' },
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
    route: '/patients',
    permissions: ['patient.view'],
  },

  // ── Org Master ─────────────────────────────────────────────────────────────
  { navCap: 'Org Master', permissions: ['org.manage'] },
  {
    displayName: 'Human Resources',
    iconName: 'users',
    bgcolor: 'success',
    route: '/org-master/hr',
    permissions: ['org.manage'],
  },
  {
    displayName: 'Role Management',
    iconName: 'shield-check',
    bgcolor: 'warning',
    route: '/org-master/roles',
    permissions: ['org.manage'],
  },
  {
    displayName: 'Accounts',
    iconName: 'report-money',
    bgcolor: 'primary',
    route: '/org-master/accounts',
    permissions: ['org.manage'],
  },
  {
    displayName: 'Release Notes',
    iconName: 'sparkles',
    bgcolor: 'accent',
    route: '/org-master/release-notes',
    permissions: ['org.manage'],
  },
  // {
  //   displayName: 'Security (MFA)',
  //   iconName: 'shield-lock',
  //   bgcolor: 'accent',
  //   route: '/authentication/mfa-setup',
  //   permissions: ['org.manage'],
  // },

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
    displayName: 'My Services',
    iconName: 'stethoscope',
    bgcolor: 'primary',
    route: '/my-services',
    permissions: ['service.manage_own'],
  },
  // ── Master — permission-gated (roles kept as fallback during migration) ─────
  {
    navCap: 'Master',
    roles: ['admin'],
    permissions: ['clinic.settings', 'staff.manage'],
  },
  {
    displayName: 'Clinics',
    iconName: 'building-hospital',
    bgcolor: 'primary',
    route: '/master/clinics',
    roles: ['admin'],
    permissions: ['org.manage'],
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
    iconName: 'tool',
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
