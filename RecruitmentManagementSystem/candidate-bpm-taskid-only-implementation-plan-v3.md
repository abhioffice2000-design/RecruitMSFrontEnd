# Candidate Flow Implementation Plan (BPM = Task Assignment + TaskId Only)

This plan implements the candidate recruitment flow using:
- **DB updates in code** (Angular/TypeScript) for everything workflow-related (interviews, rounds, stages, feedback gates, offers, accept/reject/argue, cancellation).
- **BPM only for HR task assignment**:
  - Use your existing SOAP BPM:
    `ApplicationTaskIDGenerationBPM(dn, application_id)`
  - Extract the returned `TaskId`
  - Store `TaskId` in `ts_applications.temp2`
  - Complete the BPM task later using `PerformTaskAction(TaskId, 'COMPLETE', payload)`

Your latest decisions (confirmed by you):
- `ts_interviews.interview_type` values are **TECHNICAL** and **HR**
- HR decides all next steps
- Candidate does **not** select slots (they only view schedule)
- Use `ts_users`, `ts_accounts` and your “get user by mail” style lookups when you need HR email

---

## 0) DB requirements you already applied (must be correct)

## 0.1 Enum additions (already planned/applied)
- `offer_status_enum`: add `ARGUED`
- `application_status_enum`: add `HIRED`, `CANCELLED`
- `interview_status_enum`: add `CONFIRMED` (optional, but recommended)

## 0.2 Feedback uniqueness (already applied)
Create/ensure:
- `UNIQUE(interview_id, interviewer_id)` on `ts_interview_feedback`

## 0.3 Pipeline stage reference rows (must exist)
Ensure `mt_pipeline_stages` contains these stage rows (or adjust stage ids in this plan):
- `S4` = Offer
- `S5` = Hired
- `S6` = Rejected
- `S7` = Cancelled
- `S8` = On Hold / Argued

Your `hs_application_stage_history` has FK constraints to `mt_pipeline_stages`, so missing stage ids will break inserts.

---

## 1) BPM TaskId storage contract (critical)

### 1.1 Set stepKey before calling BPM
Because your SOAP for task id generation does NOT accept `stepKey`, you must store the “current HR step” in `ts_applications.temp1` BEFORE calling BPM.

### 1.2 Store TaskId in temp2
After BPM returns:
- `ts_applications.temp2 = TaskId`

### 1.3 Recommended `temp1` stepKey values
Use these strings in `ts_applications.temp1`:
- `SCREENING_DECISION`
- `TECH_ROUND_DECISION`
- `OPTIONAL_HR_INTERVIEW_DECISION`
- `MOVE_TO_OFFER`
- `ARGUE_RESOLUTION`

After the HR completes the BPM task:
- clear `ts_applications.temp2 = ''`
- optionally clear `ts_applications.temp1 = ''`

---

## 2) Workflow: end-to-end states & transitions

### 2.1 Candidate applies
Location (existing):
- `src/app/candidate-portal/pages/candidate-apply-job/candidate-apply-job.component.ts`

Current behavior:
- inserts `ts_applications` with `current_stage_id = firstStageId` and `status = ACTIVE`

Required addition:
1. After inserting the application and obtaining `application_id`, decide who will act as HR.
2. Set:
   - `ts_applications.temp1 = 'SCREENING_DECISION'`
3. Trigger BPM TaskId generation:
   - call SOAP `ApplicationTaskIDGenerationBPM(dn, application_id)`
4. Store extracted `TaskId` in:
   - `ts_applications.temp2 = TaskId`

Do NOT create interviews at this time.

---

### 2.2 HR screening decision (BPM step: SCREENING_DECISION)

HR UI entry point:
- `src/app/hr-dashboard/candidates/candidates.ts` (drawer + pipeline modal already exist)

Required HR UI behavior:
When HR selects an application where:
- `temp1 == 'SCREENING_DECISION'`
- and `temp2 != ''`
then show buttons:
- `Approve/Shortlist`
- `Reject` (reason text optional/required depending on UI)

HR actions:
#### A) Approve/Shortlist
1. Create **Technical Round 1** interviews:
   - pick one set of interviewers (see §3.3)
   - create a `ts_interview_slots` row for each interview (candidate must be able to see date/time)
   - create `ts_interviews` rows:
     - `interview_type='TECHNICAL'`
     - `round_number=1`
     - `slot_id=<created slot>`
     - `status='SCHEDULED'`
   - create:
     - `ts_interviewers` for each interview (multiple interviewer users)
     - `ts_interview_slot_interviewers` for each slot & interviewer if you want candidate-interviews UI to show interviewer chips via slot mapping (recommended)
