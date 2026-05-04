import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, interval, switchMap, takeWhile, lastValueFrom } from 'rxjs';
import { authApiConfig } from '../auth/auth.config';
import { CreateRxPayload, RxSummary } from '../pages/rx/rx.interfaces';

interface CreateResult { id: number; prescriptionNo: string; }
interface PdfUrlResult { url: string | null; }

@Injectable({ providedIn: 'root' })
export class PrescriptionService {
  private http = inject(HttpClient);
  private base = `${authApiConfig.baseUrl}/rx`;

  create(payload: CreateRxPayload) {
    return firstValueFrom(
      this.http.post<CreateResult>(`${this.base}/prescriptions`, payload)
    );
  }

  update(id: number, payload: Partial<CreateRxPayload>) {
    return firstValueFrom(
      this.http.put<{ success: boolean }>(`${this.base}/prescriptions/${id}`, payload)
    );
  }

  get(id: number) {
    return firstValueFrom(
      this.http.get<{ data: any }>(`${this.base}/prescriptions/${id}`)
    );
  }

  listForPatient(patientId: number | string, page = 1, limit = 10) {
    return firstValueFrom(
      this.http.get<{ data: RxSummary[]; total: number }>(
        `${this.base}/prescriptions`,
        { params: { patient_id: patientId, page, limit } }
      )
    );
  }

  generatePdf(id: number) {
    return firstValueFrom(
      this.http.post<{ jobId: string }>(`${this.base}/prescriptions/${id}/generate`, {})
    );
  }

  getPdfUrl(id: number) {
    return firstValueFrom(
      this.http.get<PdfUrlResult>(`${this.base}/prescriptions/${id}/pdf`)
    );
  }

  sendOnWA(id: number) {
    return firstValueFrom(
      this.http.post<{ success: boolean }>(`${this.base}/prescriptions/${id}/send`, {})
    );
  }

  async pollUntilPdfReady(id: number): Promise<string> {
    let attempts = 0;
    const result = await lastValueFrom(
      interval(3000).pipe(
        switchMap(() => this.http.get<PdfUrlResult>(`${this.base}/prescriptions/${id}/pdf`)),
        takeWhile(res => {
          attempts++;
          if (res.url) return false;
          if (attempts >= 30) throw new Error('PDF generation timed out after 90 seconds');
          return true;
        }, true),
      )
    );
    if (!result?.url) throw new Error('PDF URL not available');
    return result.url;
  }
}
