# Implementation Plan: HR & Platform Features (Items 7–11)

This document outlines a **phased, implementable plan** for closing gaps identified in the codebase audit. Dependencies and suggested order are noted so work can be parallelized where safe.

---

## Implementation status (repo)

| Phase | Status | Notes |
|-------|--------|--------|
| **0** — HR route RBAC | **Done** | `hr` route uses `canActivate: [authGuard, roleGuard(['HR_RMST1'])]` in `app.routes.ts`. |
| **1** — Requisition closure | **Done** | HR closes `APPROVED` jobs with reason (`HIRING_COMPLETE` / `WITHDRAWN` / `OTHER`); `status: CLOSED`, `temp4`/`temp5`; `JOB_REQUISITION_CLOSED` to owner + HR; UI distinguishes manager rejection vs HR closure. |
| **2** — Referral broadcast | **Done** | On manager `APPROVED`, `REFERRAL_JOB_OPEN` to internal users (excl. candidates); `temp4` = `REFERRAL_BROADCAST_SENT` until HR closes (then `HR_CLOSE_*`). |
| **3** — Dashboards | **Partial** | HR dashboard export wired; report/calendar/settings tabs may still be stubs. |
| **4** — Filters & export | **Partial** | CSV: shared util + HR dashboard KPI export + HR candidates (filtered) export; PDF/Excel and other lists optional. |
| **5** — RBAC polish | **Pending** | Full route audit + role matrix doc. |

---

## Current state (baseline)

| Area | What exists today |
|------|-------------------|
| Requisition status | `PENDING` / `APPROVED` / `CLOSED` in UI and manager rejection flow |
| Mail templates | `mail-templates.ts` with events like `JOB_APPROVED`, `JOB_REJECTED`; no `JOB_CLOSED` / referral blast |
| RBAC | `authGuard` + `roleGuard` on admin, candidate, interviewer, manager, **and `/hr`** (HR role). |
| Dashboards | Role-specific shells; some HR tabs are stubs (report, calendar, settings); referrals tab has minimal “how it works” + link to candidates. |
| Export | HR dashboard + candidates: **CSV** download; PDF/other lists not wired yet. |
| Referrals | Broadcast email on approval (Phase 2); HR tab is minimal guidance, not a full `referred_by` report yet. |

---

## Guiding principles

1. **Backend truth first** — Requisition closure and emails should persist via existing Cordys/SOAP patterns (`UpdateTs_job_requisitions`, `sendAllMailsBPM` or equivalent).
2. **Idempotent notifications** — Avoid duplicate emails on retries; store “closure notified” flag in `temp*` if needed.
3. **Security before features** — Add HR route guards before shipping new HR-only workflows.
4. **Incremental delivery** — Ship RBAC + one vertical slice (e.g. closure) before broad export/referral work.

---

## Phase 0 — Security & prerequisites (1–2 days)

### 0.1 Enforce RBAC on HR routes

- **File:** `src/app/app.routes.ts`
- **Change:** Add to the `hr` route:
  - `canActivate: [authGuard, roleGuard(['HR_RMST1'])]`
- **Verify:** Unauthenticated users redirect to `/login`; users without HR role cannot open `/hr/*`.
- **Regression:** Confirm `login.component.ts` still routes HR users to `/hr` and `getDefaultHomeRoute()` in `auth-session.ts` stays consistent.

### 0.2 Session / role helpers (if needed)

- **Review:** `src/app/guards/auth-session.ts` — ensure `hasAnyRole` includes all HR variants if multiple role strings exist in Cordys.

**Exit criteria:** HR area is only reachable by authenticated users with the HR role.

---

## Phase 1 — Job requisition closure (Item 7) (3–5 days)

### 1.1 Product rules (agree with stakeholders)

- **Close reasons (examples):** `HIRING_COMPLETE` | `WITHDRAWN` | `OTHER` (free text).
- **Who can close:** HR only (manager approval already distinct from “closure after hire”).
- **Effect on candidates:** Define whether open applications move to `CLOSED` / `WITHDRAWN` or stay readable for audit only.

