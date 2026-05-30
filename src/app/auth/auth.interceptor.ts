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

// Retry the request with a known-good token. If the retry itself fails with
// 401/403, treat it as a permissions problem (not a session problem) and
// navigate to the forbidden page instead of clearing the session.
function retryWithToken(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  token: string,
  clinicId: string | null,
  router: Router,
) {
  return next(addAuthHeaders(req, token, clinicId)).pipe(
    catchError((retryErr: HttpErrorResponse) => {
      if (retryErr.status === 401 || retryErr.status === 403) {
        router.navigate(['/authentication/forbidden']);
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

  const token    = storage.getAccessToken();
  const clinicId = authService.getActiveClinicId();
  const authedReq = token ? addAuthHeaders(req, token, clinicId) : req;

  // Capture the token sent so we can detect post-refresh races in catchError.
  const sentToken = token;

  return next(authedReq).pipe(
    catchError((err: HttpErrorResponse) => {
      // Pass non-401 errors through (components handle 4xx/5xx themselves).
      // Exception: 403 → forbidden page; unless clinic_inactive → login with reason.
      if (err.status === 403) {
        if (err.error?.error === 'clinic_inactive') {
          storage.clearSession();
          router.navigate(['/authentication/login'], { queryParams: { reason: 'clinic_inactive' } });
        } else {
          router.navigate(['/authentication/forbidden']);
        }
        return EMPTY;
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

      // token_stale: role_version was bumped (role/permission change).
      // A refresh issues a new token with the updated rv — fall through to
      // the normal refresh flow below instead of hard-logging out.

      // Another concurrent request already refreshed the token — just retry
      // with the current (already-refreshed) token; no second refresh needed.
      const currentToken = storage.getAccessToken();
      if (currentToken && currentToken !== sentToken) {
        return retryWithToken(req, next, currentToken, clinicId, router);
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
            return retryWithToken(req, next, newToken, clinicId, router);
          })
        );
      }

      isRefreshing = true;
      refreshDone$.next(null);

      return authService.refresh(refreshToken).pipe(
        switchMap((res) => {
          refreshDone$.next(res.access_token);
          return retryWithToken(req, next, res.access_token, clinicId, router);
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
