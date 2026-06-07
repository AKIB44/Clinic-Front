import { Component, ChangeDetectionStrategy, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { DecisionLogService, DecisionLogEntry, DecisionLogFilters } from '../../../services/decision-log.service';

@Component({
  selector: 'app-decision-log',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, MaterialModule, TablerIconsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './decision-log.component.html',
  styleUrl:    './decision-log.component.scss',
})
export class DecisionLogComponent implements OnInit {
  private readonly svc = inject(DecisionLogService);

  readonly entries  = signal<DecisionLogEntry[]>([]);
  readonly stats    = signal<{ decision: string; n: number }[]>([]);
  readonly loading  = signal(false);
  readonly error    = signal<string | null>(null);
  readonly expanded = signal<string | null>(null);

  readonly filters = signal<DecisionLogFilters>({ limit: 100 });

  readonly statsMap = computed(() => {
    const m: Record<string, number> = { PERMIT: 0, DENY: 0 };
    for (const s of this.stats()) m[s.decision] = s.n;
    return m;
  });

  readonly resourceOptions = [
    'session','patient','clinical_note','examination','diagnosis','prescription',
    'charge_line','payment','invoice','service_performed','booking',
    'specialty_case','treatment_plan','inventory_item','stock_movement','lab_order',
    'audit_log','staff','clinic_settings',
  ];
  readonly actionOptions = ['read','create','update','delete','export','seal','reopen','approve_discount'];

  ngOnInit(): void { this.search(); }

  setFilter<K extends keyof DecisionLogFilters>(k: K, v: DecisionLogFilters[K]): void {
    this.filters.update(f => ({ ...f, [k]: v }));
  }

  reset(): void { this.filters.set({ limit: 100 }); this.search(); }

  search(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.search(this.filters()).subscribe({
      next: (r) => {
        this.entries.set(r.entries ?? []);
        this.stats.set(r.stats ?? []);
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.error.set('Could not load decision log.'); },
    });
  }

  toggleRow(id: string): void {
    this.expanded.set(this.expanded() === id ? null : id);
  }
}
