import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { FeatureFlagsService } from '../services/feature-flags.service';
import { ToastService } from '../services/toast.service';

/**
 * Blocks a route unless an org feature flag is ON. Flags are loaded at app boot
 * (fire-and-forget), so if they aren't in yet we trigger a load and wait on it —
 * avoiding both a boot race and a hang if the boot load errored. Denial cancels
 * the navigation in place (or falls back to /schedule on a cold deep-link).
 */
export const featureFlagGuard = (flagKey: string): CanActivateFn => () => {
  const ff     = inject(FeatureFlagsService);
  const router  = inject(Router);
  const toast   = inject(ToastService);

  const deny = (): UrlTree => {
    toast.error('This feature isn’t enabled for your clinic. Ask your admin to turn it on.');
    return router.url && router.url !== '/'
      ? router.parseUrl(router.url)
      : router.parseUrl('/schedule');
  };
  const decide = () => (ff.isOn(flagKey) ? true : deny());

  if (ff.loaded()) return decide();
  return ff.load().pipe(map(decide), catchError(() => of(deny())));
};
