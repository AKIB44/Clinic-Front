import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MaterialModule } from '../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MarketingDashboardStore } from '../store/marketing-dashboard.store';

@Component({
  selector: 'marketing-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, MaterialModule, TablerIconsModule],
  templateUrl: './marketing-dashboard.component.html',
  styleUrl: './marketing-dashboard.component.scss',
})
export class MarketingDashboardComponent implements OnInit {
  readonly store = inject(MarketingDashboardStore);

  ngOnInit(): void {
    this.store.load();
  }

  inr(paise: number | null | undefined): string {
    if (paise == null) return '—';
    return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }
}
