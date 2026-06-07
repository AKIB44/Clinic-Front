import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { authApiConfig } from '../auth/auth.config';

export interface StaffAbacAttrs {
  id:                string;
  email:             string;
  first_name:        string;
  last_name:         string;
  role:              string;
  hierarchy_level:   number;
  specialty_tags:    string[];
  branch_id:         string | null;
  max_discount_pct:  number;
  shift_start:       string | null;
  shift_end:         string | null;
  clinic_id:         string;
  org_id:            string;
}

export interface StaffAttrPatch {
  specialty_tags?:    string[];
  branch_id?:         string | null;
  max_discount_pct?:  number;
  shift_start?:       string | null;
  shift_end?:         string | null;
}

@Injectable({ providedIn: 'root' })
export class StaffAttrsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${authApiConfig.baseUrl}/staff-attrs`;

  get(userId: string): Observable<{ user: StaffAbacAttrs }> {
    return this.http.get<{ user: StaffAbacAttrs }>(`${this.base}/${userId}`);
  }
  update(userId: string, patch: StaffAttrPatch): Observable<{ user: Partial<StaffAbacAttrs> }> {
    return this.http.patch<{ user: Partial<StaffAbacAttrs> }>(`${this.base}/${userId}`, patch);
  }
}
