/**
 * Helpers for interview / slot validation with UTC semantics (align with Cordys Business Calendar).
 *
 * Prefer {@link SoapService.isWorkingTime} when the RMS_HR calendar is configured in Cordys
 * (holidays, special hours). Use weekend checks only as a fast client-side guard or fallback.
 */

/** Default Cordys Business Calendar name (confirm in your Cordys admin). */
export const RMS_HR_BUSINESS_CALENDAR_NAME = 'Calendar/RMS_HR';

/** Optional workspace GUID for `isWorkingTime` SOAP `WorkspaceID`; leave empty to omit. */
export const CORDYS_BUSINESS_CALENDAR_WORKSPACE_ID = '';

/**
 * Saturday / Sunday in **UTC** (0 = Sunday … 6 = Saturday).
 * Use when you need a quick rule without calling SOAP (e.g. mock mode or UX hint).
 */
export function isWeekendUtc(date: Date): boolean {
  const wd = date.getUTCDay();
  return wd === 0 || wd === 6;
}

/**
 * Ensures a value suitable for `isWorkingTime` `dateTime` (ISO-8601 with Z or explicit offset).
 * Pass the instant in time you want to evaluate (slot start in UTC).
 */
export function toUtcIsoString(date: Date): string {
  return date.toISOString();
}
