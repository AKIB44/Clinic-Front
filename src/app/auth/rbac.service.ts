import { Injectable, inject } from '@angular/core';
import { AuthStorageService } from './auth-storage.service';
import { AppRole } from './auth.models';

@Injectable({ providedIn: 'root' })
export class RbacService {
  private storage = inject(AuthStorageService);

  get user() { return this.storage.getUser(); }
  get role(): AppRole | undefined { return this.user?.role; }
  get clinicId(): string | undefined { return this.user?.clinic_id; }

  hasAnyRole(roles: AppRole[]): boolean {
    return !!this.role && roles.includes(this.role);
  }

  get isSuperAdmin()    { return this.role === 'super_admin'; }
  get isClinicAdmin()   { return this.role === 'clinic_admin'; }
  get isDoctor()        { return this.role === 'doctor'; }
  get isReceptionist()  { return this.role === 'receptionist'; }
  get canManageMaster() { return this.hasAnyRole(['super_admin', 'clinic_admin']); }
}
