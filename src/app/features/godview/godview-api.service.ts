import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { authApiConfig } from '../../auth/auth.config';

export interface GeoInfo {
  country: string; region: string; city: string;
  lat: number; lon: number; isp: string;
  precise?: boolean;      // true = exact browser GPS/WiFi; false = coarse IP city
  accuracy?: number | null; // metres (precise only)
}

export interface GodSession {
  userId: string;
  name: string;
  email: string | null;
  role: string | null;
  ip: string;
  device: string;
  geo: GeoInfo | null;
  firstSeen: number;
  lastSeen: number;
  hits: number;
  lastPath: string;
  online: boolean;
}

export interface GodActivity {
  id: number;
  at: number;
  userId: string;
  name: string;
  ip: string;
  method: string;
  path: string;
  action: string;
}

export interface GodLog {
  id: number;
  at: number;
  level: 'info' | 'warn' | 'error';
  msg: string;
}

export interface GodSnapshot {
  generatedAt: number;
  stats: { sessions: number; online: number; users: number; located: number };
  sessions: GodSession[];
  activity: GodActivity[];
  logs: GodLog[];
  logSource?: 'pm2' | 'console';
}

@Injectable({ providedIn: 'root' })
export class GodviewApiService {
  private http = inject(HttpClient);
  private base = `${authApiConfig.baseUrl}/godview`;

  /** 200 → authorised operator (also returns the Maps key); 404 → not allowed. */
  access(): Observable<{ ok: boolean; email: string; mapsKey: string }> {
    return this.http.get<{ ok: boolean; email: string; mapsKey: string }>(`${this.base}/access`);
  }

  live(): Observable<GodSnapshot> {
    return this.http.get<GodSnapshot>(`${this.base}/live`);
  }
}