2. Move application:
   - `ts_applications.current_stage_id = S3 (Interview)`
   - keep `status = ACTIVE`
   - insert `hs_application_stage_history` record (from S1 to S3)
3. Complete BPM:
   - call `performTaskAction(TaskId=temp2, 'COMPLETE', { decision:'APPROVED', comments? })`
4. Clear temps:
   - set `temp1=''`, `temp2=''`

#### B) Reject
1. Move application:
   - `ts_applications.status = REJECTED` (use `application_status_enum`)
   - `ts_applications.current_stage_id = S6 (Rejected)`
   - insert `hs_application_stage_history`
2. Complete BPM:
   - `performTaskAction(temp2, 'COMPLETE', { decision:'REJECTED', comments })`
3. Clear temps:
   - `temp1=''`, `temp2=''`

---

### 2.3 Technical interview rounds (dynamic; BPM step: TECH_ROUND_DECISION)

Core rule you required:
- **feedback is compulsory**
- next round creation/offer transition happens only after feedback for the current round is complete

How to compute “feedback complete”:
For a given application + technical round number:
1. Fetch all `ts_interviews` where:
   - `application_id = ?`
   - `interview_type = 'TECHNICAL'`
   - `round_number = currentRound`
2. For each `interview_id`, fetch assigned interviewers from `ts_interviewers`
3. For each assigned interviewer, ensure a `ts_interview_feedback` row exists
4. Return true only if all assigned interviewers have submitted feedback

When to trigger BPM step TECH_ROUND_DECISION:
- After feedback is submitted for the last interview (or after any feedback submit, re-check completeness in code)

Recommended approach:
In interviewer-portal feedback submit:
1. Insert feedback with `UpdateTs_interview_feedback`
2. Mark the interview status to `COMPLETED`:
   - call `UpdateTs_interviews` to set `status='COMPLETED'`
3. Call your code method:
   - re-check if technical round feedback is complete
4. If complete and HR needs to decide:
   - set application `temp1='TECH_ROUND_DECISION'`
   - trigger BPM TaskId generation
   - store TaskId into `temp2`

HR UI buttons when `temp1 == 'TECH_ROUND_DECISION'`:
- `Next Technical Interview (YES)`
- `Finish Technical / Go to HR decision (NO)` (or show “Optional HR Interview” next)

HR actions:
#### YES: create next technical round
1. Determine next round number dynamically:
   - find `MAX(ts_interviews.round_number)` for technical interviews for this application
   - set `nextRound = max+1`
2. Create next technical round interviews exactly like Round 1 (§2.2 A)
3. Complete BPM task:
   - `performTaskAction(temp2, 'COMPLETE', { decision:'NEXT_ROUND_CREATED', round:nextRound })`
4. Clear temps

#### NO: go to optional HR interview stage decision
1. Set application `temp1='OPTIONAL_HR_INTERVIEW_DECISION'`
2. Trigger BPM task id generation (store in temp2)
3. Complete the current TECH_ROUND_DECISION BPM task first, or include both in same task design.
   - MVP suggestion: complete each step as separate BPM task.

---

### 2.4 Optional HR Interview (dynamic; BPM step: OPTIONAL_HR_INTERVIEW_DECISION)

HR UI buttons:
- `Create HR Interview (YES)`
- `Move to Offer (NO)`

HR action YES:
1. Create one `ts_interviews` set:
   - `interview_type='HR'`
   - `round_number = nextTechnicalRound + 1` (or use any strictly increasing scheme)
   - status='SCHEDULED'
2. Create slots for scheduling and assign interviewers/users similar to §2.2 A.
3. Complete BPM and clear temps.

HR action NO (move to offer):
1. Move application:
   - `ts_applications.current_stage_id = S4 (Offer)`
   - insert `hs_application_stage_history`
2. Complete BPM step.
3. Clear temps.

Note:
- After app is in Offer stage, your existing HR “Offer Management” screen already creates offers for S4 apps without existing offers.

---

### 2.5 Offer decision (candidate decides; HR resolves argue)

Candidate offer actions already exist in code, but you must extend:
Location:
- `src/app/candidate-portal/pages/candidate-applications/candidate-applications.component.ts`

Required behavior:
- Candidate `ACCEPT`:
  1. Set winning offer to `ACCEPTED`
  2. Set winning application to `HIRED` and stage to S5
  3. Cancel all other applications of same candidate:
     - set status=`CANCELLED`
     - stage to S7 Cancelled
     - cancel all their interviews
  4. Optionally set other applications’ offers to `REJECTED`/`EXPIRED` based on policy

