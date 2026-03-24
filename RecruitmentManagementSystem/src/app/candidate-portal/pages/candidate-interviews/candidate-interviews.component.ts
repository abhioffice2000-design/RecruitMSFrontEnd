import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  CordysService,
  CordysApplication,
  CordysInterview,
  CordysInterviewSlot,
  CordysInterviewSlotInterviewer,
  CordysInterviewFeedback,
  CordysJobRequisition,
  CordysPipelineStage
} from '../../services/cordys.service';
import { forkJoin } from 'rxjs';

interface InterviewDisplay {
  interview: CordysInterview;
  jobTitle: string;
  department: string;
  applicationId: string;
  slots: CordysInterviewSlot[];
}

@Component({
  selector: 'app-candidate-interviews',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './candidate-interviews.component.html',
  styleUrls: ['./candidate-interviews.component.scss']
})
export class CandidateInterviewsComponent implements OnInit {
  interviews: InterviewDisplay[] = [];
  allSlots: CordysInterviewSlot[] = [];
  slotInterviewersMap: Map<string, CordysInterviewSlotInterviewer[]> = new Map();
  feedbackMap: Map<string, CordysInterviewFeedback[]> = new Map();
  jobRequisitions: CordysJobRequisition[] = [];
  pipelineStages: CordysPipelineStage[] = [];

  isLoading = true;
  activeTab: 'scheduled' | 'slots' = 'scheduled';
  /** False when session has no loggedInCandidateId (same key as rest of candidate portal). */
  hasCandidateSession = true;

  constructor(private cordysService: CordysService) {}

  ngOnInit() {
    this.loadInterviews();
  }

  private loadInterviews(): void {
    const candidateId =
      sessionStorage.getItem('loggedInCandidateId') ||
      sessionStorage.getItem('candidateId') ||
      '';

    if (!candidateId) {
      this.hasCandidateSession = false;
      this.isLoading = false;
      this.interviews = [];
      return;
    }

    // Load applications, jobs, stages, slots, slot interviewers, and interview feedback (GetTs_interview_feedbackObjects)
    forkJoin({
      applications: this.cordysService.getApplicationsForCandidate(candidateId),
      jobs: this.cordysService.getJobRequisitions(),
      stages: this.cordysService.getPipelineStages(),
      slots: this.cordysService.getInterviewSlots(),
      slotInterviewers: this.cordysService.getInterviewSlotInterviewers(),
      feedbackList: this.cordysService.getInterviewFeedback()
    }).subscribe({
      next: ({ applications, jobs, stages, slots, slotInterviewers, feedbackList }) => {
        this.jobRequisitions = jobs;
        this.pipelineStages = stages;
        this.allSlots = slots;
        this.buildSlotInterviewersMap(slotInterviewers);
        this.buildFeedbackMap(feedbackList);

        if (applications.length === 0) {
          this.isLoading = false;
          return;
        }

        // For each application, fetch interviews
        const interviewObservables = applications.map(app =>
          this.cordysService.getInterviewsForApplication(app.application_id)
        );

        forkJoin(interviewObservables).subscribe({
          next: (interviewArrays) => {
            const displays: InterviewDisplay[] = [];

            interviewArrays.forEach((interviews, idx) => {
              const app = applications[idx];
              const job = jobs.find(j => j.requisition_id === app.requisition_id);

              interviews.forEach(interview => {
                // DB slots are linked to interviews via `interview.slot_id` (not via `interview_id`).
                const interviewSlot = slots.find(s => s.slot_id === (interview as any).slot_id);
                const interviewSlots: CordysInterviewSlot[] = interviewSlot
                  ? [{ ...interviewSlot, is_selected: '1' }]
                  : [];

                // Enrich interview with slot date/time so the template can render it.
                const enrichedInterview: CordysInterview = {
                  ...interview,
                  scheduled_date: interviewSlot?.slot_date || interviewSlot?.proposed_date || '',
                  scheduled_time: interviewSlot?.start_time || interviewSlot?.proposed_time || '',
                  duration_minutes: interviewSlot?.end_time && interviewSlot?.start_time ? '30' : (interview as any).duration_minutes || '30'
                };

                displays.push({
                  interview: enrichedInterview,
                  jobTitle: job?.job_title || app.requisition_id,
                  department: job?.department || '',
                  applicationId: app.application_id,
                  slots: interviewSlots
                });
              });
            });

            // Sort by scheduled date (upcoming first)
            displays.sort((a, b) =>
              new Date(a.interview.scheduled_date || '').getTime() -
              new Date(b.interview.scheduled_date || '').getTime()
            );

            this.interviews = displays;
            this.isLoading = false;
          },
          error: (err) => {
            console.error('Failed to load interviews:', err);
            this.isLoading = false;
          }
        });
      },
      error: (err) => {
        console.error('Failed to load interview data:', err);
        this.isLoading = false;
      }
    });
  }

