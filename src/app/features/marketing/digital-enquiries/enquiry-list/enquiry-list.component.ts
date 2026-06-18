import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MaterialModule } from '../../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MarketingEnquiriesStore } from '../../store/marketing-enquiries.store';
import { MarketingApiService } from '../../services/marketing-api.service';
import { ToastService } from '../../../../services/toast.service';
import { PermissionService } from '../../../../core/rbac/permission.service';
import { DigitalEnquiry, EnquirySource, IngestKey } from '../../models/marketing.model';

@Component({
  selector: 'mkt-enquiry-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MaterialModule, TablerIconsModule],
  templateUrl: './enquiry-list.component.html',
  styleUrl: './enquiry-list.component.scss',
})
export class EnquiryListComponent implements OnInit {
  readonly store = inject(MarketingEnquiriesStore);
  private api     = inject(MarketingApiService);
  private router  = inject(Router);
  private toast   = inject(ToastService);
  private perms   = inject(PermissionService);

  readonly sources: EnquirySource[] = ['website', 'referral', 'social'];
  sourceFilter = '';

  readonly canEdit = this.perms.has('marketing.enquiry.edit');
  readonly ingestKey = signal<IngestKey | null>(null);
  readonly showKey = signal(false);
  readonly ingestPath = '/v1/marketing/enquiries/ingest';

  ngOnInit(): void {
    this.store.load();
  }

  applyFilter(): void {
    this.store.setFilters(this.sourceFilter ? { source: this.sourceFilter } : {});
  }

  open(e: DigitalEnquiry): void {
    this.router.navigate(['/marketing/enquiries', e.id]);
  }

  convert(e: DigitalEnquiry, ev: Event): void {
    ev.stopPropagation();
    this.api.convertEnquiry(e.id).subscribe({
      next: (r) => { this.store.upsert(r.data); this.toast.success('Converted to a pipeline lead.'); },
      error: (err) => this.toast.error(err?.error?.error ?? 'Could not convert enquiry.'),
    });
  }

  markDuplicate(e: DigitalEnquiry, ev: Event): void {
    ev.stopPropagation();
    this.api.markEnquiryDuplicate(e.id, true).subscribe({
      next: (r) => { this.store.upsert(r.data); this.toast.success('Marked as duplicate.'); },
      error: (err) => this.toast.error(err?.error?.error ?? 'Could not update enquiry.'),
    });
  }

  toggleKey(): void {
    this.showKey.set(!this.showKey());
    if (this.showKey() && !this.ingestKey()) {
      this.api.enquiryKey().subscribe({
        next: (r) => this.ingestKey.set(r.data),
        error: (e) => this.toast.error(e?.error?.error ?? 'Could not load ingest key.'),
      });
    }
  }

  rotateKey(): void {
    this.api.rotateEnquiryKey().subscribe({
      next: (r) => { this.ingestKey.set(r.data); this.toast.success('New key issued. Update your website form.'); },
      error: (e) => this.toast.error(e?.error?.error ?? 'Could not rotate key.'),
    });
  }

  copy(text: string): void {
    navigator.clipboard?.writeText(text).then(
      () => this.toast.success('Copied.'),
      () => this.toast.error('Copy failed.'),
    );
  }
}
