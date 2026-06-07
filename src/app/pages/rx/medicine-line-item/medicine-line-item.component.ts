import {
  Component, Input, Output, EventEmitter,
  ChangeDetectionStrategy, signal, computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MedFormItem } from '../rx.interfaces';

export interface FieldChangeEvent {
  field: keyof MedFormItem;
  value: string;
}

const DOSAGE_PRESETS    = ['1-0-0', '0-0-1', '1-0-1', '1-1-1', '1-1-1-1', 'SOS', 'STAT'];
const FOOD_PRESETS      = ['After food', 'Before food', 'With food', 'Empty stomach', 'Any time'];
const DURATION_PRESETS  = [3, 5, 7, 10, 14, 21, 30];

@Component({
  selector: 'app-medicine-line-item',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './medicine-line-item.component.html',
  styleUrls: ['./medicine-line-item.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicineLineItemComponent {
  @Input()  item!:       MedFormItem;
  @Output() fieldChange = new EventEmitter<FieldChangeEvent>();
  @Output() remove      = new EventEmitter<void>();

  readonly dosagePresets   = DOSAGE_PRESETS;
  readonly foodPresets     = FOOD_PRESETS;
  readonly durationPresets = DURATION_PRESETS;

  onField(field: keyof MedFormItem, e: Event): void {
    this.fieldChange.emit({ field, value: (e.target as HTMLInputElement).value });
  }

  setField(field: keyof MedFormItem, value: string): void {
    this.fieldChange.emit({ field, value });
    // Smart auto-quantity when both dosage and duration are present.
    if (field === 'dosage' || field === 'duration') {
      const dosage   = field === 'dosage'   ? value : this.item.dosage;
      const duration = field === 'duration' ? value : this.item.duration;
      const qty = this.suggestQuantity(dosage, duration);
      if (qty) this.fieldChange.emit({ field: 'quantity', value: qty });
    }
  }

  /** "1-0-1" + "5 days" → "10 tabs" */
  private suggestQuantity(dosage: string, duration: string): string | null {
    const perDay = this.parseDosagePerDay(dosage);
    const days   = this.parseDays(duration);
    if (!perDay || !days) return null;
    const total = perDay * days;
    return `${total} tabs`;
  }

  private parseDosagePerDay(d: string): number | null {
    if (!d) return null;
    if (/^sos$/i.test(d.trim())) return 1;
    if (/^stat$/i.test(d.trim())) return 1;
    const parts = d.split('-').map(p => Number(p.trim()));
    if (parts.some(isNaN)) return null;
    return parts.reduce((a, b) => a + b, 0);
  }

  private parseDays(s: string): number | null {
    if (!s) return null;
    const m = s.match(/(\d+)/);
    return m ? Number(m[1]) : null;
  }

  isOn(field: keyof MedFormItem, value: string): boolean {
    return (this.item[field] as string)?.toLowerCase() === value.toLowerCase();
  }

  setDuration(days: number): void {
    this.setField('duration', `${days} days`);
  }
}
