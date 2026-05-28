import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpRequest } from '@angular/common/http';
import { SessionStore } from '../store/session.store';
import { Observable, from, of } from 'rxjs';
import { concatMap, catchError } from 'rxjs/operators';

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

@Injectable({ providedIn: 'root' })
export class OfflineQueueService {
  private store = inject(SessionStore);
  private http  = inject(HttpClient);

  private db: IDBDatabase | null = null;
  private online = navigator.onLine;

  constructor() {
    this.openDb();
    window.addEventListener('online',  () => { this.online = true;  this.flush(); });
    window.addEventListener('offline', () => { this.online = false; });
  }

  get isOnline(): boolean { return this.online; }

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
        resolve(this.db);
      };
      req.onerror = () => reject(req.error);
    });
  }

  private getDb(): Promise<IDBDatabase> {
    if (this.db) return Promise.resolve(this.db);
    return this.openDb();
  }

  enqueue(req: Omit<QueuedRequest, 'id' | 'queuedAt'>): Promise<void> {
    const entry: QueuedRequest = {
      ...req,
      id:       crypto.randomUUID(),
      queuedAt: Date.now(),
    };
    return this.getDb().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).add(entry);
      tx.oncomplete = () => { this.syncDepth(); resolve(); };
      tx.onerror    = () => reject(tx.error);
    }));
  }

  private dequeue(id: string): Promise<void> {
    return this.getDb().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => { this.syncDepth(); resolve(); };
      tx.onerror    = () => reject(tx.error);
    }));
  }

  private getAll(): Promise<QueuedRequest[]> {
    return this.getDb().then(db => new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result as QueuedRequest[]);
      req.onerror   = () => reject(req.error);
    }));
  }

  private syncDepth(): void {
    this.getAll().then(items => this.store.offlineQueueDepth.set(items.length)).catch(() => {});
  }

  flush(): void {
    if (!this.online) return;
    from(this.getAll()).pipe(
      concatMap(items =>
        from(items).pipe(
          concatMap(item =>
            this.replay(item).pipe(
              catchError(() => of(null))
            )
          )
        )
      )
    ).subscribe();
  }

  private replay(item: QueuedRequest): Observable<unknown> {
    return new Observable(observer => {
      const req = new HttpRequest(item.method as any, item.url, item.body, {
        headers: item.headers as any,
      });
      this.http.request(req).subscribe({
        next:     () => {},
        complete: () => { this.dequeue(item.id); observer.complete(); },
        error:    (err) => observer.error(err),
      });
    });
  }

  /** Returns current queue depth synchronously from the store signal */
  get depth(): number {
    return this.store.offlineQueueDepth();
  }
}
