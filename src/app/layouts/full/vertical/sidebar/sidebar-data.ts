import { NavItem } from './nav-item/nav-item';

export const navItems: NavItem[] = [

  // ── Booking ────────────────────────────────────────────────────────────────
  { navCap: 'Booking' },
  {
    displayName: 'New Appointment',
    iconName: 'calendar-plus',
    bgcolor: 'success',
    route: '/booking',
    permissions: ['appointment.create'],
  },

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
  {
    displayName: 'Feature Flags',
    iconName: 'toggle-right',
    bgcolor: 'warning',
    route: '/org-master/feature-flags',
    permissions: ['feature_flag.manage'],
  },
  {
    displayName: 'Staff Attributes',
    iconName: 'shield-check',
    bgcolor: 'primary',
    route: '/org-master/staff-attrs',
    permissions: ['staff.manage'],
  },
  {
    displayName: 'Decision Log',
    iconName: 'file-search',
    bgcolor: 'accent',
    route: '/org-master/decision-log',
    permissions: ['audit.view'],
  },
  // {
  //   displayName: 'Security (MFA)',
  //   iconName: 'shield-lock',
  //   bgcolor: 'accent',
  //   route: '/authentication/mfa-setup',
  //   permissions: ['org.manage'],
  // },

  // ── Specialty Modules ──────────────────────────────────────────────────────
  { navCap: 'Specialty Modules', permissions: ['specialty.view'] },
  {
    displayName: 'Orthodontics',
    iconName: 'teeth',
    bgcolor: 'primary',
    permissions: ['specialty.view'],
    children: [
      { displayName: 'All Cases', route: '/specialty/orthodontic/cases',     iconName: 'list',  bgcolor: 'primary' },
      { displayName: 'New Case',  route: '/specialty/orthodontic/cases/new', iconName: 'plus',  bgcolor: 'primary' },
    ],
  },
  {
    displayName: 'Implantology',
    iconName: 'screw',
    bgcolor: 'accent',
    permissions: ['specialty.view'],
    children: [
      { displayName: 'All Cases',     route: '/specialty/implantology/cases',            iconName: 'list',   bgcolor: 'accent' },
      { displayName: 'New Case',      route: '/specialty/implantology/cases/new',        iconName: 'plus',   bgcolor: 'accent' },
      { displayName: 'Recall Search', route: '/specialty/implantology/recall-search',    iconName: 'search', bgcolor: 'accent' },
    ],
  },
  {
    displayName: 'Paediatric',
    iconName: 'baby-carriage',
    bgcolor: 'success',
    permissions: ['specialty.view'],
    children: [
      { displayName: 'All Cases', route: '/specialty/paediatric/cases',     iconName: 'list', bgcolor: 'success' },
      { displayName: 'New Case',  route: '/specialty/paediatric/cases/new', iconName: 'plus', bgcolor: 'success' },
    ],
  },
  {
    displayName: 'Endodontics',
    iconName: 'tooth',
    bgcolor: 'warning',
    permissions: ['specialty.view'],
    children: [
      { displayName: 'All Cases', route: '/specialty/endodontic/cases',     iconName: 'list', bgcolor: 'warning' },
      { displayName: 'New Case',  route: '/specialty/endodontic/cases/new', iconName: 'plus', bgcolor: 'warning' },
    ],
  },
  {
    displayName: 'TMJ & Orofacial',
    iconName: 'brain',
    bgcolor: 'error',
    permissions: ['specialty.view'],
    children: [
      { displayName: 'All Cases', route: '/specialty/tmj/cases',     iconName: 'list', bgcolor: 'error' },
      { displayName: 'New Case',  route: '/specialty/tmj/cases/new', iconName: 'plus', bgcolor: 'error' },
    ],
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
    displayName: 'Inventory',
    iconName: 'package',
    bgcolor: 'warning',
    route: '/master/inventory',
    roles: ['admin'],
    permissions: ['inventory.adjust'],
  },
  {
    displayName: 'Activity Log',
    iconName: 'history',
    bgcolor: 'accent',
    route: '/master/activity-log',
    roles: ['admin'],
    permissions: ['audit.view'],
  },

];
