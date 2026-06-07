import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take } from 'rxjs/operators';
import { PermissionService } from './permission.service';
import { ToastService } from '../../services/toast.service';

/**
 * Show a non-blocking toast and keep the user on whatever page they were on.
 *
 * The previous behaviour redirected to `/authentication/forbidden`, which
 * stranded users with no obvious way back. Now we cancel the navigation in
 * place — if they were navigating from a working page, they stay there;
 * if they hit the URL directly (no prior route), we send them to /schedule
 * which is the safe landing for every role.
 */
function denyInPlace(router: Router, toast: ToastService, perm: string) {
  toast.error(
    `You don't have permission to access this. Ask your admin if you need access.`
  );
  // If there's a current valid URL (i.e. they were already somewhere), stay.
  if (router.url && router.url !== '/' && router.url !== '/authentication/forbidden') {
    return router.parseUrl(router.url);
  }
  // First-load deep link / no prior nav — fall back to a safe page.
  return router.parseUrl('/schedule');
}

function waitThenCheck(check: () => boolean, router: Router, toast: ToastService, perm: string) {
  const ps = inject(PermissionService);
  if (ps.loaded()) {
    return check() || denyInPlace(router, toast, perm);
  }
  return toObservable(ps.loaded).pipe(
    filter(Boolean),
    take(1),
    map(() => check() || denyInPlace(router, toast, perm))
  );
}

export const permissionGuard = (perm: string): CanActivateFn => () => {
  const ps     = inject(PermissionService);
  const router = inject(Router);
  const toast  = inject(ToastService);
  return waitThenCheck(() => ps.has(perm), router, toast, perm);
};

export const anyPermissionGuard = (...perms: string[]): CanActivateFn => () => {
  const ps     = inject(PermissionService);
  const router = inject(Router);
  const toast  = inject(ToastService);
  return waitThenCheck(() => ps.hasAny(...perms), router, toast, perms.join(' / '));
};
