import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { authApiConfig } from '../../../auth/auth.config';
import { BillingSummary, ClinicExpense, ExpenseUpsert, RevenueItem } from '../models/billing.model';

@Injectable({ providedIn: 'root' })
export class BillingApiService {
  private http = inject(HttpClient);
  private base = `${authApiConfig.baseUrl}/clinic-billing`;

  getSummary(periodDays: number): Observable<BillingSummary> {
    return this.http.get<BillingSummary>(`${this.base}/summary`, { params: new HttpParams().set('period', periodDays) });
  }

  getRevenue(periodDays: number): Observable<{ data: RevenueItem[] }> {
    return this.http.get<{ data: RevenueItem[] }>(`${this.base}/revenue`, { params: new HttpParams().set('period', periodDays) });
  }

  getExpenses(periodDays: number): Observable<{ data: ClinicExpense[] }> {
    return this.http.get<{ data: ClinicExpense[] }>(`${this.base}/expenses`, { params: new HttpParams().set('period', periodDays) });
  }

  createExpense(payload: ExpenseUpsert): Observable<{ data: ClinicExpense }> {
    return this.http.post<{ data: ClinicExpense }>(`${this.base}/expenses`, payload);
  }

  updateExpense(id: string, payload: Partial<ExpenseUpsert>): Observable<{ data: ClinicExpense }> {
    return this.http.patch<{ data: ClinicExpense }>(`${this.base}/expenses/${id}`, payload);
  }

  deleteExpense(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/expenses/${id}`);
  }
}
