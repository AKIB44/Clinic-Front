import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { MaterialModule } from '../../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MarketingPipelineStore } from '../../store/marketing-pipeline.store';
import { MarketingApiService } from '../../services/marketing-api.service';
import { ToastService } from '../../../../services/toast.service';
import { PermissionService } from '../../../../core/rbac/permission.service';
import { PipelineLead, LeadStage, LeadSource, LeadUpsert } from '../../models/marketing.model';

const STAGE_LABELS: Record<LeadStage, string> = {
  new: 'New', marketing_qualified: 'Qualified', routed_to_caller: 'Routed', called: 'Called',
  demo_scheduled: 'Demo', trial: 'Trial', onboarded: 'Onboarded', lost: 'Lost',
};

@Component({
  selector: 'mkt-pipeline-board',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, DragDropModule, MaterialModule, TablerIconsModule],
  templateUrl: './pipeline-board.component.html',
  styleUrl: './pipeline-board.component.scss',
})
export class PipelineBoardComponent implements OnInit {
  readonly store = inject(MarketingPipelineStore);
  private api     = inject(MarketingApiService);
  private router  = inject(Router);
  private toast   = inject(ToastService);
  private perms   = inject(PermissionService);

  readonly stages = this.store.stages;
  readonly stageLabels = STAGE_LABELS;
  readonly sources: LeadSource[] = ['manual', 'digital', 'referral'];
  readonly dropListIds = this.stages.map((s) => `stage-${s}`);
  readonly canEdit = this.perms.has('marketing.pipeline.edit');

  readonly showCreate = signal(false);
  draft: LeadUpsert = { clinic_name: '', contact_name: '', contact_phone: '', city: '', stage: 'new', source: 'manual' };

  ngOnInit(): void {
    this.store.load();
  }

  forStage(stage: LeadStage): PipelineLead[] {
    return this.store.byStage()[stage];
  }

  open(lead: PipelineLead): void {
    this.router.navigate(['/marketing/pipeline', lead.id]);
  }

  drop(event: CdkDragDrop<PipelineLead[]>, target: LeadStage): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      return;
    }
    const lead = event.previousContainer.data[event.previousIndex];
    transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex);
    this.api.patchLeadStage(lead.id, target).subscribe({
      next: (r) => this.store.upsert(r.data),
      error: (e) => { this.store.load(); this.toast.error(e?.error?.error ?? 'Could not move lead.'); },
    });
  }

  openCreate(): void {
    this.draft = { clinic_name: '', contact_name: '', contact_phone: '', city: '', stage: 'new', source: 'manual' };
    this.showCreate.set(true);
  }

  saveDraft(): void {
    if (!this.draft.clinic_name.trim()) { this.toast.error('Clinic name is required.'); return; }
    this.api.createLead({ ...this.draft, clinic_name: this.draft.clinic_name.trim() }).subscribe({
      next: (r) => { this.store.upsert(r.data); this.showCreate.set(false); this.toast.success('Lead added.'); },
      error: (e) => this.toast.error(e?.error?.error ?? 'Could not add lead.'),
    });
  }
}
