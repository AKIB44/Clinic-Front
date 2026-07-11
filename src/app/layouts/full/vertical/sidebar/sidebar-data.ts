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
  {
    displayName: 'Analytics',
    iconName: 'chart-histogram',
    bgcolor: 'primary',
    route: '/analytics',
    permissions: ['billing.view'],
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

  // Org-admin & subscription tools (HR, Roles, Decision Log, Staff Attributes,
  // Feature Flags, Release Notes, Billing, Subscriptions) now live in the header
  // Shortcuts menu — see header.component.ts.

  // ── Operations ─────────────────────────────────────────────────────────────
  { navCap: 'Operations' },
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

  // ── Specialty Modules (single collapsible parent → 5 specialties) ──────────
  { navCap: 'Specialty', permissions: ['specialty.view'] },
  {
    displayName: 'Specialty Modules',
    iconName: 'dental',
    bgcolor: 'primary',
    permissions: ['specialty.view'],
    children: [
      {
        displayName: 'Orthodontics',
        iconName: 'teeth',
        bgcolor: 'primary',
        children: [
          { displayName: 'All Cases', route: '/specialty/orthodontic/cases',     iconName: 'list',  bgcolor: 'primary' },
          { displayName: 'New Case',  route: '/specialty/orthodontic/cases/new', iconName: 'plus',  bgcolor: 'primary' },
        ],
      },
      {
        displayName: 'Implantology',
        iconName: 'screw',
        bgcolor: 'accent',
        children: [
          { displayName: 'All Cases',     route: '/specialty/implantology/cases',         iconName: 'list',   bgcolor: 'accent' },
          { displayName: 'New Case',      route: '/specialty/implantology/cases/new',     iconName: 'plus',   bgcolor: 'accent' },
          { displayName: 'Recall Search', route: '/specialty/implantology/recall-search', iconName: 'search', bgcolor: 'accent' },
        ],
      },
      {
        displayName: 'Paediatric',
        iconName: 'baby-carriage',
        bgcolor: 'success',
        children: [
          { displayName: 'All Cases', route: '/specialty/paediatric/cases',     iconName: 'list', bgcolor: 'success' },
          { displayName: 'New Case',  route: '/specialty/paediatric/cases/new', iconName: 'plus', bgcolor: 'success' },
        ],
      },
      {
        displayName: 'Endodontics',
        iconName: 'tooth',
        bgcolor: 'warning',
        children: [
          { displayName: 'All Cases', route: '/specialty/endodontic/cases',     iconName: 'list', bgcolor: 'warning' },
          { displayName: 'New Case',  route: '/specialty/endodontic/cases/new', iconName: 'plus', bgcolor: 'warning' },
        ],
      },
      {
        displayName: 'TMJ & Orofacial',
        iconName: 'brain',
        bgcolor: 'error',
        children: [
          { displayName: 'All Cases', route: '/specialty/tmj/cases',     iconName: 'list', bgcolor: 'error' },
          { displayName: 'New Case',  route: '/specialty/tmj/cases/new', iconName: 'plus', bgcolor: 'error' },
        ],
      },
    ],
  },

];
