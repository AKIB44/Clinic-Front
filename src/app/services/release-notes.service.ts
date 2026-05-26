import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { authApiConfig } from '../auth/auth.config';

export interface ReleaseNote {
  id: string;
  version: string;
  title: string;
  body: string;
  is_published?: boolean;
  published_at?: string;
  created_at?: string;
}

@Injectable({ providedIn: 'root' })
export class ReleaseNotesService {
  private http = inject(HttpClient);
  private base = `${authApiConfig.baseUrl}/release-notes`;

  getPending(): Observable<{ note: ReleaseNote | null }> {
    return this.http.get<{ note: ReleaseNote | null }>(`${this.base}/pending`);
  }

  ack(id: string): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.base}/${id}/ack`, {});
  }

  list(): Observable<{ notes: ReleaseNote[] }> {
    return this.http.get<{ notes: ReleaseNote[] }>(this.base);
  }

  create(payload: { version: string; title: string; body: string; publish?: boolean }): Observable<{ note: ReleaseNote }> {
    return this.http.post<{ note: ReleaseNote }>(this.base, payload);
  }

  update(id: string, payload: { title?: string; body?: string; publish?: boolean }): Observable<{ note: ReleaseNote }> {
    return this.http.patch<{ note: ReleaseNote }>(`${this.base}/${id}`, payload);
  }

  delete(id: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.base}/${id}`);
  }
}
