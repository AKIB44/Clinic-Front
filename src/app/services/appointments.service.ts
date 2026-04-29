import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { authApiConfig } from '../auth/auth.config';

export interface Slot {
  time: string;
  taken: boolean;
}

export interface Appointment {
  id: string;
  patient_id: string;
  patient_name: string;
  patient_phone: string;
  service_id: string;
  service_name: string;
  chair_id: number;
  scheduled_at: string;
  status: 'booked' | 'confirmed' | 'in_progress' | 'done' | 'no_show' | 'cancelled';
  booking_source: string;
  intake_data: Record<string, unknown> | null;
  notes: string | null;
}

export interface BookingPayload {
  service_id: string;
  chair_id: number;
  scheduled_at: string;
  booking_source: string;
  patient: { name: string; phone: string; email?: string };
  intake_data: Record<string, unknown>;
}

@Injectable({ providedIn: 'root' })
export class AppointmentsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${authApiConfig.baseUrl}/appointments`;

  getSlots(date: string, serviceId: string, chairId = 1): Observable<{ slots: Slot[] }> {
    return this.http.get<{ slots: Slot[] }>(`${this.base}/slots`, {
      params: { date, service_id: serviceId, chair_id: String(chairId) },
    });
  }

  getTodaySchedule(date: string): Observable<{ appointments: Appointment[] }> {
    return this.http.get<{ appointments: Appointment[] }>(this.base, {
      params: { date, limit: '100' },
    });
  }

  getDetail(id: string): Observable<{ appointment: Appointment }> {
    return this.http.get<{ appointment: Appointment }>(`${this.base}/${id}`);
  }

  book(payload: BookingPayload): Observable<{ appointment: Appointment }> {
    return this.http.post<{ appointment: Appointment }>(this.base, payload);
  }

  close(id: string): Observable<unknown> {
    return this.http.post(`${this.base}/${id}/complete`, {});
  }

  markNoShow(id: string): Observable<unknown> {
    return this.http.post(`${this.base}/${id}/no-show`, {});
  }

  cancel(id: string): Observable<unknown> {
    return this.http.post(`${this.base}/${id}/cancel`, {});
  }
}
