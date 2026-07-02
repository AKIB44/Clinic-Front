import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { switchMap } from 'rxjs';
import { authApiConfig } from '../../../auth/auth.config';
import { SessionStore } from '../store/session.store';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Session lifecycle endpoints — never auto-resume before these. */
const SKIP_AUTO_RESUME =
  /\/sessions\/[^/]+\/(pause|resume|abandon|reopen|end-treatment)(\/|$|\?)/;

function isSessionClinicalMutation(url: string, method: string): boolean {
  if (!MUTATING.has(method)) return false;
  if (!url.includes(authApiConfig.baseUrl)) return false;
  if (SKIP_AUTO_RESUME.test(url)) return false;
  if (url.includes('/sessions/')) return true;
  // TPA updates from the session canvas use a top-level /tpa route.
  if (url.includes('/tpa/')) return true;
  return false;
}

/**
 * When a paused session receives a clinical write, resume it first so the
 * backend accepts the mutation. Manual Resume uses the same store helper.
 */
export const sessionAutoResumeInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isSessionClinicalMutation(req.url, req.method)) {
    return next(req);
  }

  const store = inject(SessionStore);
  if (store.isSealed() || !store.isPaused()) {
    return next(req);
  }

  return store.ensureResumedForEdit().pipe(switchMap(() => next(req)));
};
