import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
} from '@simplewebauthn/browser';
import { authApiConfig } from './auth.config';
import { BiometricSessionService } from './biometric-session.service';

export interface WebAuthnCredentialInfo {
  id: string;
  device_label: string | null;
  device_type: string | null;
  backed_up: boolean;
  created_at: string;
  last_used_at: string | null;
}

@Injectable({ providedIn: 'root' })
export class WebAuthnService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(BiometricSessionService);
  private readonly base = `${authApiConfig.baseUrl}/auth/webauthn`;

  /** True when the device exposes a built-in biometric authenticator. */
  async isPlatformAvailable(): Promise<boolean> {
    if (!browserSupportsWebAuthn()) return false;
    try { return await platformAuthenticatorIsAvailable(); } catch { return false; }
  }

  /** Device-appropriate name for the on-device biometric (Touch ID / Face ID …). */
  biometricLabel(): string {
    const ua = navigator.userAgent;
    if (/iPhone/.test(ua)) return 'Face ID';
    if (/iPad/.test(ua)) return 'Touch ID';
    if (/Macintosh|Mac OS X/.test(ua)) return 'Touch ID';
    if (/Windows/.test(ua)) return 'Windows Hello';
    if (/Android/.test(ua)) return 'fingerprint unlock';
    return 'device biometrics';
  }

  async listCredentials(): Promise<WebAuthnCredentialInfo[]> {
    const res = await firstValueFrom(
      this.http.get<{ credentials: WebAuthnCredentialInfo[] }>(`${this.base}/credentials`),
    );
    return res.credentials ?? [];
  }

  async deleteCredential(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.base}/credentials/${id}`));
  }

  /** Enroll this device's biometric (Face ID / Touch ID) as a credential. */
  async register(deviceLabel?: string): Promise<void> {
    const options = await firstValueFrom(
      this.http.post<any>(`${this.base}/register/options`, {}),
    );
    const attResp = await startRegistration({ optionsJSON: options });
    await firstValueFrom(
      this.http.post(`${this.base}/register/verify`, {
        response: attResp,
        device_label: deviceLabel ?? this.defaultDeviceLabel(),
      }),
    );
  }

  /**
   * Run the biometric step-up. On success stores the grant token in the
   * in-memory session and returns it.
   */
  async authenticate(): Promise<string> {
    const options = await firstValueFrom(
      this.http.post<any>(`${this.base}/auth/options`, {}),
    );
    const authResp = await startAuthentication({ optionsJSON: options });
    const res = await firstValueFrom(
      this.http.post<{ biometric_token: string }>(`${this.base}/auth/verify`, {
        response: authResp,
      }),
    );
    this.session.setToken(res.biometric_token);
    return res.biometric_token;
  }

  private defaultDeviceLabel(): string {
    const ua = navigator.userAgent;
    if (/iPhone|iPad/.test(ua)) return 'iOS device (Face ID / Touch ID)';
    if (/Macintosh/.test(ua))   return 'Mac (Touch ID)';
    if (/Android/.test(ua))     return 'Android device';
    if (/Windows/.test(ua))     return 'Windows Hello';
    return 'This device';
  }
}
