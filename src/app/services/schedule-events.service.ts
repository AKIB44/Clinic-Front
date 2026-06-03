import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * App-wide bus for "the schedule changed" signals.
 *
 * Any mutation that affects the schedule kanban (book, reschedule, cancel,
 * status transition, patient edit, voice booking via Friday, …) calls
 * `emit()` to nudge the schedule page into refetching, instead of relying
 * on a 60-second poll.
 *
 * Usage:
 *   // mutator
 *   this.scheduleEvents.emit('booked');
 *
 *   // listener
 *   this.scheduleEvents.changes$.pipe(takeUntil(destroy$)).subscribe(() => reload());
 */
@Injectable({ providedIn: 'root' })
export class ScheduleEventsService {
  private readonly _changes$ = new Subject<{ reason: string; at: number }>();
  readonly changes$ = this._changes$.asObservable();

  emit(reason: string): void {
    this._changes$.next({ reason, at: Date.now() });
  }
}
