import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MaterialModule } from '../../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { PlatformStore } from '../../store/platform.store';
import { PlatformApiService } from '../../services/platform-api.service';
import { ToastService } from '../../../../services/toast.service';
import { DfPlanFeaturePickerComponent } from '../../components/df-plan-feature-picker/df-plan-feature-picker.component';
import { SubscriptionPlan, PlanUpsert, BillingCycle } from '../../models/plan.model';

interface PlanForm {
  slug: string;
  display_name: string;
  description: string;
  price_monthly_rupees: number | null;
  billing_cycle: BillingCycle;
  gst_pct: number;
  max_staff: number | null;
  max_patients: number | null;
  max_daily_appointments: number | null;
  max_storage_gb: number | null;
  features_included: string[];
  is_active: boolean;
  is_visible: boolean;
  is_custom: boolean;
  trial_days: number;
  grace_period_days: number;
}

@Component({
  selector: 'platform-plan-edit',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule, DfPlanFeaturePickerComponent],
  templateUrl: './platform-plan-edit.page.html',
  styleUrl: './platform-plan-edit.page.scss',
})
export class PlatformPlanEditPage implements OnInit {
  private route  = inject(ActivatedRoute);
  private router = inject(Router);
  private api    = inject(PlatformApiService);
  private store  = inject(PlatformStore);
  private toast  = inject(ToastService);

  readonly planId  = signal<string | null>(null);
  readonly loading = signal(false);
  readonly saving  = signal(false);
  readonly isEdit  = signal(false);

  form: PlanForm = {
    slug: '', display_name: '', description: '',
    price_monthly_rupees: null, billing_cycle: 'MONTHLY', gst_pct: 18,
    max_staff: null, max_patients: null, max_daily_appointments: null, max_storage_gb: null,
    features_included: [],
    is_active: true, is_visible: true, is_custom: false,
    trial_days: 14, grace_period_days: 7,
  };

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return; // create mode
    this.planId.set(id);
    this.isEdit.set(true);
    this.loading.set(true);
    // No GET /plans/:id endpoint — load the list and pick the row (works on deep-link).
    this.api.listPlans().subscribe({
      next: (r) => {
        this.store.plans.set(r.data);
        const p = r.data.find((x) => x.id === id);
        if (p) this.populate(p);
        else this.toast.error('Plan not found.');
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.toast.error('Failed to load plan.'); },
    });
  }

  private populate(p: SubscriptionPlan): void {
    this.form = {
      slug: p.slug,
      display_name: p.display_name,
      description: p.description ?? '',
      price_monthly_rupees: p.price_monthly_paise / 100,
      billing_cycle: p.billing_cycle,
      gst_pct: p.gst_pct,
      max_staff: p.max_staff,
      max_patients: p.max_patients,
      max_daily_appointments: p.max_daily_appointments,
      max_storage_gb: p.max_storage_gb,
      features_included: [...p.features_included],
      is_active: p.is_active,
      is_visible: p.is_visible,
      is_custom: p.is_custom,
      trial_days: p.trial_days,
      grace_period_days: p.grace_period_days,
    };
  }

  get valid(): boolean {
    return !!this.form.display_name.trim()
      && this.form.price_monthly_rupees != null && this.form.price_monthly_rupees >= 0
      && (this.isEdit() || /^[a-z0-9_]+$/.test(this.form.slug.trim()));
  }

  private toPayload(): PlanUpsert {
    const f = this.form;
    return {
      ...(this.isEdit() ? {} : { slug: f.slug.trim() }),
      display_name: f.display_name.trim(),
      description: f.description.trim() || null,
      price_monthly_paise: Math.round((f.price_monthly_rupees ?? 0) * 100),
      billing_cycle: f.billing_cycle,
      gst_pct: f.gst_pct,
      max_staff: f.max_staff,
      max_patients: f.max_patients,
      max_daily_appointments: f.max_daily_appointments,
      max_storage_gb: f.max_storage_gb,
      features_included: f.features_included,
      is_active: f.is_active,
      is_visible: f.is_visible,
      is_custom: f.is_custom,
      trial_days: f.trial_days,
      grace_period_days: f.grace_period_days,
    };
  }

  save(): void {
    if (!this.valid || this.saving()) return;
    this.saving.set(true);
    const payload = this.toPayload();
    const id = this.planId();
    const req$ = this.isEdit() && id
      ? this.api.updatePlan(id, payload)
      : this.api.createPlan(payload);

    req$.subscribe({
      next: (r) => {
        this.saving.set(false);
        this.store.upsert(r.data);
        this.toast.success(this.isEdit() ? 'Plan updated.' : 'Plan created.');
        this.router.navigate(['/platform/plans']);
      },
      error: (e) => {
        this.saving.set(false);
        this.toast.error(e?.error?.error ?? 'Could not save plan.');
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/platform/plans']);
  }

  onFeatures(slugs: string[]): void {
    this.form.features_included = slugs;
  }
}
