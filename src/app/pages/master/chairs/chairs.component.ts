import {
  Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MatDialog, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ToastService } from '../../../services/toast.service';
import { ChairsService } from '../../../services/chairs.service';
import { RbacService } from '../../../auth/rbac.service';
import { Chair } from '../../../models/clinic.model';

// ── Dialog ────────────────────────────────────────────────────────────────────

@Component({
  selector: 'chair-form-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule],
  template: `
    <h2 mat-dialog-title>{{ data?.id ? 'Edit Chair' : 'Add Chair' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" style="display:flex;flex-direction:column;gap:12px;min-width:360px;padding-top:8px">
        <mat-form-field appearance="outline" style="width:100%">
          <mat-label>Chair Name / Number</mat-label>
          <input matInput formControlName="name" placeholder="e.g. Chair 1">
        </mat-form-field>
        <mat-slide-toggle formControlName="is_active" color="primary">Active</mat-slide-toggle>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-stroked-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" [disabled]="form.invalid || saving" (click)="save()">
        {{ saving ? 'Saving…' : 'Save' }}
      </button>
    </mat-dialog-actions>
  `
})
export class ChairFormDialog {
  dialogRef = inject(MatDialogRef<ChairFormDialog>);
  data      = inject<Chair | null>(MAT_DIALOG_DATA);
  private svc = inject(ChairsService);

  saving = false;
  form = new FormGroup({
    name:      new FormControl(this.data?.name      ?? '', [Validators.required]),
    is_active: new FormControl(this.data?.is_active ?? true),
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

// ── Page ──────────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-chairs-master',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MaterialModule, TablerIconsModule],
  templateUrl: './chairs.component.html',
  styleUrls: ['./chairs.component.scss'],
})
export class ChairsMasterComponent implements OnInit {
  private svc    = inject(ChairsService);
  private rbac   = inject(RbacService);
  private dialog = inject(MatDialog);
  private toast  = inject(ToastService);
  private cdr    = inject(ChangeDetectorRef);

  chairs: Chair[] = [];
  loading = true;

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.svc.list().subscribe({
      next: (r) => { this.chairs = r.chairs; this.loading = false; this.cdr.markForCheck(); },
      error: ()  => { this.loading = false; this.cdr.markForCheck(); },
    });
  }

  openDialog(chair?: Chair) {
    const ref = this.dialog.open(ChairFormDialog, { data: chair ?? null, width: '420px' });
    ref.afterClosed().subscribe(result => {
      if (result) {
        this.toast.success(chair ? 'Chair updated' : 'Chair added');
        this.load();
      }
    });
  }

  delete(chair: Chair) {
    this.svc.delete(chair.id).subscribe(() => {
      this.toast.success('Chair removed');
      this.load();
    });
  }
}
