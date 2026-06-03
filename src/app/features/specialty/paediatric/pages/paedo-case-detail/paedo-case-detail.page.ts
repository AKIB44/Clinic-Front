import { Component, ChangeDetectionStrategy, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { PaedoCaseStore } from '../../store/paedo-case.store';

@Component({
  selector: 'app-paedo-case-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, MatCardModule, MatTabsModule],
  templateUrl: './paedo-case-detail.page.html',
  styleUrl: './paedo-case-detail.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaedoCaseDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  protected readonly store = inject(PaedoCaseStore);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('caseId')!;
    this.store.loadCase(id);
  }
}
