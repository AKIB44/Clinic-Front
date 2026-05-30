import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { authApiConfig } from '../auth/auth.config';

export interface InventoryItem {
  id: string;
  name: string;
  generic_name: string | null;
  category: string;
  unit: string;
  is_traceable: boolean;
  is_implant: boolean;
  reorder_point: number;
  reorder_quantity: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StockLevel extends InventoryItem {
  qty_on_hand: number;
  expiring_soon_batches: number;
}

export interface InventoryBatch {
  id: string;
  inventory_item_id: string;
  lot_number: string | null;
  expiry_date: string | null;
  initial_quantity: number;
  unit: string;
  supplier: string | null;
  received_at: string;
  qty_on_hand: number;
}

export interface CreateItemPayload {
  name: string;
  generic_name?: string | null;
  category: string;
  unit: string;
  is_traceable?: boolean;
  is_implant?: boolean;
  reorder_point?: number;
  reorder_quantity?: number;
}

export interface UpdateItemPayload extends Partial<CreateItemPayload> {
  is_active?: boolean;
}

export interface ReceiveBatchPayload {
  lot_number?: string;
  expiry_date?: string | null;
  initial_quantity: number;
  unit: string;
  unit_cost?: number | null;
  supplier?: string;
  received_at?: string;
}

export interface StockMovement {
  id: string;
  movement_type: string;
  direction: number;
  quantity: number;
  net_qty: number;
  source_type: string;
  created_at: string;
  item_name: string;
  category: string;
  unit: string;
  lot_number: string | null;
  unit_cost: number | null;
}

export interface MovementParams {
  item_id?: string;
  from?: string;
  to?: string;
  type?: string;
  limit?: number;
}

export interface PurchaseOrderLine {
  id: string;
  purchase_order_id: string;
  inventory_item_id: string;
  item_name?: string;
  quantity: number;
  unit: string;
  unit_cost: number | null;
  lot_number: string | null;
  expiry_date: string | null;
  created_at: string;
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  status: 'draft' | 'sent' | 'received' | 'cancelled';
  supplier: string | null;
  notes: string | null;
  line_count?: number;
  lines?: PurchaseOrderLine[];
  ordered_at: string | null;
  received_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePOLinePayload {
  inventory_item_id: string;
  quantity: number;
  unit: string;
  unit_cost?: number | null;
  lot_number?: string | null;
  expiry_date?: string | null;
}

export interface CreatePOPayload {
  supplier?: string | null;
  notes?: string | null;
  lines: CreatePOLinePayload[];
}

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private http = inject(HttpClient);
  private base = `${authApiConfig.baseUrl}/inventory`;

  getStock(): Observable<{ stock: StockLevel[] }> {
    return this.http.get<{ stock: StockLevel[] }>(`${this.base}/stock`);
  }

  searchItems(q = '', limit = 100): Observable<{ items: InventoryItem[] }> {
    const params = new HttpParams().set('q', q).set('limit', String(limit));
    return this.http.get<{ items: InventoryItem[] }>(`${this.base}/items`, { params });
  }

  createItem(payload: CreateItemPayload): Observable<{ item: InventoryItem }> {
    return this.http.post<{ item: InventoryItem }>(`${this.base}/items`, payload);
  }

  updateItem(id: string, payload: UpdateItemPayload): Observable<{ item: InventoryItem }> {
    return this.http.put<{ item: InventoryItem }>(`${this.base}/items/${id}`, payload);
  }

  receiveBatch(itemId: string, payload: ReceiveBatchPayload): Observable<{ batch: InventoryBatch }> {
    return this.http.post<{ batch: InventoryBatch }>(`${this.base}/items/${itemId}/batches`, payload);
  }

  getMovements(params: MovementParams = {}): Observable<{ movements: StockMovement[] }> {
    let p = new HttpParams();
    if (params.item_id) p = p.set('item_id', params.item_id);
    if (params.from)    p = p.set('from', params.from);
    if (params.to)      p = p.set('to', params.to);
    if (params.type)    p = p.set('type', params.type);
    if (params.limit)   p = p.set('limit', String(params.limit));
    return this.http.get<{ movements: StockMovement[] }>(`${this.base}/movements`, { params: p });
  }

  getInventoryValue(): Observable<{ total_value: number }> {
    return this.http.get<{ total_value: number }>(`${this.base}/value`);
  }

  getPurchaseOrders(): Observable<{ purchase_orders: PurchaseOrder[] }> {
    return this.http.get<{ purchase_orders: PurchaseOrder[] }>(`${this.base}/purchase-orders`);
  }

  getPurchaseOrder(id: string): Observable<{ purchase_order: PurchaseOrder }> {
    return this.http.get<{ purchase_order: PurchaseOrder }>(`${this.base}/purchase-orders/${id}`);
  }

  createPurchaseOrder(payload: CreatePOPayload): Observable<{ purchase_order: PurchaseOrder }> {
    return this.http.post<{ purchase_order: PurchaseOrder }>(`${this.base}/purchase-orders`, payload);
  }

  updatePOStatus(id: string, action: 'send' | 'receive' | 'cancel'): Observable<{ purchase_order: PurchaseOrder }> {
    return this.http.put<{ purchase_order: PurchaseOrder }>(`${this.base}/purchase-orders/${id}/status`, { action });
  }
}
