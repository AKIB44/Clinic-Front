import {
  Component, OnInit, inject, signal, computed, ChangeDetectionStrategy, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { MaterialModule } from '../../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { SessionStore } from '../../store/session.store';
import { SessionApiService } from '../../services/session-api.service';
import { ToastService } from '../../../../services/toast.service';
import { RxMasterService } from '../../../../services/rx-master.service';
import { PrescriptionService } from '../../../../services/prescription.service';
import { MedicineSearchComponent } from '../../.././../pages/rx/medicine-search/medicine-search.component';
import { MedicineLineItemComponent, FieldChangeEvent } from '../../../../pages/rx/medicine-line-item/medicine-line-item.component';
import { MedFormItem, RxMedicine } from '../../../../pages/rx/rx.interfaces';
import { Prescription, ServicePerformed } from '../../models/session.model';
import { ClinicServicesService } from '../../../../services/clinic-services.service';
import { firstValueFrom } from 'rxjs';

interface PdfState {
  generating: boolean;
  url: string | null;
  error: string | null;
}

const IDLE: PdfState = { generating: false, url: null, error: null };

@Component({
  selector: 'df-prescription-block',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, ReactiveFormsModule, MaterialModule, TablerIconsModule,
    MedicineSearchComponent, MedicineLineItemComponent,
  ],
  templateUrl: './df-prescription-block.component.html',
  styleUrl: './df-prescription-block.component.scss',
})
export class DfPrescriptionBlockComponent implements OnInit {
  readonly store  = inject(SessionStore);
  private api     = inject(SessionApiService);
  private toast   = inject(ToastService);
  private master  = inject(RxMasterService);
  private rxSvc   = inject(PrescriptionService);
  private clinicSvc = inject(ClinicServicesService);
  private fb      = inject(FormBuilder);
  private cdr     = inject(ChangeDetectorRef);

  readonly showForm  = signal(false);
  readonly saving    = signal(false);
  readonly loading   = signal(false);
  readonly formError = signal<string | null>(null);
  readonly medicines = signal<MedFormItem[]>([]);
  readonly procedureLabel = signal('');

  readonly activeService = computed(() =>
    this.store.services().find(s => s.status === 'IN_PROGRESS' || s.status === 'COMPLETED')
    ?? this.store.services()[0]
  );

  // Per-prescription PDF state: key = prescription UUID
  readonly pdfStates = signal<Record<string, PdfState>>({});

  form!: FormGroup;

  ngOnInit(): void {
    this.form = this.fb.group({
      diagnosis:      ['', [Validators.required, Validators.maxLength(500)]],
      clinical_notes: ['', [Validators.maxLength(5000)]],
    });
    this._initPdfStates();
  }

  private _initPdfStates(): void {
    const init: Record<string, PdfState> = {};
    for (const rx of this.store.prescriptions()) {
      init[rx.id] = { ...IDLE };
    }
    this.pdfStates.set(init);
  }

  pdfState(rxId: string): PdfState {
    return this.pdfStates()[rxId] ?? IDLE;
  }

  private _patch(rxId: string, patch: Partial<PdfState>): void {
    this.pdfStates.update(s => ({
      ...s,
      [rxId]: { ...(s[rxId] ?? IDLE), ...patch },
    }));
    this.cdr.markForCheck();
  }

  async generatePdf(rx: Prescription): Promise<void> {
    if (!rx.id || this.pdfState(rx.id).generating) return;

    this._patch(rx.id, { generating: true, error: null, url: null });

    try {
      // generateSync: single request → returns presigned URL directly, no polling
      const url = await this.rxSvc.generateSync(rx.id);
      this._patch(rx.id, { generating: false, url });
      this.store.setPrescriptions(
        this.store.prescriptions().map(p =>
          p.id === rx.id ? { ...p, pdf_generated: true } : p
        )
      );
      this.toast.success(`PDF ready — ${rx.prescription_no}`);
    } catch {
      this._patch(rx.id, { generating: false, error: 'PDF generation failed — retry.' });
      this.toast.error('PDF generation failed.');
    }
  }

