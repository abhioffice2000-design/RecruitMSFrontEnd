# Candidate Application Flow (BPM for Task Assignment Only)

This plan assumes:
1. You already added the SOAP endpoint for TaskId generation:
   - `ApplicationTaskIDGenerationBPM(dn, application_id)`
2. You want BPM to be used only for:
   - assigning/creating HR tasks
   - generating/storing the Cordys `TaskId`
3. All workflow logic (create rounds, enforce “feedback compulsory”, create/cancel interviews, move stages to Offer/Hired/Rejected, etc.) is done from Angular code/services.

This plan mirrors the existing Job Requisition approach:
- `triggerRequisitionBPM()` in `hr-dashboard/jobs/jobs.ts` (TaskId generation)
- `temp2` storage
- `performTaskAction(TaskId, 'COMPLETE', {...})` in `manager-dashboard.ts`

## 0) Key DB facts (from `rmsdb.sql`)

### 0.1 Tables involved
- `ts_applications` (candidate’s application)
  - stores coarse stage in `current_stage_id`
  - has `temp1..temp5` columns you will use for BPM TaskId/step metadata
- `ts_interviews` (each interview = one row)
  - `interview_type` differentiates technical vs HR interview
  - `round_number` enables dynamic rounds (no fixed max)
  - `status` is updated to reflect progress
- `ts_interview_feedback`
  - feedback is per `interview_id` + `interviewer_id`
- `ts_offers`
  - `offer_status_enum` must include `ARGUED` (for candidate argue)

### 0.2 Slot columns exist in DB
- `ts_interview_slots` has real datetime columns:
  - `slot_date`, `start_time`, `end_time`
- and also has `temp1..temp5`

## 1) BPM design (TaskId generation only)

### 1.1 New BPM task assignment steps (step keys)
Even if your SOAP TaskId generation takes only `dn` + `application_id`, you still need to know which step the task corresponds to inside your Angular HR UI. Use `ts_applications.temp1` as a “stepKey”.

Recommended `temp1` stepKey values:
- `SCREENING_DECISION`
- `TECH_ROUND_DECISION` (after technical round feedback is complete)
- `OPTIONAL_HR_INTERVIEW_DECISION` (if HR chooses to create optional HR interview)
- `HR_INTERVIEW_DECISION` (after HR interview feedback is complete)
- `MOVE_TO_OFFER`
- `ARGUE_RESOLUTION`

### 1.2 Where to store TaskId
Use `ts_applications.temp2` to store BPM `TaskId` (same pattern as job requisition uses `ts_job_requisitions.temp2`).

Rule:
- Before you trigger BPM: set `temp1 = stepKey`
- Trigger BPM TaskId generation
- Extract `TaskId` from BPM response
- Update `ts_applications.temp2 = TaskId`

After completion:
- clear `temp2` (set to empty string) to prevent accidental re-complete

## 2) Service + SOAP integration tasks (what to implement)

### 2.1 Add a SOAP method: `triggerApplicationTaskIDGenerationBPM`
In `src/app/services/soap.service.ts`, add something like:
```ts
triggerApplicationTaskIDGenerationBPM(hrEmail: string, applicationId: string): Promise<any>
```

Implementation mirrors `triggerRequisitionBPM()`:
- build DN from email (you already have `_makeDN()` in `SoapService`)
- call Cordys SOAP method `ApplicationTaskIDGenerationBPM` in namespace `http://schemas.cordys.com/default`
- return the raw BPM response so you can extract `TaskId`

### 2.2 Add an `updateApplicationTemp()` helper
Add a method similar in style to `updateJobRequisitionTemp()`, but for `ts_applications`.

Signature:
```ts
updateApplicationTemp(oldApp: Record<string,string>, updates: { temp1?:string; temp2?:string; temp3?:string; temp4?:string; temp5?:string }): Promise<any>
```

