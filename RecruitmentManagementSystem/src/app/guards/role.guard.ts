import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import {
  getDefaultHomeRoute,
  hasAnyRole,
  isAuthenticated,
  isSafeInternalReturnUrl,
} from './auth-session';

/**
 * Requires authentication and at least one of the allowed Cordys roles.
 */
export function roleGuard(allowedRoles: string[]): CanActivateFn {
  return (_route, state) => {
    const router = inject(Router);
    if (!isAuthenticated()) {
      const returnUrl = state.url;
      router.navigate(['/login'], {
        queryParams: isSafeInternalReturnUrl(returnUrl)
          ? { returnUrl }
          : {},
      });
      return false;
    }
    if (hasAnyRole(allowedRoles)) return true;
    router.navigateByUrl(getDefaultHomeRoute());
    return false;
  };
}
