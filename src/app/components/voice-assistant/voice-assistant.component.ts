import { Component, ChangeDetectionStrategy, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TablerIconsModule } from 'angular-tabler-icons';
import { format } from 'date-fns';
import { PatientsService, Patient } from '../../services/patients.service';
import { AppointmentsService, BookingPayload } from '../../services/appointments.service';
import { ClinicServicesService } from '../../services/clinic-services.service';
import { ChairsService } from '../../services/chairs.service';
import { AssistantService, AssistantResult } from '../../services/assistant.service';
import { AuthService } from '../../auth/auth.service';
import { FeatureFlagsService, FRIDAY_FLAG } from '../../services/feature-flags.service';
import { ClinicService, Chair } from '../../models/clinic.model';
import { addDays } from 'date-fns';

type Status =
  | 'idle'        // panel closed or not yet engaged
  | 'sleeping'    // background listener active, waiting for "friday"
  | 'awake'       // wake word detected, expecting command
  | 'listening'   // explicit listen (FAB tapped) or post-wake capture
  | 'thinking'    // sending to LLM
  | 'success'
  | 'noresult'
  | 'error';

const NAV_MAP: Record<string, string> = {
  schedule:          '/schedule',
  booking:           '/booking',
  patients:          '/patients',
  inventory:         '/inventory',
  labs:              '/labs',
  'treatment-plans': '/treatment-plans',
  rx:                '/rx',
  specialty:         '/specialty',
  accounts:          '/org-master/accounts',
  hr:                '/org-master/hr',
  'release-notes':   '/org-master/release-notes',
  'feature-flags':   '/org-master/feature-flags',
  settings:          '/settings',
};