Important:
- Cordys Update expects an `old` tuple + a `new` tuple.
- You must preserve all non-changed columns exactly as `updateApplicationStage` does (so FK/nullable constraints don’t break).
- This is best copied from `updateApplicationStage` / `updateApplicationStatus` patterns, but with only temp* and optionally status/current_stage_id changed.

### 2.3 Add `getApplicationById(applicationId)`
If missing, implement using `getApplications()` and filter by `application_id`.

This is needed because you need the “oldData” object to update `temp1/temp2`.

### 2.4 Add Interview orchestration methods (all code-driven)
Create service methods in `SoapService` (or a dedicated `CandidateFlowService`) for all DB mutations:

1. `createInterviewRound(applicationId, roundNumber, interviewType, slotInfo?, meeting?, createdByUser, interviewerIds[])`
   - inserts into `ts_interviews`
   - inserts into `ts_interviewers` for each interviewer
   - ensures slot creation/association if your UI depends on slots
2. `createInterviewSlots(slot_date/start_time/end_time ...)`
   - insert into `ts_interview_slots`
3. `markInterviewCompleted(interviewId)` (recommended)
   - sets `ts_interviews.status = 'COMPLETED'`
4. `cancelApplicationInterviews(applicationId)`
   - set all interviews for that application to `CANCELLED`
5. `cancelOtherApplications(candidateId, winningApplicationId)`
   - update `ts_applications.status = CANCELLED`
   - set `current_stage_id` to a Cancelled stage id
   - cancel interviews + offers if your policy requires it

### 2.5 Add a feedback completeness gate
Signature:
```ts
isRoundFeedbackComplete(applicationId, roundNumber, interviewType): Promise<boolean>
```

Algorithm:
1. load all `ts_interviews` for (application_id, round_number, interview_type)
2. for each interview_id:
   - load assigned interviewers from `ts_interviewers`
   - for each assigned interviewer_id: check there exists a row in `ts_interview_feedback`
3. return true only if ALL interviews and ALL assigned interviewers have feedback rows

Enforcement:
- HR UI should hide/disable the “next step” button until this returns true.

## 3) Candidate UI / HR UI responsibility split

### 3.1 BPM tasks only decide “who can do the next action”
Your HR UI will still execute logic via service calls, then complete the BPM task.

### 3.2 When HR clicks decision in UI:
The flow must be:
1. HR clicks a button (example: “Approve Screening”)
2. Code executes DB logic (example: create Round 1 interviews)
3. Code completes BPM task:
   - use the `TaskId` stored in `ts_applications.temp2`
   - call `performTaskAction(taskId, 'COMPLETE', { decision, comments, ... })`

## 4) Where to implement “Feedback compulsory” gating

You need this gate at HR decision time:
- after technical round feedback is submitted
- before HR is allowed to trigger:
  - “create next technical round”
  - “move to optional HR interview”
  - “move to offer”

Implementation location options (choose one):
1. HR UI level only (simpler; must still avoid race conditions)
2. BPM precondition level (harder)
3. Both (best): UI disables + code validates in service before performing DB mutations

Recommended:
- do both:
  - UI disables until gate true
  - service also validates gate true before creating next rounds / moving stages

## 5) Slot datetime + “proposed_date/proposed_time” mapping (your question)

### 5.1 Can you store proposed date/time in `temp1..temp5` of `ts_interview_slots`?
Yes technically, but it is usually **not necessary** because DB already has:
- `slot_date`
- `start_time`
- `end_time`

### 5.2 What’s the real problem in your current code?
Your candidate interviews UI expects slot objects with properties:
- `proposed_date`
- `proposed_time`
- `is_selected`

But DB returns:
- `slot_date`, `start_time`, `end_time`
- `temp1..temp5`

So you have to map columns to the UI fields somewhere.

