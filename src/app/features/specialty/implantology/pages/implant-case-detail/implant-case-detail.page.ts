import { Component, ChangeDetectionStrategy, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { ImplantCaseStore } from '../../store/implant-case.store';

@Component({
  selector: 'app-implant-case-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, MatCardModule, MatTabsModule],
  templateUrl: './implant-case-detail.page.html',
  styleUrl: './implant-case-detail.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImplantCaseDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  protected readonly store = inject(ImplantCaseStore);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('caseId')!;
    this.store.loadCase(id);
  }
}
