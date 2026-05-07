import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({ providedIn: 'root' })
export class ToastService {
  private snack = inject(MatSnackBar);

  success(message: string): void {
    this.snack.open(message, '', { panelClass: ['toast-success'] });
  }

  error(message: string): void {
    this.snack.open(message, 'Dismiss', { panelClass: ['toast-error'], duration: 6000 });
  }

  info(message: string): void {
    this.snack.open(message, '');
  }
}
