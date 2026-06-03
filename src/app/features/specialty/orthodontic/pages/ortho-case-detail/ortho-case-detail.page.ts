import { Component, ChangeDetectionStrategy, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { OrthoCaseStore } from '../../store/ortho-case.store';

@Component({
  selector: 'app-ortho-case-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, MatTabsModule, MatCardModule, MatChipsModule],
  templateUrl: './ortho-case-detail.page.html',
  styleUrl: './ortho-case-detail.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrthoCaseDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  protected readonly store = inject(OrthoCaseStore);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('caseId')!;
    this.store.loadCase(id);
  }
}
