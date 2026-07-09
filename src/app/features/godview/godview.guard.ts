import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, catchError, of } from 'rxjs';
import { GodviewApiService } from './godview-api.service';

/**
 * Route guard for /godview. The allowlist lives server-side (GODVIEW_EMAILS),
 * so we ask the backend whether this user is permitted: `GET /godview/access`
 * returns 200 for allowlisted operators and 404 for everyone else. Anyone not
 * on the list is bounced back to the schedule — they never see the surface.
 */
export const godviewGuard: CanActivateFn = () => {
  const api    = inject(GodviewApiService);
  const router = inject(Router);
  return api.access().pipe(
    map(() => true),
    catchError(() => of(router.createUrlTree(['/schedule']))),
  );
};
