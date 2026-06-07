import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, switchMap, from, firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';
import { authApiConfig } from './auth.config';
import {
  LoginRequest, LoginResponse, AuthUser, StepUpResponse,
  OtpRequestResponse, OtpVerifyRequest,
  LoginOrMfaResponse, MfaStatusResponse, MfaSetupResponse,
  MfaEnableRequest, MfaDisableRequest,
} from './auth.models';
import { AuthStorageService } from './auth-storage.service';
import { PermissionService } from '../core/rbac/permission.service';
import { FeatureFlagsService } from '../services/feature-flags.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http        = inject(HttpClient);
  private readonly authStorage = inject(AuthStorageService);
  private readonly permissions = inject(PermissionService);
  private readonly featureFlags = inject(FeatureFlagsService);
  private readonly router      = inject(Router);

  private readonly _user = signal<AuthUser | null>(this.authStorage.getUser());
  readonly user = this._user.asReadonly();

  login(payload: LoginRequest): Observable<LoginOrMfaResponse> {
    return this.http
      .post<LoginOrMfaResponse>(`${authApiConfig.baseUrl}${authApiConfig.loginEndpoint}`, payload);
  }

  /** Called after a successful MFA TOTP challenge. */
  mfaChallenge(mfa_token: string, code: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${authApiConfig.baseUrl}/auth/mfa/challenge`, { mfa_token, code })
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

  /** Completes a non-MFA login session store. Called by login component after MFA is not required. */
  finaliseLogin(response: LoginResponse): Promise<LoginResponse> {
    this.authStorage.storeSession(response);
    this._user.set(response.user);
    return this.permissions
      .refresh(response.user.active_clinic_id ?? response.user.clinic_id)
      .then(() => response);
  }

  mfaStatus(): Observable<MfaStatusResponse> {
    return this.http.get<MfaStatusResponse>(`${authApiConfig.baseUrl}/auth/mfa/status`);
  }

  mfaSetup(): Observable<MfaSetupResponse> {
    return this.http.post<MfaSetupResponse>(`${authApiConfig.baseUrl}/auth/mfa/setup`, {});
  }

  mfaEnable(payload: MfaEnableRequest): Observable<MfaStatusResponse> {
    return this.http.post<MfaStatusResponse>(`${authApiConfig.baseUrl}/auth/mfa/enable`, payload);
  }

  mfaDisable(payload: MfaDisableRequest): Observable<MfaStatusResponse> {
    return this.http.post<MfaStatusResponse>(`${authApiConfig.baseUrl}/auth/mfa/disable`, payload);
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
    if (!this.authStorage.isAuthenticated()) return Promise.resolve();
    const clinicId = this.getActiveClinicId();
    // Org admins have no clinic_id — still load org-scoped permissions.
    return this.permissions.refresh(clinicId ?? undefined).then(() => {
      // Fire-and-forget — feature flags shouldn't block app boot if they fail.
      this.featureFlags.load().subscribe({ error: () => { /* ignored */ } });
    });
  }
}
