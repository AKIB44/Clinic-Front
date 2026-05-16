import {
  Component, Input, OnInit, inject,
  signal, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { PrescriptionService } from '../../../services/prescription.service';
import { RxSummary } from '../rx.interfaces';

@Component({
  selector: 'app-rx-history-tab',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './rx-history-tab.component.html',
  styleUrls: ['./rx-history-tab.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RxHistoryTabComponent implements OnInit {
  @Input() patientId!: number | string;

  private rxSvc = inject(PrescriptionService);

  loading       = signal(true);
  prescriptions = signal<RxSummary[]>([]);
  total         = signal(0);
  page          = signal(1);
  resendingId   = signal<number | null>(null);
  errorMsg      = signal<string | null>(null);

  ngOnInit(): void { this.load(); }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.rxSvc.listForPatient(this.patientId, this.page(), 10);
      this.prescriptions.set(res.data);
      this.total.set(res.total);
    } catch {
      this.errorMsg.set('Failed to load prescriptions.');
    } finally {
      this.loading.set(false);
    }
  }

  async downloadPdf(rxId: number): Promise<void> {
    try {
      const { url } = await this.rxSvc.getPdfUrl(rxId);
      if (url) window.open(url, '_blank');
    } catch {
      this.errorMsg.set('Could not generate download link.');
    }
  }

  async resendWA(rxId: number): Promise<void> {
    this.resendingId.set(rxId);
    try {
      const { url } = await this.rxSvc.getPdfUrl(rxId);
      if (!url) { this.errorMsg.set('PDF not generated yet. Generate PDF first.'); return; }
      await this.rxSvc.sendOnWA(rxId);
      await this.load();
      const rx = this.prescriptions().find(r => r.id === rxId);
      const msg = `Your prescription${rx ? ` (${rx.prescription_no})` : ''} is ready. View / download: ${url}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    } catch {
      this.errorMsg.set('Could not share prescription. Please try again.');
    } finally {
      this.resendingId.set(null);
    }
  }

  changePage(p: number): void {
    this.page.set(p);
    this.load();
  }

  trackById(_: number, item: RxSummary): number { return item.id; }
}
