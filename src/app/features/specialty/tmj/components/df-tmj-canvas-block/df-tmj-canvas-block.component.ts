import { Component, ChangeDetectionStrategy, input, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { TmjCaseStore } from '../../store/tmj-case.store';

@Component({
  selector: 'df-tmj-canvas-block',
  standalone: true,
  imports: [CommonModule, MatCardModule],
  templateUrl: './df-tmj-canvas-block.component.html',
  styleUrl: './df-tmj-canvas-block.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DfTmjCanvasBlockComponent implements OnInit {
  readonly caseId = input.required<string>();
  protected readonly store = inject(TmjCaseStore);

  ngOnInit(): void { this.store.loadCase(this.caseId()); }
}
