import {
  Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, inject, effect, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TablerIconsModule } from 'angular-tabler-icons';
import { ViewerStore } from '../../store/viewer.store';
import { GestureEngineService } from '../../services/gesture-engine.service';

// Standard MediaPipe 21-point hand skeleton.
const CONNECTIONS: [number, number][] = [
  [0,1],[1,2],[2,3],[3,4],          // thumb
  [0,5],[5,6],[6,7],[7,8],          // index
  [5,9],[9,10],[10,11],[11,12],     // middle
  [9,13],[13,14],[14,15],[15,16],   // ring
  [13,17],[17,18],[18,19],[19,20],  // pinky
  [0,17],                           // palm base
];

@Component({
  selector: 'df-camera-preview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TablerIconsModule],
  templateUrl: './df-camera-preview.component.html',
  styleUrl: './df-camera-preview.component.scss',
})
export class DfCameraPreviewComponent implements AfterViewInit, OnDestroy {
  @ViewChild('video', { static: true }) videoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  readonly store = inject(ViewerStore);
  private engine = inject(GestureEngineService);
  private raf = 0;

  constructor() {
    // Attach / detach the live stream as the camera turns on/off.
    effect(() => {
      const active = this.store.cameraActive();
      const v = this.videoRef?.nativeElement;
      if (!v) return;
      v.srcObject = active ? this.engine.stream : null;
      if (active) v.play().catch(() => {});
    });
  }

  ngAfterViewInit(): void {
    const draw = () => {
      this.raf = requestAnimationFrame(draw);
      this.drawOverlay();
    };
    draw();
  }

  ngOnDestroy(): void { cancelAnimationFrame(this.raf); }

  toggle(): void { this.store.cameraPreviewVisible.update((v) => !v); }

  private drawOverlay(): void {
    const cv = this.canvasRef?.nativeElement;
    const v = this.videoRef?.nativeElement;
    if (!cv || !v) return;
    const w = cv.width = v.clientWidth || 120;
    const h = cv.height = v.clientHeight || 90;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);

    const hand = this.engine.latestLandmarks?.[0];
    if (!hand) return;
    const px = (i: number) => (1 - hand[i].x) * w;   // mirror x (selfie)
    const py = (i: number) => hand[i].y * h;

    ctx.strokeStyle = 'rgba(167,139,250,.9)'; ctx.lineWidth = 1.5;
    for (const [a, b] of CONNECTIONS) {
      ctx.beginPath(); ctx.moveTo(px(a), py(a)); ctx.lineTo(px(b), py(b)); ctx.stroke();
    }
    ctx.fillStyle = '#34d399';
    for (let i = 0; i < hand.length; i++) {
      ctx.beginPath(); ctx.arc(px(i), py(i), 2.4, 0, Math.PI * 2); ctx.fill();
    }
  }
}
