# Candidate Flow (Code-Driven) BPM TaskId Plan

## 0) Goal
Implement the candidate workflow so that:
- **BPM is used only for task assignment + generating a Cordys `TaskId`**
- **All business work (DB updates) is done by your Angular code / `SoapService`**
- Candidate interviews support **dynamic rounds** (Round 1..N created dynamically as HR decides)
- **Feedback is compulsory**: HR can’t decide the next step until feedback is submitted for all assigned interviewers of that round
- Candidate can **ACCEPT / REJECT / ARGUE** at offer stage
- If candidate **ACCEPTS**, then all other candidate applications for that candidate are **cancelled** (and their interviews/offers handled accordingly)

This plan is written to match your existing “job requisition BPM” approach in:
- `src/app/hr-dashboard/jobs/jobs.ts`
- `src/app/manager-dashboard/manager-dashboard.ts`
- `src/app/services/soap.service.ts`

## 1) Your BPM SOAP to generate TaskId (already created)
You have a BPM SOAP like:

```xml
<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <ApplicationTaskIDGenerationBPM xmlns="http://schemas.cordys.com/default">
      <dn>PARAMETER</dn>
      <application_id>PARAMETER</application_id>
    </ApplicationTaskIDGenerationBPM>
  </SOAP:Body>
</SOAP:Envelope>
```

We will call this from code, extract the returned `TaskId`, and store it into `ts_applications.temp*`.

## 2) Required DB enum changes (assumed done)
Your DB already has:
- `interview_status_enum`: `SCHEDULED|COMPLETED|CANCELLED`
- `offer_status_enum`: `DRAFT|SENT|ACCEPTED|REJECTED|EXPIRED`
- `application_status_enum`: `ACTIVE|REJECTED|HOLD`

For the required flow, you should have completed:
1. `offer_status_enum` add: `ARGUED`
2. `application_status_enum` add: `HIRED`, `CANCELLED`
3. (Recommended) `interview_status_enum` add: `CONFIRMED` (to satisfy candidate interview UI expectations)

## 3) How to store BPM TaskId + step state in `ts_applications.temp1..temp5`
You asked: “store dn + task id in application tab temp col and then do all work from here code”.

We will standardize a mapping so each BPM step is identifiable and safe.

### 3.1 Use these conventions
On `ts_applications` row:
- `temp1` = `stepKey` (string, e.g. `SCREENING`, `ROUND_DECISION`, `HR_INTERVIEW_DECISION`, `ARGUE_RESOLUTION`)
- `temp2` = current BPM `TaskId` (string)
- `temp3` = round number (technical round i) as string (optional but recommended)
- `temp4` = extra metadata (optional; e.g. `interview_type` or `next_round_number`)
- `temp5` = reserved

### 3.2 Before calling BPM, set `temp1`
Because your BPM SOAP currently accepts only `dn` and `application_id`, BPM must know which step to create.

Implementation choice (recommended):
- Set `ts_applications.temp1 = stepKey` in code before calling `ApplicationTaskIDGenerationBPM`.
- BPM reads `temp1` based on `application_id` and creates the correct HR task.

## 4) Service layer changes (what you must add in `soap.service.ts`)
You already have:
- `triggerRequisitionBPM()` and `performTaskAction()`

You must add candidate equivalents:

### 4.1 `triggerApplicationTaskIDGenerationBPM(...)`
Signature (example):
```ts
triggerApplicationTaskIDGenerationBPM(hrEmail: string, applicationId: string): Promise<string>
```
Behavior:
1. Build `dn` from `hrEmail` using the existing private `_makeDN()` logic in `SoapService`
2. Call SOAP method `ApplicationTaskIDGenerationBPM`
3. Extract `TaskId` from response (same parsing style you used in `jobs.ts`)
4. Return `TaskId`

### 4.2 `updateApplicationTemp(oldApp, updates)`
Your `SoapService` currently has no direct `updateJobRequisitionTemp`-like method for applications.

Add:
```ts
updateApplicationTemp(
  oldData: Record<string, string>,
  updates: { temp1?: string; temp2?: string; temp3?: string; temp4?: string; temp5?: string }
): Promise<any>
```
Implementation style:
- Copy the pattern from `updateJobRequisitionTemp()` and swap `ts_job_requisitions` with `ts_applications`
- Keep all other fields same as `oldData`
- Only update provided temp columns

