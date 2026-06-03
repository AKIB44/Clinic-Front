import { Component, ChangeDetectionStrategy, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { TmjCaseStore } from '../../store/tmj-case.store';

@Component({
  selector: 'app-tmj-case-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, MatCardModule, MatTabsModule],
  templateUrl: './tmj-case-detail.page.html',
  styleUrl: './tmj-case-detail.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TmjCaseDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  protected readonly store = inject(TmjCaseStore);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('caseId')!;
    this.store.loadCase(id);
  }
}
