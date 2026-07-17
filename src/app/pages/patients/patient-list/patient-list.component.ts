import {
  Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, inject, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MaterialModule } from '../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { PageEvent } from '@angular/material/paginator';
import { PatientsService, Patient } from '../../../services/patients.service';
import { ClinicServicesService } from '../../../services/clinic-services.service';
import { ClinicService } from '../../../models/clinic.model';
import { ConfirmService } from '../../../core/ui/confirm.service';
import { ToastService } from '../../../services/toast.service';
import { HasPermissionDirective } from '../../../core/rbac/has-permission.directive';
import { format, parseISO } from 'date-fns';

@Component({
  selector: 'app-patient-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterModule, MaterialModule, TablerIconsModule, HasPermissionDirective],
  templateUrl: './patient-list.component.html',
  styleUrls: ['./patient-list.component.scss'],
})
export class PatientListComponent implements OnInit, OnDestroy {
  private patientsService  = inject(PatientsService);
  private servicesService  = inject(ClinicServicesService);
  private router           = inject(Router);
  private cdr              = inject(ChangeDetectorRef);
  private confirm          = inject(ConfirmService);
  private toast            = inject(ToastService);
  private destroy$         = new Subject<void>();
  private search$          = new Subject<string>();

  /** Patient currently animating out during a delete, so the card can collapse. */
  readonly removingId = signal<string | null>(null);

  searchTerm    = '';
  selectedSvcId = '';
  services: ClinicService[] = [];
  patients: Patient[]       = [];
  loading       = false;
  searched      = false;
  page          = 1;
  pageSize      = 20;
  total         = 0;
  readonly pageSizeOptions = [10, 20, 50];

  get rangeStart(): number {
    if (this.total === 0) return 0;
    return (this.page - 1) * this.pageSize + 1;
  }

  get rangeEnd(): number {
    return Math.min(this.page * this.pageSize, this.total);
  }

  ngOnInit() {
    this.servicesService.list().subscribe({
      next: r => { this.services = (r.services ?? []).filter(s => s.is_active !== false); this.cdr.markForCheck(); },
    });

    // Debounce search input
    this.search$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$),
    ).subscribe(() => {
      this.page = 1;
      this.load();
    });

    // Load all patients initially
    this.load();
  }

  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  onSearchInput() { this.search$.next(this.searchTerm); }

  onServiceChange() {
    this.page = 1;
    this.load();
  }

  clearSearch() {
    this.searchTerm = '';
    this.page = 1;
    this.load();
  }

  onPageChange(event: PageEvent): void {
    this.page = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.load();
  }

  private load() {
    this.loading = true;
    this.cdr.markForCheck();
    this.patientsService.list({
      search:     this.searchTerm.trim() || undefined,
      service_id: this.selectedSvcId || undefined,
      page:       this.page,
      limit:      this.pageSize,
    }).subscribe({
      next: r => {
        const patients = r.patients ?? [];
        if (patients.length === 0 && this.page > 1) {
          this.page = Math.max(1, this.page - 1);
          this.load();
          return;
        }
        this.patients = patients;
        this.total    = this.resolveTotal(r.total, patients.length);
        this.loading  = false;
        this.searched = true;
        this.cdr.markForCheck();
      },
      error: () => { this.loading = false; this.cdr.markForCheck(); },
    });
  }

  private resolveTotal(apiTotal: number | undefined, pageCount: number): number {
    if (typeof apiTotal === 'number' && apiTotal >= 0) return apiTotal;
    if (pageCount < this.pageSize) {
      return (this.page - 1) * this.pageSize + pageCount;
    }
    return this.page * this.pageSize + 1;
  }

  openRecord(patient: Patient) {
    this.router.navigate(['/patients', patient.id]);
  }

  /** Confirm, then soft-delete — the card collapses out on success. */
  confirmDelete(patient: Patient, event: Event) {
    event.stopPropagation();               // don't open the record
    if (this.removingId()) return;
    this.confirm.ask({
      title: 'Delete this patient?',
      body: `${patient.name} will be removed from search and records. Their clinical and billing history is preserved and an admin can restore them.`,
      confirmLabel: 'Delete patient',
      confirmColor: 'warn',
      icon: 'archive',
      danger: true,
    }).subscribe(ok => { if (ok) this.doDelete(patient); });
  }

  private doDelete(patient: Patient) {
    this.removingId.set(patient.id);       // triggers the collapse animation
    this.cdr.markForCheck();
    this.patientsService.delete(patient.id).subscribe({
      next: () => {
        // Let the exit animation finish before dropping the row from the list.
        setTimeout(() => {
          this.patients = this.patients.filter(p => p.id !== patient.id);
          this.total    = Math.max(0, this.total - 1);
          this.removingId.set(null);
          this.toast.success(`${patient.name} archived.`);
          this.cdr.markForCheck();
        }, 340);
      },
      error: (err) => {
        this.removingId.set(null);          // spring the card back
        this.toast.error(err?.error?.error ?? 'Could not archive the patient. Please try again.');
        this.cdr.markForCheck();
      },
    });
  }

  formatVisitDate(iso: string): string {
    try { return format(parseISO(iso.replace('Z', '')), 'd MMM yyyy'); } catch { return iso; }
  }

  formatVisitTime(iso: string): string {
    try { return format(parseISO(iso.replace('Z', '')), 'h:mm a'); } catch { return ''; }
  }

  initials(name: string): string {
    return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase()).join('');
  }

  genderIcon(g?: string): string {
    if (g === 'male')   return 'gender-male';
    if (g === 'female') return 'gender-female';
    return 'gender-bigender';
  }
}
