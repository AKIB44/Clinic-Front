import {
  Component, ElementRef, Input, ViewChild, AfterViewInit, OnChanges,
  inject, signal, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as dicomParser from 'dicom-parser';
import { FileCacheService } from '../../services/file-cache.service';

@Component({
  selector: 'df-dicom-viewer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dv-wrap">
      <div class="dv-stage">
        <canvas #cv class="dv-canvas"></canvas>
        @if (loading()) {
          <div class="dv-overlay">
            <div class="dv-loader"><span></span><span></span><span></span></div>
            <div class="dv-loading-label">{{ progress() < 100 ? 'Downloading scan… ' + progress() + '%' : 'Decoding pixels…' }}</div>
          </div>
        }
        @if (error())   { <div class="dv-overlay dv-err">{{ error() }}</div> }
      </div>
      @if (ready()) {
        <div class="dv-controls">
          @if (frames() > 1) {
            <label class="dv-ctl">Frame <span>{{ frame() + 1 }}/{{ frames() }}</span>
              <input type="range" min="0" [max]="frames()-1" [ngModel]="frame()" (ngModelChange)="setFrame($event)"></label>
          }
          <label class="dv-ctl">Window <span>{{ ww() }}</span>
            <input type="range" [min]="1" [max]="wwMax()" [ngModel]="ww()" (ngModelChange)="setWw($event)"></label>
          <label class="dv-ctl">Level <span>{{ wc() }}</span>
            <input type="range" [min]="wcMin()" [max]="wcMax()" [ngModel]="wc()" (ngModelChange)="setWc($event)"></label>
        </div>
      }
    </div>
  `,
  styles: [`
    .dv-wrap { display: flex; flex-direction: column; gap: 10px; height: 100%; }
    .dv-stage { position: relative; flex: 1; min-height: 380px; background: #000; border-radius: 10px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
    .dv-canvas { max-width: 100%; max-height: 100%; image-rendering: pixelated; }
    .dv-overlay { position: absolute; inset: 0; display: flex; flex-direction: column; gap: 12px; align-items: center; justify-content: center; color: #cbd5e1; font-size: 13.5px; padding: 16px; text-align: center; }
    .dv-loading-label { font-weight: 600; }
    .dv-loader { display: flex; gap: 7px; }
    .dv-loader span { width: 11px; height: 11px; border-radius: 50%; background: #22d3ee; animation: dv-bounce 1s ease-in-out infinite; }
    .dv-loader span:nth-child(2){ animation-delay:.15s } .dv-loader span:nth-child(3){ animation-delay:.3s }
    @keyframes dv-bounce { 0%,80%,100%{ transform:scale(.5); opacity:.4 } 40%{ transform:scale(1); opacity:1 } }
    .dv-err { color: #fca5a5; }
    .dv-controls { display: flex; flex-wrap: wrap; gap: 16px; padding: 4px 2px; }
    .dv-ctl { display: flex; flex-direction: column; gap: 4px; font-size: 11px; color: #64748b; font-weight: 600; min-width: 160px; }
    .dv-ctl span { color: #0f172a; font-weight: 700; }
    .dv-ctl input { accent-color: #0d7a5f; }
  `],
})
export class DfDicomViewerComponent implements AfterViewInit, OnChanges {
  @ViewChild('cv', { static: true }) cv!: ElementRef<HTMLCanvasElement>;
  @Input() patientId = '';
  @Input() fileId = '';

  private cache = inject(FileCacheService);
  readonly loading = signal(false);
  readonly error   = signal<string | null>(null);
  readonly ready   = signal(false);
  readonly progress = signal(0);
  readonly frame   = signal(0);
  readonly frames  = signal(1);
  readonly ww = signal(400);
  readonly wc = signal(40);
  readonly wwMax = signal(4000);
  readonly wcMin = signal(-1000);
  readonly wcMax = signal(3000);

  // Parsed image state
  private px: Int32Array | null = null;   // rescaled pixel values, all frames
  private rows = 0; private cols = 0; private mono1 = false;
  private rgb = false; private rgbBytes: Uint8Array | null = null;
  private viewInit = false;

  ngAfterViewInit(): void { this.viewInit = true; if (this.fileId) this.load(); }
  ngOnChanges(): void { if (this.viewInit && this.fileId) this.load(); }

  setFrame(f: number) { this.frame.set(+f); this.render(); }
  setWw(v: number) { this.ww.set(+v); this.render(); }
  setWc(v: number) { this.wc.set(+v); this.render(); }

  private load(): void {
    this.loading.set(true); this.error.set(null); this.ready.set(false); this.progress.set(0);
    this.px = null; this.rgbBytes = null;
    this.cache.load(this.patientId, this.fileId).subscribe({
      next: (ev) => {
        if (!ev.buffer) { this.progress.set(ev.progress); return; }
        setTimeout(() => { try { this.parse(new Uint8Array(ev.buffer!)); } catch (e) { this.fail(e); } }, 20);
      },
      error: (e) => this.fail(e),
    });
  }

  private fail(e: unknown) {
    this.loading.set(false);
    this.error.set('This DICOM can’t be previewed in-browser (compressed or unsupported). Download to open in a viewer.');
    console.warn('[dicom]', e);
  }

  private parse(bytes: Uint8Array): void {
    const ds = dicomParser.parseDicom(bytes);
    const ts = ds.string('x00020010') || '';
    // Encapsulated/compressed transfer syntaxes (JPEG/JPEG2000/RLE) — not decodable here.
    if (ts.startsWith('1.2.840.10008.1.2.4') || ts.startsWith('1.2.840.10008.1.2.5')) {
      throw new Error('compressed transfer syntax ' + ts);
    }
    this.rows = ds.uint16('x00280010') || 0;
    this.cols = ds.uint16('x00280011') || 0;
    if (!this.rows || !this.cols) throw new Error('no image dimensions');

    const bitsAllocated = ds.uint16('x00280100') || 16;
    const pixelRep      = ds.uint16('x00280103') || 0;       // 0 unsigned, 1 signed
    const samples       = ds.uint16('x00280002') || 1;
    const photometric   = (ds.string('x00280004') || 'MONOCHROME2').toUpperCase();
    const nFrames       = parseInt(ds.intString('x00280008') as unknown as string, 10) || 1;
    const slope     = parseFloat(ds.floatString('x00281053') as unknown as string) || 1;
    const intercept = parseFloat(ds.floatString('x00281052') as unknown as string) || 0;

    const pde = (ds.elements as Record<string, { dataOffset: number; length: number }>)['x7fe00010'];
    if (!pde) throw new Error('no pixel data');

    this.frames.set(nFrames);
    this.mono1 = photometric === 'MONOCHROME1';
    this.rgb = samples === 3;

    if (this.rgb) {
      this.rgbBytes = new Uint8Array(ds.byteArray.buffer, pde.dataOffset, pde.length);
    } else {
      const count = pde.length / (bitsAllocated / 8);
      let raw: Int16Array | Uint16Array | Uint8Array;
      if (bitsAllocated === 8) raw = new Uint8Array(ds.byteArray.buffer, pde.dataOffset, count);
      else raw = pixelRep === 1
        ? new Int16Array(ds.byteArray.buffer, pde.dataOffset, count)
        : new Uint16Array(ds.byteArray.buffer, pde.dataOffset, count);

      const out = new Int32Array(raw.length);
      let min = Infinity, max = -Infinity;
      for (let i = 0; i < raw.length; i++) {
        const v = raw[i] * slope + intercept;
        out[i] = v; if (v < min) min = v; if (v > max) max = v;
      }
      this.px = out;

      // Default window: tag if present, else min..max range.
      let wc = parseFloat((ds.floatString('x00281050') as unknown as string));
      let ww = parseFloat((ds.floatString('x00281051') as unknown as string));
      if (!isFinite(wc) || !isFinite(ww) || ww <= 0) { wc = (max + min) / 2; ww = Math.max(1, max - min); }
      const range = Math.max(1, max - min);
      this.wwMax.set(Math.round(range * 2)); this.wcMin.set(Math.round(min - range)); this.wcMax.set(Math.round(max + range));
      this.ww.set(Math.round(ww)); this.wc.set(Math.round(wc));
    }

    this.frame.set(0);
    const c = this.cv.nativeElement; c.width = this.cols; c.height = this.rows;
    this.loading.set(false); this.ready.set(true);
    this.render();
  }

  private render(): void {
    const c = this.cv.nativeElement; const ctx = c.getContext('2d'); if (!ctx) return;
    const n = this.cols * this.rows;
    const img = ctx.createImageData(this.cols, this.rows);
    const f = this.frame();

    if (this.rgb && this.rgbBytes) {
      const off = f * n * 3;
      for (let i = 0; i < n; i++) {
        img.data[i*4] = this.rgbBytes[off+i*3]; img.data[i*4+1] = this.rgbBytes[off+i*3+1];
        img.data[i*4+2] = this.rgbBytes[off+i*3+2]; img.data[i*4+3] = 255;
      }
    } else if (this.px) {
      const off = f * n;
      const ww = this.ww(), wc = this.wc();
      const lo = wc - 0.5 - (ww - 1) / 2, scale = 255 / (ww - 1);
      for (let i = 0; i < n; i++) {
        let g = (this.px[off + i] - lo) * scale;
        g = g < 0 ? 0 : g > 255 ? 255 : g;
        if (this.mono1) g = 255 - g;
        const j = i * 4; img.data[j] = img.data[j+1] = img.data[j+2] = g; img.data[j+3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }
}
