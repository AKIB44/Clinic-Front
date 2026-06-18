import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { HttpClient } from '@angular/common/http';
import { finalize } from 'rxjs/operators';
import { SessionStore } from '../../store/session.store';
import { SessionApiService } from '../../services/session-api.service';
import { ToastService } from '../../../../services/toast.service';
import { InvestigationKind } from '../../models/session.model';

export const INV_KINDS: { value: InvestigationKind; label: string; group: 'Imaging' | 'Laboratory' }[] = [
  { value: 'iopa',              label: 'IOPA',              group: 'Imaging'     },
  { value: 'opg',               label: 'OPG',               group: 'Imaging'     },
  { value: 'cbct',              label: 'CBCT',              group: 'Imaging'     },
  { value: 'ceph',              label: 'Cephalogram',       group: 'Imaging'     },
  { value: 'bitewing',          label: 'Bitewing',          group: 'Imaging'     },
  { value: 'occlusal',          label: 'Occlusal',          group: 'Imaging'     },
  { value: 'intraoral_photo',   label: 'Intraoral Photo',   group: 'Imaging'     },
  { value: 'intraoral_scan',    label: 'Intraoral Scan',    group: 'Imaging'     },
  { value: 'lab_cbc',           label: 'CBC',               group: 'Laboratory'  },
  { value: 'lab_rbs',           label: 'RBS',               group: 'Laboratory'  },
  { value: 'lab_fbs',           label: 'FBS',               group: 'Laboratory'  },
  { value: 'lab_hba1c',         label: 'HbA1c',             group: 'Laboratory'  },
  { value: 'lab_bt_ct',         label: 'BT / CT',           group: 'Laboratory'  },
  { value: 'lab_inr',           label: 'INR',               group: 'Laboratory'  },
  { value: 'biopsy_incisional', label: 'Incisional Biopsy', group: 'Laboratory'  },
  { value: 'biopsy_excisional', label: 'Excisional Biopsy', group: 'Laboratory'  },
  { value: 'cytology',          label: 'Cytology',          group: 'Laboratory'  },
];

const KIND_MAP = Object.fromEntries(INV_KINDS.map(k => [k.value, k.label]));

const REPORT_MAX_BYTES = 100 * 1024 * 1024; // 100 MB (DICOM / RVG)

const IMAGE_KINDS = new Set<InvestigationKind>([
  'iopa', 'opg', 'ceph', 'bitewing', 'occlusal', 'intraoral_photo',
]);

@Component({
  selector: 'df-investigations-block',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule],
  templateUrl: './df-investigations-block.component.html',
  styleUrl: './df-investigations-block.component.scss',
})
export class DfInvestigationsBlockComponent {
  readonly store = inject(SessionStore);
  private api    = inject(SessionApiService);
  private toast  = inject(ToastService);
  private http   = inject(HttpClient);

  readonly invKinds = INV_KINDS;
  readonly imagingKinds    = INV_KINDS.filter(k => k.group === 'Imaging');
  readonly laboratoryKinds = INV_KINDS.filter(k => k.group === 'Laboratory');

  // ── Order form ────────────────────────────────────────────────────────────
  showForm     = false;
  newKind: InvestigationKind = 'iopa';
  newIndication = '';
  newVendor     = '';
  newCbctFov    = '';

  readonly adding   = signal(false);
  readonly addError = signal<string | null>(null);

  // ── Receive form (per-row) ────────────────────────────────────────────────
  receivingId      = signal<string | null>(null);
  receiveInterp    = '';
  receiveVendorRef = '';
  uploading        = signal(false);
  pendingS3Key     = signal<string | null>(null);
  pendingFilename  = signal<string | null>(null);

  readonly cancelling = signal<string | null>(null);

  kindLabel(kind: string): string { return KIND_MAP[kind] ?? kind; }

  isCbct(): boolean { return this.newKind === 'cbct'; }

  isImageKind(kind: string): boolean { return IMAGE_KINDS.has(kind as InvestigationKind); }

