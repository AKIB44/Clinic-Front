import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ConfirmDialogComponent, ConfirmOptions } from './confirm-dialog.component';

/** Opens the shared confirm dialog; emits true only when the user confirms. */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private dialog = inject(MatDialog);

  ask(opts: ConfirmOptions): Observable<boolean> {
    return this.dialog
      .open(ConfirmDialogComponent, { data: opts, width: '420px', autoFocus: false })
      .afterClosed()
      .pipe(map((r) => r === true));
  }
}
