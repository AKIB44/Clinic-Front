import {
  Component, OnInit, inject, signal, computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { RxMasterService } from '../../../services/rx-master.service';
import { PrescriptionService } from '../../../services/prescription.service';
import { ClinicServicesService } from '../../../services/clinic-services.service';
import {
  MedFormItem, ProcFormItem, RxMedicine, RxProcedure,
  LineItemPayload, PrescriptionContext,
} from '../rx.interfaces';
import { MedicineSearchComponent } from '../medicine-search/medicine-search.component';
import { MedicineLineItemComponent, FieldChangeEvent } from '../medicine-line-item/medicine-line-item.component';
import { ProcedurePickerComponent } from '../procedure-picker/procedure-picker.component';
import { PrescriptionPreviewComponent } from '../prescription-preview/prescription-preview.component';

@Component({
  selector: 'app-prescription-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MedicineSearchComponent,
    MedicineLineItemComponent,
    ProcedurePickerComponent,
    PrescriptionPreviewComponent,
  ],
  templateUrl: './prescription-form.component.html',
  styleUrls: ['./prescription-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrescriptionFormComponent implements OnInit {
  private route  = inject(ActivatedRoute);
  private master = inject(RxMasterService);
  private rxSvc  = inject(PrescriptionService);
  private clinicSvc = inject(ClinicServicesService);
  private fb     = inject(FormBuilder);

  context!: PrescriptionContext;

  loading     = signal(true);
  saving      = signal(false);
  generating  = signal(false);
  showPreview = signal(false);

  savedId    = signal<number | null>(null);
  savedRxNo  = signal<string | null>(null);
  pdfUrl     = signal<string | null>(null);
  waSent     = signal(false);
  errorMsg   = signal<string | null>(null);
  successMsg = signal<string | null>(null);

  medicines  = signal<MedFormItem[]>([]);
  procedures = signal<ProcFormItem[]>([]);
  readonly procedureLabel = signal('');

  form!: FormGroup;

  get excludedProcedureIds(): number[] {
    return this.procedures().map(p => p.id);
  }

  readonly itemsPayload = computed<LineItemPayload[]>(() => [
    ...this.medicines().map((m, i) => ({
      item_type:  'medicine' as const,
      ref_id:     m.id,
      sort_order: i + 1,
      dosage:       m.dosage       || undefined,
      frequency:    m.frequency    || undefined,
      duration:     m.duration     || undefined,
      quantity:     m.quantity     || undefined,
      instructions: m.instructions || undefined,
    })),
    ...this.procedures().map((p, i) => ({
      item_type:        'procedure' as const,
      ref_id:           p.id,
      sort_order:       this.medicines().length + i + 1,
      procedure_status: p.status,
      instructions:     p.default_notes || undefined,
    })),
  ]);

  ngOnInit(): void {
    const qp = this.route.snapshot.queryParams;
    this.context = {
      appointment_id:    qp['appointment_id'],
      patient_id:        qp['patient_id'],
      svc_id:            qp['svc_id'],
      patient_name:      qp['patient_name'] ?? '',
      appointment_label: qp['label'] ?? qp['service_name'] ?? '',
    };
    this.procedureLabel.set(this.context.appointment_label);

    this.form = this.fb.group({
      diagnosis:     ['', [Validators.maxLength(500)]],
      clinical_notes: ['', [Validators.maxLength(5000)]],
    });

    this._loadDefaults();
  }

  private async _loadDefaults(): Promise<void> {
    this.loading.set(true);
    this.errorMsg.set(null);
    try {
      const defaults = await this.master.getDefaults(this.context.svc_id);

      this.medicines.set(defaults.medicines.map(m => ({
        ...m,
        dosage:       m.default_dose || '',
        frequency:    '',
        duration:     m.default_days ? `${m.default_days} days` : '',
        quantity:     '',
        instructions: '',
      })));

      // Procedures start empty — doctor selects which ones were performed today.
      // Pre-filling all svc_id procedures would leave nothing available in the picker.
      await this.resolveProcedureLabel();
    } catch {
      this.errorMsg.set('Failed to load prescription defaults. Please refresh.');
    } finally {
      this.loading.set(false);
    }
  }

  private async _saveOrUpdate(): Promise<boolean> {
    if (!this.form.valid) return false;
    this.saving.set(true);
    this.errorMsg.set(null);
    try {
      const payload = {
        patient_id:     this.context.patient_id,
        appointment_id: this.context.appointment_id,
        diagnosis:      this.form.value.diagnosis,
        clinical_notes: this.form.value.clinical_notes,
        items:          this.itemsPayload(),
      };
      if (this.savedId()) {
        await this.rxSvc.update(this.savedId()!, payload);
      } else {
        const res = await this.rxSvc.create(payload);
        this.savedId.set(res.id);
        this.savedRxNo.set(res.prescription_no);
      }
      return true;
    } catch (e: any) {
      this.errorMsg.set(e?.error?.message ?? 'Save failed — please try again.');
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  addMedicine(med: RxMedicine): void {
    if (this.medicines().some(m => m.id === med.id)) return;
    this.medicines.update(list => [...list, {
      ...med,
      dosage:       med.default_dose || '',
      frequency:    '',
      duration:     med.default_days ? `${med.default_days} days` : '',
      quantity:     '',
      instructions: '',
    }]);
  }

  removeMedicine(id: number): void {
    this.medicines.update(list => list.filter(m => m.id !== id));
  }

  updateMedicineField(id: number, event: FieldChangeEvent): void {
    this.medicines.update(list =>
      list.map(m => m.id === id ? { ...m, [event.field]: event.value } : m)
    );
  }

  addProcedure(proc: RxProcedure): void {
    if (this.procedures().some(p => p.id === proc.id)) return;
    this.procedures.update(list => [...list, { ...proc, status: 'planned' }]);
  }

  setProcedureStatus(id: number, status: 'planned' | 'done' | 'skipped'): void {
    this.procedures.update(list =>
      list.map(p => p.id === id ? { ...p, status } : p)
    );
  }

  async saveDraft(): Promise<void> {
    await this._saveOrUpdate();
  }

  async generatePdf(): Promise<void> {
    const saved = await this._saveOrUpdate();
    if (!saved || !this.savedId()) return;

    this.generating.set(true);
    this.errorMsg.set(null);
    try {
      await this.rxSvc.generatePdf(this.savedId()!);
      const url = await this.rxSvc.pollUntilPdfReady(this.savedId()!);
      this.pdfUrl.set(url);
      this.successMsg.set(`PDF generated · ${this.savedRxNo()}`);
    } catch {
      this.errorMsg.set('PDF generation failed. Retry using the button.');
    } finally {
      this.generating.set(false);
    }
  }

  async saveAndSendWA(): Promise<void> {
    // Only generate PDF if not already done
    if (!this.pdfUrl()) {
      await this.generatePdf();
    }
    if (!this.pdfUrl() || !this.savedId()) return;
    try {
      await this.rxSvc.sendOnWA(this.savedId()!);
      this.waSent.set(true);
      this.successMsg.set(`Prescription ${this.savedRxNo()} saved. Opening WhatsApp…`);
      const msg = `Your prescription (${this.savedRxNo()}) is ready. View / download: ${this.pdfUrl()}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    } catch {
      this.errorMsg.set('Could not complete. Please try again.');
    }
  }

  togglePreview(): void {
    this.showPreview.update(v => !v);
  }

  private async resolveProcedureLabel(): Promise<void> {
    if (this.procedureLabel().trim() || !this.context.svc_id) return;
    try {
      const { services } = await firstValueFrom(this.clinicSvc.list());
      const match = services.find(s => String(s.id) === String(this.context.svc_id));
      if (match?.name) {
        this.procedureLabel.set(match.name);
        this.context.appointment_label = match.name;
      }
    } catch { /* optional fallback */ }
  }

  trackMedById(_: number, m: MedFormItem): number { return m.id; }
  trackProcById(_: number, p: ProcFormItem): number { return p.id; }
}