### 5.3 Best practice mapping (recommended)
Keep canonical values in real columns; map in `CordysService.getInterviewSlots()`:
- `proposed_date = slot.slot_date`
- `proposed_time = slot.start_time` (or `slot.end_time` if that’s what you meant)
- `is_selected = slot.temp1` (assuming temp1 stores '1'/'0' or 'true'/'false')

This avoids duplicating datetime into temp columns.

### 5.4 If you already stored date/time into temp columns
If you already implemented a DB change such as:
- `temp1 = proposed_date`
- `temp2 = proposed_time`
then update the mapping logic accordingly.

Either way:
- UI still needs consistent mapping
- mapping must be implemented in JS (CordysService or before setting UI state)

## 6) End-to-end implementation steps (order matters)

### Step 1: Add enum values (already done by you)
- ensure DB enums support:
  - `offer_status_enum = ARG UED`
  - `application_status_enum` includes `HIRED`, `CANCELLED`
  - `interview_status_enum` includes `CONFIRMED` if you use it in UI

### Step 2: Add missing stage reference rows
Add to `mt_pipeline_stages`:
- Rejected stage id (example: `S6 Rejected`)
- Cancelled stage id (example: `S7 Cancelled`)

This is needed if you store stage history and have FK constraints in `hs_application_stage_history`.

### Step 3: Implement service methods:
1. `triggerApplicationTaskIDGenerationBPM`
2. `updateApplicationTemp`
3. `isRoundFeedbackComplete`
4. interview creation/cancellation helpers
5. cancel-other-applications helper

### Step 4: Integrate BPM task assignment in HR actions
For each HR decision step:
1. set `temp1 = stepKey` in `ts_applications`
2. trigger BPM TaskId generation
3. store returned TaskId in `temp2`
4. when HR completes decision:
   - call service to do DB work
   - complete BPM task via `performTaskAction(taskId, 'COMPLETE', { decision,...})`
5. clear `temp2`

### Step 5: Enforce feedback compulsory in UI + service
Before “Next round?” / “Move to Offer?”:
- call `isRoundFeedbackComplete(...)`
- disable button until true
- service re-check before making changes

### Step 6: Fix slot->UI mapping
- update `CordysService.getInterviewSlots()` mapping so:
  - `slot_date/start_time/temp1` become `proposed_date/proposed_time/is_selected`
- update candidate interview slot selection chips to use the mapped `is_selected`

### Step 7: Implement candidate offer actions (Accept/Reject/Argue)
In candidate offer UI:
1. ACCEPT:
   - set winning offer status ACCEPTED
   - set winning app `HIRED` + stage to Hired
   - cancel other apps + cancel their interviews
2. REJECT:
   - set offer status REJECTED
   - move only that application to Rejected stage
3. ARGUE:
   - set offer status ARGUED
   - trigger HR argue-resolution BPM task assignment:
     - update temp1 stepKey = `ARGUE_RESOLUTION`
     - store TaskId in temp2
     - HR resolves => either Hire or Reject path

## 7) Testing checklist (to confirm no issue)
1. Apply:
   - app created with `current_stage_id = Applied`
2. Screening:
   - HR can complete screening BPM task
   - after approve: Round 1 interviews created
3. Round feedback:
   - ensure “Next round” buttons are disabled until feedback exists for all assigned interviewers
4. Dynamic rounds:
   - after Round 1 complete => create Round 2 (no fixed max)
5. Optional HR interview:
   - appears only when HR chooses it
6. Offer:
   - HR moves to Offer only when gates satisfied
7. Candidate accept:
   - only winning app becomes HIRED
   - others become CANCELLED and their interviews stop
8. Candidate argue:
   - triggers HR argue resolution
9. Slot UI:
   - candidate interviews screen shows correct date/time and selected indicator

---
If you want, tell me the exact `TaskId` parameter name in your BPM response (for Task extraction). In job requisition code, they search for `TaskId`. I’ll align candidate extraction to the same format to avoid parsing issues.

