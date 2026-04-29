import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { RbacService } from './rbac.service';
import { AppRole } from './auth.models';

export const roleGuard = (roles: AppRole[]): CanActivateFn => () => {
  const rbac   = inject(RbacService);
  const router = inject(Router);
  if (rbac.hasAnyRole(roles)) return true;
  return router.createUrlTree(['/dashboards/dashboard1']);
};
