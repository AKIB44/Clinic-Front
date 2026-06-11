import { Injectable, inject } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import { PatientFilesApiService, RawEvent } from './patient-files-api.service';

const DB_NAME = 'dentaflow_filecache';
const STORE = 'files';
const MEM_MAX = 6;                       // keep the last N buffers hot in memory
const IDB_MAX_BYTES = 400 * 1024 * 1024; // ~400 MB persistent budget

/**
 * Caches heavy file bytes so re-opening the same scan/model is instant instead of
 * re-downloading. Two tiers: an in-memory LRU (same session) and IndexedDB
 * (survives reloads), both keyed by file id.
 */
@Injectable({ providedIn: 'root' })
export class FileCacheService {
  private api = inject(PatientFilesApiService);
  private mem = new Map<string, ArrayBuffer>();
  private db: IDBDatabase | null = null;

  /** Emits download progress then the buffer — but resolves instantly from cache when available. */
  load(patientId: string, fileId: string): Observable<RawEvent> {
    const hot = this.mem.get(fileId);
    if (hot) return of({ progress: 100, buffer: hot });

    return from(this.idbGet(fileId)).pipe(
      switchMap((cached) => {
        if (cached) { this.putMem(fileId, cached); return of({ progress: 100, buffer: cached } as RawEvent); }
        return this.api.rawProgress(patientId, fileId).pipe(
          tap((ev) => { if (ev.buffer) { this.putMem(fileId, ev.buffer); this.idbPut(fileId, ev.buffer); } }),
        );
      }),
    );
  }

  evict(fileId: string): void {
    this.mem.delete(fileId);
    this.idbDelete(fileId).catch(() => {});
  }

  // ── memory LRU ───────────────────────────────────────────────────────────────
  private putMem(fileId: string, buf: ArrayBuffer): void {
    this.mem.delete(fileId);           // refresh recency
    this.mem.set(fileId, buf);
    while (this.mem.size > MEM_MAX) {
      const oldest = this.mem.keys().next().value;
      if (oldest === undefined) break;
      this.mem.delete(oldest);
    }
  }

  // ── IndexedDB tier ─────────────────────────────────────────────────────────────
  private openDb(): Promise<IDBDatabase> {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = (e) => { this.db = (e.target as IDBOpenDBRequest).result; resolve(this.db); };
      req.onerror = () => reject(req.error);
    });
  }

  private async idbGet(fileId: string): Promise<ArrayBuffer | null> {
    try {
      const db = await this.openDb();
      return await new Promise((resolve) => {
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        const r = store.get(fileId);
        r.onsuccess = () => {
          const row = r.result as { id: string; buffer: ArrayBuffer; used: number } | undefined;
          if (row) { row.used = Date.now(); store.put(row); resolve(row.buffer); } else resolve(null);
        };
        r.onerror = () => resolve(null);
      });
    } catch { return null; }
  }

  private async idbPut(fileId: string, buffer: ArrayBuffer): Promise<void> {
    try {
      const db = await this.openDb();
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put({ id: fileId, buffer, size: buffer.byteLength, used: Date.now() });
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
      this.enforceBudget().catch(() => {});
    } catch { /* cache write is best-effort */ }
  }

  private async idbDelete(fileId: string): Promise<void> {
    const db = await this.openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(fileId);
      tx.oncomplete = () => resolve(); tx.onerror = () => resolve();
    });
  }

  /** Evict least-recently-used IDB entries until under the byte budget. */
  private async enforceBudget(): Promise<void> {
    const db = await this.openDb();
    const rows: { id: string; size: number; used: number }[] = await new Promise((resolve) => {
      const out: { id: string; size: number; used: number }[] = [];
      const tx = db.transaction(STORE, 'readonly');
      const cur = tx.objectStore(STORE).openCursor();
      cur.onsuccess = () => {
        const c = cur.result;
        if (c) { const v = c.value; out.push({ id: v.id, size: v.size || 0, used: v.used || 0 }); c.continue(); }
        else resolve(out);
      };
      cur.onerror = () => resolve(out);
    });
    let total = rows.reduce((s, r) => s + r.size, 0);
    if (total <= IDB_MAX_BYTES) return;
    rows.sort((a, b) => a.used - b.used); // oldest first
    for (const r of rows) {
      if (total <= IDB_MAX_BYTES) break;
      await this.idbDelete(r.id); total -= r.size;
    }
  }
}