### 1.2 Data model / API

- **SOAP:** Extend or use existing `updateJobRequisitionStatus` / `updateJobRequisitionTemp` to set:
  - `status: 'CLOSED'`
  - Distinguish from manager rejection: e.g. `temp4` = `CLOSURE_REASON_CODE`, `temp5` = optional JSON or comment (align with existing `temp*` usage in `jobs.ts`).
- **Service:** `src/app/services/soap.service.ts` — add `closeJobRequisition(jobRaw, payload)` that performs one transactional update pattern used elsewhere.

### 1.3 HR UI

- **File:** `src/app/hr-dashboard/jobs/jobs.html` + `jobs.ts`
- **Add:** On approved (and optionally pending) requisitions, action **“Close requisition”** opening a modal: reason, optional comment, confirm.
- **List/filter:** Already supports `CLOSED`; ensure closed rows show closure reason where applicable.

### 1.4 Notifications (“all relevant stakeholders”)

- **File:** `src/app/services/mail-templates.ts`
- **Add event:** e.g. `JOB_REQUISITION_CLOSED` with data: `requisitionId`, `jobTitle`, `reason`, `closedBy`, `departmentName`.
- **Recipients (define explicitly):**
  - Requisition owner / `created_by_user` (resolve email via `getUserById` or existing helper).
  - Department head or manager on requisition — **if** stored in DB; else document as “future”.
  - Optional: hiring manager email from job metadata if available.
- **Implementation:** After successful DB update, call `sendAllMailsBPM` per recipient (or batch if platform supports). **Non-blocking** try/catch like other HR mails.

### 1.5 Audit

- Optional: insert row into an audit/history table if the project has one; else log + `temp*` snapshot.

**Exit criteria:** HR can close an approved requisition with reason; DB reflects `CLOSED`; stakeholders receive one email each per rules above.

---

## Phase 2 — Employee referral program email (Item 11) (3–4 days)

### 2.1 Scope

- **Trigger:** When requisition becomes **`APPROVED`** (manager BPM completes approval — same moment `updateJobRequisitionStatus(..., 'APPROVED')` runs).
- **Audience:** “All internal employees” — define as users with specific role(s), e.g. `EMPLOYEE_RMST1` or all users in `ts_users` excluding `CANDIDATE_*`, per business rule.

### 2.2 Mail template

- **File:** `mail-templates.ts`
- **Add:** `REFERRAL_JOB_OPEN` (or extend `JOB_APPROVED` with a flag — prefer **separate** template for clarity).
- **Content:** Job title, requisition ID, department, link to internal referral page or public job post URL, short CTA, compliance line if needed.

### 2.3 Data / service

- **SOAP:** Add or reuse method to list users eligible for internal mail (e.g. `GetTs_usersObjects` with filter, or existing “all interviewers” pattern expanded).
- **File:** `src/app/manager-dashboard/manager-dashboard.ts` (or centralize in a small `referral-notification.service.ts` called from approval success path).
- **On approve:** After `updateJobRequisitionStatus(..., 'APPROVED')`, loop eligible users (or queue job) and send `REFERRAL_JOB_OPEN` **once per requisition** — use `temp*` on requisition to store `referral_mail_sent=1` to prevent duplicates on page refresh/retry.

### 2.4 HR Referrals tab (optional but recommended)

- **Replace stub:** `src/app/hr-dashboard/referrals/referrals.ts` — show applications where `referred_by` is set, filters, link to candidate.

**Exit criteria:** On approval, internal employees receive referral CTA email; duplicate sends prevented.

---

## Phase 3 — Interactive dashboards per role (Item 9) (ongoing, 1–2 sprints)

### 3.1 Inventory

- Map each role to **minimum viable** widgets: KPIs, queues, shortcuts (already partially done for HR, manager, interviewer, candidate).

### 3.2 HR dashboard hardening

- **File:** `dashboard-tab.ts`
- **Export** button wired to CSV (Phase 4); further widgets/PDF optional.
- Replace placeholder sections with real data from `SoapService` / `HeroService` consistently.

