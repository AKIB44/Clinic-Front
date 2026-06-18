import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MarketingSegmentsStore } from '../../store/marketing-segments.store';
import { MarketingApiService } from '../../services/marketing-api.service';
import { ToastService } from '../../../../services/toast.service';
import { ConfirmService } from '../../../../core/ui/confirm.service';
import { PermissionService } from '../../../../core/rbac/permission.service';
import { SegmentBuilderComponent } from '../segment-builder/segment-builder.component';
import { Segment } from '../../models/marketing.model';

@Component({
  selector: 'mkt-segment-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MaterialModule, TablerIconsModule, SegmentBuilderComponent],
  templateUrl: './segment-list.component.html',
  styleUrl: './segment-list.component.scss',
})
export class SegmentListComponent implements OnInit {
  readonly store = inject(MarketingSegmentsStore);
  private api     = inject(MarketingApiService);
  private toast   = inject(ToastService);
  private confirm = inject(ConfirmService);
  private perms   = inject(PermissionService);

  readonly canCreate = this.perms.has('marketing.segment.create');
  readonly showBuilder = signal(false);

  ngOnInit(): void {
    this.store.load();
  }

  onSaved(s: Segment): void {
    this.showBuilder.set(false);
    this.store.prepend(s);
  }

  describe(s: Segment): string {
    const f = s.filter_json || {};
    const parts: string[] = [];
    if (f.city) parts.push(`city ~ ${f.city}`);
    if (f.gender) parts.push(f.gender);
    if (f.min_visits) parts.push(`≥${f.min_visits} visits`);
    if (f.last_visit_before) parts.push(`last visit before ${f.last_visit_before}`);
    if (f.last_visit_after) parts.push(`last visit after ${f.last_visit_after}`);
    if (f.has_email) parts.push('has email');
    return parts.join(' · ') || 'All patients';
  }

  remove(s: Segment): void {
    this.confirm.ask({
      title: `Delete "${s.name}"?`,
      body: 'Campaigns linked to this segment will lose their audience link.',
      confirmLabel: 'Delete', confirmColor: 'warn', icon: 'trash',
    }).subscribe((ok) => {
      if (!ok) return;
      this.api.deleteSegment(s.id).subscribe({
        next: () => { this.store.remove(s.id); this.toast.success('Segment deleted.'); },
        error: (e) => this.toast.error(e?.error?.error ?? 'Could not delete.'),
      });
    });
  }
}
