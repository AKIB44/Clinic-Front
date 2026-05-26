import {
  Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, inject, signal, computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormGroup, FormControl, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { OrgHrService, OrgStaff } from '../../../services/org-hr.service';
import { ClinicsService } from '../../../services/clinics.service';
import { Clinic } from '../../../models/clinic.model';
import { format, parseISO } from 'date-fns';

// ── Reset Password Dialog ─────────────────────────────────────────────────────

function passwordsMatch(g: AbstractControl): ValidationErrors | null {
  const p = g.get('newPassword')?.value;
  const c = g.get('confirmPassword')?.value;
  return p && c && p !== c ? { mismatch: true } : null;
}

@Component({
  selector: 'app-reset-password-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, MaterialModule, TablerIconsModule],
  template: `
    <h2 mat-dialog-title style="font-size:1.05rem;font-weight:700;">Reset Password</h2>
    <mat-dialog-content style="padding-top:8px;min-width:320px;">
      <p style="font-size:.85rem;color:#546e7a;margin-bottom:16px;">
        Set a new password for <strong>{{ data.name }}</strong>.
        They will need to use this password on their next login.
      </p>
      <form [formGroup]="form" style="display:flex;flex-direction:column;gap:14px;">
        <mat-form-field appearance="outline">
          <mat-label>New Password</mat-label>
          <input matInput [type]="hide1 ? 'password' : 'text'" formControlName="newPassword" autocomplete="new-password" />
          <button mat-icon-button matSuffix type="button" (click)="hide1=!hide1">
            <i-tabler [name]="hide1 ? 'eye' : 'eye-off'" size="18"></i-tabler>
          </button>
          @if (form.get('newPassword')?.hasError('minlength')) {
            <mat-error>Minimum 8 characters</mat-error>
          }
          @if (form.get('newPassword')?.hasError('required')) {
            <mat-error>Required</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Confirm Password</mat-label>
          <input matInput [type]="hide2 ? 'password' : 'text'" formControlName="confirmPassword" autocomplete="new-password" />
          <button mat-icon-button matSuffix type="button" (click)="hide2=!hide2">
            <i-tabler [name]="hide2 ? 'eye' : 'eye-off'" size="18"></i-tabler>
          </button>
          @if (form.hasError('mismatch') && form.get('confirmPassword')?.touched) {
            <mat-error>Passwords do not match</mat-error>
          }
        </mat-form-field>
      </form>
      @if (error) {
        <p style="color:#e53935;font-size:.82rem;margin-top:8px;">{{ error }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end" style="gap:8px;padding-bottom:16px;">
      <button mat-stroked-button mat-dialog-close [disabled]="submitting">Cancel</button>
      <button mat-flat-button color="primary" [disabled]="form.invalid || submitting" (click)="submit()">
        @if (submitting) { <mat-spinner diameter="18" style="display:inline-block;"></mat-spinner> }
        @else { Reset Password }
      </button>
    </mat-dialog-actions>
  `,
})
export class ResetPasswordDialogComponent {
  readonly dialogRef = inject(MatDialogRef<ResetPasswordDialogComponent>);
  readonly data: { name: string } = inject(MAT_DIALOG_DATA);

  hide1 = true;
  hide2 = true;
  submitting = false;
  error = '';

  form = new FormGroup({
    newPassword:     new FormControl('', [Validators.required, Validators.minLength(8)]),
    confirmPassword: new FormControl('', [Validators.required]),
  }, { validators: passwordsMatch });

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.dialogRef.close(this.form.value.newPassword);
  }
}

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
  private dialog     = inject(MatDialog);
  private snack      = inject(MatSnackBar);
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

  openResetPassword(s: OrgStaff) {
    const name = `${s.first_name} ${s.last_name}`.trim();
    const ref = this.dialog.open(ResetPasswordDialogComponent, {
      data: { name },
      width: '400px',
      disableClose: true,
    });
    ref.afterClosed().subscribe((newPassword: string | undefined) => {
      if (!newPassword) return;
      this.hrSvc.resetPassword(s.id, newPassword).subscribe({
        next: () => {
          this.snack.open(`Password reset for ${name}.`, 'Dismiss', { duration: 4000, panelClass: 'snack-success' });
        },
        error: () => {
          this.snack.open('Failed to reset password. Please try again.', 'Dismiss', { duration: 5000, panelClass: 'snack-error' });
        },
      });
    });
  }
}
