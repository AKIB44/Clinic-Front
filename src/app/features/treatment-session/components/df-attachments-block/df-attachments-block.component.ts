import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { HttpClient } from '@angular/common/http';
import { SessionStore } from '../../store/session.store';
import { SessionApiService } from '../../services/session-api.service';
import { ToastService } from '../../../../services/toast.service';

const ACCEPT_TYPES = 'image/*,application/pdf,.doc,.docx,.xls,.xlsx';
const MAX_BYTES    = 50 * 1024 * 1024; // 50 MB

@Component({
  selector: 'df-attachments-block',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule],
  templateUrl: './df-attachments-block.component.html',
  styleUrl: './df-attachments-block.component.scss',
})
export class DfAttachmentsBlockComponent {
  readonly store    = inject(SessionStore);
  private api       = inject(SessionApiService);
  private toast     = inject(ToastService);
  private http      = inject(HttpClient);

  readonly accept   = ACCEPT_TYPES;
  readonly uploading = signal(false);
  readonly deleting  = signal<string | null>(null);

  onFilePicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    input.value = '';
    if (!file) return;

    if (file.size > MAX_BYTES) {
      this.toast.error('File too large. Maximum size is 50 MB.');
      return;
    }

    const sessionId = this.store.sessionId();
    if (!sessionId) return;

    this.uploading.set(true);

    this.api.signAttachment(sessionId, file.name, file.type || 'application/octet-stream').subscribe({
      next: ({ upload_url, s3_key }) => {
        this.http.put(upload_url, file, {
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          responseType: 'text',
        }).subscribe({
          next: () => {
            this.api.confirmAttachment(sessionId, {
              s3_key,
              filename:     file.name,
              content_type: file.type || 'application/octet-stream',
              file_size:    file.size,
            }).subscribe({
              next: ({ attachment }) => {
                this.uploading.set(false);
                this.store.addAttachment(attachment);
                this.toast.success('File uploaded.');
              },
              error: () => {
                this.uploading.set(false);
                this.toast.error('Upload confirmed but could not register file. Please refresh.');
              },
            });
          },
          error: () => {
            this.uploading.set(false);
            this.toast.error('Upload to storage failed. Please try again.');
          },
        });
      },
      error: () => {
        this.uploading.set(false);
        this.toast.error('Could not get upload URL. Please try again.');
      },
    });
  }

  deleteAttachment(id: string): void {
    const sessionId = this.store.sessionId();
    if (!sessionId) return;
    this.deleting.set(id);
    this.api.deleteAttachment(sessionId, id).subscribe({
      next: () => {
        this.deleting.set(null);
        this.store.removeAttachment(id);
        this.toast.warn('Attachment removed.');
      },
      error: () => {
        this.deleting.set(null);
        this.toast.error('Could not remove attachment. Please try again.');
      },
    });
  }

  iconFor(contentType: string): string {
    if (contentType.startsWith('image/')) return 'photo';
    if (contentType === 'application/pdf') return 'file-type-pdf';
    return 'file';
  }

  formatBytes(bytes: number | null): string {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
