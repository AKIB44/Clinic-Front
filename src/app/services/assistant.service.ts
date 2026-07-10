import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { authApiConfig } from '../auth/auth.config';
import { AuthStorageService } from '../auth/auth-storage.service';

export type AssistantIntent =
  | 'patient.find'
  | 'viewer.open'
  | 'navigate'
  | 'appointment.book'
  | 'schedule.summary'
  | 'billing.patient'
  | 'app.exit'
  | 'account.sign_out'
  | 'behaviour'
  | 'agent.proactive'
  | 'schedule.time'
  | 'smalltalk.greeting'
  | 'smalltalk.thanks'
  | 'smalltalk.bye'
  | 'smalltalk.time'
  | 'smalltalk.weather'
  | 'smalltalk.sarcasm'
  | 'unknown';

export interface AssistantAction {
  type:               string;       // 'logout' for app.exit / account.sign_out
  redirect?:          string;
  revoke_session?:    boolean;
  clear_local_auth?:  boolean;
  reason?:            string;
  tone?:              string;
}

export interface AssistantResult {
  intent:     AssistantIntent;
  entities:   Record<string, string | number | null | undefined>;
  message:    string;
  fallback?:  boolean;
  transcript: string;
  action?:    AssistantAction | null;
  logout?:    { performed: boolean; revoked: string; count?: number };
}

@Injectable({ providedIn: 'root' })
export class AssistantService {
  private readonly http        = inject(HttpClient);
  private readonly authStorage = inject(AuthStorageService);
  private readonly base = `${authApiConfig.baseUrl}/assistant`;

  interpret(transcript: string): Observable<AssistantResult> {
    // Pass the refresh token so the backend can revoke just this session
    // instead of nuking every session for the user.
    const refresh_token = this.authStorage.getRefreshToken() || undefined;
    return this.http.post<AssistantResult>(`${this.base}/interpret`, {
      transcript,
      refresh_token,
    });
  }
}
