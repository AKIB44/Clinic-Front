import { Component, Input, Output, EventEmitter, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TablerIconsModule } from 'angular-tabler-icons';
import { ViewerStore } from '../../store/viewer.store';

@Component({
  selector: 'df-annotation-layer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, TablerIconsModule],
  templateUrl: './df-annotation-layer.component.html',
  styleUrl: './df-annotation-layer.component.scss',
})
export class DfAnnotationLayerComponent {
  /** A just-picked surface point awaiting label text, or null. */
  @Input() pending: [number, number, number] | null = null;
  @Output() create = new EventEmitter<{ position: [number, number, number]; text: string }>();
  @Output() cancel = new EventEmitter<void>();

  readonly store = inject(ViewerStore);
  text = '';

  confirm(): void {
    if (!this.pending || !this.text.trim()) return;
    this.create.emit({ position: this.pending, text: this.text.trim() });
    this.text = '';
  }
  dismiss(): void { this.text = ''; this.cancel.emit(); }
  remove(id: string): void {
    this.store.annotations.set(this.store.annotations().filter((a) => a.id !== id));
  }
}
