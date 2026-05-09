import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';
import { authApiConfig } from '../../auth/auth.config';
import { AuthStorageService } from '../../auth/auth-storage.service';
import { PermissionService } from '../rbac/permission.service';
import { ClinicRef, SwitchClinicResponse } from '../../auth/auth.models';

@Injectable({ providedIn: 'root' })
export class TenantService {
  private readonly http        = inject(HttpClient);
  private readonly storage     = inject(AuthStorageService);
  private readonly permissions = inject(PermissionService);
  private readonly router      = inject(Router);

  readonly availableClinics = computed<ClinicRef[]>(() => {
    const raw = this.storage.getUser()?.available_clinics ?? [];
    return raw.map(c =>
      typeof c === 'string' ? { id: c, name: `Clinic ${c.slice(0, 8)}` } : c
    );
  });

  readonly activeClinicId = computed(() =>
    this.storage.getUser()?.active_clinic_id ?? this.storage.getUser()?.clinic_id ?? null
  );

  clinicLabel(id: string | null): string {
    if (!id) return 'Clinic';
    const match = this.availableClinics().find(c => c.id === id);
    return match?.name ?? `Clinic ${id.slice(0, 8)}`;
  }

  async switchClinic(clinicId: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<SwitchClinicResponse>(
        `${authApiConfig.baseUrl}/auth/switch-clinic`,
        { clinicId }
      )
    );
    this.storage.updateTokens(res.access_token, res.refresh_token);
    await this.permissions.refresh(clinicId);
    this.router.navigate(['/dashboards/dashboard1']);
  }
}
