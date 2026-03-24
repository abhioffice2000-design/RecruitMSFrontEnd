# Candidate Recruitment: BPM TaskId Assignment + Full Workflow in Code (Implementation Plan)

This is the “go-to-code” implementation plan based on:
- your DB changes (`rmsdb.sql`): enum extensions + unique feedback constraint + new pipeline stages
- your SOAP request set (`allsoaprequsts.txt`): includes update/insert SOAP for applications, interviews, slots, interviewers, feedback, approvals, stage history, and all required getters
- your existing **job requisition BPM integration pattern**:
  - trigger BPM -> extract `TaskId` -> store it in `temp2` -> later complete BPM via `performTaskAction(TaskId, 'COMPLETE', payload)`

Goal:
- Use BPM ONLY to assign/generate HR task IDs for decisions.
- Do ALL workflow logic from Angular/TypeScript code:
  - create interviews for screening/rounds
  - enforce mandatory feedback completion
  - dynamically create Round 2/3/4 based on created interviews (no fixed max)
  - move to Offer/Hired/Rejected/Cancelled
  - handle candidate Accept/Reject/Argue and cancel other applications when Accept

---

## 0) DB conventions you must follow

### 0.1 TaskId and stepKey storage (must match code)
Use `ts_applications` columns:
- `temp1` = `stepKey` (string): which HR UI action this task corresponds to
- `temp2` = `TaskId` (string): Cordys BPM TaskId to later complete

Recommended `stepKey` values:
- `SCREENING_DECISION`
- `TECH_ROUND_DECISION`
- `OPTIONAL_HR_INTERVIEW_DECISION`
- `MOVE_TO_OFFER`
- `ARGUE_RESOLUTION`

### 0.2 Interview slot datetime handling
Your DB table `ts_interview_slots` has canonical datetime fields:
- `slot_date`
- `start_time`
- `end_time`

Your current candidate UI expects slot-like fields such as:
- `proposed_date`
- `proposed_time`
- `is_selected`

Recommendation (no data duplication):
- Do **NOT** store datetime in temp columns.
- Instead, map DB fields -> UI fields in your service/component.

If you need a “selected” flag:
- store it in `ts_interview_slots.temp1` (or `temp2` etc)
- map `temp1` -> UI `is_selected`

Why:
- it keeps one source of truth for time
- it avoids later bugs when mapping differs across components

### 0.3 Feedback compulsory gate
Your DB now supports a safety rule:
- unique feedback per `(interview_id, interviewer_id)`

Workflow rule (enforced in code):
Before HR can create the next step (next technical round / HR interview / offer):
- for every assigned interviewer of the round’s interviews, there must be at least one `ts_interview_feedback` row
- only then the “next” action becomes enabled and BPM task can be completed

---

## 1) BPM usage model (TaskId assignment only)

### 1.1 What BPM does
BPM does ONLY:
- assign an HR task for a decision step
- generate and return `TaskId`

### 1.2 What code does
Angular/TypeScript does:
- create interviews and assign multiple interviewers
- decide dynamic round numbers
- enforce feedback completion
- move application stage ids/status
- cancel other applications when candidate accepts
- complete the BPM task using returned `TaskId`

---

## 2) Required code additions (services / SOAP wrappers)

You already have in `src/app/services/soap.service.ts`:
- `triggerRequisitionBPM(...)`
- `performTaskAction(taskId, action, data)`
- `updateJobRequisitionTemp(...)`

Add the following for candidate flow:

### 2.1 TaskId generation for applications
Add a method that calls your existing SOAP:
- `ApplicationTaskIDGenerationBPM`

Method signature:
- `triggerApplicationTaskIDGenerationBPM(hrEmail: string, applicationId: string): Promise<any>`

Logic:
1. Build HR DN from email (same as `_makeDN()` in `SoapService`)
2. SOAP-call `ApplicationTaskIDGenerationBPM(dn, application_id)`
3. Extract `TaskId` from the response using the same pattern as job:
   - first try `$.cordys.json.find(resp, 'TaskId')`
   - fallback to regex if needed

### 2.2 Store TaskId in `ts_applications.temp2`
Add:
- `updateApplicationTemp(oldApp, updates: { temp1? temp2? temp3? temp4? temp5? })`

Implementation:
- clone logic of `updateJobRequisitionTemp()`
- but for `ts_applications` fields (`temp1..temp5`, and preserve required columns)

### 2.3 Candidate/application getters required for orchestration
You already have getters:
- `getApplications()`, `getApplicationsByCandidate()`, `getApplicationsByRequisition()`

For orchestration, also add:
- `getApplicationById(applicationId: string): Promise<Record<string,string> | null>`
  - filter from `GetTs_applicationsObjects` or use existing `GetTs_applicationsObject`