- Candidate `REJECT`:
  - set offer `REJECTED`
  - move only this application to `S6 Rejected`

- Candidate `ARGUE`:
  - set offer `ARGUED`
  - set application status `HOLD`
  - set stage to `S8 On Hold / Argued`
  - trigger HR BPM step `ARGUE_RESOLUTION`:
    - `temp1='ARGUE_RESOLUTION'`
    - BPM task id generation
    - store `temp2=TaskId`

HR resolves argue:
Location:
- HR UI similar pattern: show buttons only when `temp1 == 'ARGUE_RESOLUTION'`
Buttons:
- `Approve Hire` => follow Accept flow (Hire + cancel others)
- `Reject` => move application to S6 Rejected and set offer REJECTED

Complete BPM task:
- `performTaskAction(temp2, 'COMPLETE', { decision:'APPROVED'|'REJECTED' })`
- clear temps

---

## 3) Interviewer assignment and slot scheduling (MVP approach)

### 3.1 Interviewer selection source
You said HR decides; and you have:
- `ts_users` / `ts_accounts`
- `ts_interviewers(interview_id,user_id)`
- `ts_interview_slot_interviewers(slot_id,user_id)`

MVP selection strategy (until you build a full HR assignment UI):
- Technical round:
  - HR selects the *first interviewer* `U1` from the technical interviewer scope.
  - HR selects a slot for `U1`.
  - The system shows HR the *available other interviewers* for the same day/time `(D, S.start_time)`.
  - HR manually chooses which of those filtered interviewers to add (optional; `0..N`), while `U1` is compulsory.
- HR interview:
  - HR selects the *first HR interviewer* `U1` from the HR interviewer scope.
  - HR selects a slot for `U1`.
  - HR interview uses only this single `U1` (no additional HR interviewers).

This matches your rule: HR selects the first interviewer + a slot for that interviewer, then selects additional interviewers from a filtered list (no auto-attach).

### 3.2 Slot creation policy (since candidate cannot choose)
Your latest requirement (detailed):
1. HR selects the *first interviewer* `U1`.
2. HR selects an available slot for `U1` on a chosen day `D` (fixed grid: every 30 mins between 09:00 and 18:00).
3. The system filters the other interviewers who have an available slot at the same day/time key `(D, S.start_time)`.
4. For technical rounds: HR may choose `0..N` extra interviewers (besides `U1`) from that filtered list. For the HR interview: no extras are added.
5. HR does **not** explicitly pick separate slots for the additional interviewers.

So implement slots as a *pre-generated pool per interviewer per date*, but HR chooses the slot only for `U1`; additional interviewers are selected manually from the filtered “available at this slot time” list.

### Recommended slot policy
1. **Generate slot pool for a given interviewer and date** (idempotent: only create missing)
   - For each interviewer user `U` and chosen date `D`:
     - insert `ts_interview_slots` rows for all start-times:
       - 09:00, 09:30, ..., 17:30
     - store each slot as:
       - `slot_date = D`
       - `start_time = <hh:mm>`
       - `end_time = start_time + 30 minutes`
     - use convention:
       - `created_by_user = U` (recommended)
2. **HR chooses U1 and slot S**
   - HR selects `slot_id = S.slot_id` from U1’s pool on day D.
   - Create the interview with:
     - `ts_interviews.slot_id = S.slot_id`
3. **Filter other interviewers available at (D, S.start_time)**
   - For every other interviewer `Ux` in the same scope:
     - check whether a slot exists for Ux at `(D, S.start_time)` (pool existence)
     - build the “available interviewers” list for HR to choose from
4. **HR manually selects which additional interviewers to add**
   - For each selected interviewer `Ux` from that filtered list:
     - create `ts_interview_slot_interviewers` for `slot_id = S.slot_id` and `user_id = Ux`
     - create `ts_interviewers` for `interview_id = <createdInterviewId>` and `user_id = Ux`
5. **Candidates only view**
   - Candidates do not select slots; they just see:
     - slot details (from `ts_interview_slots`)
     - interviewer chips (from `ts_interview_slot_interviewers`)

### UI impact
- HR UI must show:
  - “First interviewer” picker `U1`
  - slot list filtered to `U1` and day `D`
