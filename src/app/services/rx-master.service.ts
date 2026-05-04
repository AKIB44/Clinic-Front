import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { authApiConfig } from '../auth/auth.config';
import { RxMedicine, RxProcedure, RxDefaults } from '../pages/rx/rx.interfaces';

@Injectable({ providedIn: 'root' })
export class RxMasterService {
  private http = inject(HttpClient);
  private base = `${authApiConfig.baseUrl}/rx`;

  private readonly _defCache = new Map<string, RxDefaults>();
  private readonly _medCache = new Map<string, RxMedicine[]>();

  async getDefaults(svcId: string): Promise<RxDefaults> {
    if (this._defCache.has(svcId)) return this._defCache.get(svcId)!;
    const response = await firstValueFrom(
      this.http.get<{ data: RxDefaults } | RxDefaults>(
        `${this.base}/master/defaults`, { params: { svc_id: svcId } }
      )
    );
    const data = this.normalizeDefaults(response);
    this._defCache.set(svcId, data);
    return data;
  }

  async getMedicines(search = '', category?: string): Promise<RxMedicine[]> {
    const key = `${search}:${category ?? ''}`;
    if (!search && this._medCache.has(key)) return this._medCache.get(key)!;

    let params = new HttpParams();
    if (search)   params = params.set('search',   search);
    if (category) params = params.set('category', category);

    const response = await firstValueFrom(
      this.http.get<{ data: RxMedicine[] } | RxMedicine[]>(
        `${this.base}/master/medicines`,
        { params }
      )
    );
    const data = this.normalizeMedicines(response);
    if (!search) this._medCache.set(key, data);
    return data;
  }

  async getProcedures(svcId: string): Promise<RxProcedure[]> {
    const defaults = await this.getDefaults(svcId);
    return defaults.procedures;
  }

  clearCache(): void {
    this._defCache.clear();
    this._medCache.clear();
  }

  private unwrap<T>(response: { data: T } | T): T {
    return response && typeof response === 'object' && 'data' in response
      ? (response as { data: T }).data
      : response as T;
  }

  private normalizeDefaults(response: { data: RxDefaults } | RxDefaults): RxDefaults {
    const data = this.unwrap(response);
    return {
      medicines: this.normalizeMedicineList(data?.medicines ?? []),
      procedures: this.normalizeProcedureList(data?.procedures ?? []),
    };
  }

  private normalizeMedicines(response: { data: RxMedicine[] } | RxMedicine[]): RxMedicine[] {
    return this.normalizeMedicineList(this.unwrap(response) ?? []);
  }

  private normalizeMedicineList(rows: any[]): RxMedicine[] {
    return rows.map((row) => ({
      id: row.id,
      genericName: row.genericName ?? row.generic_name ?? '',
      brandName: row.brandName ?? row.brand_name ?? null,
      category: row.category ?? '',
      dosageForm: row.dosageForm ?? row.dosage_form ?? '',
      strength: row.strength ?? '',
      defaultDose: row.defaultDose ?? row.default_dose ?? null,
      defaultDays: row.defaultDays ?? row.default_days ?? null,
      notes: row.notes ?? null,
    }));
  }

  private normalizeProcedureList(rows: any[]): RxProcedure[] {
    return rows.map((row) => ({
      id: row.id,
      procedureCode: row.procedureCode ?? row.procedure_code ?? '',
      procedureName: row.procedureName ?? row.procedure_name ?? '',
      svcId: row.svcId ?? row.svc_id ?? '',
      procedureStep: row.procedureStep ?? row.procedure_step ?? null,
      defaultNotes: row.defaultNotes ?? row.default_notes ?? null,
      followupDays: row.followupDays ?? row.followup_days ?? null,
    }));
  }
}
