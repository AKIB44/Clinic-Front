import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, switchMap, from, firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';
import { authApiConfig } from './auth.config';
import { LoginRequest, LoginResponse, AuthUser, StepUpResponse, OtpRequestResponse, OtpVerifyRequest } from './auth.models';
import { AuthStorageService } from './auth-storage.service';
import { PermissionService } from '../core/rbac/permission.service';
import { BreakGlassService } from '../core/rbac/break-glass.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http        = inject(HttpClient);
  private readonly authStorage = inject(AuthStorageService);
  private readonly permissions = inject(PermissionService);
  private readonly breakGlass  = inject(BreakGlassService);
  private readonly router      = inject(Router);

  private readonly _user = signal<AuthUser | null>(this.authStorage.getUser());
  readonly user = this._user.asReadonly();

  login(payload: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${authApiConfig.baseUrl}${authApiConfig.loginEndpoint}`, payload)
      .pipe(
        switchMap((response) => {
          this.authStorage.storeSession(response);
          this._user.set(response.user);
          // Await permissions before emitting so guards and directives
          // see a loaded permission set on the first render after navigation.
          return from(
            this.permissions
              .refresh(response.user.active_clinic_id ?? response.user.clinic_id)
              .then(() => response)
          );
        })
      );
  }

  refresh(refreshToken: string): Observable<{ access_token: string; refresh_token?: string }> {
    return this.http
      .post<{ access_token: string; refresh_token?: string }>(
        `${authApiConfig.baseUrl}/auth/refresh`,
        { refresh_token: refreshToken }
      )
      .pipe(
        tap((res) => {
          this.authStorage.updateAccessToken(res.access_token);
          if (res.refresh_token) {
            this.authStorage.updateTokens(res.access_token, res.refresh_token);
          }
        })
      );
  }

  logout(): Observable<void> {
    const refreshToken = this.authStorage.getRefreshToken();
    this.authStorage.clearSession();
    this.permissions.clear();
    this.breakGlass.clear();
    this._user.set(null);
    return this.http.post<void>(`${authApiConfig.baseUrl}/auth/logout`, {
      refresh_token: refreshToken,
    });
  }

  requestOtp(phone: string): Observable<OtpRequestResponse> {
    return this.http.post<OtpRequestResponse>(
      `${authApiConfig.baseUrl}/auth/otp/request`,
      { phone }
    );
  }

  verifyOtp(payload: OtpVerifyRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${authApiConfig.baseUrl}/auth/otp/verify`, payload)
      .pipe(
        switchMap((response) => {
          this.authStorage.storeSession(response);
          this._user.set(response.user);
          return from(
            this.permissions
              .refresh(response.user.active_clinic_id ?? response.user.clinic_id)
              .then(() => response)
          );
        })
      );
  }

  async stepUp(password: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<StepUpResponse>(`${authApiConfig.baseUrl}/auth/step-up`, { password })
    );
    this.authStorage.updateAccessToken(res.access_token);
  }

  getUser(): AuthUser | null {
    return this.authStorage.getUser();
  }

  getActiveClinicId(): string | null {
    const user = this.getUser();
    return user?.active_clinic_id ?? user?.clinic_id ?? null;
  }

  getRedirectPath(): string {
    return '/schedule';
  }

  /** Called by APP_INITIALIZER — loads permissions on every app boot (page refresh). */
  initPermissions(): Promise<void> {
    const clinicId = this.getActiveClinicId();
    if (!this.authStorage.isAuthenticated() || !clinicId) return Promise.resolve();
    return this.permissions.refresh(clinicId);
  }
}
