import {
  Component, OnInit, inject, signal, computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { RxMasterService } from '../../../services/rx-master.service';
import { PrescriptionService } from '../../../services/prescription.service';
import {
  MedFormItem, ProcFormItem, RxMedicine, RxProcedure,
  LineItemPayload,
} from '../rx.interfaces';
import { MedicineSearchComponent } from '../medicine-search/medicine-search.component';
import { MedicineLineItemComponent } from '../medicine-line-item/medicine-line-item.component';
import { ProcedurePickerComponent } from '../procedure-picker/procedure-picker.component';
import { PrescriptionPreviewComponent } from '../prescription-preview/prescription-preview.component';
import { FieldChangeEvent } from '../medicine-line-item/medicine-line-item.component';

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
  private fb     = inject(FormBuilder);

  context!: {
    appointmentId:    number | string;
    patientId:        number | string;
    svcId:            string;
    patientName:      string;
    appointmentLabel: string;
  };

  loading    = signal(true);
  saving     = signal(false);
  generating = signal(false);
  showPreview = signal(false);

  savedId    = signal<number | null>(null);
  savedRxNo  = signal<string | null>(null);
  pdfUrl     = signal<string | null>(null);
  waSent     = signal(false);
  errorMsg   = signal<string | null>(null);
  successMsg = signal<string | null>(null);

  medicines  = signal<MedFormItem[]>([]);
  procedures = signal<ProcFormItem[]>([]);

  form!: FormGroup;

  get excludedProcedureIds(): number[] {
    return this.procedures().map(p => p.id);
  }

  readonly itemsPayload = computed<LineItemPayload[]>(() => [
    ...this.medicines().map((m, i) => ({
      itemType:     'medicine' as const,
      refId:        m.id,
      sortOrder:    i + 1,
      dosage:       m.dosage       || undefined,
      frequency:    m.frequency    || undefined,
      duration:     m.duration     || undefined,
      quantity:     m.quantity     || undefined,
      instructions: m.instructions || undefined,
    })),
    ...this.procedures().map((p, i) => ({
      itemType:        'procedure' as const,
      refId:           p.id,
      sortOrder:       this.medicines().length + i + 1,
      procedureStatus: p.status,
      instructions:    p.defaultNotes || undefined,
    })),
  ]);

  ngOnInit(): void {
    const qp = this.route.snapshot.queryParams;
    this.context = {
      appointmentId:    qp['appointmentId'],
      patientId:        qp['patientId'],
      svcId:             qp['svcId'],
      patientName:       qp['patientName'],
      appointmentLabel:  qp['label'],
    };

    this.form = this.fb.group({
      diagnosis:     ['', [Validators.maxLength(500)]],
      clinicalNotes: ['', [Validators.maxLength(5000)]],
    });

    this._loadDefaults();
  }

  private async _loadDefaults(): Promise<void> {
    this.loading.set(true);
    this.errorMsg.set(null);
    try {
      const defaults = await this.master.getDefaults(this.context.svcId);

      this.medicines.set(defaults.medicines.map(m => ({
        ...m,
        dosage:       m.defaultDose || '',
        frequency:    '',
        duration:     m.defaultDays ? `${m.defaultDays} days` : '',
        quantity:     '',
        instructions: '',
      })));

      this.procedures.set(defaults.procedures.map(p => ({
        ...p,
        status: 'planned' as const,
      })));
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
        patientId:     this.context.patientId,
        appointmentId: this.context.appointmentId,
        ...this.form.value,
        items: this.itemsPayload(),
      };
      if (this.savedId()) {
        await this.rxSvc.update(this.savedId()!, payload);
      } else {
        const res = await this.rxSvc.create(payload);
        this.savedId.set(res.id);
        this.savedRxNo.set(res.prescriptionNo);
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
      dosage:       med.defaultDose || '',
      frequency:    '',
      duration:     med.defaultDays ? `${med.defaultDays} days` : '',
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
    await this.generatePdf();
    if (!this.pdfUrl() || !this.savedId()) return;
    try {
      await this.rxSvc.sendOnWA(this.savedId()!);
      this.waSent.set(true);
      this.successMsg.set(`Prescription ${this.savedRxNo()} sent to patient on WhatsApp.`);
    } catch {
      this.errorMsg.set('WhatsApp send failed. Try again using Resend WA button.');
    }
  }

  togglePreview(): void {
    this.showPreview.update(v => !v);
  }

  trackMedById(_: number, m: MedFormItem): number { return m.id; }
  trackProcById(_: number, p: ProcFormItem): number { return p.id; }
}
