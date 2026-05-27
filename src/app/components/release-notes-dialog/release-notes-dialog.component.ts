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
  templateUrl: './release-notes-dialog.component.html',
  styleUrl: './release-notes-dialog.component.scss',
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
