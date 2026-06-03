import { Component, ChangeDetectionStrategy, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MaterialModule } from '../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { FeatureFlagsService, FeatureFlag } from '../../../services/feature-flags.service';

@Component({
  selector: 'app-feature-flags-admin',
  standalone: true,
  imports: [CommonModule, DatePipe, MaterialModule, TablerIconsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ff-wrap">
      <div class="ff-header">
        <div>
          <h2 class="ff-title">Feature Flags</h2>
          <p class="ff-sub">Turn opt-in features on or off for this organization.</p>
        </div>
        <button mat-stroked-button (click)="reload()" [disabled]="loading()">
          <i-tabler name="refresh" size="16"></i-tabler>
          Refresh
        </button>
      </div>

      @if (loading() && !flags().length) {
        <div class="ff-loading">
          <mat-spinner diameter="28"></mat-spinner>
          <span>Loading flags…</span>
        </div>
      } @else if (error()) {
        <div class="ff-error">
          <i-tabler name="alert-triangle" size="18"></i-tabler>
          {{ error() }}
        </div>
      } @else if (!flags().length) {
        <div class="ff-empty">No flags configured.</div>
      } @else {
        <div class="ff-list">
          @for (f of flags(); track f.key) {
            <div class="ff-card" [class.ff-card-on]="f.enabled">
              <div class="ff-card-body">
                <div class="ff-card-head">
                  <span class="ff-card-name">{{ f.label }}</span>
                  <span class="ff-card-key">{{ f.key }}</span>
                </div>
                <div class="ff-card-desc">{{ f.description }}</div>
                @if (f.updated_at) {
                  <div class="ff-card-meta">
                    Last changed {{ f.updated_at | date:'d MMM yyyy, h:mm a' }}
                  </div>
                }
              </div>
              <div class="ff-card-control">
                <mat-slide-toggle
                  color="primary"
                  [checked]="f.enabled"
                  [disabled]="pending() === f.key"
                  (change)="toggle(f, $event.checked)">
                  {{ f.enabled ? 'Enabled' : 'Disabled' }}
                </mat-slide-toggle>
                @if (pending() === f.key) {
                  <mat-spinner diameter="16"></mat-spinner>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .ff-wrap { max-width: 880px; margin: 0 auto; padding: 8px; }
    .ff-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; gap: 16px; }
    .ff-title { margin: 0; font-size: 20px; font-weight: 700; color: #0f172a; }
    .ff-sub { margin: 4px 0 0; font-size: 13px; color: #64748b; }
    .ff-loading, .ff-error, .ff-empty {
      display: flex; align-items: center; gap: 10px;
      padding: 18px; border-radius: 12px; background: #f8fafc;
      color: #475569; font-size: 14px;
    }
    .ff-error { background: #fef2f2; color: #991b1b; }
    .ff-list { display: flex; flex-direction: column; gap: 12px; }
    .ff-card {
      display: flex; justify-content: space-between; align-items: center;
      padding: 16px 18px; border-radius: 12px;
      background: #fff; border: 1px solid #e5eaf0;
      box-shadow: 0 1px 3px rgba(15,23,42,.04);
      transition: border-color .15s, box-shadow .15s;
    }
    .ff-card-on { border-color: #c4b5fd; box-shadow: 0 4px 14px rgba(99,102,241,.10); }
    .ff-card-body { flex: 1; min-width: 0; }
    .ff-card-head { display: flex; align-items: center; gap: 10px; }
    .ff-card-name { font-size: 15px; font-weight: 600; color: #0f172a; }
    .ff-card-key {
      font-size: 10px; font-weight: 600; text-transform: uppercase;
      letter-spacing: .04em; color: #94a3b8;
      background: #f1f5f9; padding: 2px 8px; border-radius: 6px;
    }
    .ff-card-desc { margin-top: 4px; font-size: 13px; color: #475569; line-height: 1.45; }
    .ff-card-meta { margin-top: 6px; font-size: 11px; color: #94a3b8; }
    .ff-card-control { display: flex; align-items: center; gap: 10px; flex-shrink: 0; padding-left: 16px; }
  `],
})
export class FeatureFlagsAdminComponent implements OnInit {
  private readonly svc = inject(FeatureFlagsService);

  readonly flags    = this.svc.flags;
  readonly loading  = signal(false);
  readonly pending  = signal<string | null>(null);
  readonly error    = signal<string | null>(null);

  ngOnInit(): void { this.reload(); }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.load().subscribe({
      next: () => this.loading.set(false),
      error: () => { this.loading.set(false); this.error.set('Could not load feature flags.'); },
    });
  }

  toggle(flag: FeatureFlag, enabled: boolean): void {
    this.pending.set(flag.key);
    this.error.set(null);
    this.svc.setEnabled(flag.key, enabled).subscribe({
      next: () => this.pending.set(null),
      error: () => {
        this.pending.set(null);
        this.error.set('Update failed. Please try again.');
        // Reload so the toggle reflects server state.
        this.reload();
      },
    });
  }
}
