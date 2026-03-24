# Candidate Recruitment BPM Flow (Screening -> Dynamic Rounds -> HR -> Offer -> Argue)

This document reviews and corrects your BPM flow diagram and maps each BPM step to:
- the DB tables/enums you already have in `rmsdb.sql`
- the service/SOAP actions you must implement in this project
- the Cordys `TaskId` generation + storage pattern (same idea as job requisition BPM)

## A) Corrections vs your current diagram

Your diagram is close, but 2 required concepts are missing/ambiguous:

1. **Feedback completeness gate (required)**
   After each technical round is “done”, **HR must not decide next round / offer until every interviewer’s feedback is submitted** for that round.
   - DB evidence: `ts_interview_feedback` exists per `interview_id` and `interviewer_id`.
   - Missing in diagram: a step like “Feedback complete? (all interviewers submitted)”.

2. **ARGUE must return to HR resolution**
   Your diagram shows candidate “argue” but doesn’t show the HR resolution step after `ARGUED`.
   - DB evidence: `offer_status_enum` must include `ARGUED`, and HR must decide final outcome (Accept -> Hire / Reject).

## B) BPM Flow Diagram (corrected)

### Mermaid view

```mermaid
flowchart TD
  A([Candidate applies]) --> B[Screening BPM Task]
  B --> C{HR screening decision}
  C -- Shortlisted --> D[Create Technical Round 1 Interviews]
  C -- Not shortlisted --> Z([Rejected])

  D --> E[Interview execution (multiple interviewers per round)]
  E --> F[Interviewer feedback submit (compulsory)]
  F --> G[Feedback completeness check for this round]
  G --> H{Round decision by HR}

  H -- Next technical interview? YES --> I[Create Technical Round N+1]
  H -- Next technical interview? NO --> J{Optional HR interview required?}

  J -- YES --> K[Create Optional HR Interview]
  J -- NO --> M([Move to Offer])

  K --> L[HR interview feedback submit (compulsory)]
  L --> N{HR interview decision}
  N -- Pass --> M
  N -- Fail --> Z

  I --> E

  M --> O[Offer BPM step: Candidate receives offer]
  O --> P{Candidate decision}
  P -- ACCEPT --> Q[Accept -> Hire + Cancel other applications]
  P -- REJECT --> R([Rejected])
  P -- ARGUE --> S[Argue resolution BPM Task for HR]
  S --> T{HR resolves argue}
  T -- Approve --> Q
  T -- Reject --> R
```

## C) DB / Enum expectations (based on `rmsdb.sql`)

### 1) Required enum additions
- `offer_status_enum`: add `ARGUED`
- `application_status_enum`: add `HIRED`, add `CANCELLED`
- `interview_status_enum`: add `CONFIRMED` (recommended to match your candidate interviews UI expectations)

### 2) Required integrity rules
- Enforce “feedback compulsory” by workflow/UI + (recommended) DB safety:
  - add `UNIQUE(interview_id, interviewer_id)` on `ts_interview_feedback`
  - block HR transition until all expected feedback rows exist

## D) TaskId generation + storage (pattern to mimic job requisitions)

Your job requisition flow uses this pattern:
1. Trigger BPM by calling `RequisitionTaskIDGenerationBPM(dn, requisition_id)`
2. Extract `TaskId` from the BPM response JSON
3. Store it in a temp column on the DB row (`ts_job_requisitions.temp2`)
4. Later HR/Manager UI calls `PerformTaskAction(TaskId, COMPLETE, ...)`

For candidate flow, do the same idea:
1. Add a BPM trigger method that starts the correct BPM subprocess for a candidate:
   - `CandidateTaskIDGenerationBPM`
   - Inputs:
     - `dn` (HR email DN)
     - `application_id`
     - (optional) `workflow_step` string, if you use a single BPM for multiple steps
2. Extract Cordys `TaskId`
3. Store it on `ts_applications.temp2`
4. Complete the task using `performTaskAction(TaskId, 'COMPLETE', data)`

### Where to store the TaskId
- `ts_applications.temp2`: `current_bpm_task_id`
- Optional:
  - `ts_applications.temp1`: `current_bpm_step_key` (e.g., `SCREENING`, `ROUND_DECISION`, `HR_INTERVIEW_DECISION`, `ARGUE_RESOLUTION`)

### SOAP/service methods you must add for this
Add these in `src/app/services/soap.service.ts` (or wrap them similarly to existing job BPM):
1. `triggerCandidateBPM(hrEmail: string, applicationId: string, stepKey: string): Promise<any>`
   - calls Cordys SOAP `CandidateTaskIDGenerationBPM`
2. `updateApplicationTemp(applicationRow: Record<string,string>, updates: { temp1?: string; temp2?: string; temp3?: string; status?: string }): Promise<any>`
   - similar to `updateJobRequisitionTemp`
3. `getApplicationById(applicationId: string): Promise<Record<string,string> | null>`
   - if not already present for candidate portals (you have candidates+applications getters, but add a focused one if needed)

## E) Exact BPM step -> API/service mapping

Below mapping assumes you implement the “BPM decision execution” in the frontend (like manager job approvals) and call SOAP methods to update DB state.

### Step E1: Screening BPM Task
When BPM task starts:
1. HR performs screening decision in HR dashboard
2. HR clicks APPROVE or REJECT
3. You:
   - update `ts_approvals.status` and complete BPM task
   - update application stage/status accordingly

