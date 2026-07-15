export interface AppSettings {
  dir: 'ltr' | 'rtl';
  theme: string;
  sidenavOpened: boolean;
  sidenavCollapsed: boolean;
  /**
   * Pins the sidebar open. While locked the sidebar ignores hover, so it stays
   * in the expanded view instead of shrinking when the pointer leaves.
   */
  sidenavLocked: boolean;
  boxed: boolean;
  horizontal: boolean;
  activeTheme: string;
  language: string;
  cardBorder: boolean;
  navPos: 'side' | 'top';
}

export const defaults: AppSettings = {
  dir: 'ltr',
  theme: 'light',
  sidenavOpened: false,
  // Start mini so the sidebar is hover-driven: expands on hover, shrinks on
  // leave. The lock button pins it open.
  sidenavCollapsed: true,
  sidenavLocked: false,
  boxed: true,
  horizontal: false,
  cardBorder: false,
  activeTheme: 'blue_theme',
  language: 'en-us',
  navPos: 'side',
};
