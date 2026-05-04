import {
  Component, DestroyRef, Output, EventEmitter, inject,
  signal, computed, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, debounceTime, distinctUntilChanged, from, of, switchMap, tap } from 'rxjs';
import { RxMasterService } from '../../../services/rx-master.service';
import { RxMedicine } from '../rx.interfaces';

@Component({
  selector: 'app-medicine-search',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './medicine-search.component.html',
  styleUrls: ['./medicine-search.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicineSearchComponent {
  @Output() medicineSelected = new EventEmitter<RxMedicine>();

  private master = inject(RxMasterService);
  private destroyRef = inject(DestroyRef);
  private input$ = new Subject<string>();

  query       = signal('');
  results     = signal<RxMedicine[]>([]);
  showResults = signal(false);
  searching   = signal(false);
  errorMsg    = signal<string | null>(null);
  highlighted = signal(0);

  readonly canSearch = computed(() => this.query().trim().length >= 2);
  readonly panelOpen = computed(() => this.showResults() && (this.canSearch() || this.searching()));

  constructor() {
    this.input$.pipe(
      tap(() => {
        this.errorMsg.set(null);
        this.highlighted.set(0);
      }),
      debounceTime(320),
      distinctUntilChanged(),
      switchMap(q => {
        const term = q.trim();
        if (term.length < 2) {
          this.searching.set(false);
          this.results.set([]);
          return of([]);
        }
        this.searching.set(true);
        return from(this.master.getMedicines(term)).pipe(
          catchError(() => {
            this.errorMsg.set('Could not load medicines. Check connection and try again.');
            return of([]);
          })
        );
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((res) => {
      this.results.set(res);
      this.searching.set(false);
    });
  }

  onInput(e: Event): void {
    const val = (e.target as HTMLInputElement).value;
    this.query.set(val);
    this.input$.next(val);
    this.showResults.set(true);
  }

  onFocus(): void { this.showResults.set(true); }
  onBlur():  void { setTimeout(() => this.showResults.set(false), 180); }

  onKeydown(event: KeyboardEvent): void {
    const list = this.results();
    if (!this.panelOpen()) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.highlighted.update(i => Math.min(i + 1, Math.max(list.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.highlighted.update(i => Math.max(i - 1, 0));
    } else if (event.key === 'Enter' && list.length) {
      event.preventDefault();
      this.select(list[this.highlighted()]);
    } else if (event.key === 'Escape') {
      this.showResults.set(false);
    }
  }

  select(med: RxMedicine): void {
    this.medicineSelected.emit(med);
    this.query.set('');
    this.results.set([]);
    this.showResults.set(false);
    this.highlighted.set(0);
  }

  trackById(_: number, item: RxMedicine): number { return item.id; }
}
