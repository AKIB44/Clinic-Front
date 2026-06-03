import { Component, ChangeDetectionStrategy, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { EndoCaseStore } from '../../store/endo-case.store';

@Component({
  selector: 'app-endo-case-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, MatCardModule, MatTabsModule],
  templateUrl: './endo-case-detail.page.html',
  styleUrl: './endo-case-detail.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EndoCaseDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  protected readonly store = inject(EndoCaseStore);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('caseId')!;
    this.store.loadCase(id);
  }
}