  async viewPdf(rx: Prescription): Promise<void> {
    if (!rx.id) return;
    const cached = this.pdfState(rx.id).url;
    if (cached) { window.open(cached, '_blank'); return; }

    this._patch(rx.id, { generating: true, error: null });
    try {
      const result = await this.rxSvc.getPdfUrl(rx.id as any);
      const url = result.url;
      if (!url) throw new Error('URL not available');
      this._patch(rx.id, { generating: false, url });
      window.open(url, '_blank');
    } catch {
      this._patch(rx.id, { generating: false, error: 'Could not load PDF.' });
      this.toast.error('Could not load PDF URL.');
    }
  }

  shareOnWhatsApp(rx: Prescription): void {
    const url = this.pdfState(rx.id).url;
    const patient = this.store.patient();
    if (!url || !patient) return;
    const phone = patient.phone?.replace(/\D/g, '') ?? '';
    const msg = `Dear ${patient.name}, your prescription ${rx.prescription_no} from DentaFlow is ready. View / download: ${url}`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  openForm(): void {
    this.form.reset({ diagnosis: '', clinical_notes: '' });
    this.medicines.set([]);
    this.formError.set(null);

    const firstService = this.activeService();
    this.procedureLabel.set(this.serviceDisplayName(firstService));
    void this.resolveProcedureLabel(firstService);

    if (firstService?.catalog_item_id) {
      this.loading.set(true);
      this.master.getDefaults(firstService.catalog_item_id).then(defaults => {
        this.loading.set(false);
        this.medicines.set(defaults.medicines.map(m => this.toFormItem(m)));
      }).catch(() => this.loading.set(false));
    }

    this.showForm.set(true);
  }

  cancelForm(): void {
    this.showForm.set(false);
    this.formError.set(null);
  }

  addMedicine(med: RxMedicine): void {
    if (this.medicines().some(m => m.id === med.id)) return;
    this.medicines.update(list => [...list, this.toFormItem(med)]);
  }

  removeMedicine(id: number): void {
    this.medicines.update(list => list.filter(m => m.id !== id));
  }

  updateMedicineField(id: number, event: FieldChangeEvent): void {
    this.medicines.update(list =>
      list.map(m => m.id === id ? { ...m, [event.field]: event.value } : m)
    );
  }

  trackMedById(_: number, m: MedFormItem): number { return m.id; }

  savePrescription(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    if (!this.medicines().length) {
      this.formError.set('Add at least one medication.');
      return;
    }

    const sessionId = this.store.sessionId();
    if (!sessionId) return;

    this.saving.set(true);
    this.formError.set(null);

    this.api.addPrescription(sessionId, {
      diagnosis:      this.form.value.diagnosis.trim(),
      clinical_notes: this.form.value.clinical_notes?.trim() || undefined,
      items: this.medicines().map(m => ({
        medicine_id:  m.id,
        dosage:       m.dosage       || undefined,
        frequency:    m.frequency    || undefined,
        duration:     m.duration     || undefined,
        quantity:     m.quantity     || undefined,
        instructions: m.instructions || undefined,
      })),
    }).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: ({ prescription }) => {
        this.store.addPrescription(prescription);
        this._patch(prescription.id, { ...IDLE });
        this.showForm.set(false);
        this.toast.success(`Prescription ${prescription.prescription_no} saved.`);
      },
      error: (err) => {
        const msg = err?.error?.error ?? 'Failed to save prescription.';
        this.formError.set(msg);
        this.toast.error(msg);
      },
    });
  }

  private toFormItem(m: RxMedicine): MedFormItem {
    return {
      ...m,
      dosage:       m.default_dose ?? '',
      frequency:    '',
      duration:     m.default_days ? `${m.default_days} days` : '',
      quantity:     '',
      instructions: '',
    };
  }

  private serviceDisplayName(service?: ServicePerformed): string {
    if (!service) return '';
    return service.service_name?.trim() || service.catalogItemName?.trim() || '';
  }

  private async resolveProcedureLabel(service?: ServicePerformed): Promise<void> {
    if (this.procedureLabel() || !service) return;
    const svcId = service.catalog_item_id || service.service_id;
    if (!svcId) return;
    try {
      const { services } = await firstValueFrom(this.clinicSvc.list());
      const match = services.find(s => String(s.id) === String(svcId));
      if (match?.name) {
        this.procedureLabel.set(match.name);
        this.cdr.markForCheck();
      }
    } catch { /* keep empty — no blocking error */ }
  }
}
