import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({ providedIn: 'root' })
export class ToastService {
  private snack = inject(MatSnackBar);

  success(message: string): void {
    this.snack.open(message, '', { panelClass: ['toast-success'], duration: 3000 });
  }

  error(message: string): void {
    this.snack.open(message, 'Dismiss', { panelClass: ['toast-error'], duration: 6000 });
  }

  /** Destructive action completed (removed, cancelled, abandoned, etc.). */
  warn(message: string): void {
    this.snack.open(message, '', { panelClass: ['toast-warn'], duration: 3000 });
  }

  info(message: string): void {
    this.snack.open(message, '');
  }
}
