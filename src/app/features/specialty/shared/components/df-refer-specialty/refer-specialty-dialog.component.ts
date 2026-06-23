import { Component, Inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TablerIconsModule } from 'angular-tabler-icons';

export interface SpecialtyOption {
  seg:   string;   // route segment under /specialty
  label: string;
  desc:  string;
  icon:  string;
  accent: string;
}

export const SPECIALTY_OPTIONS: SpecialtyOption[] = [
  { seg: 'orthodontic',  label: 'Orthodontics',        desc: 'Braces & clear aligners',      icon: 'dental',        accent: '#6d28d9' },
  { seg: 'implantology', label: 'Implantology',        desc: 'Implants & restorations',      icon: 'dental-broken', accent: '#0e7490' },
  { seg: 'paediatric',   label: 'Paediatric',          desc: 'Child & preventive dentistry', icon: 'mood-kid',      accent: '#db2777' },
  { seg: 'endodontic',   label: 'Endodontics',         desc: 'Root canal therapy',           icon: 'microscope',    accent: '#b45309' },
  { seg: 'tmj',          label: 'TMJ & Orofacial Pain',desc: 'Jaw & pain management',        icon: 'mood-smile',    accent: '#1d4ed8' },
];

@Component({
  selector: 'app-refer-specialty-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatDialogModule, TablerIconsModule],
  templateUrl: './refer-specialty-dialog.component.html',
  styleUrl: './refer-specialty-dialog.component.scss',
})
export class ReferSpecialtyDialogComponent {
  readonly options = SPECIALTY_OPTIONS;

  constructor(
    private ref: MatDialogRef<ReferSpecialtyDialogComponent, string>,
    @Inject(MAT_DIALOG_DATA) public data: { patientName?: string },
  ) {}

  pick(seg: string): void { this.ref.close(seg); }
  close(): void { this.ref.close(); }
}
