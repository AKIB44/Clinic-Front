import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from '../../../material.module';
import { BreakGlassService } from '../break-glass.service';

@Component({
  selector: 'app-break-glass-dialog',
  standalone: true,
  imports: [MaterialModule, FormsModule, ReactiveFormsModule],
  template: `
    <h2 mat-dialog-title>
      <mat-icon color="warn" style="vertical-align:middle;margin-right:8px">emergency</mat-icon>
      Emergency Break-Glass Access
    </h2>
    <mat-dialog-content>
      <p class="mat-body-2" style="color:#d32f2f">
        This action grants temporary elevated access and is fully audited.
        Only use in genuine emergencies.
      </p>
      <form [formGroup]="form">
        <mat-form-field appearance="outline" class="w-100 m-t-12">
          <mat-label>Reason (required)</mat-label>
          <textarea
            matInput
            formControlName="reason"
            rows="3"
            placeholder="Briefly explain why emergency access is needed"
          ></textarea>
          @if (f['reason'].touched && f['reason'].invalid) {
            <mat-error>Reason is required.</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="w-100 m-t-8">
          <mat-label>Duration</mat-label>
          <mat-select formControlName="durationMinutes">
            <mat-option [value]="15">15 minutes</mat-option>
            <mat-option [value]="30">30 minutes</mat-option>
            <mat-option [value]="60">60 minutes</mat-option>
          </mat-select>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close [disabled]="isSubmitting">Cancel</button>
      <button
        mat-flat-button
        color="warn"
        (click)="submit()"
        [disabled]="isSubmitting"
      >
        {{ isSubmitting ? 'Activating…' : 'Activate Break-Glass' }}
      </button>
    </mat-dialog-actions>
  `,
})
export class BreakGlassDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<BreakGlassDialogComponent>);
  private readonly bgService = inject(BreakGlassService);

  isSubmitting = false;
  error        = '';

  form = new FormGroup({
    reason:          new FormControl('', [Validators.required, Validators.minLength(10)]),
    durationMinutes: new FormControl<number>(30),
  });

  get f() { return this.form.controls; }

  async submit(): Promise<void> {
    if (this.form.invalid || this.isSubmitting) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSubmitting = true;
    try {
      await this.bgService.request({
        reason:          this.form.value.reason ?? '',
        durationMinutes: this.form.value.durationMinutes ?? 30,
      });
      this.dialogRef.close(true);
    } catch {
      this.error = 'Failed to activate break-glass access. Please try again.';
      this.isSubmitting = false;
    }
  }
}
