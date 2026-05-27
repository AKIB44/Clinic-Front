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
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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
