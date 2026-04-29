import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { authApiConfig } from './auth.config';
import { LoginRequest, LoginResponse, AuthUser } from './auth.models';
import { AuthStorageService } from './auth-storage.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly authStorage = inject(AuthStorageService);

  login(payload: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(
        `${authApiConfig.baseUrl}${authApiConfig.loginEndpoint}`,
        payload
      )
      .pipe(tap((response) => this.authStorage.storeSession(response)));
  }

  refresh(refreshToken: string): Observable<{ access_token: string }> {
    return this.http
      .post<{ access_token: string }>(`${authApiConfig.baseUrl}/auth/refresh`, {
        refresh_token: refreshToken,
      })
      .pipe(
        tap((res) => this.authStorage.updateAccessToken(res.access_token))
      );
  }

  logout(): Observable<void> {
    const refreshToken = this.authStorage.getRefreshToken();
    this.authStorage.clearSession();
    return this.http.post<void>(`${authApiConfig.baseUrl}/auth/logout`, {
      refresh_token: refreshToken,
    });
  }

  getUser(): AuthUser | null {
    return this.authStorage.getUser();
  }

  getRedirectPath(): string {
    const user = this.getUser();
    if (user?.role === 'receptionist') {
      return '/schedule';
    }
    return '/dashboards/dashboard1';
  }
}
