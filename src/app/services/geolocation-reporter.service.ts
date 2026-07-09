import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { authApiConfig } from '../auth/auth.config';

/**
 * Reports the signed-in user's precise browser location (GPS/WiFi via
 * navigator.geolocation) to the backend, which surfaces it in the god view.
 *
 * The browser prompts the user for permission once. If they deny, or the API is
 * unavailable, we silently stop — the god view then falls back to coarse
 * IP-based location. Position is refreshed periodically so it stays current.
 */
@Injectable({ providedIn: 'root' })
export class GeolocationReporterService {
  private http = inject(HttpClient);
  private base = `${authApiConfig.baseUrl}/presence`;

  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly REFRESH_MS = 5 * 60 * 1000;

  start(): void {
    if (this.timer !== null || !('geolocation' in navigator)) return;
    this.capture();                                   // once now
    this.timer = setInterval(() => this.capture(), this.REFRESH_MS);
  }

  stop(): void {
    if (this.timer !== null) { clearInterval(this.timer); this.timer = null; }
  }

  private capture(): void {
    navigator.geolocation.getCurrentPosition(
      (pos) => this.report(pos),
      () => { /* denied / unavailable — fall back to IP geo, stop retrying often */ },
      { enableHighAccuracy: true, maximumAge: 120000, timeout: 15000 },
    );
  }

  private report(pos: GeolocationPosition): void {
    const { latitude, longitude, accuracy } = pos.coords;
    this.http.post(`${this.base}/location`, { lat: latitude, lng: longitude, accuracy })
      .subscribe({ next: () => {}, error: () => {} });
  }
}
