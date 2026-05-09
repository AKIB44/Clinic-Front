import { Component, inject, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { MaterialModule } from 'src/app/material.module';
import { BreakGlassService } from 'src/app/core/rbac/break-glass.service';

@Component({
  selector: 'app-break-glass-banner',
  standalone: true,
  imports: [MaterialModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (bgService.isActive()) {
      <div class="break-glass-banner">
        <mat-icon>emergency</mat-icon>
        <span>
          <strong>BREAK-GLASS ACTIVE</strong> — Emergency access expires in
          <strong>{{ timeLabel }}</strong>
        </span>
        <button mat-stroked-button color="warn" (click)="end()">
          End Session
        </button>
      </div>
    }
  `,
  styles: [`
    .break-glass-banner {
      display: flex;
      align-items: center;
      gap: 12px;
      background: #b71c1c;
      color: #fff;
      padding: 8px 24px;
      font-size: 14px;
      position: sticky;
      top: 0;
      z-index: 1000;
    }
    .break-glass-banner mat-icon { color: #ffcc02; }
    .break-glass-banner span { flex: 1; }
    .break-glass-banner button { border-color: rgba(255,255,255,.7); color: #fff; }
  `],
})
export class BreakGlassBannerComponent implements OnInit, OnDestroy {
  readonly bgService = inject(BreakGlassService);
  private readonly cdr = inject(ChangeDetectorRef);
  private ticker: ReturnType<typeof setInterval> | null = null;

  timeLabel = '';

  ngOnInit(): void {
    this.tick();
    this.ticker = setInterval(() => { this.tick(); this.cdr.markForCheck(); }, 1000);
  }

  ngOnDestroy(): void {
    if (this.ticker) clearInterval(this.ticker);
  }

  private tick(): void {
    const ms = this.bgService.msRemaining();
    const totalSec = Math.ceil(ms / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    this.timeLabel = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  }

  async end(): Promise<void> {
    await this.bgService.end();
    this.cdr.markForCheck();
  }
}
