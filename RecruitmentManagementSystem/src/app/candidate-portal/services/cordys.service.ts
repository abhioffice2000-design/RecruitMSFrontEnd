import { Injectable, NgZone } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { map } from 'rxjs/operators';

declare var $: any;

// ─── Cordys Response Interfaces ────────────────────────────────────

/** Response from GetTs_candidatesObject */
export interface CordysCandidateProfile {
  candidate_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  linkedin_url: string;
  experience_years: number | null;
  location: string;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
  temp1: string;
  temp2: string;
  temp3: string;
  temp4: string;
  temp5: string;
}

/** Response from GetTs_applicationsObjectsForcandidate_id */
export interface CordysApplication {
  application_id: string;
  candidate_id: string;
  requisition_id: string;
  current_stage_id: string;
  status: string;
  applied_date: string;
  resume_version: string;
  notes: string;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
  temp1: string;
  temp2: string;
  temp3: string;
  temp4: string;
  temp5: string;
}

/** Response from GetMt_pipeline_stagesObjects */
export interface CordysPipelineStage {
  stage_id: string;
  stage_name: string;
  stage_order: string;
  description: string;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
  temp1: string;
  temp2: string;
}

/** Cursor for GetNextTs_job_requisitionsObjects / GetPreviousTs_job_requisitionsObjects pagination */
export interface JobRequisitionsCursor {
  id: string;
  position: string;
  numRows: string;
  maxRows: string;
  sameConnection: string;
}

/** Response from GetNextTs_job_requisitionsObjects / GetTs_job_requisitionsObjects */
export interface CordysJobRequisition {
  requisition_id: string;
  job_title: string;
  department: string;
  location: string;
  employment_type: string;
  experience_required: string;
  min_salary: string;
  max_salary: string;
  job_description: string;
  requirements: string;
  responsibilities: string;
  benefits: string;
  status: string;
  posted_date: string;
  closing_date: string;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
  temp1: string;
  temp2: string;
  temp3: string;
  temp4: string;
  temp5: string;
}

/** Response from GetHs_application_stage_historyObjectsForapplication_id */
export interface CordysStageHistory {
  history_id: string;
  application_id: string;
  stage_id: string;
  entered_at: string;
  exited_at: string;
  notes: string;
  changed_by: string;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
  temp1: string;
  temp2: string;
}

/** Response from GetTs_interviewsObjectsForapplication_id */
export interface CordysInterview {
  interview_id: string;
  application_id: string;
  interview_type: string;
  round_number: string;
  slot_id: string;
  meeting_link: string;
  status: string;
  // Optional/enriched fields used by candidate UI
  scheduled_date?: string;
  scheduled_time?: string;
  duration_minutes?: string;
  location?: string;
  feedback?: string;
  rating?: string;
  notes?: string;
  // Auditing / temps (may exist in SOAP response)
  created_at?: string;
  created_by?: string;
  updated_at?: string;
  updated_by?: string;
  temp1?: string;
  temp2?: string;
  temp3?: string;
  temp4?: string;
  temp5?: string;
}

/** Response from GetTs_interview_slotsObjects */
export interface CordysInterviewSlot {
  slot_id: string;
  slot_date?: string;
  start_time?: string;
  end_time?: string;
  // Mapped fields for the candidate UI
  proposed_date: string;
  proposed_time: string;
  // In this UI: '1' => booked/selected, '0' => available
  is_selected: string;
  // Availability flag from DB (ts_interview_slots.temp1)
  temp1?: string;
  // Auditing/temps
  created_at?: string;
  created_by?: string;
  updated_at?: string;
  updated_by?: string;
  temp2?: string;
  temp3?: string;
  temp4?: string;
  temp5?: string;
}

/** Response from GetTs_interview_slot_interviewersObjects */
export interface CordysInterviewSlotInterviewer {
  slot_id: string;
  user_id: string;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
  temp1: string;
  temp2: string;
}

/** Response from GetTs_interview_feedbackObjects */
export interface CordysInterviewFeedback {
  feedback_id: string;
  interview_id: string;
  rating: string;
  result: string;
  comments: string;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
  temp1: string;
  temp2: string;
}

/** Response from GetTs_offersObjects */
export interface CordysOffer {
  offer_id: string;
  candidate_id?: string;
  application_id: string;
  requisition_id?: string;
  // DB: offered_salary + salary_currency + joining_date + expiration_date + status
  offered_salary?: string;
  salary_currency?: string;
  status?: string;

