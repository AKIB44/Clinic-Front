import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take } from 'rxjs/operators';
import { PermissionService } from './permission.service';

function waitThenCheck(check: () => boolean, router: Router) {
  const ps = inject(PermissionService);
  if (ps.loaded()) {
    return check() || router.createUrlTree(['/authentication/forbidden']);
  }
  // Permissions still loading (page refresh) — wait for loaded signal
  return toObservable(ps.loaded).pipe(
    filter(Boolean),
    take(1),
    map(() => check() || router.createUrlTree(['/authentication/forbidden']))
  );
}

export const permissionGuard = (perm: string): CanActivateFn => () => {
  const ps     = inject(PermissionService);
  const router = inject(Router);
  return waitThenCheck(() => ps.has(perm), router);
};

export const anyPermissionGuard = (...perms: string[]): CanActivateFn => () => {
  const ps     = inject(PermissionService);
  const router = inject(Router);
  return waitThenCheck(() => ps.hasAny(...perms), router);
};
