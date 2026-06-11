import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MaterialModule } from '../../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { PatientFilesApiService } from '../../services/patient-files-api.service';
import { FileCacheService } from '../../services/file-cache.service';
import { ToastService } from '../../../../services/toast.service';
import { ConfirmService } from '../../../../core/ui/confirm.service';
import { DfFileViewerComponent } from '../../components/df-file-viewer/df-file-viewer.component';
import { PatientFile, KIND_META, humanSize } from '../../models/patient-file.model';

@Component({
  selector: 'patient-files',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MaterialModule, TablerIconsModule, DfFileViewerComponent],
  templateUrl: './patient-files.page.html',
  styleUrl: './patient-files.page.scss',
})
export class PatientFilesPage implements OnInit {
  private route   = inject(ActivatedRoute);
  private router  = inject(Router);
  private api     = inject(PatientFilesApiService);
  private cache   = inject(FileCacheService);
  private toast   = inject(ToastService);
  private confirm = inject(ConfirmService);

  readonly patientId = signal('');
  readonly files     = signal<PatientFile[]>([]);
  readonly selected  = signal<PatientFile | null>(null);
  readonly loading   = signal(false);
  readonly uploads   = signal<{ id: number; name: string; progress: number }[]>([]);
  readonly dragOver  = signal(false);
  private jobId = 0;

  readonly humanSize = humanSize;
  meta(f: PatientFile) { return KIND_META[f.kind]; }

  ngOnInit(): void {
    this.patientId.set(this.route.snapshot.paramMap.get('id') ?? '');
    this.load();
  }

  private load(): void {
    if (!this.patientId()) return;
    this.loading.set(true);
    this.api.list(this.patientId()).subscribe({
      next: (r) => { this.files.set(r.data); this.loading.set(false); if (!this.selected() && r.data.length) this.selected.set(r.data[0]); },
      error: () => { this.loading.set(false); this.toast.error('Could not load files.'); },
    });
  }

  select(f: PatientFile): void { this.selected.set(f); }

  back(): void { this.router.navigate(['/patients', this.patientId()]); }

  // ── Upload ──────────────────────────────────────────────────────────────────
  onPick(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    if (input.files?.length) this.upload(Array.from(input.files));
    input.value = '';
  }
  onDrop(ev: DragEvent): void {
    ev.preventDefault(); this.dragOver.set(false);
    if (ev.dataTransfer?.files?.length) this.upload(Array.from(ev.dataTransfer.files));
  }
  onDragOver(ev: DragEvent): void { ev.preventDefault(); this.dragOver.set(true); }
  onDragLeave(): void { this.dragOver.set(false); }

  private upload(list: File[]): void {
    const pid = this.patientId();
    for (const file of list) {
      const id = ++this.jobId;
      this.uploads.update(u => [...u, { id, name: file.name, progress: 0 }]);
      this.api.upload(pid, file).subscribe({
        next: (ev) => {
          if (ev.data) {
            this.files.update(fs => [ev.data!, ...fs]);
            if (!this.selected()) this.selected.set(ev.data!);
            this.uploads.update(u => u.filter(j => j.id !== id));
            this.toast.success(`${file.name} uploaded.`);
          } else {
            this.uploads.update(u => u.map(j => j.id === id ? { ...j, progress: ev.progress } : j));
          }
        },
        error: () => {
          this.uploads.update(u => u.filter(j => j.id !== id));
          this.toast.error(`Upload failed: ${file.name}`);
        },
      });
    }
  }

  remove(f: PatientFile, ev: Event): void {
    ev.stopPropagation();
    this.confirm.ask({
      title: 'Delete file?', body: `"${f.filename}" will be permanently removed.`,
      confirmLabel: 'Delete', confirmColor: 'warn', icon: 'trash',
    }).subscribe((ok) => {
      if (!ok) return;
      this.api.remove(this.patientId(), f.id).subscribe({
        next: () => {
          this.cache.evict(f.id);
          this.files.update(fs => fs.filter(x => x.id !== f.id));
          if (this.selected()?.id === f.id) this.selected.set(this.files()[0] ?? null);
          this.toast.success('File deleted.');
        },
        error: () => this.toast.error('Could not delete file.'),
      });
    });
  }
}