### 2.4 Interview CRUD wrappers (in code)
SOAP requests already include:
- `UpdateTs_interviews`
- `UpdateTs_interview_slots`
- `UpdateTs_interviewers`
- `UpdateTs_interview_slot_interviewers`
- getters:
  - `GetTs_interviewsObjectsForapplication_id`
  - `GetTs_interview_feedbackObjectsForinterview_id`
  - `GetTs_interviewersObjectsForinterview_id`
  - `GetTs_interview_slot_interviewersObjectsForslot_id`
  - `GetTs_interview_slotsObjectsForcreated_by_user` and by slot id

You must implement wrappers in one place:
- create `CandidateFlowService` (new file) that uses `SoapService.call()` for update/insert and uses `SoapService.parseTuples()` to parse getters.

Wrappers to implement:
1. `createInterviewRound(applicationId, roundNumber, interviewType, slotDateTime, meetingLink?, interviewerUserIds[])`
   - inserts into `ts_interview_slots` (creates 1 slot)
   - inserts into `ts_interviews` referencing `slot_id`
   - inserts into `ts_interviewers` for the interview_id (multiple rows)
   - inserts into `ts_interview_slot_interviewers` for the slot_id (multiple rows)
2. `cancelInterviewsForApplication(applicationId)`
   - set `ts_interviews.status = CANCELLED` for this application
3. `isRoundFeedbackComplete(applicationId, roundNumber, interviewType)`
   - fetch all interviews for this round/type
   - for each interview, fetch assigned interviewers
   - check a feedback row exists for each interviewer_id
4. `moveApplicationToStage(applicationId, toStageId, toStatus?)`
   - update `current_stage_id` and/or `status`
   - call `insertStageHistory()`

### 2.5 Offer decision wrappers for candidate actions
You already have:
- `updateOfferStatus(offerId, newStatus)`
- `insertOffer(...)` and `getOffersByApplication(...)`

Add orchestration:
- `finalizeCandidateAccept( candidateId, winningApplicationId )`
  - update winner offer to `ACCEPTED`
  - update winner application to `HIRED` and stage to `Hired` stage id
  - cancel all other applications of same candidate:
    - `status = CANCELLED`
    - `current_stage_id = Cancelled stage id`
    - cancel their interviews
    - optionally update their offers to `REJECTED/EXPIRED` (policy)

---

## 3) HR UI integration points (where decisions happen)

There is currently no dedicated “HR Round Review” UI that displays feedback and blocks actions until feedback is complete.
So you must choose one place to implement it:

Option A (recommended MVP):
- Extend `hr-dashboard/candidates/candidates.ts` pipeline drawer modal to include a “Round Review & Decide” section when:
  - the application’s `temp1` matches a stepKey assigned by BPM
  - and `temp2` (TaskId) is present

Option B:
- Create a new HR component/page:
  - `/hr/candidate-flow`
  - It lists applications requiring decisions based on `temp1`

This implementation plan assumes Option A (less routing work).

---

## 4) Step-by-step workflow implementation order (MVP -> complete)

### Step 1: Candidate applies -> trigger SCREENING_DECISION BPM task
In `candidate-apply-job.component.ts` after successful `insertApplication(...)`:
1. Receive `application_id` from insert response (verify your current Soap/cordys insert returns it; if not, refetch by candidate_id + requisition_id)
2. Determine HR email (must exist in your system)
   - if you use department manager email like jobs BPM: use `mt_departments.temp1`
3. Set:
   - `temp1 = 'SCREENING_DECISION'`
4. Trigger BPM task assignment:
   - `triggerApplicationTaskIDGenerationBPM(hrEmail, application_id)`
5. Extract TaskId and store:
   - `temp2 = TaskId`
6. Do NOT create interviews yet. Screen is HR task.

### Step 2: HR SCREENING_DECISION UI -> create Round 1 or reject
When HR opens the candidate drawer/modal for a candidate application where:
- `temp1 == 'SCREENING_DECISION'`
- `temp2 != ''`
and there is no decision done yet:
UI buttons:
- `Shortlist/Approve`
- `Reject`

On `Approve`:
1. Create technical Round 1:
   - `createInterviewRound(application_id, 1, 'TECHNICAL', ...)`
   - for interviewType mapping, use `interview_type = 'TECHNICAL'` (or your current convention)
   - assign multiple interviewers (HR selects list of interviewers; MVP can pick all available if selection UI is not ready)
2. Move application:
   - set `current_stage_id = S3 Interview stage id`
3. Complete BPM task:
   - `performTaskAction(TaskId, 'COMPLETE', { decision:'APPROVED', ... })`
4. Clear:
   - set `temp2=''` and optionally `temp1=''`

On `Reject`:
1. Move application to `Rejected` stage
2. Complete BPM task with `REJECTED`
3. Clear temps

