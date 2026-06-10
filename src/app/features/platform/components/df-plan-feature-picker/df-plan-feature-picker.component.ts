import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PLAN_FEATURES } from '../../models/plan.model';

/** Multi-select chip picker over the known plan feature slugs. */
@Component({
  selector: 'df-plan-feature-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './df-plan-feature-picker.component.html',
  styleUrl: './df-plan-feature-picker.component.scss',
})
export class DfPlanFeaturePickerComponent {
  readonly features = PLAN_FEATURES;

  @Input() selected: string[] = [];
  @Output() selectedChange = new EventEmitter<string[]>();

  isOn(slug: string): boolean {
    return this.selected.includes(slug);
  }

  toggle(slug: string): void {
    this.selectedChange.emit(
      this.isOn(slug)
        ? this.selected.filter((s) => s !== slug)
        : [...this.selected, slug]
    );
  }
}
