import { Component, Output, EventEmitter, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MarketingApiService } from '../../services/marketing-api.service';
import { ToastService } from '../../../../services/toast.service';
import { Segment, SegmentFilter, SegmentPreview } from '../../models/marketing.model';

@Component({
  selector: 'mkt-segment-builder',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule],
  templateUrl: './segment-builder.component.html',
  styleUrl: './segment-builder.component.scss',
})
export class SegmentBuilderComponent {
  @Output() saved = new EventEmitter<Segment>();
  @Output() cancelled = new EventEmitter<void>();

  private api   = inject(MarketingApiService);
  private toast = inject(ToastService);

  readonly preview = signal<SegmentPreview | null>(null);
  readonly previewing = signal(false);
  readonly saving = signal(false);

  name = '';
  city = '';
  gender: '' | 'male' | 'female' | 'other' = '';
  hasEmail = false;
  minVisits: number | null = null;
  lastVisitBefore = '';
  lastVisitAfter = '';

  private filter(): SegmentFilter {
    return {
      city: this.city.trim() || null,
      gender: this.gender || null,
      has_email: this.hasEmail || undefined,
      min_visits: this.minVisits ?? null,
      last_visit_before: this.lastVisitBefore || null,
      last_visit_after: this.lastVisitAfter || null,
    };
  }

  runPreview(): void {
    this.previewing.set(true);
    this.api.previewSegment(this.filter()).subscribe({
      next: (r) => { this.preview.set(r.data); this.previewing.set(false); },
      error: (e) => { this.previewing.set(false); this.toast.error(e?.error?.error ?? 'Preview failed.'); },
    });
  }

  save(): void {
    if (!this.name.trim()) { this.toast.error('Name the segment.'); return; }
    this.saving.set(true);
    this.api.createSegment(this.name.trim(), this.filter()).subscribe({
      next: (r) => { this.saving.set(false); this.toast.success('Segment saved.'); this.saved.emit(r.data); },
      error: (e) => { this.saving.set(false); this.toast.error(e?.error?.error ?? 'Could not save segment.'); },
    });
  }
}
