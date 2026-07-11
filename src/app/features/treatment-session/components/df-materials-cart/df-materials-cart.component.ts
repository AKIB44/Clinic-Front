import {
  Component, input, computed, signal, inject, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, Subject, switchMap, of } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { MaterialModule } from '../../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { SessionStore } from '../../store/session.store';
import { SessionApiService } from '../../services/session-api.service';
import { ToastService } from '../../../../services/toast.service';
import { formatApiError } from '../../../../utils/api-error';
import {
  ServicePerformed, InventoryItem, InventoryBatch,
} from '../../models/session.model';

@Component({
  selector: 'df-materials-cart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule],
  templateUrl: './df-materials-cart.component.html',
  styleUrl: './df-materials-cart.component.scss',
})
export class DfMaterialsCartComponent {
  readonly service = input.required<ServicePerformed>();

  readonly store = inject(SessionStore);
  private api    = inject(SessionApiService);
  private toast  = inject(ToastService);

  readonly cartItems = computed(() =>
    this.store.cart().filter(i => i.service_id === this.service().id)
  );

  // ── Add form ──────────────────────────────────────────────────────────────
  showForm      = false;
  itemQuery     = '';
  searchResults = signal<InventoryItem[]>([]);
  selectedItem  = signal<InventoryItem | null>(null);
  batches       = signal<InventoryBatch[]>([]);
  searching     = signal(false);

  newBatchId    = '';
  newQuantity   = 1;
  newLotNumber  = '';
  newExpiry     = '';
  newScanned    = false;

  readonly adding    = signal(false);
  readonly addError  = signal<string | null>(null);
  readonly removing  = signal<string | null>(null);

  private search$ = new Subject<string>();

  constructor() {
    this.search$.pipe(
      debounceTime(250),
      distinctUntilChanged(),
      switchMap(q => {
        if (!q.trim()) { this.searchResults.set([]); return of(null); }
        this.searching.set(true);
        return this.api.searchInventoryItems(q);
      }),
    ).subscribe({
      next: (res) => {
        this.searching.set(false);
        if (res) this.searchResults.set(res.items);
      },
      error: () => this.searching.set(false),
    });
  }

  openForm(): void {
    this.showForm      = true;
    this.itemQuery     = '';
    this.searchResults.set([]);
    this.selectedItem.set(null);
    this.batches.set([]);
    this.newBatchId    = '';
    this.newQuantity   = 1;
    this.newLotNumber  = '';
    this.newExpiry     = '';
    this.newScanned    = false;
    this.addError.set(null);
  }

  closeForm(): void { this.showForm = false; }

  onQueryChange(): void { this.search$.next(this.itemQuery); }

  selectItem(item: InventoryItem): void {
    this.selectedItem.set(item);
    this.itemQuery     = item.name;
    this.searchResults.set([]);
    this.newBatchId    = '';
    this.newLotNumber  = '';
    this.newExpiry     = '';
    this.newScanned    = false;

    if (item.is_traceable) {
      this.api.getItemBatches(item.id).subscribe({
        next: ({ batches }) => this.batches.set(batches),
      });
    }
  }

  onBatchSelected(): void {
    const batch = this.batches().find(b => b.id === this.newBatchId);
    if (batch) {
      this.newLotNumber = batch.lot_number ?? '';
      this.newExpiry    = batch.expiry_date ?? '';
    }
  }

  canAdd(): boolean {
    const item = this.selectedItem();
    if (!item || !this.newQuantity) return false;
    if (item.is_implant && !this.newLotNumber.trim()) return false;
    return true;
  }

  addItem(): void {
    const item      = this.selectedItem();
    const sessionId = this.store.sessionId();
    if (!item || !sessionId) return;

    this.adding.set(true);
    this.addError.set(null);

    this.api.addCartItem(sessionId, {
      service_id:        this.service().id,
      inventory_item_id: item.id,
      batch_id:          this.newBatchId || undefined,
      quantity:          this.newQuantity,
      unit:              item.unit,
      lot_number:        this.newLotNumber.trim() || undefined,
      expiry_date:       this.newExpiry || undefined,
      scanned:           this.newScanned,
    }).pipe(finalize(() => this.adding.set(false))).subscribe({
      next: ({ cart_item }) => {
        this.store.addCartItem(cart_item);
        this.closeForm();
        this.toast.success(`${item.name} added to cart.`);
      },
      error: (err) => {
        const msg = formatApiError(err, 'Failed to add item.');
        this.addError.set(msg);
        this.toast.error(msg);
      },
    });
  }

  removeItem(id: string): void {
    const sessionId = this.store.sessionId();
    if (!sessionId) return;
    this.removing.set(id);
    this.api.removeCartItem(sessionId, id)
      .pipe(finalize(() => this.removing.set(null)))
      .subscribe({
        next: () => {
          this.store.removeCartItem(id);
          this.toast.warn('Item removed from cart.');
        },
        error: () => this.toast.error('Could not remove item.'),
      });
  }

  stateClass(state: string): string {
    return `s-${state.toLowerCase()}`;
  }

  formatQty(qty: number, unit: string): string {
    return `${qty} ${unit}`;
  }
}
