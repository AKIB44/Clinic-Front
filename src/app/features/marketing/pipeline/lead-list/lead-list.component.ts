import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MaterialModule } from '../../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MarketingPipelineStore } from '../../store/marketing-pipeline.store';
import { MarketingApiService } from '../../services/marketing-api.service';
import { ToastService } from '../../../../services/toast.service';
import { PermissionService } from '../../../../core/rbac/permission.service';
import { PipelineLead, LeadStage, LeadSource, LeadUpsert } from '../../models/marketing.model';

const STAGE_LABELS: Record<LeadStage, string> = {
  new: 'New', marketing_qualified: 'Qualified', routed_to_caller: 'Routed to caller',
  called: 'Called', demo_scheduled: 'Demo scheduled', trial: 'Trial',
  onboarded: 'Onboarded', lost: 'Lost',
};

@Component({
  selector: 'mkt-lead-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule],
  templateUrl: './lead-list.component.html',
  styleUrl: './lead-list.component.scss',
})
export class LeadListComponent implements OnInit {
  readonly store = inject(MarketingPipelineStore);
  private api     = inject(MarketingApiService);
  private router  = inject(Router);
  private toast   = inject(ToastService);
  private perms   = inject(PermissionService);

  readonly stages = this.store.stages;
  readonly stageLabels = STAGE_LABELS;
  readonly sources: LeadSource[] = ['manual', 'digital', 'referral'];
  readonly canEdit = this.perms.has('marketing.pipeline.edit');

  stageFilter = '';
  readonly showCreate = signal(false);
  draft: LeadUpsert = { clinic_name: '', contact_name: '', contact_phone: '', city: '', stage: 'new', source: 'manual' };

  ngOnInit(): void {
    this.store.load();
  }

  applyFilter(): void {
    this.store.setFilters(this.stageFilter ? { stage: this.stageFilter } : {});
  }

  open(lead: PipelineLead): void {
    this.router.navigate(['/marketing/pipeline', lead.id]);
  }

  openCreate(): void {
    this.draft = { clinic_name: '', contact_name: '', contact_phone: '', city: '', stage: 'new', source: 'manual' };
    this.showCreate.set(true);
  }

  saveDraft(): void {
    if (!this.draft.clinic_name.trim()) { this.toast.error('Clinic name is required.'); return; }
    this.api.createLead({ ...this.draft, clinic_name: this.draft.clinic_name.trim() }).subscribe({
      next: (r) => {
        this.store.upsert(r.data);
        this.showCreate.set(false);
        this.toast.success('Lead added.');
      },
      error: (e) => this.toast.error(e?.error?.error ?? 'Could not add lead.'),
    });
  }
}
