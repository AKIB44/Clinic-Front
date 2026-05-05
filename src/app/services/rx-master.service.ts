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
      this.http.get<any>(`${this.base}/master/defaults`, { params: { svc_id: svcId } })
    );
    const raw = response?.data ?? response;
    const data: RxDefaults = {
      medicines:  this._normMeds(raw?.medicines  ?? []),
      procedures: this._normProcs(raw?.procedures ?? []),
    };
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
      this.http.get<any>(`${this.base}/master/medicines`, { params })
    );
    const data = this._normMeds(response?.data ?? response ?? []);
    if (!search) this._medCache.set(key, data);
    return data;
  }

  async getProcedures(svcId: string): Promise<RxProcedure[]> {
    return (await this.getDefaults(svcId)).procedures;
  }

  clearCache(): void {
    this._defCache.clear();
    this._medCache.clear();
  }

  private _normMeds(rows: any[]): RxMedicine[] {
    return rows.map(r => ({
      id:           r.id,
      generic_name: r.generic_name  ?? r.genericName  ?? '',
      brand_name:   r.brand_name    ?? r.brandName    ?? null,
      category:     r.category      ?? '',
      dosage_form:  r.dosage_form   ?? r.dosageForm   ?? '',
      strength:     r.strength      ?? '',
      default_dose: r.default_dose  ?? r.defaultDose  ?? null,
      default_days: r.default_days  ?? r.defaultDays  ?? null,
      notes:        r.notes         ?? null,
    }));
  }

  private _normProcs(rows: any[]): RxProcedure[] {
    return rows.map(r => ({
      id:             r.id,
      procedure_code: r.procedure_code ?? r.procedureCode ?? '',
      procedure_name: r.procedure_name ?? r.procedureName ?? '',
      svc_id:         r.svc_id         ?? r.svcId         ?? '',
      procedure_step: r.procedure_step ?? r.procedureStep ?? null,
      default_notes:  r.default_notes  ?? r.defaultNotes  ?? null,
      followup_days:  r.followup_days  ?? r.followupDays  ?? null,
    }));
  }
}