SOAP calls needed:
1. `insertApproval({ entity_type: 'APPLICATION', entity_id: application_id, ... })` (if you reuse approvals table)
2. `updateApprovalStatus(oldApproval, 'APPROVED'|'REJECTED', hrUserId, comments)`
3. `performTaskAction(taskId, 'COMPLETE', { decision, comments })`
4. `updateApplicationStage(appRow, toStageId)` and `insertStageHistory()`
5. On APPROVED:
   - `createInterviewRound(application_id, round_number=1, interview_type='TECHNICAL')`
   - `assignInterviewers(interview_id, interviewer_user_ids)`
   - `createInterviewSlots(interview_id or slot_id flow)` (see note below)

DB effects:
- `ts_applications.current_stage_id`: S3 Interview
- `ts_applications.status`: ACTIVE
- `ts_interviews`: round 1 rows created

### Step E2: Technical round loop (dynamic, HR decides after feedback)
Each time you create a round:
1. Interviews are executed (multiple interviewers -> multiple feedback rows)
2. HR sees “Ready to decide” only when feedback is complete
3. HR clicks “Next interview?” YES or NO

SOAP/service calls:
1. `isInterviewRoundFeedbackComplete(application_id, round_number, interview_type='TECHNICAL'): Promise<boolean>`
   - must compute expected interviewers from `ts_interviews -> ts_interviewers` (or from slot->interviewers if that’s your assignment source)
   - must verify all expected feedback rows exist in `ts_interview_feedback`
2. On YES:
   - `createInterviewRound(application_id, round_number+1, 'TECHNICAL')`
3. On NO:
   - go to Step E3 (optional HR interview)

DB effects:
- Always create next `ts_interviews` rows (dynamic rounds)
- Update `ts_interviews.status` as interviews finish:
  - interviewer feedback submit should also mark interview status to `COMPLETED` (see Section F)

### Step E3: Optional HR interview
SOAP calls:
1. `createInterviewRound(application_id, round_number=<next>, interview_type='HR')`
2. `assignInterviewers(interview_id, interviewer_user_ids)`
3. Enforce:
   - feedback complete gate before HR decides
4. HR decision:
   - PASS -> proceed to Offer
   - FAIL -> reject application

DB effects:
- `ts_applications.current_stage_id` moves to S4 Offer only on PASS

### Step E4: Move to Offer
This is HR-driven.
SOAP calls:
1. `updateApplicationStage(appRow, 'S4')` and `insertStageHistory()`
2. HR then creates `ts_offers` (existing `insertOffer` supports this)
3. Candidate UI shows offer banner when `offer.status` is `SENT`

### Step E5: Candidate offer decision (Accept / Reject / Argue)
Candidate UI calls (you already have updateOfferStatus for ACCEPTED/REJECTED; you must extend):
1. `updateOfferStatus(offer_id, 'ACCEPTED'|'REJECTED'|'ARGUED')`
2. If ACCEPT:
   - `finalizeHireAndCancelOthers(candidate_id, winning_application_id)`
     - set winning app:
       - `ts_applications.status=HIRED`
       - `ts_applications.current_stage_id=S5 Hired`
     - cancel all other apps for same `candidate_id`:
       - `ts_applications.status=CANCELLED`
       - `ts_applications.current_stage_id=S6 Cancelled`
       - `ts_interviews.status=CANCELLED` for those applications
       - optionally set any offers on those apps to `REJECTED` or `EXPIRED` (policy)
3. If REJECT:
   - move only that application to rejected:
     - `ts_applications.status=REJECTED`
     - `ts_applications.current_stage_id=S6 Rejected`
4. If ARGUE:
   - set `ts_offers.status=ARGUED`
   - trigger HR argue-resolution BPM task
     - call `triggerCandidateBPM(hrEmail, application_id, stepKey='ARGUE_RESOLUTION')`

### Step E6: HR resolves argue
HR action:
- APPROVE => follow Accept path (Hire + cancel others)
- REJECT => follow Reject path (Rejected stage)

SOAP calls:
1. `performTaskAction(taskId, 'COMPLETE', { resolution: 'APPROVED'|'REJECTED', ... })`
2. then call:
   - `finalizeHireAndCancelOthers(...)` OR `updateApplicationStage(...)`

## F) Important implementation notes (to make “mandatory feedback” real)

### 1) Ensure interview status flips to COMPLETED when feedback is submitted
Your current interviewer portal only inserts feedback using `UpdateTs_interview_feedback`.
Add one more DB update in the same action:
- after successful `UpdateTs_interview_feedback`, call:
  - `updateInterviewStatus(interview_id, 'COMPLETED')`

This makes “Round completed” computable reliably.

### 2) Candidate interviews slot mapping must match DB schema
Your DB slot fields are:
- `ts_interview_slots.slot_date`
- `ts_interview_slots.start_time`
- `ts_interview_slots.end_time`

Your candidate interviews UI currently expects:
- `proposed_date`, `proposed_time`, `is_selected`

So in code, map:
- `proposed_date = slot_date`
- `proposed_time = start_time`
- `is_selected` should come from a real DB column (if you don’t have it, store selection in `ts_interview_slots.temp1` or add a proper column)

## G) What you should verify after implementing

1. Screening decision:
   - shortlisted => Round 1 technical interviews exist
   - not shortlisted => application rejected stage appears
2. Dynamic rounds:
   - completing Round 1 feedback => HR can create Round 2
   - dynamic growth should reflect real created `round_number` values
3. Feedback compulsory:
   - HR “Next round” action must be blocked until feedback completeness is true
4. Optional HR interview:
   - appears only when HR chooses to create it
5. Offer actions:
   - accept => hire + cancel other applications
   - argue => HR resolution task and final outcome

