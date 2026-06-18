import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem,
} from '@angular/cdk/drag-drop';
import { MaterialModule } from '../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MarketingCalendarStore } from '../store/marketing-calendar.store';
import { MarketingApiService } from '../services/marketing-api.service';
import { ToastService } from '../../../services/toast.service';
import { PermissionService } from '../../../core/rbac/permission.service';
import { CalendarEntry, CalendarChannel, CalendarStatus, CalendarUpsert } from '../models/marketing.model';

const COLUMN_LABELS: Record<CalendarStatus, string> = {
  draft: 'Draft', scheduled: 'Scheduled', posted: 'Posted', cancelled: 'Cancelled',
};

@Component({
  selector: 'content-calendar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, DragDropModule, MaterialModule, TablerIconsModule],
  templateUrl: './content-calendar.component.html',
  styleUrl: './content-calendar.component.scss',
})
export class ContentCalendarComponent implements OnInit {
  readonly store = inject(MarketingCalendarStore);
  private api    = inject(MarketingApiService);
  private toast  = inject(ToastService);
  private perms  = inject(PermissionService);

  readonly columns = this.store.columns;
  readonly columnLabels = COLUMN_LABELS;
  readonly channels: CalendarChannel[] = ['instagram', 'facebook', 'whatsapp_status', 'other'];

  readonly canCreate = this.perms.has('marketing.calendar.create');
  readonly canEdit   = this.perms.has('marketing.calendar.edit');
  readonly canDelete = this.perms.has('marketing.calendar.delete');

  readonly showCreate = signal(false);
  draft: CalendarUpsert = { channel: 'instagram', title: '', caption: '', scheduled_for: null, status: 'draft' };

  // CDK drop list ids, so columns can connect to each other.
  readonly dropListIds = this.columns.map((c) => `cal-col-${c}`);

  ngOnInit(): void {
    this.store.load();
  }

  entriesFor(status: CalendarStatus): CalendarEntry[] {
    return this.store.byStatus()[status];
  }

  drop(event: CdkDragDrop<CalendarEntry[]>, target: CalendarStatus): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      return;
    }
    const entry = event.previousContainer.data[event.previousIndex];
    transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex);
    // Optimistic; reconcile from server response.
    this.api.patchCalendarStatus(entry.id, target).subscribe({
      next: (r) => this.store.upsert(r.data),
      error: (e) => {
        this.store.load();
        this.toast.error(e?.error?.error ?? 'Could not move entry.');
      },
    });
  }

  openCreate(): void {
    this.draft = { channel: 'instagram', title: '', caption: '', scheduled_for: null, status: 'draft' };
    this.showCreate.set(true);
  }

  saveDraft(): void {
    if (!this.draft.title?.trim()) { this.toast.error('Title is required.'); return; }
    this.api.createCalendar({ ...this.draft, title: this.draft.title.trim() }).subscribe({
      next: (r) => {
        this.store.upsert(r.data);
        this.showCreate.set(false);
        this.toast.success('Calendar entry added.');
      },
      error: (e) => this.toast.error(e?.error?.error ?? 'Could not add entry.'),
    });
  }

  remove(entry: CalendarEntry): void {
    this.api.deleteCalendar(entry.id).subscribe({
      next: () => { this.store.remove(entry.id); this.toast.success('Entry removed.'); },
      error: (e) => this.toast.error(e?.error?.error ?? 'Could not remove entry.'),
    });
  }
}
