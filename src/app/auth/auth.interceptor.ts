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

function addBearer(req: HttpRequest<unknown>, token: string) {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const storage = inject(AuthStorageService);
  const authService = inject(AuthService);
  const router = inject(Router);

  const token = storage.getAccessToken();
  const authedReq = token ? addBearer(req, token) : req;

  return next(authedReq).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status !== 401) {
        return throwError(() => err);
      }

      const refreshToken = storage.getRefreshToken();
      if (!refreshToken) {
        storage.clearSession();
        router.navigate(['/authentication/login']);
        return EMPTY;
      }

      if (isRefreshing) {
        return refreshDone$.pipe(
          filter((t): t is string => t !== null),
          take(1),
          switchMap((newToken) => next(addBearer(req, newToken)))
        );
      }

      isRefreshing = true;
      refreshDone$.next(null);

      return authService.refresh(refreshToken).pipe(
        switchMap((res) => {
          refreshDone$.next(res.access_token);
          return next(addBearer(req, res.access_token));
        }),
        catchError((refreshErr) => {
          storage.clearSession();
          router.navigate(['/authentication/login']);
          return throwError(() => refreshErr);
        }),
        finalize(() => {
          isRefreshing = false;
        })
      );
    })
  );
};
