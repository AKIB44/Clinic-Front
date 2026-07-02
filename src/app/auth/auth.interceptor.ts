import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
  HttpErrorResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { BehaviorSubject, throwError, EMPTY } from 'rxjs';
import { catchError, filter, switchMap, take, finalize } from 'rxjs/operators';
import { AuthStorageService } from './auth-storage.service';
import { AuthService } from './auth.service';
import { Router } from '@angular/router';
import { ToastService } from '../services/toast.service';

let isRefreshing = false;
const refreshDone$ = new BehaviorSubject<string | null>(null);

function addAuthHeaders(req: HttpRequest<unknown>, token: string, clinicId: string | null) {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (clinicId) headers['X-Clinic-Id'] = clinicId;
  return req.clone({ setHeaders: headers });
}

function isPublicAuthRequest(req: HttpRequest<unknown>): boolean {
  const u = req.url;
  return (
    u.includes('/auth/login') ||
    u.includes('/auth/refresh') ||
    u.includes('/auth/logout') ||
    u.includes('/auth/otp/') ||
    u.includes('/auth/mfa/challenge')
  );
}

function showForbiddenToast(toast: ToastService, err: HttpErrorResponse) {
  const msg = err.error?.message
    || "You don't have permission for that action. Ask your admin if you need access.";
  toast.error(msg);
}

// Detect a genuine backend OUTAGE that warrants the full-screen "server
// unavailable" page. Returns the reason, or null if it's something the component
// should handle itself. A plain 500 is an application error from ONE endpoint —
// it must NOT hijack the whole screen (and, with the retry-to-returnUrl page,
// would loop): the component surfaces it inline instead.
function serverOutageReason(err: HttpErrorResponse): 'offline' | 'maintenance' | 'server' | null {
  const s = err.status;
  // status 0 = network unreachable (browser ProgressEvent/Error). Plain aborted
  // requests on navigation also surface as 0 but without that body — skip those.
  if (s === 0 && (err.error instanceof ProgressEvent || err.error instanceof Error)) return 'offline';
  if (s === 503) return 'maintenance'; // whole backend in maintenance
  if (s === 502 || s === 504) return 'server'; // gateway down = real infra outage
  return null;
}

// Retry the request with a known-good token. If the retry itself fails with
// 401/403, surface it as a toast instead of stranding the user on a forbidden
// page they can't get out of.
function retryWithToken(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  token: string,
  clinicId: string | null,
  router: Router,
  toast: ToastService,
) {
  return next(addAuthHeaders(req, token, clinicId)).pipe(
    catchError((retryErr: HttpErrorResponse) => {
      if (retryErr.status === 403) {
        showForbiddenToast(toast, retryErr);
        return throwError(() => retryErr);
      }
      if (retryErr.status === 401) {
        // Session genuinely dead on retry — bounce to login.
        router.navigate(['/authentication/login']);
        return EMPTY;
      }
      return throwError(() => retryErr);
    })
  );
}

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const storage     = inject(AuthStorageService);
  const authService = inject(AuthService);
  const router      = inject(Router);
  const toast       = inject(ToastService);

  const token    = storage.getAccessToken();
  const clinicId = authService.getActiveClinicId();
  const authedReq = token ? addAuthHeaders(req, token, clinicId) : req;

  // Capture the token sent so we can detect post-refresh races in catchError.
  const sentToken = token;

  return next(authedReq).pipe(
    catchError((err: HttpErrorResponse) => {
      // Backend outage / maintenance / 500 → full-screen "server unavailable"
      // page (with a return URL so the user lands back where they were once the
      // backend recovers). Skip the health probe and avoid redirect loops.
      const outage = serverOutageReason(err);
      if (
        outage &&
        !req.url.includes('/health') &&
        !router.url.startsWith('/authentication/server-error')
      ) {
        router.navigate(['/authentication/server-error'], {
          queryParams: { reason: outage, returnUrl: router.url },
        });
        return throwError(() => err);
      }

      // Pass non-401 errors through (components handle 4xx/5xx themselves).
      // Exception: 403 → friendly toast; clinic_inactive is a session problem
      // and goes to login. All other 403s we toast AND re-throw so the
      // component's own error handler can flip its loading flag and render
      // a "no access" state instead of being stuck on a spinner.
      if (err.status === 403) {
        if (err.error?.error === 'clinic_inactive') {
          storage.clearSession();
          router.navigate(['/authentication/login'], { queryParams: { reason: 'clinic_inactive' } });
          return EMPTY;
        }
        showForbiddenToast(toast, err);
        return throwError(() => err);
      }
      if (err.status !== 401) return throwError(() => err);
      if (isPublicAuthRequest(req)) return throwError(() => err);

      // Session expired (12h hard limit) — skip refresh, force re-login
      if (err.error?.error === 'session_expired') {
        storage.clearSession();
        router.navigate(['/authentication/login'], { queryParams: { reason: 'session_expired' } });
        return EMPTY;
      }

      // Step-up required for sensitive permission
      if (err.error?.error === 'step_up_required') {
        router.navigate(['/authentication/step-up'], {
          queryParams: { returnUrl: router.url },
        });
        return EMPTY;
      }

      // Biometric (Face ID / Touch ID) grant missing/expired — NOT a session
      // problem. Re-throw so the screen can re-open its biometric gate instead
      // of refreshing the token or logging the user out.
      if (
        err.error?.error === 'biometric_required' ||
        err.error?.error === 'biometric_expired' ||
        err.error?.error === 'biometric_invalid'
      ) {
        return throwError(() => err);
      }

      // token_stale: role_version was bumped (role/permission change).
      // A refresh issues a new token with the updated rv — fall through to
      // the normal refresh flow below instead of hard-logging out.

      // Another concurrent request already refreshed the token — just retry
      // with the current (already-refreshed) token; no second refresh needed.
      const currentToken = storage.getAccessToken();
      if (currentToken && currentToken !== sentToken) {
        return retryWithToken(req, next, currentToken, clinicId, router, toast);
      }

      const refreshToken = storage.getRefreshToken();
      if (!refreshToken) {
        storage.clearSession();
        router.navigate(['/authentication/login']);
        return EMPTY;
      }

      if (isRefreshing) {
        // Wait for the in-flight refresh to complete.
        // '' is the failure sentinel — unblock and redirect to login.
        return refreshDone$.pipe(
          filter((t): t is string => t !== null),
          take(1),
          switchMap((newToken) => {
            if (!newToken) {
              storage.clearSession();
              router.navigate(['/authentication/login']);
              return EMPTY;
            }
            return retryWithToken(req, next, newToken, clinicId, router, toast);
          })
        );
      }

      isRefreshing = true;
      refreshDone$.next(null);

      return authService.refresh(refreshToken).pipe(
        switchMap((res) => {
          refreshDone$.next(res.access_token);
          return retryWithToken(req, next, res.access_token, clinicId, router, toast);
        }),
        catchError((refreshErr: HttpErrorResponse) => {
          storage.clearSession();
          // Unblock any concurrent requests waiting on the subject.
          refreshDone$.next('');
          const reason = refreshErr.error?.error === 'clinic_inactive' ? 'clinic_inactive' : null;
          router.navigate(['/authentication/login'], reason ? { queryParams: { reason } } : {});
          return EMPTY;
        }),
        finalize(() => { isRefreshing = false; })
      );
    })
  );
};
