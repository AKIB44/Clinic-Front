import {
  Component, OnInit, inject, signal, computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { MaterialModule } from '../../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { SessionStore } from '../../store/session.store';
import { SessionApiService } from '../../services/session-api.service';
import { ServicePerformed, TreatmentPlanItem } from '../../models/session.model';
import { DfLabOrderComponent } from '../df-lab-order/df-lab-order.component';
import { DfMaterialsCartComponent } from '../df-materials-cart/df-materials-cart.component';
import { ClinicServicesService } from '../../../../services/clinic-services.service';
import { ClinicService } from '../../../../models/clinic.model';
import { ToastService } from '../../../../services/toast.service';

@Component({
  selector: 'df-services-block',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule, DfLabOrderComponent, DfMaterialsCartComponent],
  templateUrl: './df-services-block.component.html',
  styleUrl: './df-services-block.component.scss',
})
export class DfServicesBlockComponent implements OnInit {
  readonly store     = inject(SessionStore);
  private api        = inject(SessionApiService);
  private svcService = inject(ClinicServicesService);
  private toast      = inject(ToastService);

  searchTerm   = '';
  addQty       = 1;
  addDiscountPct = 0;
  pendingPlanItemId: string | null = null;

  readonly adding        = signal(false);
  readonly updating      = signal<string | null>(null);
  readonly addError      = signal<string | null>(null);
  readonly pendingService = signal<ClinicService | null>(null);
  readonly allServices   = signal<ClinicService[]>([]);

  // Accepted plan items not yet started in this session
  readonly acceptedPlanItems = computed<TreatmentPlanItem[]>(() => {
    const performedServiceIds = new Set(this.store.services().map(s => s.catalog_item_id));
    return this.store.plans()
      .flatMap(p => p.items)
      .filter(i => i.status === 'ACCEPTED' && !performedServiceIds.has(i.service_id));
  });

  readonly filteredServices = computed(() => {
    const term = this.searchTerm.toLowerCase().trim();
    if (!term) return this.allServices().slice(0, 8);
    return this.allServices()
      .filter(s => s.name.toLowerCase().includes(term))
      .slice(0, 10);
  });

  ngOnInit(): void {
    this.svcService.list().subscribe({
      next: ({ services }) => this.allServices.set(services),
    });
  }

  displayFn(svc: ClinicService | null): string {
    return svc?.name ?? '';
  }

  onSearch(): void {
    // filteredServices computed reacts automatically
  }

  onServiceSelected(svc: ClinicService): void {
    this.pendingService.set(svc);
    this.searchTerm       = '';
    this.addQty           = 1;
    this.addDiscountPct   = 0;
    this.pendingPlanItemId = null;
    this.addError.set(null);
  }

  addFromPlan(item: TreatmentPlanItem): void {
    // Find the matching ClinicService by service_id
    const svc = this.allServices().find(s => s.id === item.service_id);
    if (!svc) {
      // Service not in local list — create a minimal stub so the confirm row shows
      this.pendingService.set({ id: item.service_id, name: item.service_name ?? 'Service', price: item.cost_min ?? 0 } as ClinicService);
    } else {
      this.pendingService.set(svc);
    }
    this.addQty            = 1;
    this.addDiscountPct    = 0;
    this.pendingPlanItemId = item.id;
    this.addError.set(null);
  }

  cancelPending(): void {
    this.pendingService.set(null);
    this.pendingPlanItemId = null;
    this.addError.set(null);
  }

  confirmAdd(): void {
    const svc       = this.pendingService();
    const sessionId = this.store.sessionId();
    if (!svc || !sessionId) return;

    this.adding.set(true);
    this.addError.set(null);

    this.api.addService(sessionId, {
      service_id:   svc.id,
      plan_item_id: this.pendingPlanItemId ?? undefined,
      quantity:     this.addQty || 1,
      discount_pct: this.addDiscountPct || 0,
    }).pipe(finalize(() => this.adding.set(false))).subscribe({
      next: ({ service, plan_item }) => {
        this.adding.set(false);
        this.store.addService({ ...service, service_name: svc.name });
        if (plan_item) this.store.updatePlanItem(plan_item);
        this.cancelPending();
        this.toast.success(`${svc.name} added to session.`);
      },
      error: (err) => {
        this.adding.set(false);
        const msg = err?.error?.error ?? 'Failed to add service.';
        this.addError.set(msg);
        this.toast.error(msg);
      },
    });
  }

  completeService(svc: ServicePerformed): void {
    this.updating.set(svc.id);
    this.api.updateService(svc.id, { status: 'COMPLETED' })
      .pipe(finalize(() => this.updating.set(null)))
      .subscribe({
        next: ({ service, plan_item }) => {
          this.updating.set(null);
          this.store.updateService({ ...service, service_name: svc.service_name });
          if (plan_item) this.store.updatePlanItem(plan_item);
          this.toast.success(`${svc.service_name ?? 'Service'} marked as completed.`);
        },
        error: () => {
          this.updating.set(null);
          this.toast.error('Could not update service status. Please try again.');
        },
      });
  }

  abandonService(svc: ServicePerformed): void {
    const reason = window.prompt('Reason for abandoning this service?');
    if (reason === null) return;
    this.updating.set(svc.id);
    this.api.updateService(svc.id, {
      status: 'ABANDONED',
      abandon_reason: reason || 'Not specified',
    }).pipe(finalize(() => this.updating.set(null)))
      .subscribe({
        next: ({ service, plan_item }) => {
          this.updating.set(null);
          this.store.updateService({ ...service, service_name: svc.service_name });
          if (plan_item) this.store.updatePlanItem(plan_item);
          this.toast.warn(`${svc.service_name ?? 'Service'} abandoned.`);
        },
        error: () => {
          this.updating.set(null);
          this.toast.error('Could not abandon service. Please try again.');
        },
      });
  }
}
