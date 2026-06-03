import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { OrthoCaseApiService } from '../../services/ortho-case-api.service';

@Component({
  selector: 'app-ortho-case-list',
  standalone: true,
  imports: [CommonModule, RouterModule, MatTableModule, MatButtonModule, MatCardModule],
  templateUrl: './ortho-case-list.page.html',
  styleUrl: './ortho-case-list.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrthoCaseListPage implements OnInit {
  private readonly api = inject(OrthoCaseApiService);
  protected readonly cases = signal<unknown[]>([]);
  protected readonly loading = signal(true);
  protected readonly columns = ['patient_name', 'external_case_no', 'current_phase', 'started_at', 'actions'];

  ngOnInit(): void {
    this.api.getActiveCases().subscribe({
      next: (res) => { this.cases.set(res.cases); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }
}
