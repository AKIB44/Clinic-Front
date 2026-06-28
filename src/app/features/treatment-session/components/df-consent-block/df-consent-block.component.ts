import {
  Component, OnInit, inject, signal, ElementRef, ViewChild, AfterViewInit, OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { MaterialModule } from '../../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { SessionStore } from '../../store/session.store';
import { SessionApiService } from '../../services/session-api.service';
import { ConsentTemplate } from '../../models/session.model';
import { ToastService } from '../../../../services/toast.service';

@Component({
  selector: 'df-consent-block',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule],
  templateUrl: './df-consent-block.component.html',
  styleUrl: './df-consent-block.component.scss',
})
export class DfConsentBlockComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly store  = inject(SessionStore);
  private api     = inject(SessionApiService);
  private toast   = inject(ToastService);

  @ViewChild('sigCanvas') sigCanvasRef!: ElementRef<HTMLCanvasElement>;

  showForm       = false;
  procedureType  = '';
  selectedServiceId = '';
  selectedTemplateId = '';
  isMinor        = false;
  guardianName   = '';
  notes          = '';

  readonly saving      = signal(false);
  readonly saveError   = signal<string | null>(null);
  readonly templates   = signal<ConsentTemplate[]>([]);
  readonly hasDrawn    = signal(false);

  private ctx!: CanvasRenderingContext2D;
  private drawing = false;
  private lastX = 0;
  private lastY = 0;
  private boundMouseDown!: (e: MouseEvent) => void;
  private boundMouseMove!: (e: MouseEvent) => void;
  private boundMouseUp!:   (e: MouseEvent) => void;
  private boundTouchStart!: (e: TouchEvent) => void;
  private boundTouchMove!:  (e: TouchEvent) => void;
  private boundTouchEnd!:   (e: TouchEvent) => void;

  ngOnInit(): void {
    this.api.getConsentTemplates().subscribe({
      next: ({ templates }) => this.templates.set(templates),
    });
  }

  ngAfterViewInit(): void {
    // Canvas wired up after view is checked (when showForm toggles, we re-init)
  }

  openForm(): void {
    this.showForm      = true;
    this.procedureType = '';
    this.selectedServiceId = '';
    this.selectedTemplateId = '';
    this.isMinor = false;
    this.guardianName = '';
    this.notes = '';
    this.hasDrawn.set(false);
    this.saveError.set(null);
    // Wait one tick for canvas to be in DOM
    setTimeout(() => this.initCanvas(), 0);
  }

  closeForm(): void {
    this.showForm = false;
    this.destroyCanvas();
  }

  private initCanvas(): void {
    const canvas = this.sigCanvasRef?.nativeElement;
    if (!canvas) return;
    this.ctx = canvas.getContext('2d')!;
    this.ctx.strokeStyle = '#0f172a';
    this.ctx.lineWidth = 2;
    this.ctx.lineCap = 'round';
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);

    this.boundMouseDown  = (e) => this.startDraw(e.offsetX, e.offsetY);
    this.boundMouseMove  = (e) => this.draw(e.offsetX, e.offsetY);
    this.boundMouseUp    = ()  => { this.drawing = false; };
    this.boundTouchStart = (e) => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      this.startDraw(e.touches[0].clientX - r.left, e.touches[0].clientY - r.top);
    };
    this.boundTouchMove  = (e) => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      this.draw(e.touches[0].clientX - r.left, e.touches[0].clientY - r.top);
    };
    this.boundTouchEnd   = () => { this.drawing = false; };

    canvas.addEventListener('mousedown',  this.boundMouseDown);
    canvas.addEventListener('mousemove',  this.boundMouseMove);
    canvas.addEventListener('mouseup',    this.boundMouseUp);
    canvas.addEventListener('mouseleave', this.boundMouseUp);
    canvas.addEventListener('touchstart', this.boundTouchStart, { passive: false });
    canvas.addEventListener('touchmove',  this.boundTouchMove,  { passive: false });
    canvas.addEventListener('touchend',   this.boundTouchEnd);
  }

  private destroyCanvas(): void {
    const canvas = this.sigCanvasRef?.nativeElement;
    if (!canvas || !this.boundMouseDown) return;
    canvas.removeEventListener('mousedown',  this.boundMouseDown);
    canvas.removeEventListener('mousemove',  this.boundMouseMove);
    canvas.removeEventListener('mouseup',    this.boundMouseUp);
    canvas.removeEventListener('mouseleave', this.boundMouseUp);
    canvas.removeEventListener('touchstart', this.boundTouchStart);
    canvas.removeEventListener('touchmove',  this.boundTouchMove);
    canvas.removeEventListener('touchend',   this.boundTouchEnd);
  }

  ngOnDestroy(): void {
    this.destroyCanvas();
  }

  private startDraw(x: number, y: number): void {
    this.drawing = true;
    this.lastX = x;
    this.lastY = y;
  }

  private draw(x: number, y: number): void {
    if (!this.drawing) return;
    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(x, y);
    this.ctx.stroke();
    this.lastX = x;
    this.lastY = y;
    this.hasDrawn.set(true);
  }

  clearSignature(): void {
    const canvas = this.sigCanvasRef?.nativeElement;
    if (canvas) this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.hasDrawn.set(false);
  }

  saveConsent(): void {
    const sessionId = this.store.sessionId();
    if (!sessionId || !this.procedureType.trim() || !this.hasDrawn()) return;

    const canvas = this.sigCanvasRef.nativeElement;
    this.saving.set(true);
    this.saveError.set(null);

    // Step 1: presign the upload
    this.api.signConsent(sessionId).subscribe({
      next: ({ upload_url, s3_key }) => {
        // Step 2: upload the PNG blob directly to S3
        canvas.toBlob((blob) => {
          if (!blob) {
            this.saving.set(false);
            this.saveError.set('Could not capture signature image.');
            return;
          }
          fetch(upload_url, {
            method: 'PUT',
            body: blob,
            headers: { 'Content-Type': 'image/png' },
          }).then(async (r) => {
            if (!r.ok) {
              const detail = await r.text().catch(() => '');
              throw new Error(`UPLOAD_FAILED:${r.status}:${detail.slice(0, 300)}`);
            }
            // Step 3: confirm. Guard against an option that rendered a literal
            // "undefined"/"null" string (e.g. a missing field on the bound object).
            const cleanId = (v: string) => {
              const s = (v || '').trim();
              return s && s !== 'undefined' && s !== 'null' ? s : undefined;
            };
            return this.api.addConsent(sessionId, {
              procedure_type:        this.procedureType.trim(),
              service_id:            cleanId(this.selectedServiceId),
              template_id:           cleanId(this.selectedTemplateId),
              patient_signature_url: s3_key,
              is_minor:              this.isMinor,
              guardian_name:         this.guardianName.trim() || undefined,
              notes:                 this.notes.trim() || undefined,
            }).toPromise();
          }).then((resp: any) => {
            this.saving.set(false);
            this.store.addConsent(resp.consent);
            this.closeForm();
            this.toast.success('Consent recorded.');
          }).catch((err: any) => {
            this.saving.set(false);
            // A blocked/failed PUT to S3 (CORS or network) rejects as a TypeError
            // with no response; an S3 4xx surfaces as UPLOAD_FAILED:<status>. Only
            // a real save error means the request actually reached our API.
            const m: string = err?.message || '';
            const isUploadProblem = err instanceof TypeError || m.startsWith('UPLOAD_FAILED');
            // Keep the real reason in the console for diagnosis.
            // eslint-disable-next-line no-console
            console.error('[consent] save failed:', err);
            const msg = isUploadProblem
              ? 'Could not upload the signature to storage. This is usually an S3 CORS/bucket setting — check the PUT request to S3 in the Network tab.'
              : 'Failed to save the consent record. Please try again.';
            this.saveError.set(msg);
            this.toast.error(msg);
          });
        }, 'image/png');
      },
      error: () => {
        this.saving.set(false);
        this.saveError.set('Could not initiate signature upload.');
      },
    });
  }

  get canSave(): boolean {
    return !!this.procedureType.trim() && this.hasDrawn() && !this.saving();
  }
}
