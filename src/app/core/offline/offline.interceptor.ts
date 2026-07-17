import {
  HttpInterceptorFn,
  HttpErrorResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { authApiConfig } from '../../auth/auth.config';
import { OfflineQueueService } from './offline-queue.service';

const MUTATING = ['POST', 'PUT', 'PATCH', 'DELETE'];

// Fire-and-forget / ephemeral endpoints that must never be queued for offline
// replay. Auth can't be replayed with a stale token; presence is live telemetry
// (precise location for the god view) where a replayed, minutes-old ping is
// worthless — and queuing it leaves a phantom "1 change to sync" that never drains.
const NON_QUEUEABLE = ['/auth/', '/presence/'];

/**
 * Queues mutating API requests when the device is offline (or a request fails
 * with a network error) and lets the OfflineQueueService replay them on
 * reconnect. Every eligible mutation gets an Idempotency-Key so a replayed
 * request is deduped server-side.
 *
 * Registered OUTSIDE authInterceptor so it enqueues the request before the auth
 * header is attached — replays then re-run authInterceptor for a fresh token.
 */
export const offlineInterceptor: HttpInterceptorFn = (req, next) => {
  const queue = inject(OfflineQueueService);

  const eligible =
    MUTATING.includes(req.method) &&
    req.url.includes(authApiConfig.baseUrl) &&
    !NON_QUEUEABLE.some(p => req.url.includes(p)) &&
    !req.headers.has('X-Offline-Replay');

  if (!eligible) return next(req);

  // Attach an idempotency key to every eligible mutation — online too, so a
  // request that dies mid-flight is still deduped when replayed.
  const key   = req.headers.get('Idempotency-Key') ?? crypto.randomUUID();
  const keyed = req.clone({ setHeaders: { 'Idempotency-Key': key } });

  const queueAndSignal = () => {
    queue.enqueue({
      method:  keyed.method,
      url:     keyed.urlWithParams,
      body:    keyed.body,
      headers: { 'Idempotency-Key': key },
    });
    return throwError(() => new HttpErrorResponse({
      status:     0,
      statusText: 'Offline',
      url:        keyed.url ?? undefined,
      error:      { error: 'offline_queued' },
    }));
  };

  if (!queue.isOnline) return queueAndSignal();

  return next(keyed).pipe(
    catchError((err: HttpErrorResponse) => {
      // status 0 == network failure (server unreachable) — queue for replay.
      if (err.status === 0) return queueAndSignal();
      return throwError(() => err);
    })
  );
};
