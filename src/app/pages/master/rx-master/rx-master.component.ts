import {
  Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, inject, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MatDialog, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { authApiConfig } from '../../../auth/auth.config';
import { RxMedicine, RxProcedure } from '../../rx/rx.interfaces';

// ── Medicine Form Dialog ─────────────────────────────────────────────────────

@Component({
  selector: 'rx-medicine-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule],
  template: `
    <h2 mat-dialog-title>{{ data?.id ? 'Edit Medicine' : 'Add Medicine' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">
        <div class="two-col">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Generic Name</mat-label>
            <input matInput formControlName="generic_name" placeholder="e.g. Amoxicillin">
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Brand Name</mat-label>
            <input matInput formControlName="brand_name" placeholder="e.g. Amoxil">
          </mat-form-field>
        </div>
        <div class="two-col">
          <mat-form-field appearance="outline">
            <mat-label>Category</mat-label>
            <mat-select formControlName="category">
              <mat-option value="antibiotic">Antibiotic</mat-option>
              <mat-option value="analgesic">Analgesic / NSAID</mat-option>
              <mat-option value="ppi">PPI / Antacid</mat-option>
              <mat-option value="antiseptic">Antiseptic / Mouthwash</mat-option>
              <mat-option value="topical">Topical</mat-option>
              <mat-option value="vitamin">Vitamin / Supplement</mat-option>
              <mat-option value="other">Other</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Dosage Form</mat-label>
            <mat-select formControlName="dosage_form">
              <mat-option value="tablet">Tablet</mat-option>
              <mat-option value="capsule">Capsule</mat-option>
              <mat-option value="syrup">Syrup</mat-option>
              <mat-option value="injection">Injection</mat-option>
              <mat-option value="gel">Gel</mat-option>
              <mat-option value="mouthwash">Mouthwash</mat-option>
              <mat-option value="drops">Drops</mat-option>
              <mat-option value="cream">Cream</mat-option>
            </mat-select>
          </mat-form-field>
        </div>
        <div class="two-col">
          <mat-form-field appearance="outline">
            <mat-label>Strength</mat-label>
            <input matInput formControlName="strength" placeholder="e.g. 500mg">
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Default Duration (days)</mat-label>
            <input matInput type="number" formControlName="default_days" min="1">
          </mat-form-field>
        </div>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Default Dose / Instructions</mat-label>
          <input matInput formControlName="default_dose" placeholder="e.g. 1-0-1 after food">
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Notes (internal)</mat-label>
          <textarea matInput formControlName="notes" rows="2" placeholder="When to prescribe, contraindications..."></textarea>
        </mat-form-field>
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
    .dialog-form { display: flex; flex-direction: column; gap: 6px; min-width: 520px; padding-top: 8px; }
    .full-width { width: 100%; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  `]
})
export class RxMedicineDialog {
  dialogRef = inject(MatDialogRef<RxMedicineDialog>);
  data      = inject<RxMedicine | null>(MAT_DIALOG_DATA);
  private http = inject(HttpClient);
  private base = `${authApiConfig.baseUrl}/rx`;

  saving = false;
  form = new FormGroup({
    generic_name: new FormControl(this.data?.generic_name ?? '', [Validators.required]),
    brand_name:   new FormControl(this.data?.brand_name   ?? ''),
    category:    new FormControl(this.data?.category    ?? 'other', [Validators.required]),
    dosage_form:  new FormControl(this.data?.dosage_form  ?? 'tablet', [Validators.required]),
    strength:     new FormControl(this.data?.strength     ?? '', [Validators.required]),
    default_dose: new FormControl(this.data?.default_dose ?? ''),
    default_days: new FormControl(this.data?.default_days ?? null),
    notes:       new FormControl(this.data?.notes       ?? ''),
  });

  save() {
    if (this.form.invalid) return;
    this.saving = true;
    const body = this.form.value;
    const req = this.data?.id
      ? this.http.patch(`${this.base}/master/medicines/${this.data.id}`, body)
      : this.http.post(`${this.base}/master/medicines`, body);
    firstValueFrom(req).then(
      (r: any) => { this.saving = false; this.dialogRef.close(r.data ?? r); },
      ()       => { this.saving = false; }
    );
  }
}

// ── Procedure Form Dialog ────────────────────────────────────────────────────

@Component({
  selector: 'rx-procedure-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule],
  template: `
    <h2 mat-dialog-title>{{ data?.id ? 'Edit Procedure' : 'Add Procedure' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">
        <div class="two-col">
          <mat-form-field appearance="outline">
            <mat-label>Procedure Code</mat-label>
            <input matInput formControlName="procedure_code" placeholder="e.g. RCT-ACCESS">
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Service (SVC-ID)</mat-label>
            <input matInput formControlName="svc_id" placeholder="e.g. SVC-03">
          </mat-form-field>
        </div>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Procedure Name</mat-label>
          <input matInput formControlName="procedure_name" placeholder="e.g. Access opening and pulp extirpation">
        </mat-form-field>
        <div class="two-col">
          <mat-form-field appearance="outline">
            <mat-label>Step (for multi-visit)</mat-label>
            <input matInput type="number" formControlName="procedure_step" min="1" placeholder="Leave blank if single-visit">
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Follow-up (days)</mat-label>
            <input matInput type="number" formControlName="followup_days" min="1">
          </mat-form-field>
        </div>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Default Post-Care Notes</mat-label>
          <textarea matInput formControlName="default_notes" rows="3" placeholder="Instructions shown on prescription..."></textarea>
        </mat-form-field>
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
    .dialog-form { display: flex; flex-direction: column; gap: 6px; min-width: 520px; padding-top: 8px; }
    .full-width { width: 100%; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  `]
})
export class RxProcedureDialog {
  dialogRef = inject(MatDialogRef<RxProcedureDialog>);
  data      = inject<RxProcedure | null>(MAT_DIALOG_DATA);
  private http = inject(HttpClient);
  private base = `${authApiConfig.baseUrl}/rx`;

