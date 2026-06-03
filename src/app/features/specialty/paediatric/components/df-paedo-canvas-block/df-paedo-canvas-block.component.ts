import { Component, ChangeDetectionStrategy, input, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { PaedoCaseStore } from '../../store/paedo-case.store';

@Component({
  selector: 'df-paedo-canvas-block',
  standalone: true,
  imports: [CommonModule, MatCardModule],
  templateUrl: './df-paedo-canvas-block.component.html',
  styleUrl: './df-paedo-canvas-block.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DfPaedoCanvasBlockComponent implements OnInit {
  readonly caseId = input.required<string>();
  protected readonly store = inject(PaedoCaseStore);

  ngOnInit(): void { this.store.loadCase(this.caseId()); }
}
