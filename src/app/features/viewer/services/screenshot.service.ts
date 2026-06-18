import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PatientFilesApiService } from '../../patient-files/services/patient-files-api.service';

/**
 * GV-3 — capture the viewport PNG and either upload it as a patient-file
 * attachment (when opened from a patient model) or hand back a Blob the page
 * downloads locally (standalone /viewer). PRD §6.5.
 */
@Injectable()
export class ScreenshotService {
  private filesApi = inject(PatientFilesApiService);

  dataUrlToFile(dataUrl: string, filename: string): File {
    const [head, b64] = dataUrl.split(',');
    const mime = /:(.*?);/.exec(head)?.[1] || 'image/png';
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new File([bytes], filename, { type: mime });
  }

  /** Upload the screenshot as a patient-file (one-shot multipart → S3). */
  uploadToPatient(patientId: string, file: File): Observable<unknown> {
    return this.filesApi.upload(patientId, file);
  }

  /** Trigger a local browser download of a data URL. */
  download(dataUrl: string, filename: string): void {
    const a = document.createElement('a');
    a.href = dataUrl; a.download = filename; a.click();
  }
}
