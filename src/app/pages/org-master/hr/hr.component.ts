import {
  Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, inject, signal, computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { OrgHrService, OrgStaff } from '../../../services/org-hr.service';
import { ClinicsService } from '../../../services/clinics.service';
import { Clinic } from '../../../models/clinic.model';
import { format, parseISO } from 'date-fns';

@Component({
  selector: 'app-hr',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule],
  templateUrl: './hr.component.html',
  styleUrls: ['./hr.component.scss'],
})
export class HrComponent implements OnInit, OnDestroy {
  private hrSvc      = inject(OrgHrService);
  private clinicsSvc = inject(ClinicsService);
  private cdr        = inject(ChangeDetectorRef);
  private destroy$   = new Subject<void>();
  private search$    = new Subject<string>();

  staff         = signal<OrgStaff[]>([]);
  total         = signal<number>(0);
  loading       = signal<boolean>(false);
  error         = signal<string>('');
  clinics       = signal<Clinic[]>([]);

  searchTerm      = '';
  filterClinicId  = '';
  filterActive    = '';
  page            = 0;
  readonly pageSize = 50;

  activeCount   = computed(() => this.staff().filter(s => s.is_active).length);
  inactiveCount = computed(() => this.staff().filter(s => !s.is_active).length);

  ngOnInit() {
    this.clinicsSvc.list().subscribe({
      next: r => { this.clinics.set(r.clinics ?? []); this.cdr.markForCheck(); },
    });

    this.search$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$),
    ).subscribe(() => { this.page = 0; this.load(); });

    this.load();
  }

  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  onSearchInput() { this.search$.next(this.searchTerm); }
  onFilterChange() { this.page = 0; this.load(); }

  load() {
    this.loading.set(true);
    this.error.set('');
    this.cdr.markForCheck();

    const opts: Parameters<OrgHrService['listStaff']>[0] = {
      limit:  this.pageSize,
      offset: this.page * this.pageSize,
    };
    if (this.searchTerm.trim()) opts.search = this.searchTerm.trim();
    if (this.filterClinicId)    opts.clinic_id = this.filterClinicId;
    if (this.filterActive)      opts.is_active = this.filterActive === 'true';

    this.hrSvc.listStaff(opts).subscribe({
      next: r => {
        this.staff.set(r.staff ?? []);
        this.total.set(r.total ?? 0);
        this.loading.set(false);
        this.cdr.markForCheck();
      },
      error: () => {
        this.error.set('Failed to load staff. Please try again.');
        this.loading.set(false);
        this.cdr.markForCheck();
      },
    });
  }

  toggleActive(s: OrgStaff) {
    this.hrSvc.updateStaff(s.id, { is_active: !s.is_active }).subscribe({
      next: () => this.load(),
    });
  }

  initials(s: OrgStaff): string {
    return [s.first_name?.[0], s.last_name?.[0]]
      .filter(Boolean)
      .join('')
      .toUpperCase();
  }

  roleLabel(s: OrgStaff): string {
    return s.roles?.[0]?.name || s.role || '—';
  }

  formatDate(iso?: string): string {
    if (!iso) return '—';
    try { return format(parseISO(iso), 'd MMM yyyy'); } catch { return iso; }
  }
}
