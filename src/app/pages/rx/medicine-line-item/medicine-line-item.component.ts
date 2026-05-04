import {
  Component, Input, Output, EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MedFormItem } from '../rx.interfaces';

export interface FieldChangeEvent {
  field: keyof MedFormItem;
  value: string;
}

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

  onField(field: keyof MedFormItem, e: Event): void {
    this.fieldChange.emit({ field, value: (e.target as HTMLInputElement).value });
  }
}
