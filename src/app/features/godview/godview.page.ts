import {
  Component, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild,
  inject, signal, computed, ChangeDetectionStrategy, NgZone,
} from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router } from '@angular/router';
import { TablerIconsModule } from 'angular-tabler-icons';
import { Subscription, timer, switchMap, catchError, of } from 'rxjs';
import { GodviewApiService, GodSnapshot, GodSession, GodActivity } from './godview-api.service';
import { GOOGLE_MAPS_CONFIG, loadGoogleMaps } from './google-maps.config';

const POLL_MS = 3000;

@Component({
  selector: 'app-godview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TablerIconsModule],
  templateUrl: './godview.page.html',
  styleUrl: './godview.page.scss',
})
export class GodviewPage implements OnInit, AfterViewInit, OnDestroy {
  private api      = inject(GodviewApiService);
  private zone     = inject(NgZone);
  private router   = inject(Router);
  private location = inject(Location);

  @ViewChild('mapEl') mapEl!: ElementRef<HTMLDivElement>;
  @ViewChild('logsScroll') logsScroll?: ElementRef<HTMLDivElement>;

  readonly authorised = signal<boolean | null>(null); // null = checking
  readonly snapshot   = signal<GodSnapshot | null>(null);
  readonly selectedUser = signal<string | null>(null);
  readonly detail     = signal<GodActivity | null>(null);
  readonly expanded   = signal<'sessions' | 'logs' | 'activity' | null>(null);

  toggleExpand(id: 'sessions' | 'logs' | 'activity'): void {
    this.expanded.set(this.expanded() === id ? null : id);
  }

  // ── Boot / exit theatrics ──────────────────────────────────────────────────
  readonly booting  = signal(true);
  readonly exiting  = signal(false);
  readonly exitLine = signal('');

  readonly bootLines = [
    'establishing secure uplink…',
    'triangulating active IP addresses…',
    'decrypting user telemetry…',
    'spinning up the all-seeing eye…',
    'access granted — clearance: OVERLORD',
  ];
  readonly welcomeLine = [
    'Welcome back, Overlord. They have no idea you\'re watching.',
    'God mode engaged. Try not to let the power go to your head.',
    'Omniscience online. Everyone\'s whereabouts are now your business.',
    'Big Brother reporting for duty. Judgement: mandatory. Coffee: optional.',
    'You see all. You know all. Use it responsibly… or don\'t.',
  ][Math.floor(Math.random() * 5)];
  private readonly exitLines = [
    'Powering down the all-seeing eye. They can breathe again.',
    'Returning to mortal mode. Pretend you didn\'t see everything.',
    'Surveillance grid offline. You saw nothing. Wink.',
    'Logging off god mode — the peasants may resume their privacy.',
    'Eye closed. Somewhere, a user just relaxed and doesn\'t know why.',
  ];
  readonly exitLogLines = [
    'closing live surveillance grid…',
    'flushing session cache…',
    'severing telemetry uplink…',
    'revoking OVERLORD clearance…',
    'logging out…',
  ];

  /** The live session behind the opened activity entry (device, geo, etc.). */
  readonly detailSession = computed<GodSession | null>(() => {
    const a = this.detail();
    if (!a) return null;
    return this.sessions().find(s => s.userId === a.userId && s.ip === a.ip)
        ?? this.sessions().find(s => s.userId === a.userId) ?? null;
  });

  /** Recent actions by the same user, for the detail timeline. */
  readonly detailTimeline = computed<GodActivity[]>(() => {
    const a = this.detail();
    if (!a) return [];
    return (this.snapshot()?.activity ?? []).filter(x => x.userId === a.userId).slice(0, 15);
  });

  private map?: google.maps.Map;
  private markers = new Map<string, google.maps.Marker>();
  private info?: google.maps.InfoWindow;
  private sub?: Subscription;
  private mapReady = false;
  private mapInitStarted = false;
  private fitted = false;
  private mapsKey = '';                     // delivered by /godview/access from server env
  readonly mapUnavailable = signal(false); // true when the map can't render
  readonly mapError = signal<'no-key' | 'auth-error' | 'failed' | null>(null);

  readonly sessions = computed(() => this.snapshot()?.sessions ?? []);
  readonly stats    = computed(() => this.snapshot()?.stats ?? { sessions: 0, online: 0, users: 0, located: 0 });
  readonly logs     = computed(() => this.snapshot()?.logs ?? []);

