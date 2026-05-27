import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { Subject, debounceTime, takeUntil } from 'rxjs';
import { SessionStore } from '../../store/session.store';
import { SessionApiService } from '../../services/session-api.service';
import { Examination } from '../../models/session.model';
import { ToastService } from '../../../../services/toast.service';

const PAIN_TRIGGERS = [
  { value: 'cold',        label: 'Cold' },
  { value: 'hot',         label: 'Hot' },
  { value: 'sweet',       label: 'Sweet' },
  { value: 'biting',      label: 'Biting / Pressure' },
  { value: 'spontaneous', label: 'Spontaneous' },
  { value: 'none',        label: 'None' },
];

@Component({
  selector: 'df-examination-block',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule],
  templateUrl: './df-examination-block.component.html',
  styleUrl: './df-examination-block.component.scss',
})
export class DfExaminationBlockComponent implements OnInit, OnDestroy {
  readonly store = inject(SessionStore);
  private api    = inject(SessionApiService);
  private toast  = inject(ToastService);

  expanded = signal(true);
  saving   = signal(false);
  saved    = signal(false);

  chiefComplaint = '';
  painScore: number | null = null;
  painSite    = '';
  painTrigger = '';
  occlusionNotes = '';

  readonly triggers = PAIN_TRIGGERS;
  readonly painScaleValues = [0,1,2,3,4,5,6,7,8,9,10];

  private change$  = new Subject<void>();
  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    const exam = this.store.examination();
    this.chiefComplaint  = exam.chief_complaint ?? '';
    this.painScore       = exam.pain_score ?? null;
    this.painSite        = exam.pain_site ?? '';
    this.painTrigger     = exam.pain_trigger ?? '';
    this.occlusionNotes  = exam.occlusion_notes ?? '';

    this.change$
      .pipe(debounceTime(800), takeUntil(this.destroy$))
      .subscribe(() => this.save());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setPainScore(n: number): void {
    if (this.store.isSealed()) return;
    this.painScore = this.painScore === n ? null : n;
    this.onChange();
  }

  onChange(): void {
    this.saved.set(false);
    this.change$.next();
  }

  private save(): void {
    const sessionId = this.store.sessionId();
    if (!sessionId || this.store.isSealed()) return;

    this.saving.set(true);
    const payload: Partial<Examination> = {
      chief_complaint:      this.chiefComplaint,
      pain_score:           this.painScore,
      pain_site:            this.painSite || null,
      pain_trigger:         (this.painTrigger || null) as Examination['pain_trigger'],
      occlusion_notes:      this.occlusionNotes || null,
    };

    this.api.upsertExamination(sessionId, payload).subscribe({
      next: ({ examination }) => {
        this.saving.set(false);
        this.saved.set(true);
        this.store.setExamination(examination);
        setTimeout(() => this.saved.set(false), 2000);
      },
      error: () => {
        this.saving.set(false);
        this.toast.error('Examination could not be saved. Please try again.');
      },
    });
  }
}
