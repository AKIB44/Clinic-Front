import { Component, ChangeDetectionStrategy, input, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { OrthoCaseStore } from '../../store/ortho-case.store';
import type { OrthoPhase } from '../../models/ortho-case.model';

@Component({
  selector: 'df-ortho-canvas-block',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatChipsModule, MatSelectModule, MatFormFieldModule],
  templateUrl: './df-ortho-canvas-block.component.html',
  styleUrl: './df-ortho-canvas-block.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DfOrthoCanvasBlockComponent implements OnInit {
  readonly caseId = input.required<string>();
  protected readonly store = inject(OrthoCaseStore);

  protected readonly phases: OrthoPhase[] = [
    'RECORDS', 'TREATMENT_PLANNING', 'BOND_UP', 'LEVELING_ALIGNING',
    'WORKING', 'FINISHING', 'DEBOND', 'RETENTION', 'RETENTION_REVIEW',
  ];

  ngOnInit(): void {
    this.store.loadCase(this.caseId());
  }

  protected transitionPhase(phase: string): void {
    this.store.transitionPhase(phase);
  }
}
