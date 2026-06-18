import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MaterialModule } from '../../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MarketingCampaignsStore } from '../../store/marketing-campaigns.store';
import { MarketingApiService } from '../../services/marketing-api.service';
import { ToastService } from '../../../../services/toast.service';
import { CampaignGoal, CampaignChannel, CampaignStatus, CampaignUpsert, Segment, PromoCode } from '../../models/marketing.model';

interface CampaignFormModel {
  name: string;
  goal: CampaignGoal;
  channel: CampaignChannel;
  status: CampaignStatus;
  budget_rupees: number | null;
  start_date: string | null;
  end_date: string | null;
  segment_id: string | null;
  promo_code_id: string | null;
}

@Component({
  selector: 'campaign-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule],
  templateUrl: './campaign-form.component.html',
  styleUrl: './campaign-form.component.scss',
})
export class CampaignFormComponent implements OnInit {
  private route  = inject(ActivatedRoute);
  private router = inject(Router);
  private api    = inject(MarketingApiService);
  private store  = inject(MarketingCampaignsStore);
  private toast  = inject(ToastService);

  readonly goals:    CampaignGoal[]    = ['bookings', 'awareness', 'lead_gen'];
  readonly channels: CampaignChannel[] = ['whatsapp', 'instagram', 'facebook', 'offline'];
  readonly statuses: CampaignStatus[]  = ['draft', 'scheduled', 'active', 'completed', 'archived'];

  readonly id      = signal<string | null>(null);
  readonly saving  = signal(false);
  readonly loading = signal(false);
  readonly segments = signal<Segment[]>([]);
  readonly promoCodes = signal<PromoCode[]>([]);

  form: CampaignFormModel = {
    name: '', goal: 'bookings', channel: 'whatsapp', status: 'draft',
    budget_rupees: null, start_date: null, end_date: null,
    segment_id: null, promo_code_id: null,
  };

  get isEdit(): boolean { return this.id() !== null; }

  ngOnInit(): void {
    // Audience + promo options (fail silently if the user lacks the permission).
    this.api.listSegments().subscribe({ next: (r) => this.segments.set(r.data), error: () => {} });
    this.api.listPromoCodes().subscribe({ next: (r) => this.promoCodes.set(r.data), error: () => {} });

    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.id.set(id);
    this.loading.set(true);
    this.api.getCampaign(id).subscribe({
      next: (r) => {
        const c = r.data;
        this.form = {
          name: c.name, goal: c.goal, channel: c.channel, status: c.status,
          budget_rupees: c.budget_paise / 100,
          start_date: c.start_date, end_date: c.end_date,
          segment_id: c.segment_id, promo_code_id: c.promo_code_id,
        };
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.toast.error(e?.error?.error ?? 'Campaign not found.');
        this.router.navigate(['/marketing/campaigns']);
      },
    });
  }

  save(): void {
    if (!this.form.name.trim()) { this.toast.error('Campaign name is required.'); return; }
    const payload: CampaignUpsert = {
      name: this.form.name.trim(),
      goal: this.form.goal,
      channel: this.form.channel,
      status: this.form.status,
      budget_paise: Math.round((this.form.budget_rupees ?? 0) * 100),
      start_date: this.form.start_date || null,
      end_date: this.form.end_date || null,
      segment_id: this.form.segment_id || null,
      promo_code_id: this.form.promo_code_id || null,
    };
    this.saving.set(true);
    const req$ = this.isEdit
      ? this.api.updateCampaign(this.id()!, payload)
      : this.api.createCampaign(payload);
    req$.subscribe({
      next: (r) => {
        this.store.upsert(r.data);
        this.toast.success(this.isEdit ? 'Campaign updated.' : 'Campaign created.');
        this.router.navigate(['/marketing/campaigns']);
      },
      error: (e) => {
        this.saving.set(false);
        this.toast.error(e?.error?.error ?? 'Could not save campaign.');
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/marketing/campaigns']);
  }
}
