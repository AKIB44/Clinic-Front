import {
  Component, ChangeDetectionStrategy, OnInit, OnDestroy, inject, signal, computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TablerIconsModule } from 'angular-tabler-icons';

type Reason = 'maintenance' | 'server' | 'offline';

interface Copy {
  icon: string;
  badge: string;
  title: string;
  body: string;
  accent: string;
}

const COPY: Record<Reason, Copy> = {
  offline: {
    icon: 'cloud-off',
    badge: 'Connection lost',
    title: "Can't reach the server",
    body: "We're unable to connect right now. Check your internet, or hang tight — we'll keep trying to reconnect automatically.",
    accent: '#dc2626',
  },
  maintenance: {
    icon: 'tool',
    badge: 'Scheduled maintenance',
    title: "We'll be right back",
    body: "DentaFlow is undergoing brief maintenance to make things better. This usually takes only a few minutes — thanks for your patience.",
    accent: '#d97706',
  },
  server: {
    icon: 'server-bolt',
    badge: 'Server error · 500',
    title: 'Something went wrong on our end',
    body: "That's on us, not you. The server hit an unexpected error. We're retrying automatically — or you can try again now.",
    accent: '#7c3aed',
  },
};

@Component({
  selector: 'app-server-error',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatButtonModule, MatProgressSpinnerModule, TablerIconsModule],
  templateUrl: './server-error.component.html',
  styleUrl: './server-error.component.scss',
})
export class ServerErrorComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);

  private readonly AUTO_SECONDS = 15;
  private timer?: ReturnType<typeof setInterval>;
  private returnUrl = '/';

  readonly reason     = signal<Reason>('server');
  readonly checking   = signal(false);
  readonly stillDown  = signal(false);
  readonly countdown  = signal(this.AUTO_SECONDS);

  readonly meta = computed<Copy>(() => COPY[this.reason()]);

  ngOnInit(): void {
    const qp = this.route.snapshot.queryParamMap;
    const r  = (qp.get('reason') || 'server') as Reason;
    this.reason.set((['maintenance', 'server', 'offline'] as Reason[]).includes(r) ? r : 'server');
    const ret = qp.get('returnUrl');
    if (ret && ret.startsWith('/') && !ret.startsWith('//') && !ret.startsWith('/authentication/server-error')) {
      this.returnUrl = ret;
    }
    this.startAutoRetry();
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private startAutoRetry(): void {
    this.countdown.set(this.AUTO_SECONDS);
    this.timer = setInterval(() => {
      if (this.checking()) return;
      const next = this.countdown() - 1;
      if (next <= 0) { void this.retry(); } else { this.countdown.set(next); }
    }, 1000);
  }

  async retry(): Promise<void> {
    if (this.checking()) return;
    this.checking.set(true);
    this.stillDown.set(false);
    const up = await this.pingBackend();
    if (up) {
      if (this.timer) clearInterval(this.timer);
      // Full reload re-bootstraps the app cleanly after an outage.
      window.location.assign(this.returnUrl);
      return;
    }
    this.checking.set(false);
    this.stillDown.set(true);
    this.countdown.set(this.AUTO_SECONDS);
  }

  /** Reachable if the backend answers at all with a non-5xx (4xx still means it's alive). */
  private async pingBackend(): Promise<boolean> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    try {
      const res = await fetch('/v1/health', { method: 'GET', cache: 'no-store', signal: ctrl.signal });
      return res.ok || (res.status >= 400 && res.status < 500);
    } catch {
      return false;
    } finally {
      clearTimeout(t);
    }
  }
}
