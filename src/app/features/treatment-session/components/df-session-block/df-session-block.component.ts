import {
  Component, input, signal, OnInit, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TablerIconsModule } from 'angular-tabler-icons';
import {
  trigger, state, style, transition, animate,
} from '@angular/animations';

export type BlockStatus = 'empty' | 'active' | 'complete' | 'warn';

@Component({
  selector: 'df-session-block',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TablerIconsModule],
  animations: [
    trigger('slide', [
      transition(':enter', [
        style({ height: 0, opacity: 0 }),
        animate('220ms cubic-bezier(.4,0,.2,1)', style({ height: '*', opacity: 1 })),
      ]),
      transition(':leave', [
        animate('180ms cubic-bezier(.4,0,.2,1)', style({ height: 0, opacity: 0 })),
      ]),
    ]),
  ],
  templateUrl: './df-session-block.component.html',
  styleUrl:    './df-session-block.component.scss',
})
export class DfSessionBlockComponent implements OnInit {
  title     = input.required<string>();
  icon      = input.required<string>();
  accent    = input<string>('#6366f1');
  status    = input<BlockStatus>('empty');
  badge     = input<string | null>(null);
  summary   = input<string | null>(null);
  startOpen = input<boolean>(false);

  readonly expanded = signal(false);

  ngOnInit(): void {
    this.expanded.set(this.startOpen());
  }

  toggle(): void {
    this.expanded.update(v => !v);
  }
}
