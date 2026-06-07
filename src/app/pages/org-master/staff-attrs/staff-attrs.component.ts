import { Component, ChangeDetectionStrategy, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { StaffAttrsService, StaffAbacAttrs, StaffAttrPatch } from '../../../services/staff-attrs.service';
import { authApiConfig } from '../../../auth/auth.config';
import { HttpClient } from '@angular/common/http';

interface StaffRow {
  id: string; email: string; first_name: string; last_name: string; role: string;
}

const SPECIALTY_OPTIONS = [
  'ORTHODONTIC', 'IMPLANTOLOGY', 'ENDODONTIC', 'PAEDODONTIC',
  'TMJ', 'PERIODONTIC', 'PROSTHODONTIC', 'ORAL_SURGERY',
];

@Component({
  selector: 'app-staff-attrs',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './staff-attrs.component.html',
  styleUrl:    './staff-attrs.component.scss',
})
export class StaffAttrsComponent implements OnInit {
  private readonly svc  = inject(StaffAttrsService);
  private readonly http = inject(HttpClient);

  readonly staff      = signal<StaffRow[]>([]);
  readonly attrs      = signal<Record<string, StaffAbacAttrs>>({});
  readonly draft      = signal<Record<string, StaffAttrPatch>>({});
  readonly pendingId  = signal<string | null>(null);
  readonly selectedId = signal<string | null>(null);
  readonly loading    = signal(false);
  readonly error      = signal<string | null>(null);
  readonly toast      = signal<string | null>(null);

  readonly specialtyOptions = SPECIALTY_OPTIONS;

  readonly selected = computed<StaffAbacAttrs | null>(() => {
    const id = this.selectedId();
    return id ? (this.attrs()[id] ?? null) : null;
  });

  ngOnInit(): void {
    this.loading.set(true);
    this.http.get<{ users: StaffRow[] }>(`${authApiConfig.baseUrl}/staff`).subscribe({
      next: r => {
        this.staff.set(r.users ?? []);
        this.loading.set(false);
        if (this.staff().length && !this.selectedId()) this.select(this.staff()[0].id);
      },
      error: () => { this.loading.set(false); this.error.set('Could not load staff list.'); },
    });
  }

  select(id: string): void {
    this.selectedId.set(id);
    if (this.attrs()[id]) return;
    this.svc.get(id).subscribe({
      next: ({ user }) => {
        this.attrs.update(a => ({ ...a, [id]: user }));
        this.draft.update(d => ({ ...d, [id]: this.draftFromAttrs(user) }));
      },
      error: () => this.error.set('Could not load staff attributes.'),
    });
  }

  draftFromAttrs(u: StaffAbacAttrs): StaffAttrPatch {
    return {
      specialty_tags:   [...(u.specialty_tags ?? [])],
      max_discount_pct: u.max_discount_pct,
    };
  }

  d(): StaffAttrPatch {
    const id = this.selectedId();
    return id ? (this.draft()[id] ?? {}) : {};
  }

  toggleTag(tag: string): void {
    const id = this.selectedId(); if (!id) return;
    this.draft.update(d => {
      const current = d[id] ?? {};
      const tags = new Set(current.specialty_tags ?? []);
      tags.has(tag) ? tags.delete(tag) : tags.add(tag);
      return { ...d, [id]: { ...current, specialty_tags: [...tags] } };
    });
  }

  setField<K extends keyof StaffAttrPatch>(field: K, value: StaffAttrPatch[K]): void {
    const id = this.selectedId(); if (!id) return;
    this.draft.update(d => ({ ...d, [id]: { ...(d[id] ?? {}), [field]: value } }));
  }

  reset(): void {
    const id = this.selectedId(); if (!id) return;
    const orig = this.attrs()[id];
    if (orig) this.draft.update(d => ({ ...d, [id]: this.draftFromAttrs(orig) }));
  }

  save(): void {
    const id = this.selectedId(); if (!id) return;
    const patch = this.draft()[id]; if (!patch) return;
    this.pendingId.set(id);
    this.error.set(null);
    this.svc.update(id, patch).subscribe({
      next: ({ user }) => {
        this.attrs.update(a => ({ ...a, [id]: { ...a[id], ...user } }));
        this.pendingId.set(null);
        this.toast.set('Attributes saved.');
        setTimeout(() => this.toast.set(null), 2500);
      },
      error: () => { this.pendingId.set(null); this.error.set('Save failed. Please try again.'); },
    });
  }

  fullName(s: StaffRow): string {
    return (s.first_name + ' ' + (s.last_name ?? '')).trim() || s.email;
  }

  initials(s: StaffRow): string {
    const n = this.fullName(s);
    return n.charAt(0).toUpperCase();
  }

  selectedTags(): string[] {
    return this.d().specialty_tags ?? [];
  }
}
