import {
  Component, OnInit, OnDestroy, inject, ChangeDetectionStrategy
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MatDialog } from '@angular/material/dialog';
import { SessionStore } from '../store/session.store';
import { SessionApiService } from '../services/session-api.service';
import { DfSoapNotesComponent } from '../components/df-soap-notes/df-soap-notes.component';
import { DfServicesBlockComponent } from '../components/df-services-block/df-services-block.component';
import { DfExaminationBlockComponent } from '../components/df-examination-block/df-examination-block.component';
import { DfDiagnosisBlockComponent } from '../components/df-diagnosis-block/df-diagnosis-block.component';
import { DfEndTreatmentModalComponent } from '../components/df-end-treatment-modal/df-end-treatment-modal.component';
import { DfToothChartComponent } from '../components/df-tooth-chart/df-tooth-chart.component';
import { DfTreatmentPlanComponent } from '../components/df-treatment-plan/df-treatment-plan.component';
import { DfPrescriptionBlockComponent } from '../components/df-prescription-block/df-prescription-block.component';
import { DfAttachmentsBlockComponent } from '../components/df-attachments-block/df-attachments-block.component';
import { DfInvestigationsBlockComponent } from '../components/df-investigations-block/df-investigations-block.component';
import { forkJoin, of, switchMap } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Component({
  selector: 'df-session-canvas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, MaterialModule, TablerIconsModule,
    DfExaminationBlockComponent, DfDiagnosisBlockComponent,
    DfServicesBlockComponent, DfSoapNotesComponent,
    DfToothChartComponent, DfTreatmentPlanComponent,
    DfPrescriptionBlockComponent, DfAttachmentsBlockComponent,
    DfInvestigationsBlockComponent,
  ],
  templateUrl: './session-canvas.page.html',
  styleUrl: './session-canvas.page.scss',
})
export class SessionCanvasPage implements OnInit, OnDestroy {
  readonly store = inject(SessionStore);
  private route  = inject(ActivatedRoute);
  private router = inject(Router);
  private api    = inject(SessionApiService);
  private dialog = inject(MatDialog);

  ngOnInit(): void {
    const sessionId = this.route.snapshot.paramMap.get('sessionId') ?? '';
    this.store.loading.set(true);
    this.store.error.set(null);

    // Load all session data in parallel.
    // Examination and diagnoses are optional — a 404 or error returns empty rather
    // than crashing the entire forkJoin (e.g. before backend restart picks up new routes).
    forkJoin({
      hydration:   this.api.getSession(sessionId),
      services:    this.api.getServices(sessionId).pipe(catchError(() => of({ services: [] }))),
      examination: this.api.getExamination(sessionId).pipe(catchError(() => of({ examination: null }))),
      diagnoses:   this.api.getDiagnoses(sessionId).pipe(catchError(() => of({ diagnoses: [] }))),
      chart:       this.api.getChart(sessionId).pipe(catchError(() => of({ chart: null }))),
    }).pipe(
      switchMap(({ hydration, services, examination, diagnoses, chart }) => {
        this.store.hydrate({
          ...hydration,
          services:    services.services,
          examination: examination.examination,
          diagnoses:   diagnoses.diagnoses,
          chart:       chart.chart,
        });
        const patientId  = hydration.session.patient_id;
        const sid        = hydration.session.id;
        return forkJoin({
          plans:          this.api.getPlans(patientId).pipe(catchError(() => of({ plans: [] }))),
          prescriptions:  this.api.getPrescriptions(sid).pipe(catchError(() => of({ prescriptions: [] }))),
          attachments:    this.api.getAttachments(sid).pipe(catchError(() => of({ attachments: [] }))),
          investigations: this.api.getInvestigations(sid).pipe(catchError(() => of({ investigations: [] }))),
          labOrders:      this.api.getLabOrders(sid).pipe(catchError(() => of({ lab_orders: [] }))),
        });
      })
    ).subscribe({
      next: ({ plans, prescriptions, attachments, investigations, labOrders }) => {
        this.store.setPlans(plans.plans);
        this.store.setPrescriptions(prescriptions.prescriptions);
        this.store.setAttachments(attachments.attachments);
        this.store.setInvestigations(investigations.investigations);
        this.store.setLabOrders(labOrders.lab_orders);
        this.store.loading.set(false);
      },
      error: (err) => {
        this.store.loading.set(false);
        this.store.error.set(err?.error?.error ?? 'Failed to load session.');
      },
    });
  }

  ngOnDestroy(): void {
    this.store.reset();
  }

  goBack(): void {
    this.router.navigate(['/schedule']);
  }

  openEndTreatment(): void {
    this.dialog.open(DfEndTreatmentModalComponent, {
      width: '480px',
      disableClose: true,
    });
  }
}
