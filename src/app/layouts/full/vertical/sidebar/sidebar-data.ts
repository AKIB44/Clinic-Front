import { NavItem } from './nav-item/nav-item';

export const navItems: NavItem[] = [
  {
    navCap: 'Clinic',
  },
  {
    displayName: 'Dashboard',
    iconName: 'layout-dashboard',
    bgcolor: 'primary',
    route: '/dashboards/dashboard1',
  },
  {
    displayName: 'Today\'s Schedule',
    iconName: 'calendar-event',
    bgcolor: 'success',
    route: '/schedule',
  },
  {
    navCap: 'Patients',
  },
  {
    displayName: 'Patient Search',
    iconName: 'user-search',
    bgcolor: 'accent',
    route: '/apps/contacts',
  },
  {
    navCap: 'Operations',
  },
  {
    displayName: 'Invoices',
    iconName: 'file-invoice',
    bgcolor: 'warning',
    route: '/apps/invoice',
  },
  {
    displayName: 'Recalls',
    iconName: 'bell-ringing',
    bgcolor: 'error',
    route: '/apps/notes',
  },
  {
    navCap: 'Analytics',
  },
  {
    displayName: 'Analytics',
    iconName: 'chart-bar',
    bgcolor: 'primary',
    route: '/dashboards/dashboard2',
  },
  {
    navCap: 'Booking',
  },
  {
    displayName: 'Patient Booking Form',
    iconName: 'clipboard-plus',
    bgcolor: 'success',
    route: '/booking',
    external: false,
  },
];