- After HR selects `U1` + slot `S` for a technical round, the system shows “available interviewers at this slot time” (filtered by `(D, S.start_time)`), and HR may optionally select additional interviewers (checkbox/multi-select). `U1` remains mandatory.
- For the HR interview stage, only the selected `U1` is used (no additional interviewers to select).

---

## 4) Candidate interviews UI compatibility (must fix mapping)

Your earlier code in `candidate-interviews.component.ts` assumes:
- slots have `interview_id` and fields like `proposed_date/proposed_time/is_selected`

But DB schema:
- slots do not have `interview_id`
- slots have `slot_date/start_time/end_time`

Therefore, implement this in code:
When building candidate interview display:
1. For each interview row, use `interview.slot_id` to fetch the slot row
2. Convert to UI slot model:
   - `proposed_date = slot.slot_date`
   - `proposed_time = slot.start_time`
   - `is_selected = '1'` (because candidate cannot choose; they just view)
3. Keep a slots array with one item (the interview’s own slot)

This keeps candidate interview page working even without candidate slot selection.

---

## 5) Feedback completeness gate implementation details

You must implement both:
- UI gating (disable HR “Next” and “Move to Offer” buttons)
- Service validation (re-check in code before creating next rounds or moving to offer)

Service gating method:
- `isTechnicalRoundFeedbackComplete(applicationId, roundNumber): Promise<boolean>`

Expected counts:
- interviews in that round = N interviews
- assigned interviewers per interview = M_i
- total expected feedback rows = sum(M_i)
Return true only if feedback rows count equals expected feedback rows count AND no feedback is missing.

---

## 6) Implementation order (do this sequentially)

### Phase 1: plumbing (Day 1)
1. Add/ensure SOAP wrapper:
   - `triggerApplicationTaskIDGenerationBPM(hrEmail, applicationId)`
2. Add helper `updateApplicationTemp(oldApp, updates)` for `ts_applications`
3. Add helper `getApplicationById(applicationId)`

### Phase 2: interviewer feedback -> mark interview completed (Day 2)
1. In `interviewer-portal.ts` after `UpdateTs_interview_feedback`:
   - update `ts_interviews.status='COMPLETED'`
2. After marking completed:
   - check technical round feedback completeness
   - if complete, assign BPM step `TECH_ROUND_DECISION` and store `temp2=TaskId`

### Phase 3: HR screening and round decision UI (Day 3-4)
1. Extend `hr-dashboard/candidates/candidates.ts` drawer modal:
   - if `temp1=='SCREENING_DECISION'` show screening buttons
   - if `temp1=='TECH_ROUND_DECISION'` show next-round buttons
   - if `temp1=='OPTIONAL_HR_INTERVIEW_DECISION'` show HR interview decision buttons
   - if `temp1=='ARGUE_RESOLUTION'` show argue resolution buttons
2. On each button click:
   - run DB code operations
   - complete BPM task using stored `temp2` TaskId
   - clear temps

### Phase 4: interview creation helpers + cancellation (Day 5)
1. Create technical round helper:
   - insert slot + interviews + ts_interviewers + ts_interview_slot_interviewers
2. Create HR interview helper
3. Implement cancellation helper:
   - when one application hired, cancel other applications:
     - set app status CANCELLED + stage S7
     - cancel their interviews

### Phase 5: candidate accept/reject/argue behavior (Day 6)
1. Extend candidate offer actions in `candidate-applications.component.ts`
2. Add ARGUe button and handle ARGUED state
3. Trigger HR BPM step `ARGUE_RESOLUTION` when candidate argues

### Phase 6: dynamic pipeline UI (Day 7)
Your pipeline UI currently uses static `mt_pipeline_stages`.
Update it to render derived “virtual” steps inside Interview based on:
- distinct technical rounds found in `ts_interviews`
- presence of interview_type='HR'

This makes pipeline dots grow to 2/3/4 rounds automatically.

---

## 7) “temp columns for proposed date/time” answer (your question)
Yes, you *can* store extra data in `ts_interview_slots.temp*`, but it’s not needed because:
- canonical schedule already exists in `slot_date/start_time/end_time`

Best practice for your case:
- keep canonical schedule in real columns
- store `is_selected` in `temp1` (optional) OR map to `'1'` directly
- always map DB->UI fields in candidate interviews service/component.

---

## 8) What you should confirm before coding (only 2 checks)
1. When you create a slot for an interview, which datetime should be shown as `proposed_time` in candidate UI?
   - use `start_time` (recommended)
2. What is the role filter for interviewer assignment in MVP?
   - all `INTERVIEWER` users, or department-scoped?

If those two are confirmed, you can start implementing with low risk.

