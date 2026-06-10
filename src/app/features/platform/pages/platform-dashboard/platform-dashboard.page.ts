import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MaterialModule } from '../../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { PlatformApiService } from '../../services/platform-api.service';
import { DashboardMetrics } from '../../models/plan.model';

@Component({
  selector: 'platform-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MaterialModule, TablerIconsModule],
  templateUrl: './platform-dashboard.page.html',
  styleUrl: './platform-dashboard.page.scss',
})
export class PlatformDashboardPage implements OnInit {
  private api    = inject(PlatformApiService);
  private router = inject(Router);

  readonly metrics = signal<DashboardMetrics | null>(null);
  readonly loading = signal(false);
  readonly error   = signal<string | null>(null);

  ngOnInit(): void {
    this.loading.set(true);
    this.api.dashboardMetrics().subscribe({
      next: (m) => { this.metrics.set(m); this.loading.set(false); },
      error: (e) => { this.error.set(e?.error?.error ?? 'Failed to load metrics.'); this.loading.set(false); },
    });
  }

  inr(paise: number | undefined): string {
    return `₹${((paise ?? 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  }

  openTenant(clinicId: string): void {
    this.router.navigate(['/platform/tenants', clinicId]);
  }
}
