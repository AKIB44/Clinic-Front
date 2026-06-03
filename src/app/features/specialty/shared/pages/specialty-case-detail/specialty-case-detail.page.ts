import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule, DatePipe, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TablerIconsModule } from 'angular-tabler-icons';
import { SpecialtyApiService } from '../../services/specialty-api.service';
import { DfSpecialtyCaseSummaryComponent } from '../../components/df-specialty-case-summary/df-specialty-case-summary.component';
import { DfSpecialtyCaseTimelineComponent } from '../../components/df-specialty-case-timeline/df-specialty-case-timeline.component';
import { SpecialtyCase, SpecialtyVisit, SpecialtyMilestone } from '../../models/specialty.model';

@Component({
  selector: 'app-specialty-case-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    DatePipe,
    TitleCasePipe,
    RouterLink,
    TablerIconsModule,
    DfSpecialtyCaseSummaryComponent,
    DfSpecialtyCaseTimelineComponent,
  ],
  templateUrl: './specialty-case-detail.page.html',
  styleUrl:    './specialty-case-detail.page.scss',
})
export class SpecialtyCaseDetailPage implements OnInit {
  private readonly route      = inject(ActivatedRoute);
  private readonly router     = inject(Router);
  private readonly specialtyApi = inject(SpecialtyApiService);
  private readonly cdr        = inject(ChangeDetectorRef);

  loading   = signal(true);
  errorMsg  = signal<string | null>(null);
  activeTab = signal<'overview' | 'timeline' | 'visits'>('overview');

  specialtyCase = signal<SpecialtyCase | null>(null);
  visits        = signal<SpecialtyVisit[]>([]);
  milestones    = signal<SpecialtyMilestone[]>([]);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.errorMsg.set('Case ID is missing.');
      this.loading.set(false);
      return;
    }
    this.loadCase(id);
  }

  private loadCase(id: string): void {
    this.loading.set(true);
    this.errorMsg.set(null);
    this.specialtyApi.getCase(id).subscribe({
      next: (detail) => {
        this.specialtyCase.set(detail.case);
        this.visits.set(detail.visits);
        this.milestones.set(detail.milestones);
        this.loading.set(false);
        this.cdr.markForCheck();
      },
      error: () => {
        this.errorMsg.set('Could not load specialty case.');
        this.loading.set(false);
        this.cdr.markForCheck();
      },
    });
  }

  goBack(): void {
    const patientId = this.specialtyCase()?.patient_id;
    if (patientId) {
      this.router.navigate(['/patients', patientId]);
    } else {
      this.router.navigate(['/patients']);
    }
  }
}
