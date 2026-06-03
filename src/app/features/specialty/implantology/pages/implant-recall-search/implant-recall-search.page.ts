import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { ImplantCaseApiService } from '../../services/implant-case-api.service';

@Component({
  selector: 'app-implant-recall-search',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatCardModule, MatTableModule],
  templateUrl: './implant-recall-search.page.html',
  styleUrl: './implant-recall-search.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImplantRecallSearchPage {
  private readonly api = inject(ImplantCaseApiService);
  private readonly fb = inject(FormBuilder);

  protected readonly results = signal<unknown[]>([]);
  protected readonly searching = signal(false);
  protected readonly searched = signal(false);
  protected readonly columns = ['patient_name', 'brand', 'system', 'lot_number', 'expiry_date', 'fdi_position', 'placed_at', 'phone'];

  protected readonly form = this.fb.group({
    lot:   [''],
    brand: [''],
    from:  [''],
    to:    [''],
  });

  protected search(): void {
    this.searching.set(true);
    this.api.recallSearch(this.form.value as Record<string, string>).subscribe({
      next: (res) => {
        this.results.set((res as { fixtures: unknown[] }).fixtures ?? []);
        this.searched.set(true);
        this.searching.set(false);
      },
      error: () => this.searching.set(false),
    });
  }
}