  readonly activity = computed(() => {
    const all = this.snapshot()?.activity ?? [];
    const sel = this.selectedUser();
    return sel ? all.filter(a => a.userId === sel) : all;
  });

  ngOnInit(): void {
    this.api.access().subscribe({
      next: (r) => { this.mapsKey = r.mapsKey || ''; this.authorised.set(true); this.startPolling(); },
      error: () => this.authorised.set(false),
    });
    // Run the boot sequence, then reveal the console.
    setTimeout(() => this.booting.set(false), 3000);
  }

  ngAfterViewInit(): void {
    // Map is created lazily once we know the user is authorised and the DOM
    // node exists — see ensureMap(), called from the first successful poll.
  }

  private startPolling(): void {
    // Poll outside Angular so the map's own rAF doesn't thrash change detection;
    // re-enter the zone only to push new signal values.
    this.zone.runOutsideAngular(() => {
      this.sub = timer(0, POLL_MS).pipe(
        switchMap(() => this.api.live().pipe(catchError(() => of(null)))),
      ).subscribe((snap) => {
        if (!snap) return;
        this.zone.run(() => {
          this.snapshot.set(snap);
          this.ensureMap();
          this.syncMarkers(snap.sessions);
          this.pinLogsToTop();
        });
      });
    });
  }

  private ensureMap(): void {
    if (this.mapReady || this.mapInitStarted || !this.mapEl) return;
    this.mapInitStarted = true;

    loadGoogleMaps(this.mapsKey).then((result) => this.zone.run(() => {
      if (result !== 'ok') {
        this.mapError.set(result);
        this.mapUnavailable.set(true);
        this.mapInitStarted = false;
        return;
      }

      const map = new google.maps.Map(this.mapEl.nativeElement, {
        center: GOOGLE_MAPS_CONFIG.defaultCenter,
        zoom: GOOGLE_MAPS_CONFIG.defaultZoom,
        mapTypeId: GOOGLE_MAPS_CONFIG.defaultType,   // roadmap by default
        // Built-in Google controls — the map-type switcher gives Street /
        // Satellite / Hybrid / Terrain natively.
        mapTypeControl: true,
        mapTypeControlOptions: {
          style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
          position: google.maps.ControlPosition.TOP_LEFT,
          mapTypeIds: ['roadmap', 'satellite', 'hybrid', 'terrain'],
        },
        zoomControl: true,
        scaleControl: true,            // distance scale bar
        streetViewControl: true,       // pegman
        fullscreenControl: true,
        gestureHandling: 'greedy',     // scroll-wheel zoom without holding Ctrl
        clickableIcons: false,
      });

      this.info = new google.maps.InfoWindow();
      this.map = map;
      this.mapReady = true;

      const snap = this.snapshot();
      if (snap) this.syncMarkers(snap.sessions);
    }));
  }

  private syncMarkers(sessions: GodSession[]): void {
    if (!this.map) return;
    const seen = new Set<string>();
    const bounds = new google.maps.LatLngBounds();
    let located = 0;

    for (const s of sessions) {
      if (!s.geo) continue;
      const key = s.userId + '|' + s.ip;
      seen.add(key);
      const pos = { lat: s.geo.lat, lng: s.geo.lon };
      bounds.extend(pos);
      located++;

      // Coloured circle marker (green = online, grey = idle) with the name label.
      const icon: google.maps.Symbol = {
        path: google.maps.SymbolPath.CIRCLE,
        scale: s.online ? 8 : 6,
        fillColor: s.online ? '#4ade80' : '#94a3b8',
        fillOpacity: 1,
        strokeColor: '#0b1020',
        strokeWeight: 2,
      };

      let m = this.markers.get(key);
      if (m) {
        m.setPosition(pos);
        m.setIcon(icon);
      } else {
        m = new google.maps.Marker({
          position: pos, map: this.map, icon,
          label: { text: s.name, color: '#0f172a', fontSize: '11px', fontWeight: '700' },
        });
        m.addListener('click', () => this.zone.run(() => {
          this.info?.setContent(this.popupHtml(s));
          this.info?.open({ map: this.map, anchor: m });
          this.selectUser(s.userId);
        }));
        this.markers.set(key, m);
      }
    }

    // Drop markers for sessions that aged out.
    for (const [key, m] of this.markers) {
      if (!seen.has(key)) { m.setMap(null); this.markers.delete(key); }
    }

    // Fit once, on first data with locations.
    if (located && !this.fitted) {
      this.map.fitBounds(bounds, 60);
      if (located === 1) this.map.setZoom(9);
      this.fitted = true;
    }
  }

