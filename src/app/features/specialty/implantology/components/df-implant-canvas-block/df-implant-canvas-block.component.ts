import { Component, ChangeDetectionStrategy, input, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { ImplantCaseStore } from '../../store/implant-case.store';

@Component({
  selector: 'df-implant-canvas-block',
  standalone: true,
  imports: [CommonModule, MatCardModule],
  templateUrl: './df-implant-canvas-block.component.html',
  styleUrl: './df-implant-canvas-block.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DfImplantCanvasBlockComponent implements OnInit {
  readonly caseId = input.required<string>();
  protected readonly store = inject(ImplantCaseStore);

  ngOnInit(): void { this.store.loadCase(this.caseId()); }
}
