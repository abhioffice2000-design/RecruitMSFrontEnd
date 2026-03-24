# Candidate Flow Implementation Plan (DB -> BPM -> Services -> UI)

## 1. Purpose
This document describes a complete, end-to-end implementation plan for the candidate recruitment flow:

1. Candidate applies
2. HR screening
3. Technical interviews with a *dynamic number* of rounds (Round 1..N)
4. Interviewer feedback is **mandatory**
5. HR reviews interviewer decisions + feedback and decides:
   - whether to create the next technical round
   - whether an optional HR interview is required
   - whether to move to the offer stage
6. Offer stage: candidate can **accept**, **reject**, or **argue**
7. If the candidate **accepts**, cancel all other applications/jobs for that candidate

The plan is designed to fit your existing DB schema (`rmsdb.sql`) and your current app structure (Angular + Cordys SOAP wrapper).

## 2. Current DB Capabilities (from `rmsdb.sql`)
### 2.1 Existing enums
- `application_status_enum`: `('ACTIVE','REJECTED','HOLD')`
- `interview_status_enum`: `('SCHEDULED','COMPLETED','CANCELLED')`
- `offer_status_enum`: `('DRAFT','SENT','ACCEPTED','REJECTED','EXPIRED')`

### 2.2 Existing workflow tables
- `ts_applications`
  - Holds the coarse pipeline stage in `current_stage_id`
  - Holds coarse status in `status`
- `hs_application_stage_history`
  - Stage change audit
- `ts_interviews`
  - Each interview row belongs to `application_id`
  - Each interview has:
    - `interview_type` (e.g., technical vs HR)
    - `round_number` (this is what enables dynamic rounds)
    - `slot_id` (meeting time reference)
    - `status`
- `ts_interview_feedback`
  - Feedback rows per `interview_id` and `interviewer_id`
- `ts_offers`
  - Offer per `application_id`

### 2.3 Interviewers assignment tables (important)
- `ts_interviewers(interview_id, user_id)`
  - Interviewer portal discovers assigned interviews through this table
- `ts_interview_slot_interviewers(slot_id, user_id)`
  - Candidate interviews UI lists interviewers via slots

## 3. Missing DB pieces required for your required flow

### 3.1 Enum changes (required)
You must add enum values to support your flow UI + candidate actions.

1. `offer_status_enum`
   - Add: `ARGUED`
   - Reason: candidate can argue

2. `application_status_enum`
   - Add: `HIRED`
   - Add: `CANCELLED`
   - Reason:
     - accept offer => hired (and cancel all other applications)
     - accept offer => cancel all other apps/jobs

3. `interview_status_enum`
   - Add: `CONFIRMED` (recommended)
   - Reason: your candidate interviews page already expects a “confirmed” status in its scheduled list.

Postgres note: enum values can only be added, not removed.

### 3.2 Feedback “compulsory” enforcement (required)
Your requirement: after interviews are done, HR can see all interviewer decisions and feedbacks, and feedback is compulsory.

You will enforce this at the workflow level (UI/service) and also prevent duplicates in DB:

1. Add a unique constraint:
   - `UNIQUE(interview_id, interviewer_id)` on `ts_interview_feedback`
   - Reason: guarantees each interviewer can submit feedback only once per interview.

### 3.3 Pipeline stage reference data
Your current `mt_pipeline_stages` mock includes:
- S1 Applied
- S2 Screening
- S3 Interview
- S4 Offer
- S5 Hired

You should add at least:
- A “Rejected” stage (for HR/interview rejection)
- A “Cancelled” stage (for accept => cancel other applications)

If you do not add these stage IDs, you must hardcode names/icons and skip `hs_application_stage_history` FK checks for those stage IDs (not recommended).

## 4. Core Flow Definition (state machine)

### 4.1 Coarse application stages (use `ts_applications.current_stage_id`)
1. `Applied` (S1) – after candidate applies
2. `Screening` (S2) – HR screening task
3. `Interview` (S3) – multiple technical rounds and optional HR interview appear here dynamically
4. `Offer` (S4) – HR prepares and sends offer
5. `Hired` (S5) – candidate accepted
6. `Rejected` (new stage) – rejected after screening/interviews/HR interviews/argue resolution
7. `Cancelled` (new stage) – cancelled when candidate accepted another job

### 4.2 Dynamic “virtual stages” inside Interview (no fixed count)
Inside `Interview` coarse stage, show dynamic dots:

