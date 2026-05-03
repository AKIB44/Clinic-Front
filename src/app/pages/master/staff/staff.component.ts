import {
  Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MatDialog, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { StaffService } from '../../../services/staff.service';
import { RbacService } from '../../../auth/rbac.service';
import { StaffUser } from '../../../models/clinic.model';

@Component({
  selector: 'staff-form-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule],
  template: `
    <h2 mat-dialog-title>{{ data?.id ? 'Edit Staff' : 'Add Staff Member' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">
        <div class="two-col">
          <mat-form-field appearance="outline">
            <mat-label>First Name</mat-label>
            <input matInput formControlName="first_name">
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Last Name</mat-label>
            <input matInput formControlName="last_name">
          </mat-form-field>
        </div>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Email</mat-label>
          <input matInput formControlName="email" type="email">
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Role</mat-label>
          <mat-select formControlName="role">
            <mat-option value="admin">Admin</mat-option>
            <mat-option value="doctor">Doctor</mat-option>
            <mat-option value="receptionist">Receptionist</mat-option>
          </mat-select>
        </mat-form-field>
        @if (!data?.id) {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Temporary Password</mat-label>
            <input matInput formControlName="password" type="password">
          </mat-form-field>
        }
        <mat-slide-toggle formControlName="is_active" color="primary">Active</mat-slide-toggle>
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
    .dialog-form { display: flex; flex-direction: column; gap: 4px; min-width: 440px; padding-top: 8px; }
    .full-width { width: 100%; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  `]
})
export class StaffFormDialog {
  dialogRef = inject(MatDialogRef<StaffFormDialog>);
  data      = inject<StaffUser | null>(MAT_DIALOG_DATA);
  private svc = inject(StaffService);

  saving = false;
  form = new FormGroup({
    first_name: new FormControl(this.data?.first_name ?? '', [Validators.required]),
    last_name:  new FormControl(this.data?.last_name  ?? '', [Validators.required]),
    email:      new FormControl(this.data?.email      ?? '', [Validators.required, Validators.email]),
    role:       new FormControl(this.data?.role       ?? '', [Validators.required]),
    password:   new FormControl(''),
    is_active:  new FormControl(this.data?.is_active  ?? true),
  });

  save() {
    if (this.form.invalid) return;
    this.saving = true;
    const payload: any = { ...this.form.value };
    if (!payload.password) delete payload.password;
    const req = this.data?.id
      ? this.svc.update(this.data.id, payload)
      : this.svc.create(payload);
    req.subscribe({
      next: (r: any) => { this.saving = false; this.dialogRef.close(r.user); },
      error: ()      => { this.saving = false; },
    });
  }
}

@Component({
  selector: 'app-staff-master',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MaterialModule, TablerIconsModule],
  templateUrl: './staff.component.html',
  styleUrls: ['./staff.component.scss'],
})
export class StaffMasterComponent implements OnInit {
  private svc    = inject(StaffService);
  private rbac   = inject(RbacService);
  private dialog = inject(MatDialog);
  private snack  = inject(MatSnackBar);
  private cdr    = inject(ChangeDetectorRef);

  staff: StaffUser[] = [];
  loading = true;
  displayedColumns = ['name', 'email', 'role', 'status', 'actions'];

  readonly roleLabel: Record<string, string> = {
    admin:  'Super Admin',
    doctor:       'Doctor',
    receptionist: 'Receptionist',
  };

  readonly roleClass: Record<string, string> = {
    admin:  'role-super',
    doctor:       'role-doctor',
    receptionist: 'role-receptionist',
  };

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.svc.list().subscribe({
      next: (r) => { this.staff = r.users; this.loading = false; this.cdr.markForCheck(); },
      error: ()  => { this.loading = false; this.cdr.markForCheck(); },
    });
  }

  openDialog(member?: StaffUser) {
    const ref = this.dialog.open(StaffFormDialog, { data: member ?? null, width: '520px' });
    ref.afterClosed().subscribe(result => {
      if (result) {
        this.snack.open(member ? 'Staff updated' : 'Staff member added', '', { duration: 3000 });
        this.load();
      }
    });
  }

  toggle(member: StaffUser) {
    this.svc.toggle(member.id, !member.is_active).subscribe(() => this.load());
  }
}
