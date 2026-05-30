import {
  Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MatDialog, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { ToastService } from '../../../services/toast.service';
import { ChairsService } from '../../../services/chairs.service';
import { Chair, ChairServiceLog, LogServicePayload } from '../../../models/clinic.model';

// ── Add / Edit Chair Dialog ───────────────────────────────────────────────────

@Component({
  selector: 'chair-form-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule],
  template: `
    <h2 mat-dialog-title>{{ data?.id ? 'Edit Chair' : 'Add Chair' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="chair-form-dlg">
        <mat-form-field appearance="outline" style="width:100%">
          <mat-label>Chair Name / Number</mat-label>
          <input matInput formControlName="name" placeholder="e.g. Chair 1">
        </mat-form-field>

        <mat-form-field appearance="outline" style="width:100%">
          <mat-label>Service Interval (days)</mat-label>
          <input matInput type="number" formControlName="service_interval_days" min="1">
          <mat-hint>How often this chair should be serviced</mat-hint>
        </mat-form-field>

        @if (data?.id) {
          <mat-form-field appearance="outline" style="width:100%">
            <mat-label>Operational Status</mat-label>
            <mat-select formControlName="operational_status">
              <mat-option value="operational">Operational</mat-option>
              <mat-option value="under_service">Under Service</mat-option>
              <mat-option value="out_of_order">Out of Order</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-slide-toggle formControlName="is_active" color="primary">Active</mat-slide-toggle>
        }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-stroked-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" [disabled]="form.invalid || saving" (click)="save()">
        {{ saving ? 'Saving…' : 'Save' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .chair-form-dlg { display: flex; flex-direction: column; gap: 12px; min-width: 380px; padding-top: 8px; }
  `],
})
export class ChairFormDialog {
  dialogRef = inject(MatDialogRef<ChairFormDialog>);
  data      = inject<Chair | null>(MAT_DIALOG_DATA);
  private svc = inject(ChairsService);

  saving = false;
  form = new FormGroup({
    name:                  new FormControl(this.data?.name      ?? '', [Validators.required]),
    service_interval_days: new FormControl(this.data?.service_interval_days ?? 180),
    operational_status:    new FormControl(this.data?.operational_status ?? 'operational'),
    is_active:             new FormControl(this.data?.is_active ?? true),
  });

  save() {
    if (this.form.invalid) return;
    this.saving = true;
    const req = this.data?.id
      ? this.svc.update(this.data.id, this.form.value as Partial<Chair>)
      : this.svc.create(this.form.value as Partial<Chair>);
    req.subscribe({
      next: (r: any) => { this.saving = false; this.dialogRef.close(r.chair); },
      error: ()      => { this.saving = false; },
    });
  }
}

// ── Log Service Dialog ────────────────────────────────────────────────────────

