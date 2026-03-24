/**
 * Centralized session checks for route guards (browser-only).
 */

const ROLE_KEYS = [
  'ADMIN_RMST1',
  'HR_RMST1',
  'INTERVIEWER_RMST1',
  'MANAGER_RMST1',
  'CANDIDATE_RMST1',
] as const;

/** Portal label fallback when loggedInRoles was not stored (older sessions). */
const PORTAL_LABEL_TO_ROLES: Record<string, string[]> = {
  'Admin Dashboard': ['ADMIN_RMST1'],
  'HR Dashboard': ['HR_RMST1'],
  'Interviewer Portal': ['INTERVIEWER_RMST1'],
  'Manager Dashboard': ['MANAGER_RMST1'],
  'Candidate Portal': ['CANDIDATE_RMST1'],
};

export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof sessionStorage !== 'undefined';
}

export function isAuthenticated(): boolean {
  if (!isBrowser()) return false;
  try {
    return !!(
      sessionStorage.getItem('loggedInUser') ||
      sessionStorage.getItem('loggedInUserEmail')
    );
  } catch {
    return false;
  }
}

/**
 * Cordys / app roles from login (JSON array string).
 */
export function getAuthRoles(): string[] {
  if (!isBrowser()) return [];
  try {
    const raw = sessionStorage.getItem('loggedInRoles');
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((r) => String(r).trim().toUpperCase()).filter(Boolean);
      }
    }
  } catch {
    /* ignore */
  }
  const label = sessionStorage.getItem('loggedInPortalLabel') || '';
  return [...(PORTAL_LABEL_TO_ROLES[label] || [])];
}

export function hasAnyRole(allowed: string[]): boolean {
  const upper = allowed.map((r) => r.toUpperCase());
  const roles = getAuthRoles();
  if (roles.some((r) => upper.includes(r))) return true;
  // Candidate-only sessions: Cordys role may be missing but candidate id exists
  if (upper.includes('CANDIDATE_RMST1')) {
    try {
      if (sessionStorage.getItem('loggedInCandidateId')) return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}

/**
 * Default landing route after login / when blocking wrong-role access.
 */
export function getDefaultHomeRoute(): string {
  const roles = getAuthRoles();
  if (roles.includes('ADMIN_RMST1')) return '/admin/dashboard';
  if (roles.includes('HR_RMST1')) return '/hr/dashboard';
  if (roles.includes('INTERVIEWER_RMST1')) return '/interviewer';
  if (roles.includes('MANAGER_RMST1')) return '/manager/dashboard';
  if (roles.includes('CANDIDATE_RMST1')) return '/candidate/dashboard';
  try {
    if (sessionStorage.getItem('loggedInCandidateId')) return '/candidate/dashboard';
  } catch {
    /* ignore */
  }
  return '/home';
}

export function isSafeInternalReturnUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const u = url.trim();
  if (!u.startsWith('/')) return false;
  if (u.startsWith('//')) return false;
  if (u.includes('://')) return false;
  return true;
}

export { ROLE_KEYS };