  switchTab(tab: 'scheduled' | 'slots') {
    this.activeTab = tab;
  }

  /** Interviewer portal sets status to COMPLETED; treat common variants as finished. */
  isCompletedLike(status: string | undefined): boolean {
    const s = (status || '').toLowerCase().trim();
    return ['completed', 'complete', 'done', 'attended'].includes(s);
  }

  isCancelledLike(status: string | undefined): boolean {
    const s = (status || '').toLowerCase().trim();
    return s === 'cancelled' || s === 'canceled';
  }

  getScheduledInterviews(): InterviewDisplay[] {
    return this.interviews.filter(i => this.isScheduledLike(i.interview.status));
  }

  getCompletedInterviews(): InterviewDisplay[] {
    return this.interviews.filter(i => this.isCompletedLike(i.interview.status));
  }

  /**
   * Upcoming row: not completed/cancelled; scheduled, confirmed, or unknown (empty) still waiting.
   */
  isScheduledLike(status: string | undefined): boolean {
    if (this.isCompletedLike(status) || this.isCancelledLike(status)) {
      return false;
    }
    const s = (status || '').toLowerCase().trim();
    return s === 'scheduled' || s === 'confirmed' || s === '';
  }

  /** Single join control: link exists and interview is still open (interviewer has not marked complete). */
  showJoinMeeting(item: InterviewDisplay): boolean {
    const link = (item.interview.meeting_link || '').trim();
    return !!link && this.isScheduledLike(item.interview.status);
  }

  getStatusClass(status: string): string {
    switch ((status || '').toLowerCase()) {
      case 'scheduled': return 'status-scheduled';
      case 'confirmed': return 'status-confirmed';
      case 'completed': return 'status-completed';
      case 'cancelled': return 'status-cancelled';
      default: return 'status-default';
    }
  }

  getTypeIcon(type: string): string {
    switch ((type || '').toLowerCase()) {
      case 'technical': return 'fa-solid fa-code';
      case 'hr': return 'fa-solid fa-users';
      case 'behavioral': return 'fa-solid fa-brain';
      case 'panel': return 'fa-solid fa-people-group';
      default: return 'fa-solid fa-microphone';
    }
  }

  formatDate(dateStr: string | undefined): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  }

  getMonth(dateStr: string | undefined): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short' });
  }

  getDay(dateStr: string | undefined): string {
    if (!dateStr) return '';
    return new Date(dateStr).getDate().toString();
  }

  getDayName(dateStr: string | undefined): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' });
  }

  /** Convert stage_id → stage name (Applied, Interview, Offer, etc.) via GetMt_pipeline_stagesObjects. */
  getStageName(stageId: string): string {
    return this.cordysService.getStageName(stageId, this.pipelineStages, 'Applied');
  }

  private buildSlotInterviewersMap(list: CordysInterviewSlotInterviewer[]): void {
    this.slotInterviewersMap = new Map();
    (list || []).forEach(si => {
      const arr = this.slotInterviewersMap.get(si.slot_id) || [];
      arr.push(si);
      this.slotInterviewersMap.set(si.slot_id, arr);
    });
  }

  private buildFeedbackMap(list: CordysInterviewFeedback[]): void {
    this.feedbackMap = new Map();
    (list || []).forEach(fb => {
      const arr = this.feedbackMap.get(fb.interview_id) || [];
      arr.push(fb);
      this.feedbackMap.set(fb.interview_id, arr);
    });
  }

  /** Interview feedback for an interview (GetTs_interview_feedbackObjects – optional view). Show result if allowed. */
  getFeedbackForInterview(interviewId: string): CordysInterviewFeedback[] {
    return this.feedbackMap.get(interviewId) || [];
  }

  /** Interviewers for a slot (from GetTs_interview_slot_interviewersObjects). */
  getInterviewersForSlot(slotId: string): CordysInterviewSlotInterviewer[] {
    return this.slotInterviewersMap.get(slotId) || [];
  }

  /** All interviewers for an interview (from all its slots). */
  getInterviewersForItem(item: InterviewDisplay): CordysInterviewSlotInterviewer[] {
    const seen = new Set<string>();
    const out: CordysInterviewSlotInterviewer[] = [];
    item.slots.forEach(slot => {
      this.getInterviewersForSlot(slot.slot_id).forEach(si => {
        const key = si.user_id || si.slot_id + '-' + out.length;
        if (!seen.has(key)) {
          seen.add(key);
          out.push(si);
        }
      });
    });
    return out;
  }

  /** Display name for an interviewer (user_id or temp1 if set). */
  getInterviewerDisplayName(si: CordysInterviewSlotInterviewer): string {
    return (si.temp1 && si.temp1.trim()) ? si.temp1 : (si.user_id || 'Interviewer');
  }
}
