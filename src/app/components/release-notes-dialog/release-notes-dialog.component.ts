import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MaterialModule } from '../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { ReleaseNote } from '../../services/release-notes.service';

@Component({
  selector: 'app-release-notes-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule],
  styles: [`
    .rn-header {
      display: flex; align-items: flex-start; gap: 14px;
      padding: 24px 24px 0;
    }
    .rn-icon-wrap {
      width: 44px; height: 44px; border-radius: 12px;
      background: linear-gradient(135deg, #1565c0, #1976d2);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .rn-titles { flex: 1; }
    .rn-badge {
      display: inline-block; font-size: .72rem; font-weight: 700;
      background: #e3f2fd; color: #1565c0; border-radius: 20px;
      padding: 2px 10px; margin-bottom: 6px; letter-spacing: .3px;
    }
    .rn-title { font-size: 1.15rem; font-weight: 700; color: #1a237e; line-height: 1.3; }
    .rn-body {
      padding: 18px 24px; max-height: 420px; overflow-y: auto;
      font-size: .9rem; color: #37474f; line-height: 1.75;
    }
    .rn-body ul { padding-left: 20px; margin: 0; }
    .rn-body li { margin-bottom: 6px; }
    .rn-body strong { color: #1565c0; }
    .rn-consent {
      display: flex; align-items: center; gap: 10px;
      background: #f8f9fa; border-top: 1px solid #e8eaf0;
      padding: 14px 24px; font-size: .82rem; color: #546e7a;
    }
    .rn-consent i-tabler { flex-shrink: 0; color: #1976d2; }
    .rn-actions { padding: 12px 24px 20px; display: flex; justify-content: flex-end; gap: 10px; }
  `],
  template: `
    <div class="rn-header">
      <div class="rn-icon-wrap">
        <i-tabler name="sparkles" size="22" style="color:#fff"></i-tabler>
      </div>
      <div class="rn-titles">
        <span class="rn-badge">v{{ data.version }}</span>
        <div class="rn-title">{{ data.title }}</div>
      </div>
    </div>

    <div class="rn-body" [innerHTML]="formattedBody"></div>

    <div class="rn-consent">
      <i-tabler name="info-circle" size="16"></i-tabler>
      <span>Please review the changes above. Clicking <strong>Got it</strong> confirms you've read this release note.</span>
    </div>

    <div class="rn-actions">
      <button mat-flat-button color="primary" (click)="dialogRef.close(true)">
        <i-tabler name="check" size="16" style="margin-right:6px"></i-tabler>
        Got it
      </button>
    </div>
  `,
})
export class ReleaseNotesDialogComponent {
  readonly dialogRef = inject(MatDialogRef<ReleaseNotesDialogComponent>);
  readonly data: ReleaseNote = inject(MAT_DIALOG_DATA);

  get formattedBody(): string {
    // Convert plain newlines to <br> and wrap lines starting with "-" as list items
    const lines = this.data.body.split('\n');
    const items = lines.filter(l => l.trim().startsWith('-'));
    const hasAllList = items.length > 0 && items.length === lines.filter(l => l.trim()).length;

    if (hasAllList) {
      const lis = items.map(l => `<li>${this.escape(l.replace(/^[\s-]+/, ''))}</li>`).join('');
      return `<ul>${lis}</ul>`;
    }
    return lines.map(l => this.escape(l)).join('<br>');
  }

  private escape(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