  // Mapped fields for candidate UI
  salary: string;
  joining_date: string;
  expiration_date: string;
  offer_status: string;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
  temp1: string;
  temp2: string;
}

/** Response from GetMt_departmentsObjects (reference data for dropdowns) */
export interface CordysDepartment {
  department_id: string;
  department_name: string;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
  temp1: string;
  temp2: string;
  temp3: string;
  temp4: string;
  temp5: string;
}

/** Response from GetMt_skillsObjects (reference data for dropdowns) */
export interface CordysSkill {
  skill_id: string;
  skill_name: string;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
  temp1: string;
  temp2: string;
}

/** Response from GetTs_candidate_skillsObjectsForcandidate_id */
export interface CordysCandidateSkill {
  skill_id: string;
  candidate_id: string;
  skill_name: string;
  proficiency_level: string;
  years_experience: string;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
  temp1: string;
  temp2: string;
}

@Injectable({
  providedIn: 'root'
})
export class CordysService {

  /** Namespace for all RMS database metadata web services */
  private readonly NAMESPACE = 'http://schemas.cordys.com/RMST1DatabaseMetadata';

  constructor(private ngZone: NgZone) {}

  // ─── Generic SOAP Caller ──────────────────────────────────────
  private callSoap<T>(method: string, parameters: any): Observable<T> {
    const subject = new Subject<T>();

    $.cordys.ajax({
      method,
      namespace: this.NAMESPACE,
      parameters
    })
      .done((response: any) => {
        this.ngZone.run(() => {
          subject.next(response);
          subject.complete();
        });
      })
      .fail((error: any) => {
        this.ngZone.run(() => {
          console.error(`Cordys SOAP error [${method}]:`, error);
          subject.error(error);
        });
      });

    return subject.asObservable();
  }

  // ─── Generic Tuple Extractor ──────────────────────────────────
  /**
   * Extracts entity data from the standard Cordys response pattern:
   *   MethodResponse > tuple > old > entityName
   * Handles empty, single, and array tuple scenarios.
   */
  private extractTuples<T>(resp: any, responseKey: string, entityName: string): T[] {
    try {
      const root = resp?.[responseKey] ?? resp;
      if (!root || !root.tuple) return [];

      const tuples = Array.isArray(root.tuple) ? root.tuple : [root.tuple];
      const results: T[] = [];

      for (const tuple of tuples) {
        const entity = tuple?.old?.[entityName];
        if (entity) {
          results.push(entity as T);
        }
      }
      return results;
    } catch (e) {
      console.error(`Error extracting ${entityName}:`, e);
      return [];
    }
  }

  // ─── 1. GetTs_candidatesObject ────────────────────────────────
  getCandidateById(candidateId: string): Observable<CordysCandidateProfile> {
    const subject = new Subject<CordysCandidateProfile>();

    this.callSoap<any>('GetTs_candidatesObject', {
      Candidate_id: candidateId
    }).subscribe({
      next: (response) => {
        const items = this.extractTuples<CordysCandidateProfile>(
          response, 'GetTs_candidatesObjectResponse', 'ts_candidates'
        );
        if (items.length > 0) {
          subject.next(items[0]);
          subject.complete();
        } else {
          subject.error('Could not parse candidate profile from response');
        }
      },
      error: (err) => subject.error(err)
    });

    return subject.asObservable();
  }

  // ─── 2. Applications: GetTs_applicationsObjectsForcandidate_id / requisition_id / current_stage_id ───
  /** Get applications for a candidate (My Applications). */
  getApplicationsForCandidate(candidateId: string): Observable<CordysApplication[]> {
    const subject = new Subject<CordysApplication[]>();

    this.callSoap<any>('GetTs_applicationsObjectsForcandidate_id', {
      Candidate_id: candidateId || ''
    }).subscribe({
      next: (response) => {
        const items = this.extractTuples<CordysApplication>(
          response, 'GetTs_applicationsObjectsForcandidate_idResponse', 'ts_applications'
        );
        subject.next(items);
        subject.complete();
      },
      error: (err) => subject.error(err)
    });

    return subject.asObservable();
  }

