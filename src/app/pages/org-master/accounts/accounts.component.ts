import {
  Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, inject, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { forkJoin } from 'rxjs';
import { OrgAccountsService, OrgSummary, ClinicRevenue, ServiceRevenue } from '../../../services/org-accounts.service';
import { ClinicsService } from '../../../services/clinics.service';
import { Clinic } from '../../../models/clinic.model';
import { format, parseISO } from 'date-fns';

@Component({
  selector: 'app-accounts',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule],
  templateUrl: './accounts.component.html',
  styleUrls: ['./accounts.component.scss'],
})
export class AccountsComponent implements OnInit {
  private accountsSvc = inject(OrgAccountsService);
  private clinicsSvc  = inject(ClinicsService);
  private cdr         = inject(ChangeDetectorRef);

  summary       = signal<OrgSummary | null>(null);
  clinicRevenue = signal<ClinicRevenue[]>([]);
  topServices   = signal<ServiceRevenue[]>([]);
  loading       = signal<boolean>(false);
  clinics       = signal<Clinic[]>([]);
  period        = signal<number>(30);
  filterClinicId = '';

  readonly periodOptions = [7, 30, 90];

  ngOnInit() {
    this.clinicsSvc.list().subscribe({
      next: r => { this.clinics.set(r.clinics ?? []); this.cdr.markForCheck(); },
    });
    this.reload();
  }

  setPeriod(p: number) {
    this.period.set(p);
    this.loadRevenueAndServices();
  }

  reload() {
    this.loading.set(true);
    this.cdr.markForCheck();

    forkJoin({
      summary:  this.accountsSvc.getSummary(this.period()),
      revenue:  this.accountsSvc.getRevenue(this.period(), this.filterClinicId || undefined),
      services: this.accountsSvc.getTopServices(this.period(), this.filterClinicId || undefined),
    }).subscribe({
      next: ({ summary, revenue, services }) => {
        this.summary.set(summary);
        this.clinicRevenue.set(revenue.clinics ?? []);
        this.topServices.set(services.services ?? []);
        this.loading.set(false);
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading.set(false);
        this.cdr.markForCheck();
      },
    });
  }

  private loadRevenueAndServices() {
    forkJoin({
      revenue:  this.accountsSvc.getRevenue(this.period(), this.filterClinicId || undefined),
      services: this.accountsSvc.getTopServices(this.period(), this.filterClinicId || undefined),
    }).subscribe({
      next: ({ revenue, services }) => {
        this.clinicRevenue.set(revenue.clinics ?? []);
        this.topServices.set(services.services ?? []);
        this.cdr.markForCheck();
      },
    });
  }

  onClinicFilterChange() { this.reload(); }

  formatCurrency(n: number | string): string {
    return '₹' + Number(n).toLocaleString('en-IN');
  }

  formatDate(iso?: string): string {
    if (!iso) return '—';
    try { return format(parseISO(iso), 'd MMM yyyy'); } catch { return iso; }
  }
}
