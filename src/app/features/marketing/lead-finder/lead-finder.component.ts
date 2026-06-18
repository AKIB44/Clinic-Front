import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MarketingLeadFinderStore } from '../store/marketing-lead-finder.store';
import { MarketingApiService } from '../services/marketing-api.service';
import { ToastService } from '../../../services/toast.service';
import { ScrapedLead, SCRAPED_STATUS_LABELS } from '../models/marketing.model';

@Component({
  selector: 'mkt-lead-finder',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule],
  templateUrl: './lead-finder.component.html',
  styleUrl: './lead-finder.component.scss',
})
export class LeadFinderComponent implements OnInit {
  readonly store = inject(MarketingLeadFinderStore);
  private api    = inject(MarketingApiService);
  private toast  = inject(ToastService);

  readonly statusLabels = SCRAPED_STATUS_LABELS;

  query = 'dental clinic';
  city = '';
  limit = 20;

  ngOnInit(): void {
    this.store.loadStatus();
    this.store.loadResults();
  }

  search(): void {
    if (!this.query.trim()) { this.toast.error('Enter a search term.'); return; }
    this.store.clearSelection();
    this.store.search(this.query.trim(), this.city.trim(), this.limit);
  }

  importSelected(): void {
    const ids = [...this.store.selected()];
    if (!ids.length) { this.toast.error('Select at least one result.'); return; }
    this.api.leadFinderImport(ids).subscribe({
      next: (r) => {
        this.toast.success(`${r.data.imported} lead${r.data.imported === 1 ? '' : 's'} imported into the pipeline.`);
        this.store.clearSelection();
        this.store.loadResults();
      },
      error: (e) => this.toast.error(e?.error?.error ?? 'Import failed.'),
    });
  }

  discard(r: ScrapedLead): void {
    this.api.leadFinderDiscard(r.id).subscribe({
      next: () => { this.store.removeLocal(r.id); this.toast.success('Discarded.'); },
      error: (e) => this.toast.error(e?.error?.error ?? 'Could not discard.'),
    });
  }
}