For each application:
- Technical rounds derived from:
  - `ts_interviews` where `interview_type != 'HR'`
  - group by distinct `round_number`, sorted ascending
- Optional HR interview derived from:
  - `ts_interviews` where `interview_type == 'HR'`

This enables pipeline dots to grow naturally from 1 round to 2/3/4/etc.

## 5. Decision timing rules (your updated requirement)

### 5.1 After each interview round
- Interviewers submit feedback (mandatory)
- HR reviews all feedback for that round
- HR decides:
  - create next technical round (Round i+1)
  - optionally create HR interview
  - or move application to Offer

Important:
- The *system does not auto-create* next rounds purely from feedback.
- Next-round creation is always an HR action after feedback is complete.

## 6. BPM Design (mimic Job Requisition BPM)

You already have a BPM pattern for job requisitions:
- On creation: insert approval record, trigger BPM, extract `TaskId`, store it in `temp2`
- On approve/reject UI: update approval record + job requisition status + performTaskAction

### 6.1 BPM scope for candidate flow (recommended approach)
Use BPM for the steps that are “formal HR decisions” and should behave like job approvals:
- HR Screening decision
- HR decision after a round is ready (optional but recommended)
- HR decision after HR-interview (if you want it as BPM task)

Technical round creation itself can be an HR UI action without BPM if you prefer MVP.

### 6.2 Candidate BPM actions (task payload)
Design BPM tasks to accept:
- `application_id`
- `decision` (APPROVED/REJECTED or similar)
- `comments/rejection reason`
- optional `round_number` (if BPM is used for round decisions)

### 6.3 Where store BPM TaskId for candidate applications
Reuse `ts_applications.temp*` fields:
- For example: store BPM `TaskId` in `ts_applications.temp2`

This parallels job requisition where `temp2` stores BPM task id.

## 7. Services / SOAP integration plan

Your project uses:
- `SoapService` for DB operations (job/pipeline/apps/offers)
- `CordysService` for candidate-portal interview/offer retrieval in the newer module

### 7.1 Existing services you can reuse
- `SoapService.insertApplication`, `updateApplicationStage`, `insertStageHistory`
- `SoapService.getApplicationsByCandidate`, `getApplicationsByRequisition`
- `SoapService.getOffersByApplication`, `insertOffer`, `updateOfferStatus`
- `SoapService.insertStageHistory`
- `CordysService.getPipelineStages`, `getInterviewsForApplication`, `getInterviewFeedback`, etc.

### 7.2 New service methods you must add (required)
You need CRUD/orchestration for interviews and candidate-specific pipeline rendering.

1. Interview lifecycle
   - `createInterviewRound(application_id, round_number, interview_type, slot details)`
   - `assignInterviewersToInterview(interview_id, interviewer_user_ids)`
   - `create interview slots` (`ts_interview_slots`)
   - update interview status:
     - from `SCHEDULED` -> `CONFIRMED` (optional)
     - from `SCHEDULED/CONFIRMED` -> `COMPLETED` when meeting ends

2. Feedback completeness check (required before HR can proceed)
   - `isInterviewRoundFeedbackComplete(application_id, round_number)`
   - Algorithm:
     - fetch interviews for (application_id, round_number, technical type)
     - fetch assigned interviewers per interview from `ts_interviewers`
     - for each interview, check that for every assigned interviewer there exists exactly one `ts_interview_feedback`
     - return true only if all interviews have all feedback

3. HR actions for next step
   - `hrAdvanceAfterRound(application_id, action)`
     - action variants:
       - `CREATE_NEXT_TECH_ROUND`
       - `CREATE_OPTIONAL_HR_INTERVIEW`
       - `MOVE_TO_OFFER`
       - `REJECT_APPLICATION`
     - service must:
       - validate feedback completeness (compulsory rule)
       - create/cancel interviews as required
       - update `ts_applications.current_stage_id` and `hs_application_stage_history`

4. Offer argument resolution (required)
   - Candidate action updates `ts_offers.status = ARGUED`
   - Then HR resolves:
     - `ARGUE_APPROVED` => treat as ACCEPTED path
     - `ARGUE_REJECTED` => treat as REJECTED path

