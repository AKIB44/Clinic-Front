import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MaterialModule } from '../../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MarketingApiService } from '../../services/marketing-api.service';
import { ToastService } from '../../../../services/toast.service';
import { PermissionService } from '../../../../core/rbac/permission.service';
import { DigitalEnquiry } from '../../models/marketing.model';

@Component({
  selector: 'mkt-enquiry-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, MaterialModule, TablerIconsModule],
  templateUrl: './enquiry-detail.component.html',
  styleUrl: './enquiry-detail.component.scss',
})
export class EnquiryDetailComponent implements OnInit {
  private route  = inject(ActivatedRoute);
  private router = inject(Router);
  private api    = inject(MarketingApiService);
  private toast  = inject(ToastService);
  private perms  = inject(PermissionService);

  readonly enquiry = signal<DigitalEnquiry | null>(null);
  readonly loading = signal(true);
  readonly canEdit = this.perms.has('marketing.enquiry.edit');

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.api.getEnquiry(id).subscribe({
      next: (r) => { this.enquiry.set(r.data); this.loading.set(false); },
      error: (e) => {
        this.loading.set(false);
        this.toast.error(e?.error?.error ?? 'Enquiry not found.');
        this.router.navigate(['/marketing/enquiries']);
      },
    });
  }

  convert(): void {
    const e = this.enquiry(); if (!e) return;
    this.api.convertEnquiry(e.id).subscribe({
      next: (r) => { this.enquiry.set(r.data); this.toast.success('Converted to a pipeline lead.'); },
      error: (err) => this.toast.error(err?.error?.error ?? 'Could not convert enquiry.'),
    });
  }

  markDuplicate(): void {
    const e = this.enquiry(); if (!e) return;
    this.api.markEnquiryDuplicate(e.id, !e.is_duplicate).subscribe({
      next: (r) => { this.enquiry.set(r.data); this.toast.success('Updated.'); },
      error: (err) => this.toast.error(err?.error?.error ?? 'Could not update enquiry.'),
    });
  }

  openLead(): void {
    const e = this.enquiry();
    if (e?.lead_id) this.router.navigate(['/marketing/pipeline', e.lead_id]);
  }

  back(): void {
    this.router.navigate(['/marketing/enquiries']);
  }
}