  pendingInvestigations() {
    return this.store.investigations().filter(i => i.status === 'ORDERED' || i.status === 'RECEIVED');
  }

  readInvestigations() {
    return this.store.investigations().filter(i => i.status === 'READ');
  }

  cancelledInvestigations() {
    return this.store.investigations().filter(i => i.status === 'CANCELLED');
  }

  openForm(): void {
    this.showForm     = true;
    this.newKind      = 'iopa';
    this.newIndication = '';
    this.newVendor    = '';
    this.newCbctFov   = '';
    this.addError.set(null);
  }

  closeForm(): void { this.showForm = false; }

  addInvestigation(): void {
    const indication = this.newIndication.trim();
    const sessionId  = this.store.sessionId();
    if (!indication || !sessionId) return;

    this.adding.set(true);
    this.addError.set(null);

    this.api.addInvestigation(sessionId, {
      kind:                this.newKind,
      clinical_indication: indication,
      vendor:              this.newVendor.trim() || undefined,
      cbct_fov:            this.isCbct() && this.newCbctFov ? this.newCbctFov : undefined,
    }).pipe(finalize(() => this.adding.set(false))).subscribe({
      next: ({ investigation }) => {
        this.store.addInvestigation(investigation);
        this.closeForm();
        this.toast.success(`${this.kindLabel(investigation.kind)} ordered.`);
      },
      error: (err) => {
        const msg = err?.error?.error ?? 'Failed to place investigation order.';
        this.addError.set(msg);
        this.toast.error(msg);
      },
    });
  }

  openReceive(id: string): void {
    this.receivingId.set(id);
    this.receiveInterp    = '';
    this.receiveVendorRef = '';
    this.pendingS3Key.set(null);
    this.pendingFilename.set(null);
  }

  closeReceive(): void { this.receivingId.set(null); }

  onReportFilePicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    input.value = '';
    if (!file || !this.receivingId()) return;

    if (file.size > REPORT_MAX_BYTES) {
      this.toast.error('File too large. Maximum size is 100 MB.');
      return;
    }

    this.uploading.set(true);
    this.api.signInvestigationUpload(this.receivingId()!, file.name, file.type || 'application/octet-stream')
      .subscribe({
        next: ({ upload_url, s3_key }) => {
          this.http.put(upload_url, file, {
            headers: { 'Content-Type': file.type || 'application/octet-stream' },
            responseType: 'text',
          }).subscribe({
            next: () => {
              this.uploading.set(false);
              this.pendingS3Key.set(s3_key);
              this.pendingFilename.set(file.name);
              this.toast.success('Report uploaded — add interpretation and confirm.');
            },
            error: () => { this.uploading.set(false); this.toast.error('Upload failed.'); },
          });
        },
        error: () => { this.uploading.set(false); this.toast.error('Could not get upload URL.'); },
      });
  }

  confirmReceive(): void {
    const id = this.receivingId();
    const interp = this.receiveInterp.trim();
    if (!id || !interp) return;

    this.api.receiveInvestigation(id, {
      interpretation:   interp,
      s3_key:           this.pendingS3Key() ?? undefined,
      vendor_report_id: this.receiveVendorRef.trim() || undefined,
    }).subscribe({
      next: ({ investigation }) => {
        this.store.updateInvestigation(investigation);
        this.closeReceive();
        this.toast.success('Investigation marked as read.');
      },
      error: (err) => {
        this.toast.error(err?.error?.error ?? 'Could not save result.');
      },
    });
  }

  cancelInvestigation(id: string): void {
    this.cancelling.set(id);
    this.api.cancelInvestigation(id)
      .pipe(finalize(() => this.cancelling.set(null)))
      .subscribe({
        next: () => {
          this.store.cancelInvestigation(id);
          this.toast.warn('Investigation cancelled.');
        },
        error: () => this.toast.error('Could not cancel investigation.'),
      });
  }
}
