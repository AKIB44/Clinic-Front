import { Component, inject, signal } from '@angular/core';
import { MaterialModule } from 'src/app/material.module';
import { TenantService } from './tenant.service';

@Component({
  selector: 'app-clinic-switcher',
  standalone: true,
  imports: [MaterialModule],
  template: `
    @if (tenant.availableClinics().length > 1) {
      <button mat-button [matMenuTriggerFor]="clinicMenu"
              [disabled]="switching()"
              class="clinic-switcher-btn d-flex align-items-center gap-1">
        @if (switching()) {
          <mat-spinner diameter="16"></mat-spinner>
        } @else {
          <mat-icon>business</mat-icon>
        }
        <span class="clinic-name">{{ tenant.clinicLabel(tenant.activeClinicId()) }}</span>
        <mat-icon>arrow_drop_down</mat-icon>
      </button>

      <mat-menu #clinicMenu="matMenu">
        @for (clinic of tenant.availableClinics(); track clinic.id) {
          <button mat-menu-item
                  [disabled]="clinic.id === tenant.activeClinicId()"
                  (click)="switchTo(clinic.id)">
            @if (clinic.id === tenant.activeClinicId()) {
              <mat-icon>check</mat-icon>
            } @else {
              <mat-icon>business</mat-icon>
            }
            {{ clinic.name }}
          </button>
        }
      </mat-menu>
    }
  `,
  styles: [`
    .clinic-switcher-btn { text-transform: none; font-size: 13px; }
    .clinic-name { max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  `],
})
export class ClinicSwitcherComponent {
  readonly tenant   = inject(TenantService);
  readonly switching = signal(false);

  async switchTo(clinicId: string): Promise<void> {
    if (this.switching()) return;
    this.switching.set(true);
    try {
      await this.tenant.switchClinic(clinicId);
    } finally {
      this.switching.set(false);
    }
  }
}
