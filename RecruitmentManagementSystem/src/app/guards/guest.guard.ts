import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { getDefaultHomeRoute, isAuthenticated } from './auth-session';

/**
 * For login / register / forgot-password: redirect authenticated users to their home.
 */
export const guestGuard: CanActivateFn = () => {
  const router = inject(Router);
  if (!isAuthenticated()) return true;
  router.navigateByUrl(getDefaultHomeRoute());
  return false;
};