  /** Get applications for a job requisition. */
  getApplicationsForRequisition(requisitionId: string): Observable<CordysApplication[]> {
    const subject = new Subject<CordysApplication[]>();

    this.callSoap<any>('GetTs_applicationsObjectsForrequisition_id', {
      Requisition_id: requisitionId || ''
    }).subscribe({
      next: (response) => {
        const items = this.extractTuples<CordysApplication>(
          response, 'GetTs_applicationsObjectsForrequisition_idResponse', 'ts_applications'
        );
        subject.next(items);
        subject.complete();
      },
      error: (err) => subject.error(err)
    });

    return subject.asObservable();
  }

  /** Get applications in a given pipeline stage. */
  getApplicationsForCurrentStage(currentStageId: string): Observable<CordysApplication[]> {
    const subject = new Subject<CordysApplication[]>();

    this.callSoap<any>('GetTs_applicationsObjectsForcurrent_stage_id', {
      Current_stage_id: currentStageId || ''
    }).subscribe({
      next: (response) => {
        const items = this.extractTuples<CordysApplication>(
          response, 'GetTs_applicationsObjectsForcurrent_stage_idResponse', 'ts_applications'
        );
        subject.next(items);
        subject.complete();
      },
      error: (err) => subject.error(err)
    });

    return subject.asObservable();
  }

  // ─── 3. GetMt_pipeline_stagesObjects ──────────────────────────
  /**
   * Load pipeline stages (Applied, Interview, Offer, etc.) for stage_id → stage name conversion.
   * SOAP: cursor + fromStage_id + toStage_id (empty strings = all stages).
   */
  getPipelineStages(fromStageId = '', toStageId = ''): Observable<CordysPipelineStage[]> {
    const subject = new Subject<CordysPipelineStage[]>();

    const parameters: any = {
      cursor: {
        id: '0',
        position: '0',
        numRows: '5',
        maxRows: '99999',
        sameConnection: 'false'
      },
      fromStage_id: fromStageId,
      toStage_id: toStageId
    };

    this.callSoap<any>('GetMt_pipeline_stagesObjects', parameters).subscribe({
      next: (response) => {
        const items = this.extractTuples<CordysPipelineStage>(
          response, 'GetMt_pipeline_stagesObjectsResponse', 'mt_pipeline_stages'
        );
        subject.next(items);
        subject.complete();
      },
      error: (err) => subject.error(err)
    });

    return subject.asObservable();
  }

  /**
   * Convert stage_id → stage name (Applied, Interview, Offer, etc.) using pipeline stages.
   * Use wherever stage_id is displayed. Returns fallback when stages not loaded or id not found.
   */
  getStageName(stageId: string, pipelineStages: CordysPipelineStage[], fallback = 'Applied'): string {
    if (!stageId) return fallback;
    const stage = (pipelineStages || []).find(s => s.stage_id === stageId);
    return stage?.stage_name || fallback;
  }

  // ─── 4. Job Requisitions (GetNext / GetPrevious with cursor pagination) ───
  /** Default cursor for first page */
  createInitialJobRequisitionsCursor(numRows = 5): JobRequisitionsCursor {
    return {
      id: '0',
      position: '0',
      numRows: String(numRows),
      maxRows: '99999',
      sameConnection: 'false'
    };
  }

  private parseCursorFromResponse(resp: any, responseKey: string): JobRequisitionsCursor | null {
    try {
      const root = resp?.[responseKey] ?? resp;
      const c = root?.cursor;
      if (!c) return null;
      return {
        id: c.id ?? c['@id'] ?? '0',
        position: c.position ?? c['@position'] ?? '0',
        numRows: c.numRows ?? c['@numRows'] ?? '5',
        maxRows: c.maxRows ?? c['@maxRows'] ?? '99999',
        sameConnection: c.sameConnection ?? c['@sameConnection'] ?? 'false'
      };
    } catch {
      return null;
    }
  }

  /** Get next page of job requisitions. Use createInitialJobRequisitionsCursor() for first load. */
  getNextJobRequisitions(
    cursor: JobRequisitionsCursor,
    requisitionId = ''
  ): Observable<{ jobs: CordysJobRequisition[]; cursor: JobRequisitionsCursor | null }> {
    const subject = new Subject<{ jobs: CordysJobRequisition[]; cursor: JobRequisitionsCursor | null }>();

    const parameters: any = {
      cursor: {
        id: cursor.id,
        position: cursor.position,
        numRows: cursor.numRows,
        maxRows: cursor.maxRows,
        sameConnection: cursor.sameConnection
      },
      Requisition_id: requisitionId
    };

    this.callSoap<any>('GetNextTs_job_requisitionsObjects', parameters).subscribe({
      next: (response) => {
        const items = this.extractTuples<CordysJobRequisition>(
          response, 'GetNextTs_job_requisitionsObjectsResponse', 'ts_job_requisitions'
        );
        const nextCursor = this.parseCursorFromResponse(response, 'GetNextTs_job_requisitionsObjectsResponse');
        subject.next({ jobs: items, cursor: nextCursor });
        subject.complete();
      },
      error: (err) => subject.error(err)
    });

    return subject.asObservable();
  }

