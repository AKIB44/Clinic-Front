import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { authApiConfig } from '../../../auth/auth.config';
import { PatientFile } from '../models/patient-file.model';

export interface UploadEvent { progress: number; data?: PatientFile; }
export interface RawEvent { progress: number; buffer?: ArrayBuffer; }

@Injectable({ providedIn: 'root' })
export class PatientFilesApiService {
  private http = inject(HttpClient);
  private base = authApiConfig.baseUrl; // /v1

  private files(patientId: string): string {
    return `${this.base}/patients/${patientId}/files`;
  }

  list(patientId: string): Observable<{ data: PatientFile[] }> {
    return this.http.get<{ data: PatientFile[] }>(this.files(patientId));
  }

  sign(patientId: string, filename: string, contentType: string): Observable<{ upload_url: string; s3_key: string }> {
    return this.http.post<{ upload_url: string; s3_key: string }>(
      `${this.files(patientId)}/sign`, { filename, content_type: contentType });
  }

  /** Direct PUT to S3 (presigned URL). The presign signs SSE, so the PUT must
   *  echo the x-amz-server-side-encryption header or S3 returns 403. */
  uploadToS3(uploadUrl: string, file: File): Observable<unknown> {
    return this.http.put(uploadUrl, file, {
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'x-amz-server-side-encryption': 'AES256',
      },
      responseType: 'text',
    });
  }

  register(patientId: string, payload: {
    s3_key: string; filename: string; content_type: string; file_size?: number; notes?: string;
  }): Observable<{ data: PatientFile }> {
    return this.http.post<{ data: PatientFile }>(this.files(patientId), payload);
  }

  /** One-shot upload through the backend (same-origin → no S3 CORS), with progress. */
  upload(patientId: string, file: File): Observable<UploadEvent> {
    const fd = new FormData();
    fd.append('file', file, file.name);
    return this.http.post<{ data: PatientFile }>(`${this.files(patientId)}/upload`, fd, {
      reportProgress: true, observe: 'events',
    }).pipe(
      map((ev): UploadEvent => {
        if (ev.type === HttpEventType.UploadProgress) {
          return { progress: ev.total ? Math.round((ev.loaded / ev.total) * 100) : 0 };
        }
        if (ev.type === HttpEventType.Response) return { progress: 100, data: ev.body!.data };
        return { progress: -1 };
      }),
      filter((e) => e.progress >= 0 || !!e.data),
    );
  }

  remove(patientId: string, fileId: string): Observable<void> {
    return this.http.delete<void>(`${this.files(patientId)}/${fileId}`);
  }

  /** Same-origin auth'd raw bytes — used by the 3D/DICOM viewers (no S3 CORS). */
  raw(patientId: string, fileId: string): Observable<ArrayBuffer> {
    return this.http.get(`${this.files(patientId)}/${fileId}/raw`, { responseType: 'arraybuffer' });
  }

  /** Raw bytes with download progress (for the viewers' loading bar). */
  rawProgress(patientId: string, fileId: string): Observable<RawEvent> {
    return this.http.get(`${this.files(patientId)}/${fileId}/raw`, {
      responseType: 'arraybuffer', reportProgress: true, observe: 'events',
    }).pipe(
      map((ev): RawEvent => {
        if (ev.type === HttpEventType.DownloadProgress) {
          return { progress: ev.total ? Math.round((ev.loaded / ev.total) * 100) : 0 };
        }
        if (ev.type === HttpEventType.Response) return { progress: 100, buffer: ev.body as ArrayBuffer };
        return { progress: -1 };
      }),
      filter((e) => e.progress >= 0 || !!e.buffer),
    );
  }
}