### Step 3: After Round feedback -> HR TECH_ROUND_DECISION task
When interviewers submit feedback:
- interviewer-portal currently only inserts into `ts_interview_feedback`

Add a hook in interviewer feedback submit action (interviewer-portal.ts):
After inserting feedback successfully:
1. Mark interview status to `COMPLETED` (recommended for reliable checks)
2. Check if the *current round* feedback is complete:
   - call `isRoundFeedbackComplete(application_id, roundNumber, interviewType)`
3. If complete:
   - trigger BPM task for HR:
     - set application `temp1='TECH_ROUND_DECISION'`
     - trigger BPM to generate `TaskId` and store it in `temp2`

**This ensures feedback is compulsory** because HR will only get the next BPM task after feedback is complete.

### Step 4: HR TECH_ROUND_DECISION -> create next technical round or go to Optional HR interview
UI when:
- `temp1 == 'TECH_ROUND_DECISION'`

Buttons:
- `Next Technical Interview?` (Yes/No)

On Yes:
1. Determine next round number:
   - create Round (maxExistingRound + 1) for technical interviews
2. Create next interview round with multiple interviewers
3. Move application stage remains `Interview`
4. Complete BPM task
5. Clear temps

On No:
UI should ask:
- create optional HR interview? YES/NO OR switch to a second BPM step

Recommended:
- Use BPM step assignment `OPTIONAL_HR_INTERVIEW_DECISION`
- or encode inside the payload of TECH_ROUND_DECISION.

### Step 5: Optional HR Interview decision -> create HR interview or move to offer
When `temp1 == 'OPTIONAL_HR_INTERVIEW_DECISION'`:
Buttons:
- `Create HR Interview`
- `Move to Offer`

On Create HR Interview:
1. Create interview with `interview_type='HR'` and `round_number = <next>` (dynamic)
2. Complete BPM task
3. Clear temps

On Move to Offer:
1. Move application to Offer stage (`S4 Offer`)
2. Trigger BPM task or call code to allow offer creation (depends on your HR offer UI)
3. Clear temps

### Step 6: HR ARGUE_RESOLUTION BPM step
Candidate ARGUED in offer:
- candidate UI updates `ts_offers.status = ARGUED` (you added enum)

When candidate sets ARGUED:
1. Update application status to `HOLD` or keep ACTIVE (policy)
2. Trigger HR BPM:
   - `temp1='ARGUE_RESOLUTION'`
   - store `temp2=TaskId`

HR UI decision:
- Approve Hire
- Reject Hire

On approve:
1. Finalize Accept path:
   - set winner HIRED + cancel other apps
2. Update offer to ACCEPTED
3. Complete BPM task

On reject:
1. Move application to Rejected stage
2. update offer to REJECTED
3. Complete BPM task

---

## 5) Critical “slot to UI” corrections (must not skip)

Your DB slot data comes from:
- `ts_interview_slots.slot_date`, `start_time`, `end_time`

Your candidate interviews UI uses:
- `proposed_date`, `proposed_time`, `is_selected`

Implementation requirement:
- Update `CordysService.getInterviewSlots()` or wherever you build the `slots` list so that:
  - `proposed_date = slot_date`
  - `proposed_time = start_time` (or end_time based on your UI intention)
  - `is_selected = temp1` (or a consistent derived boolean/flag)

This is the one place where past code may be inconsistent because slot objects used in the front-end may be coming from an earlier mock schema.

---

## 6) What to implement first (to avoid dead-ends)

Order:
1. SOAP wrappers + CandidateFlowService orchestration (no UI yet)
2. Screening -> create Round 1 -> complete BPM
3. Feedback completion -> trigger TECH_ROUND_DECISION BPM
4. TECH_ROUND_DECISION -> create Round 2
5. Optional HR interview decision
6. Offer/Hired/Cancelled paths + candidate accept cancels others
7. Argue resolution BPM
8. Dynamic pipeline UI to show R1..RN based on created rounds

---

## 7) Confirmation questions (answer now so implementation has no surprises)

1. In your DB and UI, what exact string values do you store in `ts_interviews.interview_type`?
   - Is it `TECHNICAL` and `HR` (recommended), or something else?
2. When creating a round, who chooses interviewers?
   - HR during TECH_ROUND_DECISION UI (recommended), or all active interviewers automatically (MVP)?
3. What is the exact “HR email” source?
   - `mt_departments.temp1` like job BPM, or another field?
4. Do you want candidate selection of available slots during scheduling?
   - If yes, we must decide how `slot_id` and “selected slot” links are represented (using `ts_interviews.slot_id` and `temp1` selection flag is typical).

Reply with these 4 answers and I’ll convert this plan into a concrete checklist of file-level edits (exact files/patches for services + components).

