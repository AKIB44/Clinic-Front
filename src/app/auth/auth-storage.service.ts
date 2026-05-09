import { Injectable } from '@angular/core';
import { LoginResponse, AuthUser } from './auth.models';

@Injectable({ providedIn: 'root' })
export class AuthStorageService {
  private readonly accessTokenKey  = 'dentaflow_access_token';
  private readonly refreshTokenKey = 'dentaflow_refresh_token';
  private readonly userKey         = 'dentaflow_user';

  getAccessToken(): string | null {
    return sessionStorage.getItem(this.accessTokenKey);
  }

  getRefreshToken(): string | null {
    return sessionStorage.getItem(this.refreshTokenKey);
  }

  getUser(): AuthUser | null {
    const raw = sessionStorage.getItem(this.userKey);
    return raw ? JSON.parse(raw) : null;
  }

  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }

  storeSession(session: LoginResponse): void {
    sessionStorage.setItem(this.accessTokenKey,  session.access_token);
    sessionStorage.setItem(this.refreshTokenKey, session.refresh_token);
    sessionStorage.setItem(this.userKey,         JSON.stringify(session.user));
  }

  updateAccessToken(token: string): void {
    sessionStorage.setItem(this.accessTokenKey, token);
  }

  updateTokens(accessToken: string, refreshToken: string): void {
    sessionStorage.setItem(this.accessTokenKey,  accessToken);
    sessionStorage.setItem(this.refreshTokenKey, refreshToken);
  }

  clearSession(): void {
    sessionStorage.removeItem(this.accessTokenKey);
    sessionStorage.removeItem(this.refreshTokenKey);
    sessionStorage.removeItem(this.userKey);
  }
}
