import { Directive, ElementRef, Input, OnInit, OnDestroy, inject, NgZone } from '@angular/core';

/**
 * Makes a chart card user-resizable (CSS `resize`), keeps the ApexChart inside
 * fitted to the new size, and remembers the chosen size across reloads.
 *
 * Usage: <mat-card class="an-chart-card" anResizable="revenue-trend">
 *   - the string is a stable key for persisting this card's size in localStorage.
 */
@Directive({
  selector: '[anResizable]',
  standalone: true,
})
export class ResizableCardDirective implements OnInit, OnDestroy {
  @Input('anResizable') key = '';

  private host = inject(ElementRef<HTMLElement>).nativeElement;
  private zone = inject(NgZone);
  private ro?: ResizeObserver;
  private timer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    // Restore a previously chosen size.
    if (this.key) {
      try {
        const raw = localStorage.getItem(this.storageKey());
        if (raw) {
          const s = JSON.parse(raw);
          if (s.w) this.host.style.width = s.w;
          if (s.h) this.host.style.height = s.h;
        }
      } catch { /* ignore bad storage */ }
    }

    // On resize: refit the ApexChart (it recomputes width/height off its
    // container when a window resize fires) and persist the new size.
    this.zone.runOutsideAngular(() => {
      this.ro = new ResizeObserver(() => {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => {
          window.dispatchEvent(new Event('resize'));
          if (this.key) {
            try {
              localStorage.setItem(this.storageKey(), JSON.stringify({
                w: this.host.style.width, h: this.host.style.height,
              }));
            } catch { /* ignore quota */ }
          }
        }, 120);
      });
      this.ro.observe(this.host);
    });
  }

  ngOnDestroy(): void {
    this.ro?.disconnect();
    clearTimeout(this.timer);
  }

  private storageKey(): string { return `an_card_size_${this.key}`; }
}
