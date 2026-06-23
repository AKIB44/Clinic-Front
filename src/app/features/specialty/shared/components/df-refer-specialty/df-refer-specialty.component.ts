import { Component, Input, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { TablerIconsModule } from 'angular-tabler-icons';
import { PermissionService } from '../../../../../core/rbac/permission.service';
import { ReferSpecialtyDialogComponent } from './refer-specialty-dialog.component';

/**
 * "Refer to specialty" — opens a picker dialog and deep-links to the chosen
 * specialty's case-create with the patient pre-selected. Self-gates on
 * `specialty.create` (renders nothing without it). Drop-in for the patient
 * record and the treatment session screen. Does not affect the existing manual
 * case-create flow (that path stays exactly as-is).
 */
@Component({
  selector: 'df-refer-specialty',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatButtonModule, TablerIconsModule],
  templateUrl: './df-refer-specialty.component.html',
  styleUrl: './df-refer-specialty.component.scss',
})
export class DfReferSpecialtyComponent {
  @Input({ required: true }) patientId!: string;
  @Input() patientName = '';
  @Input() flat = false;           // flat (primary) vs stroked button
  @Input() label = 'Refer to specialty';

  private dialog = inject(MatDialog);
  private router = inject(Router);
  private perms  = inject(PermissionService);

  readonly canRefer = this.perms.has('specialty.create');

  open(): void {
    if (!this.patientId) return;
    this.dialog.open(ReferSpecialtyDialogComponent, {
      data: { patientName: this.patientName },
      panelClass: 'refer-specialty-panel',
      autoFocus: false,
      maxWidth: '92vw',
    }).afterClosed().subscribe((seg?: string) => {
      if (seg) this.router.navigate(['/specialty', seg, 'cases', 'new'], { queryParams: { patientId: this.patientId } });
    });
  }
}
