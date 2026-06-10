import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface ConfirmOptions {
  title: string;
  body: string;
  confirmLabel?: string;
  confirmColor?: 'primary' | 'accent' | 'warn';
  icon?: string;
  danger?: boolean;
}

/** Shared in-app confirmation dialog (replaces native window.confirm). */
@Component({
  selector: 'df-confirm-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MaterialModule, TablerIconsModule],
  template: `
    <div class="cf-wrap">
      <div class="cf-icon" [class.cf-icon--danger]="data.danger ?? (data.confirmColor === 'warn')">
        <i-tabler [name]="data.icon ?? 'alert-triangle'" size="26"></i-tabler>
      </div>
      <h2 mat-dialog-title class="cf-title">{{ data.title }}</h2>
      <mat-dialog-content>
        <p class="cf-body">{{ data.body }}</p>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-stroked-button mat-dialog-close>Cancel</button>
        <button mat-flat-button [color]="data.confirmColor ?? 'warn'" [mat-dialog-close]="true" cdkFocusInitial>
          {{ data.confirmLabel ?? 'Confirm' }}
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .cf-wrap { padding: 14px 18px 6px; min-width: 320px; max-width: 420px; }
    .cf-icon {
      width: 46px; height: 46px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      background: #eef6f3; color: #0d7a5f; margin-bottom: 10px;
    }
    .cf-icon--danger { background: #fef2f2; color: #b91c1c; }
    .cf-title { margin: 0 0 4px; font-size: 17px; font-weight: 700; color: #0f172a; }
    .cf-body  { color: #64748b; font-size: 14px; margin: 0; line-height: 1.5; }
  `],
})
export class ConfirmDialogComponent {
  readonly dialogRef = inject(MatDialogRef<ConfirmDialogComponent>);
  readonly data = inject<ConfirmOptions>(MAT_DIALOG_DATA);
}
