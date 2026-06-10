import { Component, Inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../../../../material.module';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface TenantActionData {
  action: 'extend' | 'revoke';
  clinicName: string;
}

@Component({
  selector: 'df-tenant-action-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, MaterialModule],
  templateUrl: './df-tenant-action-modal.component.html',
  styleUrl: './df-tenant-action-modal.component.scss',
})
export class DfTenantActionModalComponent {
  days = 7;
  reason = '';

  constructor(
    private ref: MatDialogRef<DfTenantActionModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: TenantActionData,
  ) {}

  get isExtend(): boolean { return this.data.action === 'extend'; }
  get valid(): boolean {
    return this.isExtend ? this.days >= 1 && this.days <= 30 : this.reason.trim().length > 0;
  }

  confirm(): void {
    if (!this.valid) return;
    this.ref.close(this.isExtend ? { days: this.days } : { reason: this.reason.trim() });
  }
  cancel(): void { this.ref.close(null); }
}