  /** Get previous page of job requisitions. */
  getPreviousJobRequisitions(
    cursor: JobRequisitionsCursor,
    requisitionId = ''
  ): Observable<{ jobs: CordysJobRequisition[]; cursor: JobRequisitionsCursor | null }> {
    const subject = new Subject<{ jobs: CordysJobRequisition[]; cursor: JobRequisitionsCursor | null }>();

    const parameters: any = {
      cursor: {
        id: cursor.id,
        position: cursor.position,
        numRows: cursor.numRows,
        maxRows: cursor.maxRows,
        sameConnection: cursor.sameConnection
      },
      Requisition_id: requisitionId
    };

    this.callSoap<any>('GetPreviousTs_job_requisitionsObjects', parameters).subscribe({
      next: (response) => {
        const items = this.extractTuples<CordysJobRequisition>(
          response, 'GetPreviousTs_job_requisitionsObjectsResponse', 'ts_job_requisitions'
        );
        const prevCursor = this.parseCursorFromResponse(response, 'GetPreviousTs_job_requisitionsObjectsResponse');
        subject.next({ jobs: items, cursor: prevCursor });
        subject.complete();
      },
      error: (err) => subject.error(err)
    });

    return subject.asObservable();
  }

  /** First page of job requisitions (for applications/dashboard to resolve job titles). */
  getJobRequisitions(): Observable<CordysJobRequisition[]> {
    const cursor = this.createInitialJobRequisitionsCursor(50);
    return this.getNextJobRequisitions(cursor, '').pipe(map(r => r.jobs));
  }

  // ─── 5. GetHs_application_stage_historyObjectsForapplication_id (Application History / Tracking)
  /** Load timeline progress history for an application. SOAP: Application_id. */
  getStageHistoryForApplication(applicationId: string): Observable<CordysStageHistory[]> {
    const subject = new Subject<CordysStageHistory[]>();

    this.callSoap<any>('GetHs_application_stage_historyObjectsForapplication_id', {
      Application_id: applicationId || ''
    }).subscribe({
      next: (response) => {
        const items = this.extractTuples<CordysStageHistory>(
          response, 'GetHs_application_stage_historyObjectsForapplication_idResponse', 'hs_application_stage_history'
        );
        subject.next(items);
        subject.complete();
      },
      error: (err) => subject.error(err)
    });

    return subject.asObservable();
  }

  // ─── 6. Interviews: GetTs_interviewsObjects + GetTs_interviewsObjectsForapplication_id ───
  /** Get interviews with cursor (fromInterview_id, toInterview_id optional). Data may be empty until DB is populated. */
  getInterviews(fromInterviewId = '', toInterviewId = ''): Observable<CordysInterview[]> {
    const subject = new Subject<CordysInterview[]>();

    const parameters: any = {
      cursor: {
        id: '0',
        position: '0',
        numRows: '5',
        maxRows: '99999',
        sameConnection: 'false'
      },
      fromInterview_id: fromInterviewId,
      toInterview_id: toInterviewId
    };

    this.callSoap<any>('GetTs_interviewsObjects', parameters).subscribe({
      next: (response) => {
        const items = this.extractTuples<CordysInterview>(
          response, 'GetTs_interviewsObjectsResponse', 'ts_interviews'
        );
        const normalized = (items || []).map(i => this.normalizeInterview(i));
        subject.next(normalized);
        subject.complete();
      },
      error: (err) => subject.error(err)
    });

    return subject.asObservable();
  }

  /** Normalize interview from API (handles meeting_link under different keys: meeting_link, meetingLink, Meeting_link). */
  private normalizeInterview(raw: any): CordysInterview {
    const meetingLink =
      (raw?.meeting_link ?? raw?.meetingLink ?? raw?.Meeting_link ?? raw?.MEETING_LINK ?? '')?.trim() || '';
    return { ...raw, meeting_link: meetingLink } as CordysInterview;
  }