### 4.3 Small helpers you will use often
Add these if missing:
- `getApplicationById(applicationId)`
- `cancelOtherApplications(candidateId, winnerApplicationId)`
- `finalizeHireAndCancelOthers(winnerApplicationId)`

You can implement them either inside `SoapService` or directly inside HR/candidate components, but keeping them in `SoapService` is cleaner.

## 5) Slot date/time mapping (your “proposed date time” confusion)
### 5.1 DB columns in `rmsdb.sql`
`ts_interview_slots` has:
- `slot_date`
- `start_time`
- `end_time`

### 5.2 Candidate interviews UI expects (currently)
Your candidate interviews UI uses:
- `proposed_date`
- `proposed_time`
- `is_selected`

This mismatch will break the UI unless you normalize the data.

### 5.3 Recommended approach (no DB temp hacks)
Do NOT rely on storing extra fields into temp columns only to match UI names.

Instead normalize in `CordysService.getInterviewSlots()` or in `CandidateInterviewsComponent` mapping.

Add normalization logic:
- `proposed_date = slot.slot_date ?? slot.proposed_date ?? ''`
- `proposed_time = slot.start_time ?? slot.proposed_time ?? ''`
- `is_selected = slot.is_selected ?? slot.temp1 ?? 'false'` (only if you set temp1 during slot selection)

This way:
- Your DB remains correct/consistent
- UI works even if Cordys SOAP returns different column names

### 5.4 Optional approach (if you insist on temp columns)
If you want to populate temp columns in DB instead:
- Define:
  - `ts_interview_slots.temp1` = `is_selected` (store `'1'` or `'true'`)
  - `ts_interview_slots.temp2` = `proposed_date_override` (string)
  - `ts_interview_slots.temp3` = `proposed_time_override` (string)
- Then normalization uses those temp values as fallbacks.

But you STILL must update code to read from temp columns.

## 6) Step-by-step BPM usage with code-driven business logic
For each step, the pattern is:
1. UI decides stepKey
2. Code updates `ts_applications.temp1 = stepKey` (and temp3 if relevant)
3. Code calls `ApplicationTaskIDGenerationBPM(dn, application_id)`
4. Code stores returned `TaskId` in `ts_applications.temp2`
5. HR performs decision in UI
6. Code executes all DB work
7. Code calls `performTaskAction(taskId, 'COMPLETE', payload)`
8. Code clears `ts_applications.temp2` (optional) and advances `current_stage_id/status`

### 6.1 Screening step
When candidate applies:
- `ts_applications.current_stage_id = S1 Applied`
- `ts_applications.status = ACTIVE`

HR screening happens when HR triggers it (or when code detects it needs task).

**Screening approve**
1. HR UI action: “Shortlist”
2. Code:
   - move application: `current_stage_id = S3 Interview`
   - keep `status=ACTIVE`
   - create `ts_interviews` for Round 1 (technical)
   - assign interviewers for Round 1:
     - insert rows for `ts_interviews`
     - create slots + insert `ts_interviewers` and `ts_interview_slot_interviewers`
3. Complete BPM task:
   - `performTaskAction(temp2TaskId,'COMPLETE',{decision:'APPROVED'})`

**Screening reject**
1. HR UI action: “Reject”
2. Code:
   - set application stage to `Rejected` stage id (S6) and `status = REJECTED` (or `application_status_enum` equivalent)
   - insert `hs_application_stage_history`
3. Complete BPM task

### 6.2 Technical round decision step (dynamic next round)
After interviews are done:
- Interviews can have multiple `ts_interviews` rows (one per interview round)
- Each round can have multiple interviewers (multiple feedback rows)

**Compulsory feedback gate (mandatory)**
Before HR can proceed, enforce:
- For every technical `ts_interviews` row in the round:
  - fetch all assigned interviewers for that `interview_id` from `ts_interviewers`
  - verify a feedback exists in `ts_interview_feedback` for each (same `interview_id`, `interviewer_id`)

Only then allow HR to click “Next round?”.

**Round decision YES: create Round N+1**
1. HR UI shows BPM task for `stepKey=ROUND_DECISION`
2. Code verifies feedback completeness
3. Code:
   - create next technical round:
     - insert `ts_interviews` with `round_number = current+1`, `interview_type='TECHNICAL'`
     - assign interviewers
     - create slots as required
   - keep application in `current_stage_id = S3 Interview`
4. Complete BPM task

