import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { SessionStore } from '../../store/session.store';
import { SessionApiService } from '../../services/session-api.service';
import { ToastService } from '../../../../services/toast.service';

const COMMON_DIAGNOSES = [
  'Dental caries',
  'Irreversible pulpitis',
  'Reversible pulpitis',
  'Pulp necrosis',
  'Chronic apical periodontitis',
  'Acute apical abscess',
  'Chronic periodontitis',
  'Generalised gingivitis',
  'Dentinal hypersensitivity',
  'Impacted third molar',
  'Fractured tooth',
  'Cracked tooth syndrome',
  'Oral ulcer',
  'Temporomandibular disorder',
];

const KIND_LABELS: Record<string, string> = {
  provisional:  'Provisional',
  differential: 'Differential',
  final:        'Final',
};

const KIND_COLORS: Record<string, string> = {
  provisional:  '#0074ba',
  differential: '#7c3aed',
  final:        '#15803d',
};

@Component({
  selector: 'df-diagnosis-block',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule],
  templateUrl: './df-diagnosis-block.component.html',
  styleUrl: './df-diagnosis-block.component.scss',
})
export class DfDiagnosisBlockComponent {
  readonly store = inject(SessionStore);
  private api    = inject(SessionApiService);
  private toast  = inject(ToastService);

  readonly commonDx = COMMON_DIAGNOSES;

  newText  = '';
  newKind  = 'provisional';
  newIcd   = '';
  newTeeth: number[] = [];

  // FDI: permanent 11-18, 21-28, 31-38, 41-48 + deciduous 51-55, 61-65, 71-75, 81-85
  readonly allTeeth = [
    18,17,16,15,14,13,12,11, 21,22,23,24,25,26,27,28,
    48,47,46,45,44,43,42,41, 31,32,33,34,35,36,37,38,
    55,54,53,52,51, 61,62,63,64,65,
    85,84,83,82,81, 71,72,73,74,75,
  ];

  readonly adding  = signal(false);
  readonly deleting = signal<string | null>(null);
  readonly addError = signal<string | null>(null);

  kindLabel(kind: string): string  { return KIND_LABELS[kind] ?? kind; }
  kindColor(kind: string): string  { return KIND_COLORS[kind] ?? '#64748b'; }

  toggleTooth(t: number): void {
    this.newTeeth = this.newTeeth.includes(t)
      ? this.newTeeth.filter(n => n !== t)
      : [...this.newTeeth, t];
  }

  quickAdd(text: string): void {
    this.newText = text;
    this.addDiagnosis();
  }

  addDiagnosis(): void {
    const text      = this.newText.trim();
    const sessionId = this.store.sessionId();
    if (!text || !sessionId) return;

    this.adding.set(true);
    this.addError.set(null);

    this.api.addDiagnosis(sessionId, {
      diagnosis_text: text,
      icd10_code:     this.newIcd.trim() || undefined,
      tooth_numbers:  this.newTeeth.length ? this.newTeeth : undefined,
      kind:           this.newKind,
    }).subscribe({
      next: ({ diagnosis }) => {
        this.adding.set(false);
        this.store.addDiagnosis(diagnosis);
        this.newText  = '';
        this.newIcd   = '';
        this.newKind  = 'provisional';
        this.newTeeth = [];
        this.toast.success('Diagnosis added.');
      },
      error: (err) => {
        this.adding.set(false);
        const msg = err?.error?.error ?? 'Failed to add diagnosis.';
        this.addError.set(msg);
        this.toast.error(msg);
      },
    });
  }

  deleteDiagnosis(id: string): void {
    const sessionId = this.store.sessionId();
    if (!sessionId) return;
    this.deleting.set(id);
    this.api.deleteDiagnosis(sessionId, id).subscribe({
      next: () => {
        this.deleting.set(null);
        this.store.removeDiagnosis(id);
        this.toast.success('Diagnosis removed.');
      },
      error: () => {
        this.deleting.set(null);
        this.toast.error('Could not remove diagnosis. Please try again.');
      },
    });
  }
}
