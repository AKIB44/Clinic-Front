import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MarketingApiService } from '../../services/marketing-api.service';
import { ToastService } from '../../../../services/toast.service';
import { ConfirmService } from '../../../../core/ui/confirm.service';
import { PermissionService } from '../../../../core/rbac/permission.service';
import { PitchDocument } from '../../models/marketing.model';

@Component({
  selector: 'mkt-pitch-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule],
  templateUrl: './pitch-list.component.html',
  styleUrl: './pitch-list.component.scss',
})
export class PitchListComponent implements OnInit {
  private api     = inject(MarketingApiService);
  private toast   = inject(ToastService);
  private confirm = inject(ConfirmService);
  private perms   = inject(PermissionService);

  readonly docs = signal<PitchDocument[]>([]);
  readonly loading = signal(false);
  readonly showUpload = signal(false);
  readonly uploading = signal(false);

  readonly canEdit = this.perms.has('marketing.pitch.edit');

  title = '';
  version = 'v1';
  file: File | null = null;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.listPitchDocs().subscribe({
      next: (r) => { this.docs.set(r.data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  onFile(ev: Event): void {
    this.file = (ev.target as HTMLInputElement).files?.[0] ?? null;
  }

  upload(): void {
    if (!this.title.trim()) { this.toast.error('Title is required.'); return; }
    if (!this.file) { this.toast.error('Choose a file.'); return; }
    const fd = new FormData();
    fd.append('title', this.title.trim());
    fd.append('version', this.version.trim() || 'v1');
    fd.append('file', this.file);
    this.uploading.set(true);
    this.api.uploadPitchDoc(fd).subscribe({
      next: (r) => {
        this.docs.set([r.data, ...this.docs()]);
        this.showUpload.set(false); this.uploading.set(false);
        this.title = ''; this.version = 'v1'; this.file = null;
        this.toast.success('Pitch uploaded.');
      },
      error: (e) => { this.uploading.set(false); this.toast.error(e?.error?.error ?? 'Upload failed.'); },
    });
  }

  download(d: PitchDocument): void {
    this.api.pitchDownloadUrl(d.id).subscribe({
      next: (r) => window.open(r.data.url, '_blank'),
      error: (e) => this.toast.error(e?.error?.error ?? 'Download unavailable.'),
    });
  }

  remove(d: PitchDocument): void {
    this.confirm.ask({
      title: `Delete "${d.title}"?`, body: 'This removes the pitch document.',
      confirmLabel: 'Delete', confirmColor: 'warn', icon: 'trash',
    }).subscribe((ok) => {
      if (!ok) return;
      this.api.deletePitchDoc(d.id).subscribe({
        next: () => { this.docs.set(this.docs().filter((x) => x.id !== d.id)); this.toast.success('Deleted.'); },
        error: (e) => this.toast.error(e?.error?.error ?? 'Could not delete.'),
      });
    });
  }
}
