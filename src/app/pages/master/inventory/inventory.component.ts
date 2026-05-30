import {
  Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef,
  inject, signal, Inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule, FormGroup, FormControl, FormArray, Validators, AbstractControl,
} from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule, MatDialog, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatBadgeModule } from '@angular/material/badge';
import {
  InventoryService, InventoryItem, StockLevel, CreateItemPayload, UpdateItemPayload,
  StockMovement, PurchaseOrder, PurchaseOrderLine, CreatePOPayload, CreatePOLinePayload,
} from '../../../services/inventory.service';
import { ActivatedRoute } from '@angular/router';
import { InventoryAlertsService, InventoryAlert } from '../../../services/inventory-alerts.service';

// ── Item Form Dialog ──────────────────────────────────────────────────────────

@Component({
  selector: 'inv-item-form-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatDialogModule, MatCheckboxModule],
  template: `
    <h2 mat-dialog-title>{{ data?.id ? 'Edit Item' : 'Add Item' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="inv-dialog-form">
        <mat-form-field appearance="outline" class="full">
          <mat-label>Item Name</mat-label>
          <input matInput formControlName="name" placeholder="e.g. Composite Resin A2">
          <mat-error *ngIf="form.get('name')?.hasError('required')">Required</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full">
          <mat-label>Generic / Brand Name</mat-label>
          <input matInput formControlName="generic_name" placeholder="Optional">
        </mat-form-field>

        <div class="two-col">
          <mat-form-field appearance="outline">
            <mat-label>Category</mat-label>
            <mat-select formControlName="category">
              <mat-option *ngFor="let c of categories" [value]="c.value">{{ c.label }}</mat-option>
            </mat-select>
            <mat-error *ngIf="form.get('category')?.hasError('required')">Required</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Unit</mat-label>
            <mat-select formControlName="unit">
              <mat-option *ngFor="let u of units" [value]="u">{{ u }}</mat-option>
            </mat-select>
            <mat-error *ngIf="form.get('unit')?.hasError('required')">Required</mat-error>
          </mat-form-field>
        </div>

        <div class="two-col">
          <mat-form-field appearance="outline">
            <mat-label>Reorder At (qty)</mat-label>
            <input matInput type="number" formControlName="reorder_point" min="0">
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Reorder Qty</mat-label>
            <input matInput type="number" formControlName="reorder_quantity" min="0">
          </mat-form-field>
        </div>

        <div class="checkbox-row">
          <mat-checkbox formControlName="is_traceable">Batch traceable</mat-checkbox>
          <mat-checkbox formControlName="is_implant">Implant</mat-checkbox>
        </div>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-stroked-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" [disabled]="form.invalid" (click)="submit()">
        {{ data?.id ? 'Save Changes' : 'Add Item' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .inv-dialog-form { display: flex; flex-direction: column; gap: 4px; min-width: 420px; padding-top: 8px; }
    .full { width: 100%; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .checkbox-row { display: flex; gap: 24px; margin-top: 4px; margin-bottom: 8px; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemFormDialogComponent {
  data = inject<InventoryItem | null>(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef);

  categories = [
    { value: 'dental_material', label: 'Dental Material' },
    { value: 'implant',         label: 'Implant' },
    { value: 'membrane',        label: 'Membrane' },
    { value: 'medication',      label: 'Medication' },
    { value: 'disposable',      label: 'Disposable' },
    { value: 'equipment',       label: 'Equipment' },
  ];

  units = ['piece', 'box', 'ml', 'mg', 'gm', 'tube', 'vial', 'sachet', 'roll', 'pair'];

  form = new FormGroup({
    name:             new FormControl(this.data?.name ?? '', Validators.required),
    generic_name:     new FormControl(this.data?.generic_name ?? ''),
    category:         new FormControl(this.data?.category ?? 'dental_material', Validators.required),
    unit:             new FormControl(this.data?.unit ?? 'piece', Validators.required),
    reorder_point:    new FormControl(this.data?.reorder_point ?? 0),
    reorder_quantity: new FormControl(this.data?.reorder_quantity ?? 0),
    is_traceable:     new FormControl(this.data?.is_traceable ?? false),
    is_implant:       new FormControl(this.data?.is_implant ?? false),
  });

  submit(): void {
    if (this.form.invalid) return;
    this.ref.close(this.form.value);
  }
}

// ── Purchase Order Dialog ─────────────────────────────────────────────────────

export interface PODialogData {
  items: InventoryItem[];
  prefill?: InventoryAlert[];
}

@Component({
  selector: 'inv-po-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatIconModule, MatDialogModule,
    MatDatepickerModule, MatNativeDateModule],
  template: `
    <h2 mat-dialog-title>Create Purchase Order</h2>
    <mat-dialog-content class="po-dialog-content">
      <form [formGroup]="form" class="po-form">

        <div class="po-header-row">
          <mat-form-field appearance="outline" class="full">
            <mat-label>Supplier</mat-label>
            <input matInput formControlName="supplier" placeholder="Optional">
          </mat-form-field>
          <mat-form-field appearance="outline" class="full">
            <mat-label>Notes</mat-label>
            <input matInput formControlName="notes" placeholder="Optional">
          </mat-form-field>
        </div>

        <div class="po-lines-header">
          <span class="po-lines-title">Line Items ({{ lines.length }})</span>
          <button type="button" mat-stroked-button (click)="addLine()">
            <mat-icon>add</mat-icon> Add Line
          </button>
        </div>

        <div formArrayName="lines" class="po-lines">
          @for (line of lines.controls; track $index; let i = $index) {
            <div [formGroupName]="i" class="po-line-row">
              <mat-form-field appearance="outline" class="po-line__item">
                <mat-label>Item</mat-label>
                <mat-select formControlName="inventory_item_id"
                            (selectionChange)="onLineItemSelected(i, $event.value)">
                  @for (item of data.items; track item.id) {
                    <mat-option [value]="item.id">{{ item.name }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline" class="po-line__qty">
                <mat-label>Qty</mat-label>
                <input matInput type="number" formControlName="quantity" min="0.001" step="any">
              </mat-form-field>

              <mat-form-field appearance="outline" class="po-line__unit">
                <mat-label>Unit</mat-label>
                <mat-select formControlName="unit">
                  @for (u of units; track u) {
                    <mat-option [value]="u">{{ u }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline" class="po-line__cost">
                <mat-label>Unit Cost (₹)</mat-label>
                <input matInput type="number" formControlName="unit_cost" min="0" step="any">
              </mat-form-field>

              <button type="button" mat-icon-button color="warn"
                      (click)="removeLine(i)" [disabled]="lines.length === 1">
                <mat-icon>delete</mat-icon>
              </button>
            </div>
          }
        </div>

      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-stroked-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" [disabled]="form.invalid" (click)="submit()">
        Create PO
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .po-dialog-content { min-width: min(600px, 95vw); }
    .po-form { display: flex; flex-direction: column; gap: 8px; padding-top: 8px; }
    .po-header-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .full { width: 100%; }
    .po-lines-header { display: flex; align-items: center; justify-content: space-between; margin: 8px 0 4px; }
    .po-lines-title { font-size: 13px; font-weight: 600; color: #64748b; }
    .po-lines { display: flex; flex-direction: column; gap: 4px; }
    .po-line-row { display: flex; align-items: flex-start; gap: 8px; }
    .po-line__item { flex: 2; }
    .po-line__qty, .po-line__unit, .po-line__cost { flex: 1; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchaseOrderDialogComponent implements OnInit {
  data = inject<PODialogData>(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef);

  units = ['piece', 'box', 'ml', 'mg', 'gm', 'tube', 'vial', 'sachet', 'roll', 'pair'];

  form = new FormGroup({
    supplier: new FormControl<string>(''),
    notes:    new FormControl<string>(''),
    lines:    new FormArray<FormGroup>([]),
  });

  get lines(): FormArray { return this.form.get('lines') as FormArray; }

  ngOnInit(): void {
    if (this.data.prefill?.length) {
      for (const alert of this.data.prefill) {
        this.addLine(alert.id, alert.unit, alert.shortage > 0 ? alert.shortage : alert.reorder_quantity);
      }
    } else {
      this.addLine();
    }
  }

  addLine(itemId = '', unit = 'piece', qty: number | null = null): void {
    this.lines.push(new FormGroup({
      inventory_item_id: new FormControl(itemId, Validators.required),
      quantity:          new FormControl<number | null>(qty, [Validators.required, Validators.min(0.001)]),
      unit:              new FormControl(unit, Validators.required),
      unit_cost:         new FormControl<number | null>(null),
    }));
  }

  removeLine(i: number): void { this.lines.removeAt(i); }

  onLineItemSelected(i: number, itemId: string): void {
    const item = this.data.items.find(it => it.id === itemId);
    if (item) this.lines.at(i).patchValue({ unit: item.unit });
  }

  submit(): void {
    if (this.form.invalid) return;
    this.ref.close(this.form.value);
  }
}

// ── Main Component ─────────────────────────────────────────────────────────────

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    MatTableModule, MatTabsModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule,
    MatTooltipModule, MatDialogModule, MatChipsModule, MatDividerModule,
    MatCheckboxModule, MatDatepickerModule, MatNativeDateModule, MatBadgeModule,
  ],
  templateUrl: './inventory.component.html',
  styleUrls:   ['./inventory.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryComponent implements OnInit {
  private svc       = inject(InventoryService);
  private alertsSvc = inject(InventoryAlertsService);
  private route     = inject(ActivatedRoute);
  private cdr       = inject(ChangeDetectorRef);
  private dialog    = inject(MatDialog);
  private snack     = inject(MatSnackBar);

  // ── Dashboard / catalog state ─────────────────────────────────────────────
  stock    = signal<StockLevel[]>([]);
  items    = signal<InventoryItem[]>([]);
  loading  = signal(false);
  saving   = signal(false);

  alerts          = this.alertsSvc.alerts;
  alertCount      = this.alertsSvc.alertCount;
  inventoryValue  = signal(0);

  selectedTabIndex = 0;
  stockFilter = '';

  stockColumns = ['name', 'category', 'stock', 'status', 'reorder', 'expiring'];
  itemColumns  = ['name', 'category', 'unit', 'reorder', 'traceable', 'actions'];

  categories: Record<string, string | undefined> = {
    dental_material: 'Dental Material',
    implant:         'Implant',
    membrane:        'Membrane',
    medication:      'Medication',
    disposable:      'Disposable',
    equipment:       'Equipment',
  };

  units = ['piece', 'box', 'ml', 'mg', 'gm', 'tube', 'vial', 'sachet', 'roll', 'pair'];

  receiveForm = new FormGroup({
    item_id:          new FormControl('', Validators.required),
    lot_number:       new FormControl(''),
    expiry_date:      new FormControl<Date | null>(null),
    initial_quantity: new FormControl<number | null>(null, [Validators.required, Validators.min(0.001)]),
    unit:             new FormControl('piece', Validators.required),
    unit_cost:        new FormControl<number | null>(null),
    supplier:         new FormControl(''),
    received_at:      new FormControl<Date | null>(null),
  });

  // ── Reports state ─────────────────────────────────────────────────────────
  movements     = signal<StockMovement[]>([]);
  loadingMoves  = signal(false);
  movesLoaded   = false;
  movFilter = {
    item_id: '',
    type:    '',
    from:    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    to:      new Date(),
  };

  movColumns = ['date', 'item', 'type', 'qty', 'cost', 'source'];

  // ── Purchase Order state ──────────────────────────────────────────────────
  pos       = signal<PurchaseOrder[]>([]);
  loadingPOs = signal(false);
  posLoaded  = false;

  poColumns = ['po_number', 'supplier', 'status', 'lines', 'created', 'actions'];

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadStock();
    this.loadItems();
    this.alertsSvc.refresh();
    this.loadInventoryValue();

    const tab = this.route.snapshot.queryParamMap.get('tab');
    const tabMap: Record<string, number> = {
      dashboard: 0, catalog: 1, receive: 2, alerts: 3, reports: 4, orders: 5,
    };
    if (tab && tabMap[tab] !== undefined) {
      this.selectedTabIndex = tabMap[tab];
      if (tab === 'reports') this.loadMovements();
      if (tab === 'orders')  this.loadPOs();
    }
  }

  onTabChange(index: number): void {
    if (index === 4 && !this.movesLoaded) this.loadMovements();
    if (index === 5 && !this.posLoaded)   this.loadPOs();
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────
  loadStock(): void {
    this.loading.set(true);
    this.svc.getStock().subscribe({
      next: (res) => {
        this.stock.set(res.stock);
        this.loading.set(false);
        this.alertsSvc.refresh();
        this.loadInventoryValue();
        this.cdr.markForCheck();
      },
      error: () => { this.loading.set(false); this.cdr.markForCheck(); },
    });
  }

  loadItems(): void {
    this.svc.searchItems('', 200).subscribe({
      next: (res) => { this.items.set(res.items); this.cdr.markForCheck(); },
      error: () => {},
    });
  }

  loadInventoryValue(): void {
    this.svc.getInventoryValue().subscribe({
      next: (res) => { this.inventoryValue.set(res.total_value); this.cdr.markForCheck(); },
      error: () => {},
    });
  }

  get filteredStock(): StockLevel[] {
    const q = this.stockFilter.toLowerCase();
    if (!q) return this.stock();
    return this.stock().filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.generic_name ?? '').toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q)
    );
  }

  get totalItems(): number  { return this.stock().length; }
  get inStock(): number     { return this.stock().filter(s => s.qty_on_hand > s.reorder_point).length; }
  get lowStock(): number    { return this.stock().filter(s => s.qty_on_hand > 0 && s.qty_on_hand <= s.reorder_point).length; }
  get outOfStock(): number  { return this.stock().filter(s => s.qty_on_hand <= 0).length; }

  stockStatus(item: StockLevel): 'in-stock' | 'low' | 'out' {
    if (item.qty_on_hand <= 0)                   return 'out';
    if (item.qty_on_hand <= item.reorder_point)  return 'low';
    return 'in-stock';
  }

  // ── Item catalog ──────────────────────────────────────────────────────────
  openAddItem(): void {
    const ref = this.dialog.open(ItemFormDialogComponent, {
      data: null, width: '500px', maxWidth: '95vw',
    });
    ref.afterClosed().subscribe((payload: CreateItemPayload | undefined) => {
      if (!payload) return;
      this.saving.set(true);
      this.svc.createItem(payload).subscribe({
        next: (res) => {
          this.items.update(list => [res.item, ...list]);
          this.snack.open('Item added', 'OK', { duration: 3000 });
          this.saving.set(false);
          this.loadStock();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.snack.open(err?.error?.error ?? 'Failed to add item', 'Close', { duration: 4000 });
          this.saving.set(false);
          this.cdr.markForCheck();
        },
      });
    });
  }

  openEditItem(item: InventoryItem): void {
    const ref = this.dialog.open(ItemFormDialogComponent, {
      data: item, width: '500px', maxWidth: '95vw',
    });
    ref.afterClosed().subscribe((payload: UpdateItemPayload | undefined) => {
      if (!payload) return;
      this.saving.set(true);
      this.svc.updateItem(item.id, payload).subscribe({
        next: (res) => {
          this.items.update(list => list.map(i => i.id === res.item.id ? res.item : i));
          this.snack.open('Item updated', 'OK', { duration: 3000 });
          this.saving.set(false);
          this.loadStock();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.snack.open(err?.error?.error ?? 'Failed to update item', 'Close', { duration: 4000 });
          this.saving.set(false);
          this.cdr.markForCheck();
        },
      });
    });
  }

  // ── Receive Stock ─────────────────────────────────────────────────────────
  onItemSelected(itemId: string): void {
    const item = this.items().find(i => i.id === itemId);
    if (item) this.receiveForm.patchValue({ unit: item.unit });
  }

  submitReceive(): void {
    if (this.receiveForm.invalid) return;
    const v = this.receiveForm.value;
    const expiry   = v.expiry_date   ? (v.expiry_date as Date).toISOString().split('T')[0]   : null;
    const received = v.received_at   ? (v.received_at as Date).toISOString().split('T')[0]   : undefined;

    this.saving.set(true);
    this.svc.receiveBatch(v.item_id!, {
      lot_number:       v.lot_number || undefined,
      expiry_date:      expiry,
      initial_quantity: v.initial_quantity!,
      unit:             v.unit!,
      unit_cost:        v.unit_cost ?? null,
      supplier:         v.supplier || undefined,
      received_at:      received,
    }).subscribe({
      next: () => {
        this.snack.open('Stock received successfully', 'OK', { duration: 3000 });
        this.receiveForm.reset({ unit: 'piece' });
        this.saving.set(false);
        this.loadStock();
        if (this.movesLoaded) this.loadMovements();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.snack.open(err?.error?.error ?? 'Failed to receive stock', 'Close', { duration: 4000 });
        this.saving.set(false);
        this.cdr.markForCheck();
      },
    });
  }

  // ── Alerts ────────────────────────────────────────────────────────────────
  alertLabel(alert: InventoryAlert): string {
    return alert.alert_type === 'OUT_OF_STOCK' ? 'Out of Stock' : 'Low Stock';
  }

  orderNow(alert: InventoryAlert): void {
    this.receiveForm.patchValue({ item_id: alert.id, unit: alert.unit });
    this.selectedTabIndex = 2;
    this.cdr.markForCheck();
  }

  // ── Reports ───────────────────────────────────────────────────────────────
  loadMovements(): void {
    this.loadingMoves.set(true);
    const from = this.movFilter.from ? this.movFilter.from.toISOString() : undefined;
    const to   = this.movFilter.to   ? new Date(this.movFilter.to.getTime() + 86400000).toISOString() : undefined;
    this.svc.getMovements({
      item_id: this.movFilter.item_id || undefined,
      type:    this.movFilter.type    || undefined,
      from, to,
    }).subscribe({
      next: (res) => {
        this.movements.set(res.movements);
        this.movesLoaded = true;
        this.loadingMoves.set(false);
        this.cdr.markForCheck();
      },
      error: () => { this.loadingMoves.set(false); this.cdr.markForCheck(); },
    });
  }

  applyMovFilter(): void { this.loadMovements(); }

  get totalConsumed(): number {
    return this.movements()
      .filter(m => m.movement_type === 'CONSUMPTION')
      .reduce((s, m) => s + Number(m.quantity), 0);
  }

  get totalReceived(): number {
    return this.movements()
      .filter(m => m.movement_type === 'GOODS_RECEIPT')
      .reduce((s, m) => s + Number(m.quantity), 0);
  }

  movTypeLabel(type: string): string {
    const map: Record<string, string> = {
      GOODS_RECEIPT: 'Receipt',
      CONSUMPTION:   'Used',
      ADJUSTMENT:    'Adjustment',
    };
    return map[type] ?? type;
  }

  movTypeClass(type: string): string {
    const map: Record<string, string> = {
      GOODS_RECEIPT: 'mov--in',
      CONSUMPTION:   'mov--out',
      ADJUSTMENT:    'mov--adj',
    };
    return map[type] ?? '';
  }

  // ── Purchase Orders ───────────────────────────────────────────────────────
  loadPOs(): void {
    this.loadingPOs.set(true);
    this.svc.getPurchaseOrders().subscribe({
      next: (res) => {
        this.pos.set(res.purchase_orders);
        this.posLoaded = true;
        this.loadingPOs.set(false);
        this.cdr.markForCheck();
      },
      error: () => { this.loadingPOs.set(false); this.cdr.markForCheck(); },
    });
  }

  openCreatePO(prefill?: InventoryAlert[]): void {
    const ref = this.dialog.open(PurchaseOrderDialogComponent, {
      data: { items: this.items(), prefill } as PODialogData,
      width: '720px', maxWidth: '95vw',
    });
    ref.afterClosed().subscribe((payload: { supplier: string; notes: string; lines: any[] } | undefined) => {
      if (!payload) return;
      const po: CreatePOPayload = {
        supplier: payload.supplier || undefined,
        notes:    payload.notes    || undefined,
        lines:    payload.lines.map((l: any) => ({
          inventory_item_id: l.inventory_item_id,
          quantity:          l.quantity,
          unit:              l.unit,
          unit_cost:         l.unit_cost ?? null,
        })),
      };
      this.saving.set(true);
      this.svc.createPurchaseOrder(po).subscribe({
        next: (res) => {
          this.pos.update(list => [res.purchase_order, ...list]);
          this.posLoaded = true;
          this.snack.open(`Purchase order ${res.purchase_order.po_number} created`, 'OK', { duration: 3000 });
          this.saving.set(false);
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.snack.open(err?.error?.error ?? 'Failed to create PO', 'Close', { duration: 4000 });
          this.saving.set(false);
          this.cdr.markForCheck();
        },
      });
    });
  }

  changePOStatus(po: PurchaseOrder, action: 'send' | 'receive' | 'cancel'): void {
    this.svc.updatePOStatus(po.id, action).subscribe({
      next: (res) => {
        this.pos.update(list => list.map(p => p.id === res.purchase_order.id ? { ...p, ...res.purchase_order } : p));
        const labels = { send: 'marked as sent', receive: 'received — stock updated', cancel: 'cancelled' };
        this.snack.open(`PO ${po.po_number} ${labels[action]}`, 'OK', { duration: 3500 });
        if (action === 'receive') {
          this.loadStock();
          if (this.movesLoaded) this.loadMovements();
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.snack.open(err?.error?.error ?? 'Failed to update PO', 'Close', { duration: 4000 });
        this.cdr.markForCheck();
      },
    });
  }

  poStatusClass(status: string): string {
    const map: Record<string, string> = {
      draft:     'po-status--draft',
      sent:      'po-status--sent',
      received:  'po-status--received',
      cancelled: 'po-status--cancelled',
    };
    return map[status] ?? '';
  }

  poStatusLabel(status: string): string {
    const map: Record<string, string> = {
      draft: 'Draft', sent: 'Sent', received: 'Received', cancelled: 'Cancelled',
    };
    return map[status] ?? status;
  }
}