  /** Get interviews for an application (GetTs_interviewsObjectsForapplication_id). */
  getInterviewsForApplication(applicationId: string): Observable<CordysInterview[]> {
    const subject = new Subject<CordysInterview[]>();

    this.callSoap<any>('GetTs_interviewsObjectsForapplication_id', {
      Application_id: applicationId || ''
    }).subscribe({
      next: (response) => {
        const items = this.extractTuples<CordysInterview>(
          response, 'GetTs_interviewsObjectsForapplication_idResponse', 'ts_interviews'
        );
        const normalized = (items || []).map(i => this.normalizeInterview(i));
        subject.next(normalized);
        subject.complete();
      },
      error: (err) => subject.error(err)
    });

    return subject.asObservable();
  }

  // ─── 7. GetTs_interview_slotsObjects ──────────────────────────
  /** Get interview slots (cursor + fromSlot_id, toSlot_id). Data may be empty until DB is populated. */
  getInterviewSlots(fromSlotId = '', toSlotId = ''): Observable<CordysInterviewSlot[]> {
    const subject = new Subject<CordysInterviewSlot[]>();

    const parameters: any = {
      cursor: {
        id: '0',
        position: '0',
        numRows: '5',
        maxRows: '99999',
        sameConnection: 'false'
      },
      fromSlot_id: fromSlotId,
      toSlot_id: toSlotId
    };

    this.callSoap<any>('GetTs_interview_slotsObjects', parameters).subscribe({
      next: (response) => {
        const items = this.extractTuples<any>(
          response, 'GetTs_interview_slotsObjectsResponse', 'ts_interview_slots'
        );
        // DB schema uses slot_date/start_time; candidate UI expects proposed_date/proposed_time and is_selected.
        const mapped: CordysInterviewSlot[] = (items || []).map((s: any) => {
          const proposed_date = s.slot_date ?? s.proposed_date ?? '';
          const proposed_time = s.start_time ?? s.proposed_time ?? '';
          const is_selected = String(s.temp1 ?? s.is_selected ?? '0');
          return {
            ...s,
            proposed_date,
            proposed_time,
            is_selected
          } as CordysInterviewSlot;
        });
        subject.next(mapped);
        subject.complete();
      },
      error: (err) => subject.error(err)
    });

    return subject.asObservable();
  }

  // ─── 7b. GetTs_interview_slot_interviewersObjects ──────────────
  /** Get slot–interviewer mappings (cursor + fromSlot_id, toSlot_id, fromUser_id, toUser_id). */
  getInterviewSlotInterviewers(
    fromSlotId = '',
    toSlotId = '',
    fromUserId = '',
    toUserId = ''
  ): Observable<CordysInterviewSlotInterviewer[]> {
    const subject = new Subject<CordysInterviewSlotInterviewer[]>();

    const parameters: any = {
      cursor: {
        id: '0',
        position: '0',
        numRows: '5',
        maxRows: '99999',
        sameConnection: 'false'
      },
      fromSlot_id: fromSlotId,
      toSlot_id: toSlotId,
      fromUser_id: fromUserId,
      toUser_id: toUserId
    };

    this.callSoap<any>('GetTs_interview_slot_interviewersObjects', parameters).subscribe({
      next: (response) => {
        const items = this.extractTuples<CordysInterviewSlotInterviewer>(
          response, 'GetTs_interview_slot_interviewersObjectsResponse', 'ts_interview_slot_interviewers'
        );
        subject.next(items || []);
        subject.complete();
      },
      error: (err) => subject.error(err)
    });

    return subject.asObservable();
  }

  // ─── 7c. GetTs_interview_feedbackObjects (Interview Feedback – optional view) ───
  /** Get interview feedback (cursor + fromFeedback_id, toFeedback_id). Show result if allowed. */
  getInterviewFeedback(fromFeedbackId = '', toFeedbackId = ''): Observable<CordysInterviewFeedback[]> {
    const subject = new Subject<CordysInterviewFeedback[]>();

    const parameters: any = {
      cursor: {
        id: '0',
        position: '0',
        numRows: '5',
        maxRows: '99999',
        sameConnection: 'false'
      },
      fromFeedback_id: fromFeedbackId,
      toFeedback_id: toFeedbackId
    };

    this.callSoap<any>('GetTs_interview_feedbackObjects', parameters).subscribe({
      next: (response) => {
        const items = this.extractTuples<CordysInterviewFeedback>(
          response, 'GetTs_interview_feedbackObjectsResponse', 'ts_interview_feedback'
        );
        subject.next(items || []);
        subject.complete();
      },
      error: (err) => subject.error(err)
    });

    return subject.asObservable();
  }

