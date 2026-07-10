import {
  Component, inject, OnInit, OnDestroy, signal, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { Subject, debounceTime, takeUntil } from 'rxjs';
import { SessionStore } from '../../store/session.store';
import { SessionApiService } from '../../services/session-api.service';
import { ToastService } from '../../../../services/toast.service';
import { SpeechRecognitionCoordinatorService } from '../../../../core/speech/speech-recognition-coordinator.service';

type SoapField = 's' | 'o' | 'a' | 'p';

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: { transcript: string };
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechRecognitionResultLike[];
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface BrowserSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type SpeechRecognitionCtor = new () => BrowserSpeechRecognition;

@Component({
  selector: 'df-soap-notes',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule],
  templateUrl: './df-soap-notes.component.html',
  styleUrl: './df-soap-notes.component.scss',
})
export class DfSoapNotesComponent implements OnInit, OnDestroy {
  readonly store = inject(SessionStore);
  private api    = inject(SessionApiService);
  private toast  = inject(ToastService);
  private zone   = inject(NgZone);
  private speechCoord = inject(SpeechRecognitionCoordinatorService);

  s = '';
  o = '';
  a = '';
  p = '';

  readonly saving = signal(false);
  readonly saved  = signal(false);

  readonly dictating       = signal<SoapField | null>(null);
  readonly speechSupported = signal(false);
  readonly interim         = signal('');
  private recognition: BrowserSpeechRecognition | null = null;
  private activeRecId      = 0;
  private pendingField: SoapField | null = null;
  private startTimer: ReturnType<typeof setTimeout> | null = null;
  private baseText         = '';

  private change$  = new Subject<void>();
  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    const note = this.store.notes();
    this.s = note.subjective;
    this.o = note.objective;
    this.a = note.assessment;
    this.p = note.plan;

    this.change$
      .pipe(debounceTime(1500), takeUntil(this.destroy$))
      .subscribe(() => this.save());

    this.speechSupported.set(!!this.getSpeechRecognitionCtor());
  }

  ngOnDestroy(): void {
    this.clearStartTimer();
    this.pendingField = null;
    this.stopDictation();
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleDictation(field: SoapField): void {
    if (this.store.isSealed()) return;
    if (this.dictating() === field) {
      this.stopDictation();
      return;
    }
    if (this.dictating()) this.stopDictation();
    this.startDictation(field);
  }

  onSoapFieldChange(field: SoapField): void {
    if (this.dictating() === field) {
      const trimmed = (this[field] ?? '').trim();
      this.baseText = trimmed ? `${trimmed} ` : '';
      this.interim.set('');
    } else if (!this.dictating()) {
      this.baseText = '';
    }
    this.onChange();
  }

  private getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
    const win = window as Window & {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
  }

  private startDictation(field: SoapField): void {
    const SR = this.getSpeechRecognitionCtor();
    if (!SR) {
      this.toast.error('Voice input is not supported in this browser. Try Chrome or Edge.');
      return;
    }
    if (!this.speechCoord.request('soap-notes')) {
      this.toast.error('Microphone is in use. Stop Friday or another dictation first.');
      return;
    }

    this.pendingField = field;
    this.clearStartTimer();
    // Let the global voice assistant release the mic before we start.
    this.startTimer = setTimeout(() => {
      this.startTimer = null;
      if (this.pendingField !== field) {
        this.speechCoord.release('soap-notes');
        return;
      }
      this.pendingField = null;
      this.launchDictation(field, SR);
    }, 350);
  }

  private launchDictation(field: SoapField, SR: SpeechRecognitionCtor): void {
    const rec = new SR();
    const recId = ++this.activeRecId;
    rec.continuous     = true;
    rec.interimResults = true;
    rec.lang           = 'en-IN';

    this.baseText = this.dictationBaseFor(this[field]);
    this.interim.set('');

    rec.onresult = (event: SpeechRecognitionEventLike) => {
      if (this.activeRecId !== recId) return;
      this.zone.run(() => {
        let finalChunk   = '';
        let interimChunk = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result[0]?.transcript ?? '';
          if (result.isFinal) finalChunk += transcript;
          else interimChunk += transcript;
        }
        if (finalChunk) {
          this.baseText = (this.baseText + finalChunk).replace(/\s+/g, ' ').trimStart();
          this[field]   = this.baseText;
          this.onChange();
        }
        const combined = (this.baseText + interimChunk).replace(/\s+/g, ' ');
        this[field] = combined;
        this.interim.set(interimChunk);
      });
    };

    rec.onerror = (event: SpeechRecognitionErrorEventLike) => {
      if (this.activeRecId !== recId) return;
      this.zone.run(() => {
        if (event.error === 'aborted' || event.error === 'no-speech') return;
        this.finishDictation(recId, field, false);
        const msg = this.speechErrorMessage(event.error);
        this.toast.error(msg);
      });
    };

    rec.onend = () => {
      if (this.activeRecId !== recId) return;
      this.zone.run(() => this.finishDictation(recId, field, true));
    };

    const start = (attempt: number) => {
      try {
        rec.start();
        this.recognition = rec;
        this.dictating.set(field);
      } catch {
        if (attempt < 2) {
          setTimeout(() => start(attempt + 1), 400);
          return;
        }
        this.activeRecId = 0;
        this.recognition = null;
        this.speechCoord.release('soap-notes');
        this.toast.error('Could not start voice input.');
      }
    };

    start(1);
  }

  private finishDictation(recId: number, field: SoapField, persist: boolean): void {
    if (this.activeRecId !== recId) return;
    this.activeRecId = 0;
    this.recognition = null;
    this.interim.set('');
    this.dictating.set(null);
    if (persist) {
      const text = (this[field] ?? '').replace(/\s+/g, ' ').trim();
      this[field] = text;
      this.onChange();
    }
    this.baseText = '';
    this.speechCoord.release('soap-notes');
  }

  stopDictation(): void {
    this.pendingField = null;
    this.clearStartTimer();
    const rec = this.recognition;
    const recId = this.activeRecId;
    if (recId) this.activeRecId = 0;
    this.dictating.set(null);
    this.interim.set('');
    this.baseText = '';
    if (rec) {
      this.recognition = null;
      try { rec.stop(); } catch { /* ignore */ }
    }
    this.speechCoord.release('soap-notes');
  }

  private clearStartTimer(): void {
    if (this.startTimer) {
      clearTimeout(this.startTimer);
      this.startTimer = null;
    }
  }

  private dictationBaseFor(value: string): string {
    const trimmed = (value ?? '').trim();
    return trimmed ? `${trimmed} ` : '';
  }

  private speechErrorMessage(code: string): string {
    switch (code) {
      case 'not-allowed':
      case 'service-not-allowed':
        return 'Microphone permission denied.';
      case 'audio-capture':
        return 'No microphone found.';
      case 'network':
        return 'Voice input needs an internet connection.';
      default:
        return 'Voice input error. Please try again.';
    }
  }

  onChange(): void {
    this.saved.set(false);
    this.change$.next();
  }

  private save(): void {
    const sessionId = this.store.sessionId();
    if (!sessionId || this.store.isSealed()) return;

    this.saving.set(true);
    this.api.upsertNotes(sessionId, {
      subjective: this.s,
      objective:  this.o,
      assessment: this.a,
      plan:       this.p,
    }).subscribe({
      next: ({ note }) => {
        this.saving.set(false);
        this.saved.set(true);
        this.store.updateNote(note);
        setTimeout(() => this.saved.set(false), 2000);
      },
      error: () => {
        this.saving.set(false);
        this.toast.error('Notes could not be saved. Please try again.');
      },
    });
  }
}
