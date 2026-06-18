import { Component, Output, EventEmitter, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MarketingApiService } from '../../services/marketing-api.service';
import { ToastService } from '../../../../services/toast.service';
import { CallSlot } from '../../models/marketing.model';

/** Generate bookable slots and list the currently available ones. */
@Component({
  selector: 'mkt-slot-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule],
  templateUrl: './slot-picker.component.html',
  styleUrl: './slot-picker.component.scss',
})
export class SlotPickerComponent implements OnInit {
  @Output() generated = new EventEmitter<void>();

  private api   = inject(MarketingApiService);
  private toast = inject(ToastService);

  readonly slots = signal<CallSlot[]>([]);
  readonly busy = signal(false);

  from = '';
  to = '';
  duration = 30;
  startHour = 10;
  endHour = 18;

  ngOnInit(): void {
    this.loadSlots();
  }

  loadSlots(): void {
    this.api.listSlots().subscribe({
      next: (r) => this.slots.set(r.data),
      error: () => {},
    });
  }

  generate(): void {
    if (!this.from || !this.to) { this.toast.error('Pick a date range.'); return; }
    this.busy.set(true);
    this.api.generateSlots({
      from: new Date(this.from).toISOString(),
      to: new Date(this.to + 'T23:59:59').toISOString(),
      slot_duration_minutes: this.duration,
      daily_start_hour: this.startHour,
      daily_end_hour: this.endHour,
    }).subscribe({
      next: (r) => {
        this.busy.set(false);
        this.toast.success(`${r.created} slot${r.created === 1 ? '' : 's'} created.`);
        this.loadSlots();
        this.generated.emit();
      },
      error: (e) => { this.busy.set(false); this.toast.error(e?.error?.error ?? 'Could not generate slots.'); },
    });
  }
}