@Component({
  selector: 'app-voice-assistant',
  standalone: true,
  imports: [CommonModule, TablerIconsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (enabled()) {
    @if (open()) {
      <div class="va-panel" role="dialog" aria-label="Friday">
        <div class="va-head">
          <div class="va-head-left">
            <span class="va-orb" [class.va-orb-listening]="listening() || awake()">
              <i-tabler name="sparkles" size="16"></i-tabler>
            </span>
            <div>
              <div class="va-title">Friday</div>
              <div class="va-sub">{{ subline() }}</div>
            </div>
          </div>
          <div class="va-head-actions">
            <button class="va-toggle" (click)="toggleVoiceOut()"
                    [class.va-toggle-on]="voiceOutOn()"
                    [class.va-toggle-pulsing]="speaking()"
                    [attr.aria-label]="voiceOutOn() ? 'Mute voice replies' : 'Unmute voice replies'"
                    title="Voice replies">
              <i-tabler [name]="voiceOutOn() ? 'volume' : 'volume-off'" size="14"></i-tabler>
            </button>
            <button class="va-toggle" (click)="toggleWakeWord()"
                    [class.va-toggle-on]="wakeWordOn()"
                    [attr.aria-label]="wakeWordOn() ? 'Disable wake word' : 'Enable wake word'"
                    title="Always-on wake word">
              <i-tabler [name]="wakeWordOn() ? 'ear' : 'ear-off'" size="14"></i-tabler>
            </button>
            <button class="va-close" (click)="closePanel()" aria-label="Close">
              <i-tabler name="x" size="14"></i-tabler>
            </button>
          </div>
        </div>

        <div class="va-body">
          @if (transcript() || interim()) {
            <div class="va-transcript">
              @if (transcript()) {
                <span class="va-final">"{{ transcript() }}"</span>
              } @else {
                <span class="va-interim">{{ interim() }}<span class="va-caret">▍</span></span>
              }
            </div>
          } @else if (!listening() && !awake() && status() === 'idle') {
            <div class="va-empty">
              <i-tabler name="sparkles" size="28"></i-tabler>
              <p>Say <strong>"Friday"</strong> then your command,<br>or tap the mic to talk now.</p>
              <div class="va-examples">
                <span>"Friday, open patient Ravi"</span>
                <span>"Friday, what's on today"</span>
                <span>"Friday, go to booking"</span>
              </div>
            </div>
          }

          @if (listening() || awake()) {
            <div class="va-waves" aria-hidden="true">
              <i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>
            </div>
          }

          @if (message()) {
            <div class="va-msg"
                 [class.va-msg-success]="status() === 'success'"
                 [class.va-msg-empty]="status() === 'noresult'"
                 [class.va-msg-error]="status() === 'error'"
                 [class.va-msg-thinking]="status() === 'thinking'">
              @if (status() === 'thinking') { <span class="va-spinner"></span> }
              {{ message() }}
            </div>
          }

          @if (flowStep() !== 'idle') {
            <div class="va-flow">
              <div class="va-flow-title">
                <i-tabler name="calendar-plus" size="14"></i-tabler>
                Booking — {{ flowStepLabel() }}
              </div>
              <div class="va-flow-chips">
                <span class="va-chip" [class.va-chip-on]="!!flowData().patient">
                  {{ flowData().patient?.name ?? 'patient' }}
                </span>
                <span class="va-chip" [class.va-chip-on]="!!flowData().service">
                  {{ flowData().service?.name ?? 'service' }}
                </span>
                <span class="va-chip" [class.va-chip-on]="!!flowData().chair">
                  {{ flowData().chair?.name ?? 'chair' }}
                </span>
                <span class="va-chip" [class.va-chip-on]="!!flowData().date">
                  {{ flowData().date ?? 'date' }}
                </span>
                <span class="va-chip" [class.va-chip-on]="!!flowData().time">
                  {{ flowData().time ?? 'time' }}
                </span>
              </div>
              <button class="va-flow-cancel" (click)="cancelFlowFromUi()">Cancel booking</button>
            </div>
          }

          @if (matches().length > 1) {
            <ul class="va-results">
              @for (p of matches(); track p.id) {
                <li (click)="openPatient(p)">
                  <div class="va-result-avatar">{{ initial(p.name) }}</div>
                  <div class="va-result-body">
                    <div class="va-result-name">{{ p.name }}</div>
                    <div class="va-result-meta">{{ p.phone }}</div>
                  </div>
                  <i-tabler name="arrow-right" size="14"></i-tabler>
                </li>
              }
            </ul>
          }

          @if (summary()) {
            <div class="va-summary">
              <div class="va-summary-row">
                <span class="va-summary-num">{{ summary()!.total }}</span>
                <span class="va-summary-lbl">total</span>
              </div>
              <div class="va-summary-row va-summary-row-sec">
                <span>{{ summary()!.upcoming }} upcoming · {{ summary()!.done }} done · {{ summary()!.cancelled }} cancelled</span>
              </div>
              <button class="va-summary-btn" (click)="goSchedule()">View schedule</button>
            </div>
          }
        </div>

        <div class="va-foot">
          @if (!speechSupported()) {
            <div class="va-unsupported">Voice input isn't available in this browser. Try Chrome or Edge.</div>
          } @else {
            <button class="va-mic" [class.va-mic-active]="listening()"
                    (click)="listening() ? stopActive() : startActive()"
                    [attr.aria-label]="listening() ? 'Stop' : 'Speak now'">
              <i-tabler [name]="listening() ? 'player-stop-filled' : 'microphone'" size="22"></i-tabler>
            </button>
            <div class="va-foot-hint">
              {{ listening() ? 'Tap to stop' : (wakeWordOn() ? 'Wake word ON — say "Friday"' : 'Tap to speak') }}
            </div>
          }
        </div>
      </div>
    }

    <button class="va-fab" (click)="togglePanel()"
            [class.va-fab-open]="open()"
            [class.va-fab-listening]="listening() || awake()"
            [class.va-fab-sleeping]="wakeWordOn() && !open()"
            aria-label="Open Friday">
      @if (open()) {
        <i-tabler name="x" size="20"></i-tabler>
      } @else {
        <i-tabler name="sparkles" size="20"></i-tabler>
      }
    </button>
    }
  `,
  styles: [`
    :host {
      position: fixed;
      right: 30px;
      bottom: 100px;
      z-index: 10;
      display: block;
    }

    /* ── FAB ───────────────────────────────────────────────── */
    .va-fab {
      width: 56px; height: 56px;
      border-radius: 50%;
      border: none;
      cursor: pointer;
      background: linear-gradient(135deg, #8b5cf6, #6366f1, #4f46e5);
      background-size: 200% 200%;
      color: #fff;
      display: inline-flex; align-items: center; justify-content: center;
      box-shadow: 0 8px 24px rgba(79,70,229,.42);
      transition: transform .2s cubic-bezier(0.34,1.56,0.64,1), box-shadow .2s;
      position: relative;
      animation: va-gradient 8s ease infinite;
    }
    @keyframes va-gradient {
      0%,100% { background-position: 0% 50%; }
      50%     { background-position: 100% 50%; }
    }
    .va-fab:hover { transform: translateY(-2px) scale(1.06); box-shadow: 0 12px 32px rgba(79,70,229,.6); }
    .va-fab-open { background: linear-gradient(135deg,#64748b,#475569); animation: none; }
    .va-fab-sleeping::after {
      content: '';
      position: absolute; top: 4px; right: 4px;
      width: 9px; height: 9px;
      border-radius: 50%;
      background: #10b981;
      border: 2px solid #fff;
      box-shadow: 0 0 0 2px rgba(16,185,129,.35);
      animation: va-pulse 1.6s ease-in-out infinite;
    }
    @keyframes va-pulse {
      0%,100% { box-shadow: 0 0 0 0 rgba(16,185,129,.6); }
      50%     { box-shadow: 0 0 0 6px rgba(16,185,129,0);  }
    }
    .va-fab-listening {
      background: linear-gradient(135deg,#ef4444,#dc2626);
      box-shadow: 0 8px 24px rgba(239,68,68,.55);
      animation: none;
    }
    .va-fab-listening::before,
    .va-fab-listening::after {
      content: ''; position: absolute; inset: -4px; border-radius: 50%;
      border: 2px solid rgba(239,68,68,.55);
      animation: va-ring 1.6s ease-out infinite;
    }
    .va-fab-listening::after { animation-delay: .8s; }
    @keyframes va-ring {
      0%   { transform: scale(.9); opacity: .75; }
      100% { transform: scale(1.9); opacity: 0;   }
    }

    /* ── Panel ─────────────────────────────────────────────── */
    .va-panel {
      position: absolute; bottom: 70px; right: 0;
      width: 360px; max-width: calc(100vw - 60px);
      background: #fff;
      border-radius: 18px;
      box-shadow: 0 24px 56px rgba(15,23,42,.22), 0 4px 12px rgba(15,23,42,.10);
      overflow: hidden;
      border: 1px solid rgba(99,102,241,.14);
      transform-origin: bottom right;
      animation: va-pop .28s cubic-bezier(0.22,1,0.36,1);
    }
    @keyframes va-pop {
      from { opacity: 0; transform: translateY(10px) scale(.96); }
      to   { opacity: 1; transform: translateY(0) scale(1);     }
    }

    .va-head {
      display: flex; align-items: flex-start; justify-content: space-between;
      gap: 8px; padding: 14px 14px 10px;
      background: linear-gradient(135deg, rgba(139,92,246,.07), rgba(79,70,229,.03));
      border-bottom: 1px solid #eef2f7;
    }
    .va-head-left { display: flex; gap: 10px; align-items: center; min-width: 0; }
    .va-head-actions { display: flex; gap: 4px; align-items: center; }
    .va-orb {
      width: 34px; height: 34px; border-radius: 50%;
      background: linear-gradient(135deg, #8b5cf6, #4f46e5);
      color: #fff;
      display: inline-flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 12px rgba(79,70,229,.4);
      flex-shrink: 0;
      transition: background .2s;
    }
    .va-orb-listening {
      background: linear-gradient(135deg, #ef4444, #dc2626);
      animation: va-orb-pulse 1.2s ease-in-out infinite;
    }
    @keyframes va-orb-pulse {
      0%,100% { box-shadow: 0 4px 12px rgba(239,68,68,.30); }
      50%     { box-shadow: 0 4px 18px rgba(239,68,68,.65); }
    }
    .va-title { font-size: 15px; font-weight: 700; color: #0f172a; line-height: 1.2;
                background: linear-gradient(135deg,#6366f1,#a855f7);
                -webkit-background-clip: text; -webkit-text-fill-color: transparent;
                background-clip: text; }
    .va-sub   { font-size: 11.5px; color: #64748b; margin-top: 2px; line-height: 1.3; }
    .va-toggle, .va-close {
      width: 28px; height: 28px; border-radius: 50%;
      background: #f1f5f9; color: #64748b; border: none; cursor: pointer;
      display: inline-flex; align-items: center; justify-content: center;
      transition: background .15s, color .15s;
    }
    .va-toggle:hover, .va-close:hover { background: #e2e8f0; color: #0f172a; }
    .va-toggle-on { background: #dcfce7; color: #15803d; }
    .va-toggle-pulsing {
      background: #fef3c7; color: #b45309;
      animation: va-speak-pulse 1s ease-in-out infinite;
    }
    @keyframes va-speak-pulse {
      0%,100% { box-shadow: 0 0 0 0 rgba(180,83,9,.35); }
      50%     { box-shadow: 0 0 0 5px rgba(180,83,9,0);  }
    }

    .va-body { padding: 14px; min-height: 90px; }
    .va-empty {
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      color: #94a3b8; padding: 6px 0; text-align: center;
    }
    .va-empty p { margin: 0; font-size: 12.5px; }
    .va-empty p strong { color: #6366f1; }
    .va-examples {
      display: flex; flex-direction: column; gap: 4px;
      margin-top: 4px; font-size: 11px;
    }
    .va-examples span { color: #94a3b8; font-style: italic; }

    .va-transcript {
      background: linear-gradient(135deg,#f8fafc,#f1f5f9);
      border-radius: 10px; padding: 10px 12px;
      font-size: 13px; color: #0f172a; line-height: 1.45;
      border: 1px solid #e2e8f0; margin-bottom: 8px; word-break: break-word;
    }
    .va-final   { font-weight: 600; }
    .va-interim { color: #64748b; font-style: italic; }
    .va-caret   { color: #6366f1; margin-left: 2px; animation: va-blink 1s steps(1) infinite; }
    @keyframes va-blink { 50% { opacity: 0; } }

    .va-waves {
      display: flex; align-items: center; justify-content: center;
      gap: 3px; height: 28px; margin: 6px 0 4px;
    }
    .va-waves i {
      width: 3px; border-radius: 2px;
      background: linear-gradient(180deg, #8b5cf6, #4f46e5);
      animation: va-wave 1s ease-in-out infinite;
    }
    .va-waves i:nth-child(1) { height: 10px; animation-delay: 0s;   }
    .va-waves i:nth-child(2) { height: 18px; animation-delay: .1s;  }
    .va-waves i:nth-child(3) { height: 24px; animation-delay: .2s;  }
    .va-waves i:nth-child(4) { height: 16px; animation-delay: .3s;  }
    .va-waves i:nth-child(5) { height: 22px; animation-delay: .4s;  }
    .va-waves i:nth-child(6) { height: 14px; animation-delay: .5s;  }
    .va-waves i:nth-child(7) { height: 20px; animation-delay: .6s;  }
    .va-waves i:nth-child(8) { height: 12px; animation-delay: .7s;  }
    .va-waves i:nth-child(9) { height: 16px; animation-delay: .8s;  }
    @keyframes va-wave {
      0%,100% { transform: scaleY(.4); opacity: .6; }
      50%     { transform: scaleY(1.2); opacity: 1; }
    }

    .va-msg {
      margin-top: 8px; padding: 8px 10px; border-radius: 8px;
      font-size: 12.5px; display: flex; align-items: center; gap: 6px;
      animation: va-msg-in .25s ease-out;
    }
    @keyframes va-msg-in { from { opacity: 0; transform: translateY(-3px); } to { opacity: 1; transform: translateY(0); } }
    .va-msg-thinking { background: #eef2ff; color: #4338ca; }
    .va-msg-success  { background: #ecfdf5; color: #065f46; }
    .va-msg-empty    { background: #fff7ed; color: #9a3412; }
    .va-msg-error    { background: #fef2f2; color: #991b1b; }
    .va-spinner {
      width: 12px; height: 12px; border-radius: 50%;
      border: 2px solid #c7d2fe; border-top-color: #4338ca;
      animation: va-spin .8s linear infinite;
    }
    @keyframes va-spin { to { transform: rotate(360deg); } }

    .va-results {
      list-style: none; padding: 0; margin: 10px 0 0;
      max-height: 220px; overflow-y: auto;
      border-top: 1px solid #f1f5f9;
    }
    .va-results li {
      display: flex; align-items: center; gap: 10px;
      padding: 9px 6px; cursor: pointer;
      border-bottom: 1px solid #f8fafc;
      transition: background .12s;
      color: #64748b;
    }
    .va-results li:last-child { border-bottom: none; }
    .va-results li:hover { background: #f8fafc; }
    .va-result-avatar {
      width: 30px; height: 30px; border-radius: 50%;
      background: linear-gradient(135deg, #ddd6fe, #a5b4fc);
      color: #312e81; font-weight: 700; font-size: 12px;
      display: inline-flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .va-result-body { flex: 1; min-width: 0; }
    .va-result-name { font-size: 13px; font-weight: 600; color: #0f172a; }
    .va-result-meta { font-size: 11px; color: #94a3b8; }

    .va-summary {
      margin-top: 10px; padding: 12px; border-radius: 10px;
      background: linear-gradient(135deg,#eef2ff,#f5f3ff);
      border: 1px solid rgba(99,102,241,.18);
    }
    .va-summary-row { display: flex; align-items: baseline; gap: 6px; }
    .va-summary-num { font-size: 28px; font-weight: 800; color: #4338ca; line-height: 1; }
    .va-summary-lbl { font-size: 12px; color: #6366f1; font-weight: 600; text-transform: uppercase; }
    .va-summary-row-sec { font-size: 12px; color: #64748b; margin-top: 4px; }
    .va-summary-btn {
      margin-top: 10px; padding: 6px 12px;
      border-radius: 8px; border: none; cursor: pointer;
      background: #4f46e5; color: #fff; font-size: 12px; font-weight: 600;
    }
    .va-summary-btn:hover { background: #4338ca; }

    .va-flow {
      margin-top: 10px; padding: 12px; border-radius: 12px;
      background: linear-gradient(135deg,#f0fdf4,#ecfdf5);
      border: 1px solid rgba(16,185,129,.25);
    }
    .va-flow-title {
      display: flex; align-items: center; gap: 6px;
      font-size: 12px; font-weight: 700; color: #065f46;
      text-transform: uppercase; letter-spacing: .04em;
    }
    .va-flow-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 4px; }
    .va-chip {
      padding: 3px 9px; border-radius: 999px;
      font-size: 11.5px; font-weight: 500;
      background: #fff; color: #94a3b8;
      border: 1px solid #e2e8f0;
    }
    .va-chip-on { background: #10b981; color: #fff; border-color: #10b981; font-weight: 600; }
    .va-flow-cancel {
      margin-top: 6px; padding: 4px 10px;
      background: transparent; border: 1px solid #fecaca;
      border-radius: 6px; cursor: pointer;
      color: #b91c1c; font-size: 11px; font-weight: 600;
    }
    .va-flow-cancel:hover { background: #fef2f2; }

    .va-foot {
      display: flex; flex-direction: column; align-items: center;
      gap: 6px; padding: 10px 14px 16px;
      border-top: 1px solid #f1f5f9;
    }
    .va-mic {
      width: 54px; height: 54px; border-radius: 50%;
      border: none; cursor: pointer; color: #fff;
      background: linear-gradient(135deg, #8b5cf6, #4f46e5);
      display: inline-flex; align-items: center; justify-content: center;
      box-shadow: 0 6px 18px rgba(79,70,229,.42);
      transition: transform .15s, box-shadow .2s, background .2s;
      position: relative;
    }
    .va-mic:hover { transform: scale(1.05); }
    .va-mic-active {
      background: linear-gradient(135deg, #ef4444, #dc2626);
      box-shadow: 0 6px 18px rgba(239,68,68,.55);
    }
    .va-mic-active::before, .va-mic-active::after {
      content: ''; position: absolute; inset: -4px; border-radius: 50%;
      border: 2px solid rgba(239,68,68,.55);
      animation: va-ring 1.6s ease-out infinite;
    }
    .va-mic-active::after { animation-delay: .8s; }
    .va-foot-hint { font-size: 11px; color: #94a3b8; }
    .va-unsupported { font-size: 12px; color: #94a3b8; text-align: center; }
  `],
})
export class VoiceAssistantComponent implements OnInit, OnDestroy {
  private readonly patients   = inject(PatientsService);
  private readonly appts      = inject(AppointmentsService);
  private readonly assistant  = inject(AssistantService);
  private readonly auth       = inject(AuthService);
  private readonly router     = inject(Router);
  private readonly featureFlags = inject(FeatureFlagsService);
  private readonly clinicSvc    = inject(ClinicServicesService);
  private readonly chairsSvc    = inject(ChairsService);

  /** Mounted-but-hidden when the org has Friday disabled. */
  readonly enabled = computed(() => this.featureFlags.flags().some(f => f.key === FRIDAY_FLAG && f.enabled));

  readonly open             = signal(false);
  readonly listening        = signal(false);
  readonly awake            = signal(false);
  readonly wakeWordOn       = signal(true);
  readonly transcript       = signal('');
  readonly interim          = signal('');
  readonly status           = signal<Status>('idle');
  readonly message          = signal('');
  readonly matches          = signal<Patient[]>([]);
  readonly summary          = signal<{ total: number; upcoming: number; done: number; cancelled: number } | null>(null);
  readonly speechSupported  = signal(false);

  // ── Guided booking flow ───────────────────────────────────────────────────
  readonly flowStep = signal<'idle' | 'awaiting_patient' | 'awaiting_new_patient_confirm' | 'awaiting_new_patient_phone' | 'awaiting_service' | 'awaiting_chair' | 'awaiting_date' | 'awaiting_time' | 'awaiting_confirm' | 'booking'>('idle');
  readonly flowData = signal<{ patient?: Patient; service?: ClinicService; chair?: Chair; date?: string; time?: string }>({});
  private servicesCache: ClinicService[] = [];
  private chairsCache: Chair[] = [];
  /** Buffered name when offering to create a new patient. */
  private pendingNewName: string | null = null;
  readonly voiceOutOn       = signal(true);
  readonly speaking         = signal(false);

  private wakeRecognition:   any = null;
  private activeRecognition: any = null;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private idleTimer:    ReturnType<typeof setTimeout> | null = null;
  private watchdog:     ReturnType<typeof setInterval> | null = null;
  private wakeFlushTimer: ReturnType<typeof setTimeout> | null = null;
  /** Best transcript so far for the current utterance once "friday" has appeared. */
  private wakePending: string | null = null;
  /** True between stopping the wake listener and the active rec being live. */
  private handingOff = false;
  private cachedVoice: SpeechSynthesisVoice | null = null;

  constructor() {
    // React to feature-flag toggles at runtime — disabling Friday shuts mic + TTS.
    effect(() => {
      const on = this.enabled();
      if (!on) {
        this.stopWakeListener();
        this.stopActive();
        if ('speechSynthesis' in window) {
          try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
        }
        this.open.set(false);
      } else if (this.speechSupported() && this.wakeWordOn() && !this.wakeRecognition) {
        this.startWakeListener();
      }
    });
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────
  ngOnInit(): void {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    this.speechSupported.set(!!SR);
    if (SR && this.enabled() && this.wakeWordOn()) this.startWakeListener();
    // Voices load asynchronously in some browsers; cache when ready.
    this.primeFemaleVoice();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => this.primeFemaleVoice();
    }
    // Watchdog: Chrome occasionally drops continuous recognition without firing
    // a clean onend (especially after TTS playback). Every 2s, if wake is meant
    // to be on but no recognition is running and we're not in active capture,
    // re-arm it.
    this.watchdog = setInterval(() => {
      if (!this.enabled()) return;
      if (!this.speechSupported()) return;
      if (!this.wakeWordOn()) return;
      if (this.activeRecognition || this.handingOff || this.speaking()) return;
      if (!this.wakeRecognition) this.startWakeListener();
    }, 2000);
  }

  ngOnDestroy(): void {
    this.wakeWordOn.set(false);
    this.stopWakeListener();
    this.stopActive();
    if (this.restartTimer) clearTimeout(this.restartTimer);
    if (this.idleTimer)    clearTimeout(this.idleTimer);
    if (this.watchdog)     clearInterval(this.watchdog);
  }

  // ── UI controls ──────────────────────────────────────────────────────────
  subline(): string {
    if (this.awake())          return 'Yes? I\'m listening…';
    if (this.listening())      return 'Listening — speak now…';
    if (this.status() === 'thinking') return 'Thinking…';
    if (this.wakeWordOn())     return 'Standing by — say "Friday"';
    return 'Tap the mic and speak.';
  }

  togglePanel(): void {
    if (this.open()) { this.closePanel(); return; }
    this.reset();
    this.open.set(true);
  }

  closePanel(): void {
    this.open.set(false);
    this.stopActive();
    this.awake.set(false);
    if (this.flowStep() !== 'idle') {
      this.flowStep.set('idle');
      this.flowData.set({});
    }
    // Re-arm the wake-word listener so Friday keeps standing by for the next utterance.
    if (this.wakeWordOn() && this.speechSupported()) {
      setTimeout(() => {
        this.stopWakeListener();   // discard any stale/dead reference
        this.startWakeListener();  // fresh instance
      }, 350);
    }
  }

  toggleWakeWord(): void {
    const next = !this.wakeWordOn();
    this.wakeWordOn.set(next);
    if (next) this.startWakeListener();
    else      this.stopWakeListener();
  }

  private reset(): void {
    this.transcript.set('');
    this.interim.set('');
    this.matches.set([]);
    this.summary.set(null);
    this.message.set('');
    this.status.set('idle');
  }

  // ── Wake-word listener (always-on) ───────────────────────────────────────
  private startWakeListener(): void {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (this.wakeRecognition) return;

    const rec = new SR();
    rec.continuous       = true;
    // Interim results back ON for low-latency wake detection — we use a
    // debounce + final-transcript handshake to avoid clipping commands.
    rec.interimResults   = true;
    rec.maxAlternatives  = 3;   // give the recognizer multiple shots at hearing "friday"
    rec.lang             = 'en-IN';

    // Generous regex covering common ASR mishearings of "Friday".
    const WAKE_RX = /\b(friday|fryday|fride|frida|fri\s*-?\s*day|free\s*day|freed[ae]y?|frida[ey]|hey\s+da?y?)\b/;

    rec.onresult = (e: any) => {
      if (this.listening() || this.awake()) return;

      // Walk every alternative of every result in this batch — we only need one
      // alternative to contain the wake word for us to count it as detected.
      let bestText = '';
      let anyFinal = false;
      let detected = false;
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) anyFinal = true;
        for (let a = 0; a < res.length; a++) {
          const t = (res[a].transcript || '').toString();
          // Track the highest-quality transcript (first alt) for command extraction.
          if (a === 0) bestText += t;
          if (WAKE_RX.test(t.toLowerCase())) detected = true;
        }
      }

      if (!detected) return;

      // Capture the best command guess so far.
      this.wakePending = bestText.toLowerCase();

      // If the recognizer has finalised this utterance, dispatch immediately.
      if (anyFinal) {
        if (this.wakeFlushTimer) { clearTimeout(this.wakeFlushTimer); this.wakeFlushTimer = null; }
        const text = this.wakePending; this.wakePending = null;
        this.onWakeDetected(text);
        return;
      }

      // Otherwise wait a short while for the final transcript. If nothing more
      // arrives, dispatch what we have (handles bare "Friday" without trailing).
      if (this.wakeFlushTimer) clearTimeout(this.wakeFlushTimer);
      this.wakeFlushTimer = setTimeout(() => {
        const text = this.wakePending || '';
        this.wakePending = null;
        this.wakeFlushTimer = null;
        if (text) this.onWakeDetected(text);
      }, 1400);
    };
    rec.onerror = (e: any) => {
      // Microphone denied — disable wake word silently
      if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') {
        this.wakeWordOn.set(false);
        this.stopWakeListener();
      }
    };
    rec.onend = () => {
      // Drop reference if this rec was the active wake instance.
      if (this.wakeRecognition === rec) this.wakeRecognition = null;
      // Auto-restart with a fresh instance — Chrome ends continuous recognition
      // periodically by itself, so we have to re-arm. Skip while we're mid
      // handoff to active capture.
      if (this.wakeWordOn() && !this.activeRecognition && !this.handingOff) {
        if (this.restartTimer) clearTimeout(this.restartTimer);
        this.restartTimer = setTimeout(() => this.startWakeListener(), 400);
      }
    };
    try {
      rec.start();
      this.wakeRecognition = rec;
    } catch { /* ignore */ }
  }

  private stopWakeListener(): void {
    if (this.wakeRecognition) {
      try { this.wakeRecognition.stop(); } catch { /* ignore */ }
      this.wakeRecognition = null;
    }
    if (this.restartTimer)   { clearTimeout(this.restartTimer);   this.restartTimer   = null; }
    if (this.wakeFlushTimer) { clearTimeout(this.wakeFlushTimer); this.wakeFlushTimer = null; }
    this.wakePending = null;
  }

  private onWakeDetected(text: string): void {
    // Strip the wake word (and the leading noise before it) so the rest is the command.
    const stripped = text
      .replace(/^.*?\b(friday|fryday|fride|frida|fri\s*-?\s*day|free\s*day|freed[ae]y?|frida[ey]|hey\s+da?y?)\b[\s,.:!]*/i, '')
      .trim();
    this.open.set(true);
    this.reset();
    this.awake.set(true);
    this.message.set('Yes? Go ahead…');
    if (stripped && stripped.length >= 3) {
      this.transcript.set(stripped);
      this.awake.set(false);
      this.interpret(stripped);
    } else {
      // Bare "Friday" — acknowledge audibly with "Yes boss…" then auto-open the
      // mic for the next command (no second wake word required). The onComplete
      // callback fires after the synthesizer finishes so the mic and TTS never
      // fight for the audio session.
      this.message.set('Yes boss, what do you want me to do?');
      this.speak('Yes boss, what do you want me to do?', () => {
        if (!this.enabled() || this.activeRecognition) return;
        this.startActive(true);
      });
    }
  }

  // ── Active capture ───────────────────────────────────────────────────────
  startActive(triggeredByWake = false): void {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (this.activeRecognition) return;
    // Hand off the mic from the wake listener cleanly.
    this.handingOff = true;
    this.stopWakeListener();
    if (!triggeredByWake) this.reset();
    this.open.set(true);

    const rec = new SR();
    rec.continuous     = false;
    rec.interimResults = true;
    rec.lang           = 'en-IN';

    rec.onresult = (e: any) => {
      let interimText = '', finalText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t; else interimText += t;
      }
      if (interimText) this.interim.set(interimText.trim());
      if (finalText) {
        const clean = finalText.trim();
        this.transcript.set(clean);
        this.interim.set('');
        this.awake.set(false);
        if (this.flowStep() !== 'idle' && this.flowStep() !== 'booking') {
          this.handleFlowResponse(clean);
        } else {
          this.interpret(clean);
        }
      }
    };
    rec.onerror = (e: any) => {
      this.listening.set(false);
      this.awake.set(false);
      this.activeRecognition = null;
      if (e?.error !== 'no-speech') {
        this.status.set('error');
        this.message.set(e?.error === 'not-allowed'
          ? 'Microphone permission denied.'
          : "Couldn't hear that — please try again.");
      }
      if (this.wakeWordOn()) this.startWakeListener();
    };
    rec.onend = () => {
      this.listening.set(false);
      this.awake.set(false);
      this.activeRecognition = null;
      if (this.wakeWordOn()) this.startWakeListener();
    };

    const launch = (attempt: number) => {
      try {
        rec.start();
        this.activeRecognition = rec;
        this.handingOff = false;
        this.listening.set(true);
        this.status.set('listening');
        if (this.idleTimer) clearTimeout(this.idleTimer);
        this.idleTimer = setTimeout(() => this.stopActive(), 8000);
      } catch (err) {
        // Chrome occasionally throws "InvalidStateError" right after TTS
        // because the audio session hasn't fully released. Retry once.
        if (attempt < 2) {
          setTimeout(() => launch(attempt + 1), 500);
          return;
        }
        this.handingOff = false;
        this.status.set('error');
        this.message.set('Could not start voice input.');
        if (this.wakeWordOn()) this.startWakeListener();
      }
    };
    launch(1);
  }

  stopActive(): void {
    if (this.idleTimer) { clearTimeout(this.idleTimer); this.idleTimer = null; }
    if (this.activeRecognition) {
      try { this.activeRecognition.stop(); } catch { /* ignore */ }
      this.activeRecognition = null;
    }
    this.listening.set(false);
  }

  // ── Intent dispatch via backend LLM ──────────────────────────────────────
  private interpret(text: string): void {
    this.status.set('thinking');
    this.message.set('Thinking…');
    this.assistant.interpret(text).subscribe({
      next: (r) => this.dispatch(r),
      error: () => {
        this.status.set('error');
        this.message.set("Sorry, I couldn't reach the brain. Try again.");
      },
    });
  }

  private dispatch(r: AssistantResult): void {
    switch (r.intent) {
      case 'patient.find': {
        const q = String(r.entities['query'] ?? '').trim();
        if (!q) {
          this.status.set('noresult');
          this.respondAndKeepListening(r.message || "I didn't catch a name.");
          return;
        }
        this.message.set(`Searching for "${q}"…`);
        this.speak(`Searching for ${q}`);
        this.patients.search(q).subscribe({
          next: ({ patients }) => {
            const list = patients ?? [];
            this.matches.set(list);
            if (list.length === 0) {
              this.status.set('noresult');
              this.respondAndKeepListening(`No patient found matching ${q}.`);
            } else if (list.length === 1) {
              this.status.set('success');
              const msg = `Opening ${list[0].name}'s record.`;
              this.message.set(msg); this.speak(msg);
              setTimeout(() => this.openPatient(list[0]), 900);
            } else {
              this.status.set('success');
              this.respondAndKeepListening(`Found ${list.length} matches. Please say the full name.`);
            }
          },
          error: () => {
            this.status.set('error');
            this.respondAndKeepListening('Patient search failed.');
          },
        });
        return;
      }
      case 'navigate': {
        const target = String(r.entities['target'] ?? '').toLowerCase();
        const route  = NAV_MAP[target];
        if (!route) {
          this.status.set('noresult');
          this.respondAndKeepListening(`I don't know how to open ${target}.`);
          return;
        }
        this.status.set('success');
        const msg = `Opening ${target}.`;
        this.message.set(msg); this.speak(msg);
        setTimeout(() => { this.router.navigate([route]); this.closePanel(); }, 700);
        return;
      }
      case 'appointment.book': {
        this.startBookingFlow(r.entities);
        return;
      }
      case 'schedule.summary': {
        const today = format(new Date(), 'yyyy-MM-dd');
        this.appts.getSchedule(today).subscribe({
          next: ({ appointments }) => {
            const list = appointments ?? [];
            const done      = list.filter(a => a.status === 'done').length;
            const cancelled = list.filter(a => a.status === 'cancelled' || a.status === 'no_show').length;
            const upcoming  = list.length - done - cancelled;
            this.summary.set({ total: list.length, upcoming, done, cancelled });
            this.status.set('success');
            const msg = list.length === 0
              ? 'No appointments today. Anything else?'
              : `You have ${list.length} appointments today — ${upcoming} upcoming, ${done} done${cancelled ? `, ${cancelled} cancelled` : ''}. Anything else?`;
            this.respondAndKeepListening(msg);
          },
          error: () => {
            this.status.set('error');
            this.respondAndKeepListening("Couldn't fetch today's schedule.");
          },
        });
        return;
      }
      case 'smalltalk.greeting':
      case 'smalltalk.thanks':
      case 'smalltalk.time':
      case 'smalltalk.weather':
      case 'smalltalk.sarcasm': {
        this.status.set('success');
        this.respondAndKeepListening(r.message || '...');
        return;
      }
      case 'smalltalk.bye': {
        this.status.set('success');
        const msg = r.message || 'Goodbye.';
        this.message.set(msg); this.speak(msg);
        // Auto-close the panel after the farewell finishes.
        setTimeout(() => this.closePanel(), 1800);
        return;
      }
      case 'app.exit':
      case 'account.sign_out': {
        // Backend already revoked the refresh token; we just clear local
        // session + navigate. Speak the (possibly sarcastic) farewell first,
        // then hand off to AuthService.logout() which clears storage and
        // pushes us to /login. Panel closes as part of route change.
        this.status.set('success');
        const msg = r.message || 'Logging you out.';
        this.message.set(msg);
        const redirect = r.action?.redirect || '/authentication/login';
        // Stop all listening immediately so Friday doesn't keep the mic open
        // through the logout transition.
        this.wakeWordOn.set(false);
        this.stopWakeListener();
        this.stopActive();
        this.speak(msg, () => {
          // Local auth wipe + best-effort server logout (refresh token already
          // revoked server-side via the assistant pipeline, this is idempotent).
          this.auth.logout().subscribe({
            next: () => { /* ignore */ },
            error: () => { /* ignore */ },
          });
          this.closePanel();
          this.router.navigate([redirect]);
        });
        return;
      }
      default: {
        this.status.set('noresult');
        this.respondAndKeepListening(r.message || "I didn't understand that command.");
      }
    }
  }

  /** Speak the response and immediately re-open the mic for the next command —
   *  Friday stays in the conversation instead of going back to wake-word mode. */
  private respondAndKeepListening(msg: string): void {
    this.message.set(msg);
    this.speak(msg, () => {
      if (!this.enabled() || this.activeRecognition) return;
      this.startActive(true);
    });
  }

  // ── Guided booking flow ─────────────────────────────────────────────────
  private startBookingFlow(entities: Record<string, any>): void {
    this.flowData.set({});
    this.matches.set([]);
    this.summary.set(null);
    // Preload services + chair so per-step lookups are instant.
    this.loadBookingMeta(() => {
      const data: { patient?: Patient; service?: ClinicService; date?: string; time?: string } = {};
      // Pre-fill what the original utterance already gave us.
      const prefillSteps: Array<() => Promise<void>> = [];

      if (entities['patient']) {
        prefillSteps.push(() => new Promise<void>(resolve => {
          this.patients.search(String(entities['patient'])).subscribe({
            next: ({ patients }) => { if (patients?.length === 1) data.patient = patients[0]; resolve(); },
            error: () => resolve(),
          });
        }));
      }
      if (entities['service']) {
        const svc = this.matchService(String(entities['service']));
        if (svc) data.service = svc;
      }
      if (entities['date']) data.date = this.normaliseDate(String(entities['date'])) ?? undefined;
      if (entities['time']) data.time = this.normaliseTime(String(entities['time'])) ?? undefined;

      Promise.all(prefillSteps.map(s => s())).then(() => {
        this.flowData.set(data);
        this.advanceFlow();
      });
    });
  }

  private loadBookingMeta(done: () => void): void {
    if (this.servicesCache.length && this.chairsCache.length) { done(); return; }
    const clinicId = this.auth.getActiveClinicId() ?? undefined;
    let pending = 2;
    const finish = () => { if (--pending === 0) done(); };
    this.clinicSvc.list(clinicId).subscribe({
      next: r => { this.servicesCache = (r.services ?? []).filter(s => s.is_active !== false); finish(); },
      error: () => finish(),
    });
    this.chairsSvc.list(clinicId).subscribe({
      next: r => {
        this.chairsCache = (r.chairs ?? []).filter(c => c.is_active !== false && c.operational_status !== 'out_of_order');
        finish();
      },
      error: () => finish(),
    });
  }

  private advanceFlow(): void {
    const d = this.flowData();
    if (!d.patient) return this.ask('awaiting_patient', "Sure — which patient should I book this for?");
    if (!d.service) return this.ask('awaiting_service', `What service should I book for ${d.patient.name}?`);
    if (!d.chair) {
      // Auto-pick when only one chair is configured; otherwise ask.
      if (this.chairsCache.length === 1) {
        this.flowData.update(x => ({ ...x, chair: this.chairsCache[0] }));
        return this.advanceFlow();
      }
      if (this.chairsCache.length === 0) {
        return this.cancelFlow('No active chairs are set up for this clinic. Please add a chair first.');
      }
      const names = this.chairsCache.map(c => c.name).join(', ');
      return this.ask('awaiting_chair', `Which chair? Options are ${names}.`);
    }
    if (!d.date) return this.ask('awaiting_date', "Which date works? You can say today, tomorrow, or a specific date.");
    if (!d.time) return this.ask('awaiting_time', "And what time?");
    return this.askConfirm();
  }

  private ask(step: 'awaiting_patient' | 'awaiting_service' | 'awaiting_chair' | 'awaiting_date' | 'awaiting_time', prompt: string): void {
    this.flowStep.set(step);
    this.status.set('listening');
    this.message.set(prompt);
    this.speak(prompt, () => {
      if (this.flowStep() === step && !this.activeRecognition) this.startActive(true);
    });
  }

  private askConfirm(): void {
    const d = this.flowData();
    const chairTxt = d.chair ? `, ${d.chair.name}` : '';
    const summary = `Booking ${d.service!.name} for ${d.patient!.name} on ${this.spokenDate(d.date!)} at ${this.spokenTime(d.time!)}${chairTxt}. Shall I confirm?`;
    this.flowStep.set('awaiting_confirm');
    this.status.set('listening');
    this.message.set(summary);
    this.speak(summary, () => {
      if (this.flowStep() === 'awaiting_confirm' && !this.activeRecognition) this.startActive(true);
    });
  }

  private handleFlowResponse(text: string): void {
    const lower = text.toLowerCase();
    if (/^(cancel|stop|abort|never mind|forget it|drop it|exit)\b/.test(lower)) {
      this.cancelFlow('Okay, cancelled.');
      return;
    }
    switch (this.flowStep()) {
      case 'awaiting_patient':            return this.processPatient(text);
      case 'awaiting_new_patient_confirm': return this.processNewPatientConfirm(text);
      case 'awaiting_new_patient_phone':   return this.processNewPatientPhone(text);
      case 'awaiting_service':            return this.processService(text);
      case 'awaiting_chair':              return this.processChair(text);
      case 'awaiting_date':               return this.processDate(text);
      case 'awaiting_time':               return this.processTime(text);
      case 'awaiting_confirm':            return this.processConfirm(text);
    }
  }

  private processPatient(text: string): void {
    const q = text.replace(/\b(patient|name is|the patient|book for|for|new)\b/gi, '').trim();
    if (q.length < 2) return this.ask('awaiting_patient', "I didn't catch that. Please say the patient's name.");
    this.status.set('thinking');
    this.message.set(`Looking up ${q}…`);
    this.patients.search(q).subscribe({
      next: ({ patients }) => {
        const list = patients ?? [];
        if (list.length === 0) {
          // No existing record — offer to register this as a NEW patient.
          this.pendingNewName = this.titleCase(q);
          this.flowStep.set('awaiting_new_patient_confirm');
          this.status.set('listening');
          const prompt = `I don't have ${this.pendingNewName} on file. Should I add them as a new patient?`;
          this.message.set(prompt);
          this.speak(prompt, () => {
            if (this.flowStep() === 'awaiting_new_patient_confirm' && !this.activeRecognition) {
              this.startActive(true);
            }
          });
        } else if (list.length === 1) {
          this.flowData.update(d => ({ ...d, patient: list[0] }));
          this.speak(`Got it — ${list[0].name}.`, () => this.advanceFlow());
        } else {
          // Multiple — take exact name match if any, else ask to be specific.
          const exact = list.find(p => p.name.toLowerCase() === q.toLowerCase());
          if (exact) {
            this.flowData.update(d => ({ ...d, patient: exact }));
            this.speak(`Got it — ${exact.name}.`, () => this.advanceFlow());
          } else {
            this.matches.set(list);
            this.speak(`I found ${list.length} matches. Please say the full name.`, () => this.ask('awaiting_patient', `Multiple matches — say the full name.`));
          }
        }
      },
      error: () => this.ask('awaiting_patient', 'Patient lookup failed. Try again or say cancel.'),
    });
  }

  private processNewPatientConfirm(text: string): void {
    const t = text.toLowerCase();
    if (/\b(yes|yeah|yep|sure|please|go ahead|add|create|new|confirm)\b/.test(t)) {
      this.flowStep.set('awaiting_new_patient_phone');
      this.status.set('listening');
      const prompt = `Great — what's ${this.pendingNewName}'s mobile number?`;
      this.message.set(prompt);
      this.speak(prompt, () => {
        if (this.flowStep() === 'awaiting_new_patient_phone' && !this.activeRecognition) {
          this.startActive(true);
        }
      });
    } else if (/\b(no|nope|cancel|stop|wrong)\b/.test(t)) {
      this.pendingNewName = null;
      this.ask('awaiting_patient', "Okay — try saying the name again, or say cancel.");
    } else {
      this.speak("Please say yes to add them or no to try again.", () => {
        this.flowStep.set('awaiting_new_patient_confirm');
        if (!this.activeRecognition) this.startActive(true);
      });
    }
  }

  private processNewPatientPhone(text: string): void {
    const phone = this.normalisePhone(text);
    if (!phone) {
      return this.speak("That doesn't look like a ten digit mobile number. Try again or say cancel.", () => {
        this.flowStep.set('awaiting_new_patient_phone');
        if (!this.activeRecognition) this.startActive(true);
      });
    }
    // Sanity: another patient may already share this exact (phone, name).
    this.patients.search(phone).subscribe({
      next: ({ patients }) => {
        const exact = (patients ?? []).find(p => p.phone === phone && p.name.toLowerCase() === (this.pendingNewName ?? '').toLowerCase());
        if (exact) {
          this.flowData.update(d => ({ ...d, patient: exact }));
          this.pendingNewName = null;
          this.speak(`Found existing record for ${exact.name}. Continuing.`, () => this.advanceFlow());
          return;
        }
        // Build a synthetic Patient stub — booking endpoint creates the actual
        // row server-side via the (phone, name) lookup-or-insert logic.
        const stub: Patient = {
          id:    '',
          name:  this.pendingNewName ?? '',
          phone,
        };
        this.pendingNewName = null;
        this.flowData.update(d => ({ ...d, patient: stub }));
        this.speak(`Adding ${stub.name} with ${phone}.`, () => this.advanceFlow());
      },
      error: () => {
        const stub: Patient = { id: '', name: this.pendingNewName ?? '', phone };
        this.pendingNewName = null;
        this.flowData.update(d => ({ ...d, patient: stub }));
        this.speak(`Adding ${stub.name}.`, () => this.advanceFlow());
      },
    });
  }

  private normalisePhone(text: string): string | null {
    const words: Record<string, string> = {
      zero:  '0', oh:    '0', o:     '0', nought: '0',
      one:   '1', two:   '2', three: '3', four:  '4', five: '5',
      six:   '6', seven: '7', eight: '8', nine:  '9',
      double: '', triple: '',  // "double seven" -> "77" handled below
    };
    let t = text.toLowerCase();
    // "double 7" / "double seven" -> "77"
    t = t.replace(/\bdouble\s+(\w+)/g, (_, w) => {
      const d = words[w] ?? (/^\d$/.test(w) ? w : '');
      return d ? d + d : '';
    });
    t = t.replace(/\btriple\s+(\w+)/g, (_, w) => {
      const d = words[w] ?? (/^\d$/.test(w) ? w : '');
      return d ? d + d + d : '';
    });
    // Word digits -> numeric
    for (const [w, d] of Object.entries(words)) {
      if (!d) continue;
      t = t.replace(new RegExp(`\\b${w}\\b`, 'g'), d);
    }
    const digits = (t.match(/\d/g) || []).join('');
    if (digits.length === 10 && /^[6-9]/.test(digits)) return digits;
    // Handle country-prefixed input like "91 98765 43210"
    if (digits.length === 12 && digits.startsWith('91') && /^[6-9]/.test(digits[2])) return digits.slice(2);
    return null;
  }

  private titleCase(s: string): string {
    return s.split(/\s+/).filter(Boolean)
      .map(w => w[0].toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }

  private processService(text: string): void {
    const svc = this.matchService(text);
    if (!svc) {
      return this.speak("I don't recognise that service. Try again or say cancel.", () =>
        this.ask('awaiting_service', "Couldn't match that service. Try again."));
    }
    this.flowData.update(d => ({ ...d, service: svc }));
    this.speak(`Okay — ${svc.name}.`, () => this.advanceFlow());
  }

  private processChair(text: string): void {
    const chair = this.matchChair(text);
    if (!chair) {
      const names = this.chairsCache.map(c => c.name).join(', ');
      return this.speak(`I didn't catch that. Options are ${names}.`, () =>
        this.ask('awaiting_chair', `Couldn't match that chair. Options: ${names}.`));
    }
    this.flowData.update(d => ({ ...d, chair }));
    this.speak(`Okay — ${chair.name}.`, () => this.advanceFlow());
  }

  private matchChair(text: string): Chair | null {
    if (!this.chairsCache.length) return null;
    const t = text.toLowerCase().replace(/\bchair\b/g, '').replace(/\s+/g, ' ').trim();
    if (!t) return null;
    // Exact name match (case-insensitive).
    let chair = this.chairsCache.find(c => c.name.toLowerCase() === t);
    if (chair) return chair;
    // Substring.
    chair = this.chairsCache.find(c => c.name.toLowerCase().includes(t) || t.includes(c.name.toLowerCase()));
    if (chair) return chair;
    // "Chair 1" → trailing digit positional pick if names contain digits.
    const numMatch = t.match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b/);
    if (numMatch) {
      const numMap: Record<string, number> = { one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10 };
      const n = numMap[numMatch[1]] ?? Number(numMatch[1]);
      // Match name containing this digit.
      chair = this.chairsCache.find(c => c.name.includes(String(n)));
      if (chair) return chair;
      // Fall back to positional pick.
      if (n >= 1 && n <= this.chairsCache.length) return this.chairsCache[n - 1];
    }
    return null;
  }

  private processDate(text: string): void {
    const iso = this.normaliseDate(text);
    if (!iso) {
      return this.speak("I didn't get the date. Try today, tomorrow, or a date.", () =>
        this.ask('awaiting_date', "Couldn't parse that date. Try again."));
    }
    this.flowData.update(d => ({ ...d, date: iso }));
    this.speak(`Got it, ${this.spokenDate(iso)}.`, () => this.advanceFlow());
  }

  private processTime(text: string): void {
    const t = this.normaliseTime(text);
    if (!t) {
      return this.speak("I didn't catch the time. Say something like ten a m or two thirty p m.", () =>
        this.ask('awaiting_time', "Couldn't parse that time. Try again."));
    }
    this.flowData.update(d => ({ ...d, time: t }));
    this.speak(`Okay, ${this.spokenTime(t)}.`, () => this.advanceFlow());
  }

  private processConfirm(text: string): void {
    const t = text.toLowerCase();
    if (/\b(yes|yeah|yep|confirm|book it|do it|go ahead|sure|please)\b/.test(t)) {
      this.submitBooking();
    } else if (/\b(no|nope|cancel|stop|abort)\b/.test(t)) {
      this.cancelFlow('Okay, cancelled.');
    } else {
      // Re-ask confirmation without leaving the step.
      const d = this.flowData();
      const reask = `Should I book ${d.service?.name} for ${d.patient?.name} on ${this.spokenDate(d.date!)} at ${this.spokenTime(d.time!)}? Please say yes or no.`;
      this.message.set(reask);
      this.speak(reask, () => {
        this.flowStep.set('awaiting_confirm');
        if (!this.activeRecognition) this.startActive(true);
      });
    }
  }

  private submitBooking(): void {
    const d = this.flowData();
    const chairId = d.chair?.id ?? this.chairsCache[0]?.id ?? null;
    if (!d.patient || !d.service || !d.date || !d.time || !chairId) {
      this.cancelFlow("Something's missing — let's start over.");
      return;
    }
    this.flowStep.set('booking');
    this.status.set('thinking');
    this.message.set('Booking the appointment…');
    this.speak("Booking it now.");
    const payload: BookingPayload = {
      service_id: d.service.id,
      chair_id:   chairId,
      scheduled_at: `${d.date}T${d.time}:00+05:30`,
      booking_source: 'internal',
      patient: {
        name:  d.patient.name,
        phone: d.patient.phone,
        email: d.patient.email,
        age:   d.patient.age,
        gender: d.patient.gender,
        address: d.patient.address,
      },
    };
    this.appts.book(payload).subscribe({
      next: () => {
        this.status.set('success');
        const msg = `Done! ${d.service!.name} for ${d.patient!.name} on ${this.spokenDate(d.date!)} at ${this.spokenTime(d.time!)} is booked.`;
        this.message.set(msg);
        this.speak(msg, () => {
          this.flowStep.set('idle');
          this.flowData.set({});
        });
      },
      error: (e) => {
        const errMsg = e?.status === 409
          ? "That slot's already taken. Let's pick another time."
          : "Booking failed. Please try again.";
        this.status.set('error');
        this.message.set(errMsg);
        this.speak(errMsg, () => {
          if (e?.status === 409) {
            this.flowData.update(d2 => ({ ...d2, time: undefined }));
            this.flowStep.set('awaiting_time');
            this.ask('awaiting_time', 'What time should I try instead?');
          } else {
            this.cancelFlow('Booking failed.');
          }
        });
      },
    });
  }

  private cancelFlow(spoken: string): void {
    this.flowStep.set('idle');
    this.flowData.set({});
    this.status.set('idle');
    this.message.set(spoken);
    this.speak(spoken);
  }

  // ── Booking helpers ─────────────────────────────────────────────────────
  private matchService(text: string): ClinicService | null {
    if (!this.servicesCache.length) return null;
    const q = text.toLowerCase().replace(/\b(book|schedule|please|an|a|the|appointment|for|to|me)\b/g, ' ').replace(/\s+/g, ' ').trim();
    if (!q) return null;
    // 1) Exact-ish substring match.
    let best: { svc: ClinicService; score: number } | null = null;
    for (const svc of this.servicesCache) {
      const name = svc.name.toLowerCase();
      if (name === q || name.includes(q) || q.includes(name)) {
        const score = Math.min(name.length, q.length) / Math.max(name.length, q.length);
        if (!best || score > best.score) best = { svc, score };
      }
    }
    if (best) return best.svc;
    // 2) Token overlap fallback.
    const qTokens = new Set(q.split(/\s+/));
    for (const svc of this.servicesCache) {
      const nTokens = svc.name.toLowerCase().split(/\s+/);
      const hit = nTokens.filter(t => qTokens.has(t)).length;
      if (hit >= Math.min(2, nTokens.length)) {
        const score = hit / Math.max(nTokens.length, qTokens.size);
        if (!best || score > best.score) best = { svc, score };
      }
    }
    return best?.svc ?? null;
  }

  private normaliseDate(text: string): string | null {
    if (!text) return null;
    const t = text.toLowerCase().trim();
    if (/already|\d{4}-\d{2}-\d{2}/.test(t)) {
      const m = t.match(/(\d{4}-\d{2}-\d{2})/);
      if (m) return m[1];
    }
    const today = new Date();
    if (/\btoday\b/.test(t))                 return this.iso(today);
    if (/\btomorrow\b/.test(t))              return this.iso(addDays(today, 1));
    if (/\bday after tomorrow\b/.test(t))    return this.iso(addDays(today, 2));
    const weekdays = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    for (let i = 0; i < weekdays.length; i++) {
      if (new RegExp(`\\b(?:next |this |on )?${weekdays[i]}\\b`).test(t)) {
        const cur = today.getDay();
        let diff = (i - cur + 7) % 7;
        if (diff === 0) diff = 7;
        return this.iso(addDays(today, diff));
      }
    }
    // "in 3 days"
    const m = t.match(/in (\d+) days?/);
    if (m) return this.iso(addDays(today, +m[1]));
    return null;
  }

  private iso(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private normaliseTime(text: string): string | null {
    const t = text.toLowerCase().replace(/\./g, '').trim();
    const wordsToNum: Record<string, number> = {
      one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
    };
    // Replace word numbers with digits ("ten thirty pm" -> "10 30 pm")
    let norm = t;
    for (const [w, n] of Object.entries(wordsToNum)) norm = norm.replace(new RegExp(`\\b${w}\\b`, 'g'), String(n));
    norm = norm.replace(/\bthirty\b/g, '30').replace(/\bforty five\b/g, '45').replace(/\bfifteen\b/g, '15').replace(/\bquarter\b/g, '15').replace(/\bhalf\b/g, '30').replace(/\bo'?clock\b/g, '');
    const m = norm.match(/(\d{1,2})(?:[:\s](\d{1,2}))?\s*(a\.?m\.?|p\.?m\.?|am|pm)?/);
    if (!m) return null;
    let hh = +m[1]; const mm = m[2] ? +m[2] : 0; const mer = (m[3] || '').replace(/[.\s]/g, '');
    if (isNaN(hh) || hh < 0 || hh > 23) return null;
    if (mm < 0 || mm > 59) return null;
    if (mer === 'pm' && hh < 12) hh += 12;
    if (mer === 'am' && hh === 12) hh = 0;
    return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
  }

  private spokenDate(iso: string): string {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  private spokenTime(hhmm: string): string {
    const [h, m] = hhmm.split(':').map(Number);
    const hh = h % 12 || 12;
    const mer = h < 12 ? 'a m' : 'p m';
    return `${hh}${m ? ' ' + String(m).padStart(2,'0') : ''} ${mer}`;
  }

  // ── Result actions ───────────────────────────────────────────────────────
  openPatient(p: Patient): void {
    this.router.navigate(['/patients', p.id]);
    this.closePanel();
  }

  goSchedule(): void {
    this.router.navigate(['/schedule']);
    this.closePanel();
  }

  initial(name: string): string {
    return (name || '?').trim().charAt(0).toUpperCase();
  }

  flowStepLabel(): string {
    switch (this.flowStep()) {
      case 'awaiting_patient':             return 'patient';
      case 'awaiting_new_patient_confirm': return 'new patient?';
      case 'awaiting_new_patient_phone':   return 'phone number';
      case 'awaiting_service':             return 'service';
      case 'awaiting_chair':               return 'chair';
      case 'awaiting_date':                return 'date';
      case 'awaiting_time':                return 'time';
      case 'awaiting_confirm':             return 'confirm';
      case 'booking':                      return 'submitting';
      default:                             return '';
    }
  }

  cancelFlowFromUi(): void {
    this.cancelFlow('Booking cancelled.');
  }

  // ── Text-to-speech ───────────────────────────────────────────────────────
  toggleVoiceOut(): void {
    const next = !this.voiceOutOn();
    this.voiceOutOn.set(next);
    if (!next) this.cancelSpeech();
  }

  private cancelSpeech(): void {
    if ('speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
    }
    this.speaking.set(false);
  }

  /** Female Irish-accent picker, with graceful fall-back to any female English voice. */
  private primeFemaleVoice(): SpeechSynthesisVoice | null {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices() || [];
    if (!voices.length) return null;

    const lower = (v: SpeechSynthesisVoice) => (v.name + ' ' + (v.voiceURI || '')).toLowerCase();

    // ── Tier 1: Fast, modern neural / cloud female voices ──────────────────
    // These render quickly with crisp prosody — sound "alive" instead of the
    // slower legacy concatenative voices (Moira/Samantha) which feel sluggish
    // even when the rate is bumped up.
    const FAST_FEMALE = [
      // Microsoft Edge — Neural voices (very snappy)
      'microsoft aria',
      'microsoft jenny',
      'microsoft michelle',
      'microsoft eva',
      'microsoft sonia',
      'microsoft emma',
      // Google Chrome — cloud voices
      'google uk english female',
      'google us english',
      // Apple — newer enhanced voices (faster than Moira)
      'ava',          // en-US, premium enhanced
      'samantha',     // en-US
      'allison',      // en-US
      'serena',       // en-GB enhanced
      'kate',         // en-GB enhanced
      // Microsoft legacy but still snappier than Moira
      'microsoft zira',
      'microsoft hazel',
    ];
    for (const target of FAST_FEMALE) {
      const en = voices.find(v => lower(v).includes(target) && /^en/i.test(v.lang));
      if (en) { this.cachedVoice = en; return en; }
    }
    for (const target of FAST_FEMALE) {
      const any = voices.find(v => lower(v).includes(target));
      if (any) { this.cachedVoice = any; return any; }
    }

    // ── Tier 2: Irish-accent fallback (Moira / Orla — slower but characterful) ─
    const IRISH_NAMES = ['microsoft orla', 'orla', 'moira', 'google english ireland'];
    for (const target of IRISH_NAMES) {
      const irish = voices.find(v => lower(v).includes(target));
      if (irish) { this.cachedVoice = irish; return irish; }
    }
    const enIe = voices.find(v => /^en[-_]ie/i.test(v.lang));
    if (enIe) { this.cachedVoice = enIe; return enIe; }

    // ── Tier 3: Any remaining female English voice ─────────────────────────
    const FEMALE_NAMES = [
      'microsoft heera', 'microsoft neerja',
      'victoria', 'karen', 'tessa', 'susan', 'fiona',
      'female', 'woman',
    ];
    for (const target of FEMALE_NAMES) {
      const en = voices.find(v => lower(v).includes(target) && /^en/i.test(v.lang));
      if (en) { this.cachedVoice = en; return en; }
    }
    for (const target of FEMALE_NAMES) {
      const any = voices.find(v => lower(v).includes(target));
      if (any) { this.cachedVoice = any; return any; }
    }
    const female = voices.find(v => /female|woman/i.test(lower(v)));
    if (female) { this.cachedVoice = female; return female; }
    const enAny = voices.find(v => /^en/i.test(v.lang));
    if (enAny) { this.cachedVoice = enAny; return enAny; }
    this.cachedVoice = voices[0] ?? null;
    return this.cachedVoice;
  }

  private speak(text: string, onComplete?: () => void): void {
    if (!this.voiceOutOn() || !text) { onComplete?.(); return; }
    if (!('speechSynthesis' in window)) { onComplete?.(); return; }

    // Centralised completion: guarantees onComplete (or default re-arm) fires
    // exactly once — even when Chrome silently swallows utterance events after
    // .cancel() on macOS (a known SpeechSynthesis bug).
    let completed = false;
    const safeFinish = () => {
      if (completed) return;
      completed = true;
      this.speaking.set(false);
      if (onComplete) {
        // Brief delay lets the synthesizer fully release the audio session
        // before the recognizer reclaims the mic.
        setTimeout(onComplete, 250);
        return;
      }
      // Default behaviour: re-arm the wake listener.
      if (this.wakeWordOn() && !this.activeRecognition) {
        setTimeout(() => {
          this.stopWakeListener();
          this.startWakeListener();
        }, 250);
      }
    };

    try {
      const wasWake = this.wakeWordOn() && !!this.wakeRecognition;
      if (wasWake) this.stopWakeListener();
      // While we hand the mic to TTS we don't want the watchdog to silently
      // re-arm the wake listener (it would steal the mic from the recognizer
      // we're about to open in onComplete).
      this.handingOff = !!onComplete;

      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const voice = this.cachedVoice ?? this.primeFemaleVoice();
      if (voice) { u.voice = voice; u.lang = voice.lang || 'en-IN'; }
      else       { u.lang = 'en-IN'; }
      u.rate   = 1.08;
      u.pitch  = 1.05;
      u.volume = 1;
      u.onstart = () => this.speaking.set(true);
      u.onend   = safeFinish;
      u.onerror = safeFinish;
      window.speechSynthesis.speak(u);

      // Safety net — estimate utterance length and force-complete if the real
      // onend never fires. ~330ms per word + 1.6s pad covers most cases.
      const estMs = Math.max(2200, text.split(/\s+/).length * 330 + 1600);
      setTimeout(safeFinish, estMs);
    } catch {
      safeFinish();
    }
  }
}
