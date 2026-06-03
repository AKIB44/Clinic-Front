import { Component, ChangeDetectionStrategy, input, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { EndoCaseStore } from '../../store/endo-case.store';

@Component({
  selector: 'df-endo-canvas-block',
  standalone: true,
  imports: [CommonModule, MatCardModule],
  templateUrl: './df-endo-canvas-block.component.html',
  styleUrl: './df-endo-canvas-block.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DfEndoCanvasBlockComponent implements OnInit {
  readonly caseId = input.required<string>();
  protected readonly store = inject(EndoCaseStore);

  ngOnInit(): void { this.store.loadCase(this.caseId()); }
}