  // ─── 7d. GetTs_offersObjects (Offers – Salary, Joining date, Offer status) ───
  /** Get offers (cursor + fromOffer_id, toOffer_id). Filter by candidate_id on the client if needed. */
  getOffers(fromOfferId = '', toOfferId = ''): Observable<CordysOffer[]> {
    const subject = new Subject<CordysOffer[]>();

    const parameters: any = {
      cursor: {
        id: '0',
        position: '0',
        numRows: '5',
        maxRows: '99999',
        sameConnection: 'false'
      },
      fromOffer_id: fromOfferId,
      toOffer_id: toOfferId
    };

    this.callSoap<any>('GetTs_offersObjects', parameters).subscribe({
      next: (response) => {
        const items = this.extractTuples<any>(
          response, 'GetTs_offersObjectsResponse', 'ts_offers'
        );
        // Normalize DB column names -> candidate UI fields.
        const mapped: CordysOffer[] = (items || []).map((o: any) => {
          const salary = o.offered_salary ?? o.salary ?? '';
          const offer_status = o.status ?? o.offer_status ?? '';
          return {
            ...o,
            salary,
            offer_status,
            joining_date: o.joining_date ?? '',
            expiration_date: o.expiration_date ?? '',
            // Ensure required UI properties exist (avoid template crashes)
            created_at: o.created_at ?? '',
            created_by: o.created_by ?? '',
            updated_at: o.updated_at ?? '',
            updated_by: o.updated_by ?? '',
            temp1: o.temp1 ?? '',
            temp2: o.temp2 ?? '',
          } as CordysOffer;
        });
        subject.next(mapped);
        subject.complete();
      },
      error: (err) => subject.error(err)
    });

    return subject.asObservable();
  }

  // ─── Supporting APIs (reference data for dropdowns / mapping) ───
  /** GetMt_departmentsObjects – departments for dropdowns. */
  getDepartments(fromDepartmentId = '', toDepartmentId = ''): Observable<CordysDepartment[]> {
    const subject = new Subject<CordysDepartment[]>();

    const parameters: any = {
      cursor: {
        id: '0',
        position: '0',
        numRows: '5',
        maxRows: '99999',
        sameConnection: 'false'
      },
      fromDepartment_id: fromDepartmentId,
      toDepartment_id: toDepartmentId
    };

    this.callSoap<any>('GetMt_departmentsObjects', parameters).subscribe({
      next: (response) => {
        const items = this.extractTuples<CordysDepartment>(
          response, 'GetMt_departmentsObjectsResponse', 'mt_departments'
        );
        subject.next(items || []);
        subject.complete();
      },
      error: (err) => subject.error(err)
    });

    return subject.asObservable();
  }

  /** GetMt_skillsObjects – skills for dropdowns / mapping. */
  getSkills(fromSkillId = '', toSkillId = ''): Observable<CordysSkill[]> {
    const subject = new Subject<CordysSkill[]>();

    const parameters: any = {
      cursor: {
        id: '0',
        position: '0',
        numRows: '5',
        maxRows: '99999',
        sameConnection: 'false'
      },
      fromSkill_id: fromSkillId,
      toSkill_id: toSkillId
    };

    this.callSoap<any>('GetMt_skillsObjects', parameters).subscribe({
      next: (response) => {
        const items = this.extractTuples<CordysSkill>(
          response, 'GetMt_skillsObjectsResponse', 'mt_skills'
        );
        subject.next(items || []);
        subject.complete();
      },
      error: (err) => subject.error(err)
    });

    return subject.asObservable();
  }

  // ─── 8. GetTs_candidate_skillsObjectsForcandidate_id ──────────
  getCandidateSkills(candidateId: string): Observable<CordysCandidateSkill[]> {
    const subject = new Subject<CordysCandidateSkill[]>();

    this.callSoap<any>('GetTs_candidate_skillsObjectsForcandidate_id', {
      Candidate_id: candidateId
    }).subscribe({
      next: (response) => {
        const items = this.extractTuples<CordysCandidateSkill>(
          response, 'GetTs_candidate_skillsObjectsForcandidate_idResponse', 'ts_candidate_skills'
        );
        subject.next(items);
        subject.complete();
      },
      error: (err) => subject.error(err)
    });

    return subject.asObservable();
  }
}
