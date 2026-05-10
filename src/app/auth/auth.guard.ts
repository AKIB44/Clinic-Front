import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStorageService } from './auth-storage.service';

export const authGuard: CanActivateFn = () => {
  const authStorage = inject(AuthStorageService);
  const router = inject(Router);

  if (authStorage.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/authentication/login']);
};

/** Prevents authenticated users from reaching public auth pages (login, register, etc.) */
export const guestGuard: CanActivateFn = () => {
  const authStorage = inject(AuthStorageService);
  const router = inject(Router);

  if (authStorage.isAuthenticated()) {
    return router.createUrlTree(['/schedule']);
  }

  return true;
};