**Round decision NO: ask optional HR interview**
1. HR UI triggers BPM step `HR_INTERVIEW_DECISION`
2. Code checks whether HR interview should be created (your policy)
3. Code:
   - if YES: create `ts_interviews` with `interview_type='HR'`
   - if NO: move application to Offer stage `current_stage_id = S4 Offer`
4. Complete BPM task

### 6.3 HR interview decision step
Same as technical round decision, but:
- HR interview uses `interview_type='HR'`
- Feedback completeness gate is still required

**Pass**
- move to Offer stage

**Fail**
- move to Rejected stage

### 6.4 Offer stage + candidate actions
HR sets `ts_offers.status` to `SENT` through existing Offers UI.

Candidate actions:
- Candidate `ACCEPT`:
  - code marks winning app as `HIRED` and sets stage `Hired`
  - code cancels all other applications for candidate:
    - set `status=CANCELLED`
    - set `current_stage_id=Cancelled stage`
    - set all their `ts_interviews.status=CANCELLED`
    - set offers for cancelled applications to `REJECTED` or `EXPIRED` based on your policy
- Candidate `REJECT`:
  - mark this offer `REJECTED`
  - move this application to Rejected stage
- Candidate `ARGUE`:
  - mark this offer `ARGUED`
  - trigger BPM/HR resolution task:
    - `stepKey=ARGUE_RESOLUTION`
    - BPM gives HR a `TaskId`
    - HR resolves approve/reject using UI; code finalizes hire/cancel-others or reject

## 7) Where to implement “feedback completeness” logic
You must implement it in code because BPM should not do the business work.

Implementation location options:
1. `SoapService` method:
   - `isTechnicalRoundFeedbackComplete(applicationId, roundNumber): Promise<boolean>`
2. Or HR component calls `getInterviews` + `getInterviewFeedback` and computes locally.

Recommended:
- Put it in `SoapService` so it can be reused by multiple UIs.

## 8) End-to-end timeline (example)
### Timeline for one candidate application
1. Candidate applies:
   - `ts_applications` created with `current_stage_id=S1 Applied`
2. HR starts screening:
   - code sets `temp1='SCREENING'`
   - calls `ApplicationTaskIDGenerationBPM(dn, application_id)`
   - stores `TaskId` in `temp2`
3. HR submits “Shortlist”
   - code moves to S3 Interview
   - creates technical Round 1 interview(s)
   - assigns multiple interviewers
   - calls `performTaskAction(temp2,'COMPLETE',payload)`
4. Interview round completes:
   - interviewer submits feedback
   - (recommended) code marks interview `ts_interviews.status=COMPLETED`
5. HR clicks “Next round?” after feedback gate passes:
   - code creates Round 2
   - completes ROUND_DECISION task
6. After last technical decision, HR decides optional HR interview:
   - creates HR interview or moves to Offer
7. HR creates Offer and sends
8. Candidate Accept:
   - code hires this app and cancels all others
9. Candidate Reject/Argue:
   - code handles offer status + resolution BPM

## 9) Implementation checklist (“no issue” checklist)
### BPM/task assignment
- [ ] Implement `triggerApplicationTaskIDGenerationBPM()` and ensure it returns TaskId reliably
- [ ] Implement `updateApplicationTemp()` to set `temp1` and `temp2`
- [ ] Ensure UI completes BPM task using stored `temp2` `TaskId`

### DB orchestration
- [ ] On screening approve: create Round 1 technical `ts_interviews`
- [ ] On round decision: dynamically create next technical round `round_number+1`
- [ ] Optional HR interview creation uses `interview_type='HR'`
- [ ] Enforce feedback compulsory gate before showing/allowing decision actions
- [ ] On candidate accept:
  - [ ] Hire winner app
  - [ ] Cancel all other applications for candidate
  - [ ] Cancel their interviews and offers by policy

### Candidate interviews UI data mapping
- [ ] Normalize slot fields in `CordysService.getInterviewSlots()`:
  - `proposed_date` from `slot_date`
  - `proposed_time` from `start_time`
  - `is_selected` from either existing column or temp fallback

## 10) Next step
Before coding, confirm these two details:
1. What exact `interview_type` strings are stored in `ts_interviews` for technical rounds vs HR interview? (Use `TECHNICAL` and `HR` or match your existing values.)
2. Which stage IDs in `mt_pipeline_stages` you will use for:
   - Rejected
   - Cancelled

If you answer those, I can convert this plan into exact stepKey values and the exact stage_id values to use in each DB update.