5. Cancel other applications when winner accepts (required)
   - `cancelOtherApplications(candidate_id, winning_application_id)`
   - For each application where `application_id != winning_application_id` and `status in (ACTIVE, HOLD, ...)`:
     - update `status = CANCELLED`
     - update `current_stage_id = Cancelled stage`
     - cancel interviews:
       - set `ts_interviews.status = CANCELLED` for interviews belonging to that application
     - update offers (optional):
       - if offers exist, set to `REJECTED/EXPIRED` depending on your policy

## 8. Role-based UI / workflow details (what changes where)

## 8.1 Candidate UI
### A) Candidate applies
Existing: `candidate-apply-job.component.ts` inserts into `ts_applications` with `current_stage_id = firstStageId`.
You must ensure:
- pipeline stage order has S1 as the first stage
- `firstStageId` maps to `Applied`

### B) Candidate applications (pipeline dots)
Existing: `candidate-applications.component.ts` uses a static `stages` list and a single `getProgress()` logic.

Required update:
- Replace static mt_pipeline_stages dots with derived dots per application:
  - Applied
  - Screening
  - Interview Round 1..N (from ts_interviews)
  - Optional HR interview if exists
  - Offer (from ts_offers exists and/or app is in Offer stage)
  - Hired or Rejected

Also update icons/labels for virtual rounds:
- “Interview R1”, “Interview R2”, etc.

### C) Candidate interviews page
Existing: `candidate-interviews.component.ts/html` renders scheduled and completed interviews.

Required updates:
- Ensure the interview slot UI maps DB columns correctly:
  - DB: `ts_interview_slots.slot_date, start_time, end_time, temp1`
  - Your UI currently references:
    - `proposed_date`, `proposed_time`, `is_selected`
  - Decide mapping:
    - `proposed_date = slot_date`
    - `proposed_time = start_time`
    - selection flag can be `temp1` (if you store 1/0 or true/false there)
- Ensure interviews show multiple rounds naturally since it lists interviews from `getInterviewsForApplication`.

### D) Candidate offers actions
Currently your candidate UI has accept/reject buttons in `candidate-applications.component.ts` offer banner.
You must add:
- `ARGUE` button
- candidate argue input (optional)

State rules:
- If `ACCEPT`:
  - call service `acceptOfferAndCancelOthers()`
- If `REJECT`:
  - update `ts_offers.status = REJECTED`
  - move application to Rejected stage
- If `ARGUE`:
  - update `ts_offers.status = ARGUED`
  - move application to “HOLD / ARGUE” (use HOLD or a new stage if you prefer)
  - trigger HR resolution UI/task

## 8.2 Interviewer UI
Existing: `interviewer-portal.ts` inserts feedback via `UpdateTs_interview_feedback`.

Required updates:
1. Feedback compulsory support
   - Add validation: recruiter can only proceed once feedback exists (HR side)
   - Enforce duplicate prevention with DB unique constraint
2. Ensure interview status is updated before or after feedback:
   - Set `ts_interviews.status = COMPLETED` when submitting feedback (recommended)
3. Ensure assigned interviewers are correctly populated:
   - When HR creates interview round:
     - insert into `ts_interviewers`
     - insert into `ts_interview_slot_interviewers` for candidate display

### Interview type and round number
Your system must allow multiple rounds and multiple interviewers:
- interviewer portal already shows `round_number` in UI
- it will naturally show feedback per interview_id

## 8.3 HR UI
HR needs 3 core screens/actions:
1. Screening decision (before any technical interviews)
2. Round review + create next round(s) (dynamic)
3. Offer management + argue resolution

### A) HR screening
When a candidate is in S1 Applied:
- HR screens and decides Approve/Reject

On Approve:
- move application to S3 Interview stage (coarse)
- create technical Round 1 interviews for the application

On Reject:
- move application to Rejected stage and status = REJECTED
- insert stage history

### B) HR Round Review (mandatory feedback check)
HR pipeline modal/drawer must show:
- Round number(s) inside S3 Interview
- For the latest completed round, show all interviews and each interviewer feedback

Rules:
- A “Create next technical round” button must be disabled until:
  - all interviews in the current completed round have feedback from every assigned interviewer
- “Move to Offer” must also require this condition

### C) HR optional HR interview
HR can create optional HR interview after technical rounds:
- create `ts_interviews` with `interview_type='HR'`
- assign interviewers (can be one or more)
- when completed, HR can proceed to Offer only after feedback completeness

### D) HR offer / argue resolution
If candidate argued:
- HR resolves ARGUED offer by:
  - approving => set offer accepted + hired flow + cancel other apps
  - rejecting => set offer rejected + application rejected

