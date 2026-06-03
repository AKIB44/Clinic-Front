import {
  Component, inject, OnInit, OnDestroy, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { Subject, debounceTime, takeUntil } from 'rxjs';
import { SessionStore } from '../../store/session.store';
import { SessionApiService } from '../../services/session-api.service';
import { ClinicalNote } from '../../models/session.model';
import { ToastService } from '../../../../services/toast.service';

type SoapField = 's' | 'o' | 'a' | 'p';

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

  s = '';
  o = '';
  a = '';
  p = '';

  // Signals so the template reacts without needing OnPush + markForCheck
  readonly saving = signal(false);
  readonly saved  = signal(false);

  // ── Voice dictation ──────────────────────────────────────────────────────
  readonly dictating       = signal<SoapField | null>(null);
  readonly speechSupported = signal(false);
  readonly interim         = signal('');
  private recognition: any = null;
  private baseText         = '';

  private change$  = new Subject<void>();
  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    const note = this.store.notes();
    this.s = note.subjective;
    this.o = note.objective;
    this.a = note.assessment;
    this.p = note.plan;

    // Auto-save with 1.5s debounce per PRD §6.12
    this.change$
      .pipe(debounceTime(1500), takeUntil(this.destroy$))
      .subscribe(() => this.save());

    // Detect Web Speech API support
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    this.speechSupported.set(!!SR);
  }

  ngOnDestroy(): void {
    this.stopDictation();
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Voice-to-text ────────────────────────────────────────────────────────

  toggleDictation(field: SoapField): void {
    if (this.store.isSealed()) return;
    if (this.dictating() === field) { this.stopDictation(); return; }
    if (this.dictating()) this.stopDictation();
    this.startDictation(field);
  }

  private startDictation(field: SoapField): void {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      this.toast.error('Voice input is not supported in this browser. Try Chrome or Edge.');
      return;
    }
    const rec = new SR();
    rec.continuous     = true;
    rec.interimResults = true;
    rec.lang           = 'en-IN';

    this.baseText = this[field] ? this[field] + ' ' : '';
    this.interim.set('');

    rec.onresult = (event: any) => {
      let finalChunk  = '';
      let interimChunk = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalChunk += transcript;
        else                          interimChunk += transcript;
      }
      if (finalChunk) {
        this.baseText = (this.baseText + finalChunk).replace(/\s+/g, ' ').trimStart();
        this[field]   = this.baseText;
        this.onChange();
      }
      const combined = (this.baseText + interimChunk).replace(/\s+/g, ' ');
      this[field] = combined;
      this.interim.set(interimChunk);
    };
    rec.onerror = (e: any) => {
      this.dictating.set(null);
      const msg = e?.error === 'not-allowed'
        ? 'Microphone permission denied.'
        : 'Voice input error. Please try again.';
      this.toast.error(msg);
    };
    rec.onend = () => {
      this.interim.set('');
      this.dictating.set(null);
      // Persist clean final text once stopped
      this[field] = this.baseText.trim();
      this.onChange();
    };

    try {
      rec.start();
      this.recognition = rec;
      this.dictating.set(field);
    } catch {
      this.toast.error('Could not start voice input.');
    }
  }

  stopDictation(): void {
    if (this.recognition) {
      try { this.recognition.stop(); } catch { /* ignore */ }
      this.recognition = null;
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
