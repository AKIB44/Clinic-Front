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
  chair_id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: 'booked' | 'confirmed' | 'in_progress' | 'done' | 'no_show' | 'cancelled';
  booking_source: string;
  notes: string | null;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface BookingPayload {
  service_id: string;
  chair_id: string;
  scheduled_at: string;
  booking_source: string;
  notes?: string;
  patient: { name: string; phone: string; email?: string; age?: number; gender?: string; address?: string; clinical_history?: string };
  intake_data?: Record<string, unknown>;
}

export type AppointmentStatus = Appointment['status'];

@Injectable({ providedIn: 'root' })
export class AppointmentsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${authApiConfig.baseUrl}/appointments`;

  // Slot availability — public, no auth needed
  getSlots(date: string, serviceId: string, chairId: string): Observable<{ slots: Slot[] }> {
    return this.http.get<{ slots: Slot[] }>(`${this.base}/slots`, {
      params: { date, service_id: serviceId, chair_id: chairId },
    });
  }

  // Day schedule — powers the kanban board
  getSchedule(date: string, chairId?: string, status?: string): Observable<{ appointments: Appointment[] }> {
    const params: Record<string, string> = { date, limit: '100' };
    if (chairId) params['chair_id'] = chairId;
    if (status)  params['status']   = status;
    return this.http.get<{ appointments: Appointment[] }>(this.base, { params });
  }

  getDetail(id: string): Observable<{ appointment: Appointment }> {
    return this.http.get<{ appointment: Appointment }>(`${this.base}/${id}`);
  }

  // Public booking — no auth required on backend
  book(payload: BookingPayload): Observable<{ appointment: Appointment }> {
    return this.http.post<{ appointment: Appointment }>(this.base, payload);
  }

  // Single unified status transition endpoint
  updateStatus(id: string, status: AppointmentStatus, cancelReason?: string): Observable<{ appointment: Appointment }> {
    const body: Record<string, string> = { status };
    if (cancelReason) body['cancel_reason'] = cancelReason;
    return this.http.patch<{ appointment: Appointment }>(`${this.base}/${id}/status`, body);
  }

  // Reschedule — change time or chair
  reschedule(id: string, payload: { scheduled_at?: string; chair_id?: string; notes?: string }): Observable<{ appointment: Appointment }> {
    return this.http.patch<{ appointment: Appointment }>(`${this.base}/${id}`, payload);
  }
}
