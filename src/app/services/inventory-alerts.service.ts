import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { authApiConfig } from '../auth/auth.config';

export interface InventoryAlert {
  id: string;
  name: string;
  generic_name: string | null;
  category: string;
  unit: string;
  reorder_point: number;
  reorder_quantity: number;
  qty_on_hand: number;
  alert_type: 'OUT_OF_STOCK' | 'LOW_STOCK';
  shortage: number;
}

@Injectable({ providedIn: 'root' })
export class InventoryAlertsService {
  private http = inject(HttpClient);
  private base = `${authApiConfig.baseUrl}/inventory`;

  alerts     = signal<InventoryAlert[]>([]);
  alertCount = computed(() => this.alerts().length);

  refresh(): void {
    this.http.get<{ alerts: InventoryAlert[] }>(`${this.base}/alerts`).subscribe({
      next:  (res) => this.alerts.set(res.alerts),
      error: ()    => {},
    });
  }
}