  private popupHtml(s: GodSession): string {
    const loc = s.geo ? `${s.geo.city || ''}${s.geo.city ? ', ' : ''}${s.geo.region || ''}, ${s.geo.country || ''}` : 'Unknown';
    return `<div class="gv-popup">
      <strong>${this.escape(s.name)}</strong> ${s.online ? '🟢' : '⚪'}<br>
      <small>${this.escape(s.email || '')}</small><br>
      <b>IP:</b> ${s.ip}<br>
      <b>Where:</b> ${this.escape(loc)}<br>
      <b>ISP:</b> ${this.escape(s.geo?.isp || '—')}<br>
      <b>Device:</b> ${this.escape(s.device)}<br>
      <b>Doing:</b> ${this.escape(s.lastPath)}
    </div>`;
  }

  /**
   * Keep the newest log in view. Logs render newest-first, but prepending rows
   * makes the browser preserve the old scroll offset (pushing new lines above
   * the fold). Reset to top — unless the operator has deliberately scrolled
   * down to read history, in which case leave them alone.
   */
  private pinLogsToTop(): void {
    const el = this.logsScroll?.nativeElement;
    if (!el) return;
    if (el.scrollTop <= 80) {
      // Defer to after the DOM has rendered the new rows.
      requestAnimationFrame(() => { el.scrollTop = 0; });
    }
  }

  private panTo(lat: number, lng: number, zoom: number): void {
    if (!this.map) return;
    this.map.panTo({ lat, lng });
    if ((this.map.getZoom() ?? 0) < zoom) this.map.setZoom(zoom);
  }

  selectUser(userId: string | null): void {
    this.selectedUser.set(this.selectedUser() === userId ? null : userId);
    const sel = this.selectedUser();
    if (sel) {
      const s = this.sessions().find(x => x.userId === sel && x.geo);
      if (s?.geo) this.panTo(s.geo.lat, s.geo.lon, 10);
    }
  }

  focusSession(s: GodSession): void {
    if (s.geo) this.panTo(s.geo.lat, s.geo.lon, 11);
    this.selectUser(s.userId);
  }

  locationLabel(s: GodSession): string {
    if (!s.geo) return 'Locating…';
    return [s.geo.city, s.geo.region, s.geo.country].filter(Boolean).join(', ');
  }

  /** Open the detailed log view for one activity entry. */
  openActivity(a: GodActivity): void {
    this.detail.set(a);
    // Recentre the map on the actor if we know where they are.
    const s = this.detailSession();
    if (s?.geo) this.panTo(s.geo.lat, s.geo.lon, 9);
  }

  closeDetail(): void { this.detail.set(null); }

  /** Browser back — falls back to the schedule if there's no history to pop. */
  goBack(): void {
    this.playExit(() => {
      if (typeof window !== 'undefined' && window.history.length > 1) this.location.back();
      else this.router.navigate(['/schedule']);
    });
  }

  goForward(): void { this.location.forward(); }

  exitToApp(): void {
    this.playExit(() => this.router.navigate(['/schedule']));
  }

  /** Sarcastic power-down overlay + shutdown log sequence, then navigate. */
  private playExit(done: () => void): void {
    if (this.exiting()) return;
    this.exitLine.set(this.exitLines[Math.floor(Math.random() * this.exitLines.length)]);
    this.exiting.set(true);
    this.sub?.unsubscribe(); // stop polling while we leave
    setTimeout(() => done(), 2800);
  }

  logTime(ts: number): string {
    return new Date(ts).toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  }

  fullTime(ts: number): string {
    return new Date(ts).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata', hour12: true,
      weekday: 'short', day: 'numeric', month: 'short',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  }

  ago(ts: number): string {
    const sec = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (sec < 60) return `${sec}s ago`;
    if (sec < 3600) return `${Math.round(sec / 60)}m ago`;
    return `${Math.round(sec / 3600)}h ago`;
  }

  methodClass(m: string): string {
    return { GET: 'm-get', POST: 'm-post', PUT: 'm-put', PATCH: 'm-put', DELETE: 'm-del' }[m] ?? 'm-get';
  }

  private escape(s: string): string {
    return String(s ?? '').replace(/[&<>"]/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    for (const m of this.markers.values()) m.setMap(null);
    this.markers.clear();
    this.info?.close();
  }
}
