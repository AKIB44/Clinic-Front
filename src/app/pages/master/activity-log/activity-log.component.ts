import {
  Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef,
  inject, signal, Inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule, MatDialog, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { ActivityLogService, ActivityLog } from '../../../services/activity-log.service';

// ── Detail Dialog ─────────────────────────────────────────────────────────────
@Component({
  selector: 'app-activity-detail-dialog',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatChipsModule, MatDividerModule, MatDialogModule],
  template: `
    <div class="detail-dialog">
      <!-- Header -->
      <div class="detail-header" [ngClass]="statusBand()">
        <div class="detail-header-icon">
          <mat-icon>{{ entityIcon() }}</mat-icon>
        </div>
        <div class="detail-header-content">
          <h2 class="detail-title">{{ log.action || 'API Request' }}</h2>
          <div class="detail-meta">
            <span class="method-badge" [ngClass]="methodClass()">{{ log.method }}</span>
            <span class="status-badge" [ngClass]="statusClass()">{{ log.status_code }}</span>
            <span class="detail-time">{{ formatDate(log.created_at) }}</span>
          </div>
        </div>
        <button mat-icon-button class="close-btn" mat-dialog-close>
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="detail-body">

        <!-- Who -->
        <section class="detail-section">
          <div class="section-label">
            <mat-icon class="section-icon">person</mat-icon>
            Performed by
          </div>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-key">Name</span>
              <span class="info-val">{{ log.user_name || '—' }}</span>
            </div>
            <div class="info-item">
              <span class="info-key">Email</span>
              <span class="info-val">{{ log.user_email || '—' }}</span>
            </div>
            <div class="info-item">
              <span class="info-key">IP Address</span>
              <span class="info-val mono">{{ log.ip_address || '—' }}</span>
            </div>
          </div>
        </section>

        <mat-divider></mat-divider>

        <!-- What -->
        <section class="detail-section">
          <div class="section-label">
            <mat-icon class="section-icon">flash_on</mat-icon>
            Activity detail
          </div>
          @if (detailParts().length) {
            <div class="detail-parts-grid">
              @for (part of detailParts(); track part.key) {
                <div class="detail-part-item">
                  <span class="detail-part-key">{{ part.key }}</span>
                  <span class="detail-part-val">{{ part.val }}</span>
                </div>
              }
            </div>
          } @else {
            <p class="no-detail">No additional detail captured for this action.</p>
          }
        </section>

        <mat-divider></mat-divider>

        <!-- Request -->
        <section class="detail-section">
          <div class="section-label">
            <mat-icon class="section-icon">http</mat-icon>
            Request
          </div>
          <div class="info-grid">
            <div class="info-item full">
              <span class="info-key">Endpoint</span>
              <span class="info-val mono">{{ log.method }} {{ log.path }}</span>
            </div>
            @if (log.entity_type) {
              <div class="info-item">
                <span class="info-key">Entity type</span>
                <span class="info-val">
                  <span class="entity-chip">{{ log.entity_type }}</span>
                </span>
              </div>
            }
            @if (log.entity_id) {
              <div class="info-item">
                <span class="info-key">Entity ID</span>
                <span class="info-val mono small">{{ log.entity_id }}</span>
              </div>
            }
            <div class="info-item">
              <span class="info-key">Duration</span>
              <span class="info-val">
                @if (log.duration_ms != null) {
                  <span [class]="durationClass()">{{ log.duration_ms }}ms</span>
                } @else { — }
              </span>
            </div>
          </div>
        </section>

        <!-- Request body -->
        @if (log.request_body && hasBody()) {
          <mat-divider></mat-divider>
          <section class="detail-section">
            <div class="section-label">
              <mat-icon class="section-icon">data_object</mat-icon>
              Request payload
            </div>
            <pre class="json-block">{{ prettyBody() }}</pre>
          </section>
        }

        <!-- User agent -->
        @if (log.user_agent) {
          <mat-divider></mat-divider>
          <section class="detail-section detail-section--sm">
            <div class="section-label">
              <mat-icon class="section-icon">devices</mat-icon>
              User agent
            </div>
            <p class="user-agent-text">{{ log.user_agent }}</p>
          </section>
        }

      </div>

      <div class="detail-footer">
        <span class="log-id">Log #{{ log.id }}</span>
        <button mat-flat-button color="primary" mat-dialog-close>Close</button>
      </div>
    </div>
  `,
  styles: [`
    .detail-dialog { display: flex; flex-direction: column; max-height: 90vh; width: 640px; }

    .detail-header {
      display: flex; align-items: flex-start; gap: 16px;
      padding: 24px 24px 20px; border-radius: 12px 12px 0 0;
      background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
      color: #fff; position: relative;
    }
    .detail-header.band-ok   { background: linear-gradient(135deg, #14532d 0%, #166534 100%); }
    .detail-header.band-warn { background: linear-gradient(135deg, #78350f 0%, #92400e 100%); }
    .detail-header.band-err  { background: linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%); }

    .detail-header-icon {
      width: 44px; height: 44px; border-radius: 12px;
      background: rgba(255,255,255,.15); display: flex;
      align-items: center; justify-content: center; flex-shrink: 0;
      mat-icon { font-size: 22px; width: 22px; height: 22px; }
    }
    .detail-header-content { flex: 1; min-width: 0; }
    .detail-title { margin: 0 0 8px; font-size: 18px; font-weight: 600; line-height: 1.3; }
    .detail-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .close-btn { position: absolute; top: 12px; right: 12px; color: rgba(255,255,255,.7); }

    .method-badge {
      font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px;
      background: rgba(255,255,255,.2); letter-spacing: .06em;
    }
    .status-badge {
      font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 20px;
    }
    .status-badge.status-ok   { background: #bbf7d0; color: #14532d; }
    .status-badge.status-warn { background: #fef3c7; color: #78350f; }
    .status-badge.status-err  { background: #fee2e2; color: #7f1d1d; }
    .detail-time { font-size: 12px; opacity: .75; }

    .detail-body { overflow-y: auto; flex: 1; padding: 0 24px; }

    .detail-section { padding: 20px 0 4px; }
    .detail-section--sm { padding: 16px 0 4px; }

    .section-label {
      display: flex; align-items: center; gap: 6px;
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .08em; color: #64748b; margin-bottom: 14px;
    }
    .section-icon { font-size: 16px; width: 16px; height: 16px; color: #94a3b8; }

    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .info-item { display: flex; flex-direction: column; gap: 2px; }
    .info-item.full { grid-column: 1 / -1; }
    .info-key { font-size: 11px; color: #94a3b8; font-weight: 500; }
    .info-val { font-size: 13px; color: #1e293b; font-weight: 500; word-break: break-all; }
    .info-val.mono { font-family: 'Roboto Mono', monospace; font-size: 12px; }
    .info-val.small { font-size: 11px; }

    .detail-parts-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 10px;
    }
    .detail-part-item {
      background: #f8fafc; border: 1px solid #e2e8f0;
      border-radius: 8px; padding: 10px 14px;
    }
    .detail-part-key { display: block; font-size: 11px; color: #64748b; font-weight: 600; margin-bottom: 4px; }
    .detail-part-val { display: block; font-size: 13px; color: #0f172a; font-weight: 500; word-break: break-word; }

    .no-detail { font-size: 13px; color: #94a3b8; margin: 0; }

    .entity-chip {
      display: inline-block; font-size: 11px; font-weight: 600;
      padding: 2px 10px; border-radius: 12px;
      background: #e0e7ff; color: #3730a3;
    }

    .json-block {
      background: #0f172a; color: #e2e8f0; border-radius: 8px;
      padding: 16px; font-size: 12px; font-family: 'Roboto Mono', monospace;
      line-height: 1.6; overflow-x: auto; margin: 0;
      max-height: 240px; overflow-y: auto;
    }

    .duration-fast   { color: #16a34a; font-weight: 600; }
    .duration-medium { color: #d97706; font-weight: 600; }
    .duration-slow   { color: #dc2626; font-weight: 600; }

    .user-agent-text { font-size: 11px; color: #64748b; margin: 0; line-height: 1.5; word-break: break-all; }

    .detail-footer {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 24px; border-top: 1px solid #f1f5f9;
    }
    .log-id { font-size: 12px; color: #94a3b8; font-family: monospace; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityDetailDialogComponent {
  log: ActivityLog;

  constructor(@Inject(MAT_DIALOG_DATA) data: ActivityLog) {
    this.log = data;
  }

  statusBand(): string {
    if (this.log.status_code < 400) return 'band-ok';
    if (this.log.status_code < 500) return 'band-warn';
    return 'band-err';
  }

  statusClass(): string {
    if (this.log.status_code < 400) return 'status-ok';
    if (this.log.status_code < 500) return 'status-warn';
    return 'status-err';
  }

  methodClass(): string {
    return `method-${this.log.method.toLowerCase()}`;
  }

  durationClass(): string {
    const ms = this.log.duration_ms ?? 0;
    if (ms < 300) return 'duration-fast';
    if (ms < 1000) return 'duration-medium';
    return 'duration-slow';
  }

  entityIcon(): string {
    const map: Record<string, string> = {
      prescription: 'medication', patient: 'person', appointment: 'event',
      staff: 'badge', user: 'manage_accounts', auth: 'lock',
      clinic: 'business', service: 'medical_services', chair: 'chair',
      rx_medicine: 'vaccines', rx_procedure: 'content_cut',
    };
    return map[this.log.entity_type ?? ''] ?? 'receipt_long';
  }

  detailParts(): { key: string; val: string }[] {
    if (!this.log.details) return [];
    return this.log.details.split('  ·  ').map(part => {
      const idx = part.indexOf(': ');
      if (idx === -1) return { key: 'Detail', val: part.trim() };
      return { key: part.slice(0, idx).trim(), val: part.slice(idx + 2).trim() };
    });
  }

  hasBody(): boolean {
    const b = this.log.request_body;
    return b && typeof b === 'object' && Object.keys(b).length > 0;
  }

  prettyBody(): string {
    try { return JSON.stringify(this.log.request_body, null, 2); }
    catch { return String(this.log.request_body); }
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  }
}

// ── Main Component ────────────────────────────────────────────────────────────
@Component({
  selector: 'app-activity-log',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatTableModule, MatPaginatorModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatTooltipModule, MatDialogModule, MatChipsModule,
  ],
  templateUrl: './activity-log.component.html',
  styleUrls: ['./activity-log.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityLogComponent implements OnInit {
  private svc    = inject(ActivityLogService);
  private cdr    = inject(ChangeDetectorRef);
  private dialog = inject(MatDialog);

  logs    = signal<ActivityLog[]>([]);
  total   = signal(0);
  page    = signal(1);
  limit   = 50;
  loading = signal(false);

  searchQuery      = '';
  entityTypeFilter = '';
  dateFrom         = '';
  dateTo           = '';

  displayedColumns = ['timestamp', 'user', 'action', 'entity', 'status', 'duration', 'view'];

  entityTypes = [
    'prescription', 'patient', 'appointment', 'staff', 'user',
    'auth', 'clinic', 'service', 'chair', 'rx_medicine', 'rx_procedure',
  ];

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.svc.getLogs({
      page:        this.page(),
      limit:       this.limit,
      search:      this.searchQuery      || undefined,
      entity_type: this.entityTypeFilter || undefined,
      date_from:   this.dateFrom         || undefined,
      date_to:     this.dateTo           || undefined,
    }).subscribe({
      next: (res) => {
        this.logs.set(res.logs);
        this.total.set(res.total);
        this.loading.set(false);
        this.cdr.markForCheck();
      },
      error: () => { this.loading.set(false); this.cdr.markForCheck(); },
    });
  }

  applyFilter(): void { this.page.set(1); this.load(); }

  onPageChange(event: PageEvent): void { this.page.set(event.pageIndex + 1); this.load(); }

  openDetail(log: ActivityLog): void {
    this.dialog.open(ActivityDetailDialogComponent, {
      data: log,
      width: '660px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      panelClass: 'activity-detail-panel',
    });
  }

  getMethodClass(method: string): string {
    return `method-${(method || '').toLowerCase()}`;
  }

  getStatusClass(code: number): string {
    if (code < 400) return 'status-ok';
    if (code < 500) return 'status-warn';
    return 'status-err';
  }

  getStatusIcon(code: number): string {
    if (code < 400) return 'check_circle';
    if (code < 500) return 'warning';
    return 'error';
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit',
    });
  }
}