  saving = false;
  form = new FormGroup({
    procedure_code: new FormControl(this.data?.procedure_code ?? '', [Validators.required]),
    procedure_name: new FormControl(this.data?.procedure_name ?? '', [Validators.required]),
    svc_id:         new FormControl(this.data?.svc_id         ?? '', [Validators.required]),
    procedure_step: new FormControl(this.data?.procedure_step ?? null),
    followup_days:  new FormControl(this.data?.followup_days  ?? null),
    default_notes:  new FormControl(this.data?.default_notes  ?? ''),
  });

  save() {
    if (this.form.invalid) return;
    this.saving = true;
    const body = this.form.value;
    const req = this.data?.id
      ? this.http.patch(`${this.base}/master/procedures/${this.data.id}`, body)
      : this.http.post(`${this.base}/master/procedures`, body);
    firstValueFrom(req).then(
      (r: any) => { this.saving = false; this.dialogRef.close(r.data ?? r); },
      ()       => { this.saving = false; }
    );
  }
}

// ── Rx Master Page ───────────────────────────────────────────────────────────

@Component({
  selector: 'app-rx-master',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule],
  templateUrl: './rx-master.component.html',
  styleUrls: ['./rx-master.component.scss'],
})
export class RxMasterComponent implements OnInit {
  private http    = inject(HttpClient);
  private dialog  = inject(MatDialog);
  private snack   = inject(MatSnackBar);
  private cdr     = inject(ChangeDetectorRef);
  private base    = `${authApiConfig.baseUrl}/rx`;

  activeTab    = signal<'medicines' | 'procedures'>('medicines');
  medicines    = signal<RxMedicine[]>([]);
  procedures   = signal<RxProcedure[]>([]);
  loading      = signal(true);
  searchQuery  = '';

  ngOnInit() { this.loadAll(); }

  private async loadAll() {
    this.loading.set(true);
    try {
      const [meds, procs] = await Promise.all([
        firstValueFrom(this.http.get<any>(`${this.base}/master/medicines`)),
        firstValueFrom(this.http.get<any>(`${this.base}/master/procedures`)),
      ]);
      this.medicines.set(meds.data ?? meds ?? []);
      this.procedures.set(procs.data ?? procs ?? []);
    } catch {
      this.snack.open('Failed to load Rx master data', 'Dismiss', { duration: 3000 });
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }

  get filteredMedicines(): RxMedicine[] {
    const q = this.searchQuery.toLowerCase();
    if (!q) return this.medicines();
    return this.medicines().filter(
      m => m.generic_name.toLowerCase().includes(q) ||
           (m.brand_name ?? '').toLowerCase().includes(q) ||
           m.category.toLowerCase().includes(q)
    );
  }

  get filteredProcedures(): RxProcedure[] {
    const q = this.searchQuery.toLowerCase();
    if (!q) return this.procedures();
    return this.procedures().filter(
      p => p.procedure_name.toLowerCase().includes(q) ||
           p.procedure_code.toLowerCase().includes(q) ||
           p.svc_id.toLowerCase().includes(q)
    );
  }

  openAddMedicine() {
    this.dialog.open(RxMedicineDialog, { data: null, width: '600px', autoFocus: false })
      .afterClosed().subscribe(result => {
        if (result) {
          this.medicines.update(list => [...list, result]);
          this.cdr.markForCheck();
          this.snack.open('Medicine added', '', { duration: 2000 });
        }
      });
  }

  openEditMedicine(med: RxMedicine) {
    this.dialog.open(RxMedicineDialog, { data: med, width: '600px', autoFocus: false })
      .afterClosed().subscribe(result => {
        if (result) {
          this.medicines.update(list => list.map(m => m.id === med.id ? { ...m, ...result } : m));
          this.cdr.markForCheck();
          this.snack.open('Medicine updated', '', { duration: 2000 });
        }
      });
  }

  openAddProcedure() {
    this.dialog.open(RxProcedureDialog, { data: null, width: '600px', autoFocus: false })
      .afterClosed().subscribe(result => {
        if (result) {
          this.procedures.update(list => [...list, result]);
          this.cdr.markForCheck();
          this.snack.open('Procedure added', '', { duration: 2000 });
        }
      });
  }

  openEditProcedure(proc: RxProcedure) {
    this.dialog.open(RxProcedureDialog, { data: proc, width: '600px', autoFocus: false })
      .afterClosed().subscribe(result => {
        if (result) {
          this.procedures.update(list => list.map(p => p.id === proc.id ? { ...p, ...result } : p));
          this.cdr.markForCheck();
          this.snack.open('Procedure updated', '', { duration: 2000 });
        }
      });
  }

  categoryLabel(cat: string): string {
    const map: Record<string, string> = {
      antibiotic: 'Antibiotic', analgesic: 'Analgesic',
      ppi: 'PPI', antiseptic: 'Antiseptic', topical: 'Topical',
      vitamin: 'Vitamin', other: 'Other',
    };
    return map[cat] ?? cat;
  }

  trackById(_: number, item: { id: number }) { return item.id; }
}
