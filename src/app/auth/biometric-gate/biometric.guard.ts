import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { BiometricGateDialogComponent } from './biometric-gate-dialog.component';

/**
 * Requires a fresh Face ID / Touch ID step-up before activating the route.
 * Runs on every entry to the route (per-visit). On cancel/failure the
 * navigation is redirected away rather than left half-loaded.
 */
export const biometricGuard: CanActivateFn = async () => {
  const dialog = inject(MatDialog);
  const router = inject(Router);

  const ref = dialog.open(BiometricGateDialogComponent, {
    panelClass: 'biometric-gate-panel',
    autoFocus: false,
    disableClose: true,
    maxWidth: '92vw',
  });

  const ok = await firstValueFrom(ref.afterClosed());
  return ok ? true : router.parseUrl('/schedule');
};