## 9. Dynamic Pipeline UI Implementation (exact approach)
This is the most important UI requirement you gave:
- pipeline stages must expand if interview rounds become 2/3/4/etc.

### 9.1 Pipeline dots data model (virtual)
Create a local “virtual stage” type used only for UI rendering:
- `label: string`
- `type: 'APPLIED'|'SCREENING'|'TECH_ROUND'|'HR_INTERVIEW'|'OFFER'|'HIRED'|'REJECTED'|'CANCELLED'|'ARGUE'`
- `round_number?: number`
- `interview_type?: string`
- `status: 'completed'|'current'|'pending'`

### 9.2 Candidate pipeline dots algorithm (per application)
Inputs:
- `ts_applications` row
- `ts_interviews` list filtered by application_id
- `ts_offers` list filtered by application_id (if needed)

Steps:
1. Start array with Applied + Screening dots.
2. Add technical round dots:
   - gather distinct round_number where interview_type is technical
   - for each round in ascending order:
     - status completed/current/pending based on:
       - completed if all interviews in that round are COMPLETED and feedback exists
       - current if there exists an interview in that round with status != COMPLETED (or feedback incomplete, depending on policy)
       - pending otherwise
3. If any interview_type == 'HR' exists, add “HR Interview” dot after technical rounds.
4. Add Offer dot if:
   - app.current_stage_id == Offer OR an offer exists
5. Add Hired/Rejected/Cancelled dot based on app.status/current_stage_id.

This automatically grows/shrinks with round count.

### 9.3 HR pipeline-board dots algorithm
Same virtual dot logic as candidate pipeline dots, but computed for each candidate card.

To avoid too many requests:
- fetch all required interviews/offers in bulk per requisition and filter client-side, or
- add new backend APIs for bulk retrieval

## 10. Cancellation logic (when candidate accepts)
When candidate clicks Accept:
1. Update winning offer:
   - `ts_offers.status = ACCEPTED`
2. Update winning application:
   - `ts_applications.status = HIRED`
   - `ts_applications.current_stage_id = Hired stage`
3. Cancel other applications:
   - for each other application where same candidate_id and application_id != winning_application_id:
     - set `status = CANCELLED`
     - set `current_stage_id = Cancelled stage`
     - set all its interviews to `CANCELLED`
     - optionally set offers to `REJECTED/EXPIRED`
4. Insert stage history for each changed application.

This ensures pipeline UI and candidate dashboard stay consistent.

## 11. Implementation checklist (what “Done” means)
### 11.1 DB “Done”
- Enums updated (offer ARG UED, application HIRED+CANCELLED, interview CONFIRMED)
- Unique constraint on feedback to avoid duplicates
- Pipeline stages reference rows include Rejected and Cancelled (plus Hired)

### 11.2 BPM “Done” (if you implement BPM tasks)
- HR Screening task is triggered when application enters S1 Applied
- HR decision actions complete BPM tasks and update DB state + stage history
- HR round decision can be optionally BPM-driven or UI-driven; if BPM-driven it must store TaskId and use performTaskAction

### 11.3 Services “Done”
- Interview round creation supports multiple rounds, multiple interviewers per round
- Interview feedback completeness check works and blocks HR actions
- Offer actions support ACCEPT/REJECT/ARGUE
- Accept triggers cancellation of all other applications

### 11.4 UI “Done”
- Candidate pipeline dots dynamically show Round 1..N and optional HR interview
- Candidate interviews page supports multiple rounds and displays correct slot date/time mapping
- HR UI shows feedback per round and blocks actions until feedback completeness
- Candidate offer UI includes Argue

## 12. Testing plan (minimum)
1. Apply to a job:
   - confirm app enters S1 Applied
2. HR screening reject:
   - confirm app becomes Rejected and pipeline reflects it
3. HR screening approve:
   - confirm Round 1 technical interviews created
4. Technical round with multiple interviewers:
   - complete interviews and submit feedback from all interviewers
   - verify HR “Create Round 2” becomes enabled
5. Round 2 created:
   - verify pipeline grows to show Round 2 dot
6. HR optional HR interview created:
   - pipeline shows HR Interview dot
7. Move to Offer:
   - verify Offer stage appears only when HR decides
8. Candidate accepts:
   - winning app => Hired
   - all other apps => Cancelled and their interviews cancelled
9. Candidate argues:
   - verify HR can resolve and finalizes correctly