@Component({
  selector: 'chair-service-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule, MatDatepickerModule, MatNativeDateModule],
  template: `
    <h2 mat-dialog-title>Log Service — {{ data.chair.name }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="service-form">

        <div class="two-col">
          <mat-form-field appearance="outline">
            <mat-label>Service Type</mat-label>
            <mat-select formControlName="service_type">
              @for (t of serviceTypes; track t) {
                <mat-option [value]="t">{{ t }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Serviced At</mat-label>
            <input matInput [matDatepicker]="dp" formControlName="serviced_at">
            <mat-datepicker-toggle matIconSuffix [for]="dp"></mat-datepicker-toggle>
            <mat-datepicker #dp></mat-datepicker>
          </mat-form-field>
        </div>

        <div class="two-col">
          <mat-form-field appearance="outline">
            <mat-label>Serviced By</mat-label>
            <input matInput formControlName="serviced_by" placeholder="Technician / vendor name">
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Cost (₹)</mat-label>
            <span matTextPrefix>₹&nbsp;</span>
            <input matInput type="number" formControlName="cost" min="0" step="any">
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline" style="width:100%">
          <mat-label>Notes</mat-label>
          <textarea matInput formControlName="notes" rows="3" placeholder="What was done, parts replaced…"></textarea>
        </mat-form-field>

        <div class="two-col">
          <mat-form-field appearance="outline">
            <mat-label>Update Status</mat-label>
            <mat-select formControlName="operational_status">
              <mat-option value="operational">Operational</mat-option>
              <mat-option value="under_service">Under Service</mat-option>
              <mat-option value="out_of_order">Out of Order</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Next Due Date</mat-label>
            <input matInput [matDatepicker]="dp2" formControlName="next_due_date">
            <mat-hint>Auto-set if blank (interval: {{ data.chair.service_interval_days }}d)</mat-hint>
            <mat-datepicker-toggle matIconSuffix [for]="dp2"></mat-datepicker-toggle>
            <mat-datepicker #dp2></mat-datepicker>
          </mat-form-field>
        </div>

      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-stroked-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" [disabled]="form.invalid || saving" (click)="save()">
        {{ saving ? 'Logging…' : 'Log Service' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .service-form { display: flex; flex-direction: column; gap: 4px; min-width: min(520px, 90vw); padding-top: 8px; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChairServiceDialog {
  data    = inject<{ chair: Chair }>(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<ChairServiceDialog>);
  private svc = inject(ChairsService);

  saving = false;
  serviceTypes = [
    'Routine Maintenance', 'Deep Cleaning', 'Hydraulic Service',
    'Electrical Check', 'Upholstery Repair', 'Full Overhaul', 'Other',
  ];

  form = new FormGroup({
    service_type:       new FormControl('Routine Maintenance', Validators.required),
    serviced_at:        new FormControl<Date>(new Date(), Validators.required),
    serviced_by:        new FormControl(''),
    cost:               new FormControl<number | null>(null),
    notes:              new FormControl(''),
    operational_status: new FormControl('operational', Validators.required),
    next_due_date:      new FormControl<Date | null>(null),
  });

  save() {
    if (this.form.invalid) return;
    this.saving = true;
    const v = this.form.value;
    const payload: LogServicePayload = {
      service_type:       v.service_type!,
      serviced_at:        (v.serviced_at as Date).toISOString().split('T')[0],
      serviced_by:        v.serviced_by || undefined,
      cost:               v.cost ?? undefined,
      notes:              v.notes || undefined,
      operational_status: v.operational_status!,
      next_due_date:      v.next_due_date
        ? (v.next_due_date as Date).toISOString().split('T')[0]
        : undefined,
    };
    this.svc.logService(this.data.chair.id, payload).subscribe({
      next: (r) => { this.saving = false; this.ref.close(r); },
      error: ()  => { this.saving = false; },
    });
  }
}

// ── Main Component ────────────────────────────────────────────────────────────

@Component({
  selector: 'app-chairs-master',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, ReactiveFormsModule, MaterialModule, TablerIconsModule,
    MatDatepickerModule, MatNativeDateModule, MatTableModule, MatTabsModule,
  ],
  templateUrl: './chairs.component.html',
  styleUrls: ['./chairs.component.scss'],
})
export class ChairsMasterComponent implements OnInit {
  private svc    = inject(ChairsService);
  private dialog = inject(MatDialog);
  private toast  = inject(ToastService);
  private cdr    = inject(ChangeDetectorRef);

  chairs:    Chair[]           = [];
  logs:      ChairServiceLog[] = [];
  dueChairs: Chair[]           = [];

  loading     = true;
  loadingLogs = false;
  loadingDue  = false;

  logsLoaded = false;
  dueLoaded  = false;

  selectedTabIndex = 0;

  logColumns = ['chair', 'type', 'date', 'by', 'cost', 'next_due'];

  ngOnInit() { this.loadChairs(); }

  onTabChange(index: number) {
    if (index === 1 && !this.logsLoaded) this.loadLogs();
    if (index === 2 && !this.dueLoaded)  this.loadDue();
  }

  // ── Chairs ──────────────────────────────────────────────────────────────────
  loadChairs() {
    this.loading = true;
    this.svc.list().subscribe({
      next: (r) => { this.chairs = r.chairs; this.loading = false; this.cdr.markForCheck(); },
      error: ()  => { this.loading = false; this.cdr.markForCheck(); },
    });
  }

  openChairDialog(chair?: Chair) {
    const ref = this.dialog.open(ChairFormDialog, { data: chair ?? null, width: '440px' });
    ref.afterClosed().subscribe(result => {
      if (result) {
        this.toast.success(chair ? 'Chair updated' : 'Chair added');
        this.loadChairs();
        if (this.dueLoaded) this.loadDue();
      }
    });
  }

  delete(chair: Chair) {
    this.svc.delete(chair.id).subscribe({
      next: () => { this.toast.success('Chair removed'); this.loadChairs(); },
      error: (err) => this.toast.error(err?.error?.error ?? 'Cannot delete chair'),
    });
  }

  // ── Service log dialog ───────────────────────────────────────────────────────
  openServiceDialog(chair: Chair) {
    const ref = this.dialog.open(ChairServiceDialog, { data: { chair }, width: '600px' });
    ref.afterClosed().subscribe((result: { log: ChairServiceLog; chair: Chair } | undefined) => {
      if (!result) return;
      this.toast.success(`Service logged for ${result.chair.name}`);
      // Update the in-place chair record
      this.chairs = this.chairs.map(c => c.id === result.chair.id ? result.chair : c);
      this.logsLoaded = false;
      this.dueLoaded  = false;
      if (this.selectedTabIndex === 1) this.loadLogs();
      if (this.selectedTabIndex === 2) this.loadDue();
      this.cdr.markForCheck();
    });
  }

  // ── Service log tab ──────────────────────────────────────────────────────────
  loadLogs(chairId?: string) {
    this.loadingLogs = true;
    this.svc.getServiceLogs(chairId).subscribe({
      next: (r) => {
        this.logs = r.logs;
        this.logsLoaded = true;
        this.loadingLogs = false;
        this.cdr.markForCheck();
      },
      error: () => { this.loadingLogs = false; this.cdr.markForCheck(); },
    });
  }

  // ── Due for service tab ──────────────────────────────────────────────────────
  loadDue() {
    this.loadingDue = true;
    this.svc.getServiceDue().subscribe({
      next: (r) => {
        this.dueChairs = r.chairs;
        this.dueLoaded  = true;
        this.loadingDue = false;
        this.cdr.markForCheck();
      },
      error: () => { this.loadingDue = false; this.cdr.markForCheck(); },
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  opsStatusLabel(s: string): string {
    return { operational: 'Operational', under_service: 'Under Service', out_of_order: 'Out of Order' }[s] ?? s;
  }

  opsStatusClass(s: string): string {
    return { operational: 'ops--ok', under_service: 'ops--warn', out_of_order: 'ops--err' }[s] ?? '';
  }

  svcStatusLabel(s: string): string {
    return { ok: 'Up to date', due_soon: 'Due Soon', overdue: 'Overdue', no_schedule: 'Not scheduled' }[s] ?? s;
  }

  svcStatusClass(s: string): string {
    return { ok: 'svc--ok', due_soon: 'svc--warn', overdue: 'svc--err', no_schedule: 'svc--none' }[s] ?? '';
  }

  get dueCount(): number {
    return this.chairs.filter(c => c.service_status === 'overdue' || c.service_status === 'due_soon').length;
  }
}