### 3.3 Stub tabs

- **Priority order:** Report → Referrals (after Phase 2) → Calendar → Settings — each gets a one-pager scope or is hidden from nav until ready.

**Exit criteria:** Documented “dashboard checklist” per role; no dead primary nav items without a minimal screen.

---

## Phase 4 — Search filters & export Excel / PDF (Item 10) (4–6 days)

### 4.1 Filters (standardize)

- **Pattern:** Document shared filter UX for list screens: debounced search, multi-select, “Clear filters”, URL query params optional.
- **Apply to:** HR candidates, jobs, offers, pipeline board, admin lists as needed.

### 4.2 Export — technical choice

| Format | Suggested approach |
|--------|-------------------|
| **Excel** | Client: `sheetjs` (xlsx) or CSV download for simplicity; or server-side if responses are huge. |
| **PDF** | Client: `jspdf` + `jspdf-autotable` for tabular data. |

### 4.3 Implementation slices

1. **HR Dashboard “Export Report”** — Export current KPIs + chart data as PDF or CSV for selected year.
2. **HR Candidates** — Export filtered table to **Excel (CSV)** first (fastest); add PDF as optional.
3. **HR Jobs / Offers** — Same pattern behind **Export** in toolbar.

### 4.4 Performance & UX

- Disable button while generating; show toast on success/failure; cap row count (e.g. 10k) with warning.

**Exit criteria:** At least two HR list views + dashboard export work end-to-end; shared utility module for “table → CSV/PDF”.

---

## Phase 5 — RBAC polish (Item 8) (1 day, can overlap Phase 0)

- **Audit** all `loadComponent` routes for missing guards.
- **Document** role matrix: Admin / HR / Manager / Interviewer / Candidate — which routes and which API calls are allowed (for future backend alignment).

---

## Suggested timeline (indicative)

| Phase | Duration | Notes |
|-------|----------|--------|
| Phase 0 | 1–2 days | Do first |
| Phase 1 | 3–5 days | Core business value |
| Phase 2 | 3–4 days | Can start after Phase 0; parallel with Phase 1 if two devs |
| Phase 3 | 1–2 sprints | Continuous improvement |
| Phase 4 | 4–6 days | After Phase 1–2 or parallel for different dev |
| Phase 5 | 1 day | Overlap with Phase 0 |

---

## Testing checklist (cross-cutting)

- [x] HR without login → cannot access `/hr/jobs` (verify in browser).
- [ ] Close requisition → status `CLOSED`, email received, no duplicate on double-submit.
- [ ] Approve requisition → referral emails once, `temp*` flag set.
- [ ] Export → opens/downloads file with UTF-8 and correct columns.
- [ ] Regression: Manager reject path still sets `CLOSED` + `temp3` as today.

*Automated `ng build` succeeds after implementation; manual checks above still recommended.*

---

## File touch list (reference)

| Area | Likely files |
|------|----------------|
| Routes | `src/app/app.routes.ts` |
| Mail | `src/app/services/mail-templates.ts`, `soap.service.ts` |
| Closure UI | `src/app/hr-dashboard/jobs/jobs.ts`, `jobs.html` |
| Referral send | `manager-dashboard.ts` (approve path) or new service |
| Referrals UI | `src/app/hr-dashboard/referrals/referrals.ts` |
| Export | New `src/app/shared/export/` utilities + consumers |
| Dashboard | `src/app/hr-dashboard/dashboard-tab/dashboard-tab.ts` |

---

## Open questions (resolve before build)

1. **Stakeholders for closure email** — Exact list and how emails are resolved from Cordys.
2. **Internal employees** — Role-based list vs. all rows in `ts_users` with `status=ACTIVE`.
3. **Legal/compliance** — Referral program text and opt-out requirements.
4. **BPM** — Whether closing a requisition should complete or spawn a BPM task (if workflows exist).

---

*Document version: 1.1 — implementation status section added (Mar 2026).*
