import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { isAuthenticated, isSafeInternalReturnUrl } from './auth-session';

/**
 * Requires a logged-in session (Cordys login stored user email).
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const router = inject(Router);
  if (isAuthenticated()) return true;
  const returnUrl = state.url;
  router.navigate(['/login'], {
    queryParams: isSafeInternalReturnUrl(returnUrl)
      ? { returnUrl }
      : {},
  });
  return false;
};
