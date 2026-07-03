import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ToastService } from '../../services/toast.service';

export interface QueuedRequest {
  id: string;
  method: string;
  url: string;
  body: unknown;
  headers: Record<string, string>;
  queuedAt: number;
}

const DB_NAME    = 'dentaflow_offline';
const STORE_NAME = 'request_queue';
const DB_VERSION = 1;

/**
 * True when an HttpErrorResponse is the "queued for offline replay" signal the
 * offline interceptor emits (status 0 + `offline_queued`). Callers use it to
 * treat the mutation as a local success and update the UI optimistically.
 */
export function isOfflineQueued(err: unknown): boolean {
  const e = err as { status?: number; error?: { error?: string } } | null;
  return !!e && e.status === 0 && e.error?.error === 'offline_queued';
}

/**
 * App-wide offline write queue. Mutations that can't reach the server (because the
 * device is offline, or a request fails with a network error) are persisted to
 * IndexedDB by the offline interceptor and replayed in order once connectivity
 * returns. Each request carries an Idempotency-Key so replays never duplicate
 * server-side records.
 */
@Injectable({ providedIn: 'root' })
export class OfflineQueueService {
  private http  = inject(HttpClient);
  private toast = inject(ToastService);

  private db: IDBDatabase | null = null;
  private flushing = false;

  /** Live connectivity + queue state for banners, pills and seal-gating. */
  readonly online       = signal<boolean>(navigator.onLine);
  readonly queueDepth   = signal<number>(0);
  readonly lastSyncedAt = signal<number | null>(null);

  /** Animated full-screen greeting shown on connectivity transitions. */
  readonly greeting = signal<{ kind: 'online' | 'offline'; title: string } | null>(null);
  private greetingTimer?: ReturnType<typeof setTimeout>;

  // Light-hearted lines shown when the connection drops.
  private readonly OFFLINE_QUIPS = [
    'Internet took a coffee break ☕ — we’ve got your back.',
    'Wi-Fi ghosted you 👻 — keep working, we’ll sync later.',
    'Offline mode engaged — your edits are safe with us.',
    'No signal? No drama. We’ll sync it all when you’re back.',
  ];

  constructor() {
    this.openDb();
    window.addEventListener('online',  () => {
      this.online.set(true);
      this.playTone('connect');
      this.showGreeting('online');
      this.flush();
    });
    window.addEventListener('offline', () => {
      this.online.set(false);
      this.playTone('disconnect');
      this.showGreeting('offline');
    });
  }

  // ── Connectivity greeting ───────────────────────────────────────────────────

  private showGreeting(kind: 'online' | 'offline'): void {
    let title: string;
    if (kind === 'online') {
      const h    = new Date().getHours();
      const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
      title = `${part}! You’re back online`;
    } else {
      title = this.OFFLINE_QUIPS[Math.floor(Math.random() * this.OFFLINE_QUIPS.length)];
    }
    this.greeting.set({ kind, title });
    clearTimeout(this.greetingTimer);
    this.greetingTimer = setTimeout(() => this.greeting.set(null), 4500);
  }

  dismissGreeting(): void {
    clearTimeout(this.greetingTimer);
    this.greeting.set(null);
  }

  // ── Connectivity alert tones (Web Audio — no asset files, works offline) ────

  private playTone(kind: 'connect' | 'disconnect'): void {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const now = ctx.currentTime;
      // Rising major triad for "connected", falling two-tone for "disconnected".
      const seq = kind === 'connect' ? [523.25, 659.25, 783.99] : [493.88, 369.99];
      seq.forEach((freq, i) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const t = now + i * 0.13;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.22);
      });
      setTimeout(() => ctx.close().catch(() => {}), 1000);
    } catch {
      /* audio unavailable or blocked by autoplay policy — ignore */
    }
  }

  get isOnline(): boolean { return this.online(); }

  // ── IndexedDB plumbing ──────────────────────────────────────────────────────

  private openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      req.onsuccess = (e) => {
        this.db = (e.target as IDBOpenDBRequest).result;
        this.syncDepth();
        if (this.online()) this.flush(); // drain anything left from a previous session
        resolve(this.db);
      };
      req.onerror = () => reject(req.error);
    });
  }

  private getDb(): Promise<IDBDatabase> {
    return this.db ? Promise.resolve(this.db) : this.openDb();
  }

  enqueue(req: Omit<QueuedRequest, 'id' | 'queuedAt'>): Promise<void> {
    const entry: QueuedRequest = { ...req, id: crypto.randomUUID(), queuedAt: Date.now() };
    return this.getDb().then(db => new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).add(entry);
      tx.oncomplete = () => { this.syncDepth(); resolve(); };
      tx.onerror    = () => reject(tx.error);
    }));
  }

  private dequeue(id: string): Promise<void> {
    return this.getDb().then(db => new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => { this.syncDepth(); resolve(); };
      tx.onerror    = () => reject(tx.error);
    }));
  }

  private getAll(): Promise<QueuedRequest[]> {
    return this.getDb().then(db => new Promise<QueuedRequest[]>((resolve, reject) => {
      const tx  = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result as QueuedRequest[]);
      req.onerror   = () => reject(req.error);
    }));
  }

  private syncDepth(): void {
    this.getAll().then(items => this.queueDepth.set(items.length)).catch(() => {});
  }

  // ── Replay / flush ──────────────────────────────────────────────────────────

  /**
   * Replay queued requests oldest-first. A request that fails with a 4xx is
   * non-retryable (validation/permission/conflict) and is dropped so it can't
   * block the queue forever; a network error or 5xx stops the drain and leaves
   * the queue intact for the next reconnect.
   */
  async flush(): Promise<void> {
    if (!this.online() || this.flushing) return;
    this.flushing = true;
    let synced = 0;
    try {
      const items = (await this.getAll()).sort((a, b) => a.queuedAt - b.queuedAt);
      for (const item of items) {
        if (!this.online()) break;
        try {
          await firstValueFrom(this.replay(item));
          await this.dequeue(item.id);
          synced++;
        } catch (err) {
          const status = (err as HttpErrorResponse)?.status;
          if (status >= 400 && status < 500) {
            await this.dequeue(item.id); // dead-letter: non-retryable
            continue;
          }
          break; // network (0) or 5xx — keep and retry on next reconnect
        }
      }
    } finally {
      this.flushing = false;
    }

    const remaining = await this.getAll();
    this.queueDepth.set(remaining.length);
    if (synced > 0 && remaining.length === 0) {
      this.lastSyncedAt.set(Date.now());
      this.toast.success('All offline changes synced.');
    }
  }

  private replay(item: QueuedRequest) {
    const headers = new HttpHeaders({ ...item.headers, 'X-Offline-Replay': '1' });
    // Typed request form resolves to the response body and completes after it,
    // so firstValueFrom settles on success/error rather than an interim event.
    return this.http.request(item.method, item.url, { body: item.body, headers });
  }
}
