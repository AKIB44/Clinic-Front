import {
  Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ReleaseNotesService, ReleaseNote } from '../../../services/release-notes.service';
import { format, parseISO } from 'date-fns';

@Component({
  selector: 'app-release-notes-admin',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, MaterialModule, TablerIconsModule],
  templateUrl: './release-notes.component.html',
  styleUrls: ['./release-notes.component.scss'],
})
export class ReleaseNotesComponent implements OnInit {
  private svc  = inject(ReleaseNotesService);
  private snack = inject(MatSnackBar);
  private cdr  = inject(ChangeDetectorRef);

  notes   = signal<ReleaseNote[]>([]);
  loading = signal(false);
  saving  = signal(false);

  editingId: string | null = null;
  showForm = false;

  form = new FormGroup({
    version: new FormControl('', [Validators.required, Validators.maxLength(20)]),
    title:   new FormControl('', [Validators.required, Validators.maxLength(200)]),
    body:    new FormControl('', [Validators.required]),
    publish: new FormControl(false),
  });

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.svc.list().subscribe({
      next: r => { this.notes.set(r.notes); this.loading.set(false); this.cdr.markForCheck(); },
      error: () => { this.loading.set(false); this.cdr.markForCheck(); },
    });
  }

  openCreate() {
    this.editingId = null;
    this.form.reset({ version: '', title: '', body: '', publish: false });
    this.showForm = true;
    this.cdr.markForCheck();
  }

  openEdit(n: ReleaseNote) {
    this.editingId = n.id;
    this.form.reset({ version: n.version, title: n.title, body: n.body, publish: n.is_published });
    this.form.get('version')?.disable();
    this.showForm = true;
    this.cdr.markForCheck();
  }

  cancelForm() {
    this.showForm = false;
    this.editingId = null;
    this.form.get('version')?.enable();
    this.cdr.markForCheck();
  }

  save() {
    if (this.form.invalid || this.saving()) return;
    this.form.markAllAsTouched();
    const val = this.form.getRawValue();
    this.saving.set(true);

    const req$ = this.editingId
      ? this.svc.update(this.editingId, { title: val.title!, body: val.body!, publish: val.publish! })
      : this.svc.create({ version: val.version!, title: val.title!, body: val.body!, publish: val.publish! });

    req$.subscribe({
      next: () => {
        this.snack.open(this.editingId ? 'Release note updated.' : 'Release note created.', 'Dismiss', { duration: 3500, panelClass: 'snack-success' });
        this.saving.set(false);
        this.cancelForm();
        this.load();
      },
      error: (e) => {
        this.snack.open(e.error?.error || 'Failed to save.', 'Dismiss', { duration: 4000, panelClass: 'snack-error' });
        this.saving.set(false);
        this.cdr.markForCheck();
      },
    });
  }

  publish(n: ReleaseNote) {
    this.svc.update(n.id, { publish: true }).subscribe({
      next: () => {
        this.snack.open(`v${n.version} published — users will see it on next login.`, 'Dismiss', { duration: 4000, panelClass: 'snack-success' });
        this.load();
      },
      error: () => this.snack.open('Failed to publish.', 'Dismiss', { duration: 4000, panelClass: 'snack-error' }),
    });
  }

  delete(n: ReleaseNote) {
    this.svc.delete(n.id).subscribe({
      next: () => { this.snack.open('Draft deleted.', 'Dismiss', { duration: 3000 }); this.load(); },
      error: (e) => this.snack.open(e.error?.error || 'Cannot delete.', 'Dismiss', { duration: 4000, panelClass: 'snack-error' }),
    });
  }

  formatDate(iso?: string): string {
    if (!iso) return '—';
    try { return format(parseISO(iso), 'd MMM yyyy, h:mm a'); } catch { return iso; }
  }
}
