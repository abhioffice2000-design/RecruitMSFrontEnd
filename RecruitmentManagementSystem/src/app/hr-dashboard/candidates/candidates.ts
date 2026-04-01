import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { NotificationService } from '../../services/notification.service';
import { ToastService } from '../../services/toast.service';
import { SoapService } from '../../services/soap.service';
import { buildMailBody } from '../../services/mail-templates';
import { downloadCsvLines } from '../../shared/export/csv-export';
import { HrAddCandidateModalComponent } from './hr-add-candidate-modal.component';

/** Pipeline modal: tree layout (branching) instead of a single horizontal line */
interface PipelineTreeNodeVM {
  key: string;
  label: string;
  icon: string;
  status: 'completed' | 'current' | 'pending' | 'muted';
  clickable: boolean;
  dotItem?:
    | { kind: 'stage'; stage: { stage_id: string; stage_name: string; order: number } }
    | { kind: 'technical_round'; roundNumber: number };
}

interface PipelineTreeRowVM {
  layout: 'single' | 'fork2' | 'fork3';
  caption?: string;
  nodes: PipelineTreeNodeVM[];
}

interface CandidateRow {
  application_id: string;
  candidate_id: string;
  requisition_id: string;
  candidate_name: string;
  candidate_email: string;
  candidate_phone: string;
  experience_years: string;
  location: string;
  source: string;
  status: string;
  current_stage_id: string;
  stage_name: string;
  applied_at: string;
  cand_raw?: Record<string, string>;
  _raw: Record<string, string>;
}

@Component({
  selector: 'app-candidates',
  standalone: true,
  imports: [CommonModule, FormsModule, HrAddCandidateModalComponent],
  template: `
    <div class="dashboard-content">
      <div class="header header-with-action">
        <h2>Candidates</h2>
        <div class="header-btns">
          <button type="button" class="btn-refresh" (click)="loadData()" [disabled]="isLoading" title="Refresh candidate data">
            <i class="fas fa-sync-alt" [class.fa-spin]="isLoading"></i>
          </button>
          <button type="button" class="btn-add-candidate" (click)="showAddCandidateModal = true" title="Add candidate (resume or manual)">
            <i class="fas fa-user-plus"></i> Add candidate
          </button>
        </div>
      </div>

      <!-- Job Filter Bar -->
      <div class="filter-bar">
        <div class="filter-group">
          <label>Filter by Job:</label>
          <select [(ngModel)]="selectedJobId" (ngModelChange)="onJobChange()" class="filter-select job-select">
            <option value="ALL">All Jobs</option>
            <option *ngFor="let j of jobs" [value]="j.requisition_id">
              {{ j.title }} — {{ j.department_name }}
            </option>
          </select>
        </div>
        <div class="filter-group">
          <div class="search-wrap">
            <span class="search-icon">🔍</span>
            <input type="text" placeholder="Search name, email, skills, summary..."
                   [(ngModel)]="searchQuery" (ngModelChange)="applyFilters()"
                   class="search-input search-input-wide">
          </div>
        </div>
        <div class="filter-group">
          <label class="filter-inline-label">Skill:</label>
          <select [(ngModel)]="skillFilterId" (ngModelChange)="applyFilters()" class="filter-select">
            <option value="">All skills</option>
            <option *ngFor="let s of skills" [value]="s['skill_id']">{{ s['skill_name'] }}</option>
          </select>
        </div>
        <div class="filter-group filter-exp">
          <label class="filter-inline-label">Exp (yrs):</label>
          <input type="number" class="filter-num" min="0" max="60" placeholder="Min"
                 [(ngModel)]="experienceMin" (ngModelChange)="applyFilters()" />
          <span class="filter-dash">–</span>
          <input type="number" class="filter-num" min="0" max="60" placeholder="Max"
                 [(ngModel)]="experienceMax" (ngModelChange)="applyFilters()" />
        </div>
        <div class="filter-group">
          <select [(ngModel)]="stageFilter" (ngModelChange)="applyFilters()" class="filter-select">
            <option value="">All Stages</option>
            <option *ngFor="let s of stages" [value]="s.stage_id">{{ s.stage_name }}</option>
          </select>
        </div>
        <div class="stats-pill" *ngIf="!isLoading">
          <strong>{{ filteredCandidates.length }}</strong> candidate{{ filteredCandidates.length !== 1 ? 's' : '' }}
        </div>
        <button type="button" class="btn-export-csv" *ngIf="!isLoading && filteredCandidates.length > 0"
                (click)="exportCandidatesCsv()" title="Download filtered list as CSV">
          <i class="fas fa-file-csv"></i> Export CSV
        </button>
      </div>

      <!-- Loading -->
      <div class="loading-state" *ngIf="isLoading">
        <div class="spinner"></div>
        <p>Loading candidates...</p>
      </div>

      <!-- Tabs -->
      <div class="candidates-container" *ngIf="!isLoading">
        <div class="tabs-header">
          <button [class.active]="activeTab === 'active'" (click)="activeTab = 'active'; applyFilters()">
            Active <span class="tab-count">{{ activeCount }}</span>
          </button>
          <button [class.active]="activeTab === 'hired'" (click)="activeTab = 'hired'; applyFilters()">
            Hired <span class="tab-count">{{ hiredCount }}</span>
          </button>
          <button [class.active]="activeTab === 'rejected'" (click)="activeTab = 'rejected'; applyFilters()">
            Rejected <span class="tab-count">{{ rejectedCount }}</span>
          </button>
          <button [class.active]="activeTab === 'blacklisted'" (click)="activeTab = 'blacklisted'; applyFilters()">
            Blacklisted <span class="tab-count">{{ blacklistedCount }}</span>
          </button>
        </div>

        <!-- Table -->
        <div class="tab-content">
          <table class="candidates-table" *ngIf="filteredCandidates.length > 0">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Job Role</th>
                <th>Stage</th>
                <th>Source</th>
                <th>Applied</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let c of filteredCandidates" (click)="!isBlacklisted(c) && openProfile(c)" class="clickable-row" [class.row-disabled]="isBlacklisted(c)">
                <td>
                  <div class="candidate-cell">
                    <div class="avatar-circle">{{ getInitials(c.candidate_name) }}</div>
                    <div class="cell-text">
                      <span class="name">{{ c.candidate_name }}</span>
                      <span class="email">{{ c.candidate_email }}</span>
                    </div>
                  </div>
                </td>
                <td><span class="job-badge">{{ getJobTitle(c.requisition_id) }}</span></td>
                <td><span class="stage-badge" [attr.data-stage]="c.stage_name.toLowerCase()">{{ c.stage_name }}</span></td>
                <td><span class="source-text">{{ c.source || 'Direct' }}</span></td>
                <td><span class="date-text">{{ formatDate(c.applied_at) }}</span></td>
                <td>
                  <div class="action-btns" (click)="$event.stopPropagation()">
                    <button class="btn-view" [disabled]="isBlacklisted(c)" (click)="!isBlacklisted(c) && openProfile(c)" [title]="isBlacklisted(c) ? 'Profile disabled for blacklisted candidates' : 'View Profile'"><i class="fas fa-user"></i> Profile</button>
                    <button class="btn-pipeline" *ngIf="canOpenPipeline(c)" [disabled]="isBlacklisted(c)" (click)="!isBlacklisted(c) && openPipelineModal(c)" [title]="isBlacklisted(c) ? 'Pipeline disabled for blacklisted candidates' : 'Change Pipeline Stage'"><i class="fas fa-project-diagram"></i> Pipeline</button>
                    <span class="terminal-pill" *ngIf="!canOpenPipeline(c) && activeTab !== 'hired' && activeTab !== 'blacklisted'"><i class="fas fa-lock"></i> Closed</span>
                    <button class="btn-blacklist" *ngIf="activeTab === 'hired' && !isBlacklisted(c)" (click)="openBlacklistModal(c)"><i class="fas fa-ban"></i> Blacklist</button>
                    <span class="blacklisted-pill" *ngIf="isBlacklisted(c)"><i class="fas fa-ban"></i> Blacklisted until {{ getBlacklistExpiry(c) }}</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          <div class="empty-state" *ngIf="filteredCandidates.length === 0">
            <i class="fas fa-clipboard-list empty-icon-fa"></i>
            <h3>No candidates found</h3>
            <p>Try adjusting your filters or select a different job.</p>
          </div>
        </div>
      </div>
    </div>

    <app-hr-add-candidate-modal *ngIf="showAddCandidateModal"
      (closed)="showAddCandidateModal = false"
      (saved)="onHrCandidateSaved()"></app-hr-add-candidate-modal>

    <!-- ═══ CANDIDATE PROFILE DRAWER ═══ -->
    <div class="drawer-overlay" *ngIf="showDrawer" (click)="closeDrawer()"></div>
    <div class="drawer-panel" [class.open]="showDrawer">
      <div class="drawer-header">
        <h3><i class="fas fa-user-circle"></i> Candidate Profile</h3>
        <button class="drawer-close" (click)="closeDrawer()"><i class="fas fa-times"></i></button>
      </div>
      <div class="drawer-body" *ngIf="selectedCandidate">
        <div class="profile-hero">
          <div class="avatar-large">{{ getInitials(selectedCandidate.candidate_name) }}</div>
          <div class="profile-hero-info">
            <div class="profile-name-row">
              <h2 class="profile-name">{{ selectedCandidate.candidate_name }}</h2>
              <div class="hero-action-btns">
                <button *ngIf="selectedCandidate._raw['resume_url']"
                        class="btn-download-resume"
                        (click)="downloadResume(selectedCandidate._raw['resume_url'])"
                        title="Download Resume">
                  <i class="fas fa-file-download"></i> Download Resume
                </button>
                <button
                  class="btn-view"
                  (click)="requestDocuments(selectedCandidate)"
                  [disabled]="requestingDocs"
                  style="margin-top: 6px; font-size: 11px; padding: 4px 10px; border-radius: 4px; display: inline-flex; align-items: center; gap: 5px; width: fit-content;"
                >
                  <i class="fas" [ngClass]="requestingDocs ? 'fa-spinner fa-spin' : 'fa-paper-plane'"></i>
                  {{ requestingDocs ? 'Requesting...' : 'Request Documents' }}
                </button>
              </div>
            </div>
            <span class="profile-email">{{ selectedCandidate.candidate_email }}</span>
          </div>
        </div>

        <div class="profile-section">
          <h4>Contact</h4>
          <div class="info-grid">
            <div class="info-item"><span class="info-label"><i class="fas fa-envelope"></i> Email</span><span>{{ selectedCandidate.candidate_email }}</span></div>
            <div class="info-item"><span class="info-label"><i class="fas fa-phone"></i> Phone</span><span>{{ selectedCandidate.candidate_phone || 'N/A' }}</span></div>
            <div class="info-item"><span class="info-label"><i class="fas fa-map-marker-alt"></i> Location</span><span>{{ selectedCandidate.location || 'N/A' }}</span></div>
            <div class="info-item"><span class="info-label"><i class="fas fa-briefcase"></i> Experience</span><span>{{ selectedCandidate.experience_years || '0' }} years</span></div>
          </div>
        </div>

        <div class="profile-section">
          <h4>Application</h4>
          <div class="info-grid">
            <div class="info-item"><span class="info-label"><i class="fas fa-building"></i> Job</span><span>{{ getJobTitle(selectedCandidate.requisition_id) }}</span></div>
            <div class="info-item"><span class="info-label"><i class="fas fa-project-diagram"></i> Stage</span><span class="stage-badge" [attr.data-stage]="selectedCandidate.stage_name.toLowerCase()">{{ selectedCandidate.stage_name }}</span></div>
            <div class="info-item"><span class="info-label"><i class="fas fa-link"></i> Source</span><span>{{ selectedCandidate.source || 'Direct' }}</span></div>
            <div class="info-item"><span class="info-label"><i class="fas fa-calendar-alt"></i> Applied</span><span>{{ formatDate(selectedCandidate.applied_at) }}</span></div>
          </div>
        </div>

        <div class="profile-section">
          <h4>Skills</h4>
          <div class="skills-list" *ngIf="candidateSkills.length > 0">
            <span class="skill-chip" *ngFor="let sk of candidateSkills">
              {{ getSkillName(sk['skill_id']) }} <small>({{ sk['experience_years'] || '0' }} yrs)</small>
            </span>
          </div>
          <p class="drawer-hint" *ngIf="candidateSkills.length === 0">No skills tagged yet.</p>
          <div class="drawer-add-skill" *ngIf="selectedCandidate">
            <select class="drawer-skill-select" [(ngModel)]="drawerSkillToAdd" name="drawerSk">
              <option value="">Add skill…</option>
              <option *ngFor="let s of getAvailableSkillsForDrawer()" [value]="s['skill_id']">{{ s['skill_name'] }}</option>
            </select>
            <input type="number" class="drawer-skill-exp" min="0" max="40" [(ngModel)]="drawerSkillYears" name="drawerSkY" placeholder="yrs" />
            <button type="button" class="btn-view" (click)="addSkillToCandidate()" [disabled]="drawerSkillSaving || !drawerSkillToAdd">
              <i class="fas" [ngClass]="drawerSkillSaving ? 'fa-spinner fa-spin' : 'fa-plus'"></i> Add
            </button>
          </div>
        </div>

        <div class="profile-section" *ngIf="selectedCandidate && selectedCandidate.status === 'HIRED'">
          <h4>Mandatory Documents</h4>
          <div class="documents-list" *ngIf="!fetchingDocuments && candidateDocuments.length > 0">
            <div class="doc-item" *ngFor="let doc of candidateDocuments">
              <div class="doc-info">
                <i class="fas fa-file-alt doc-icon"></i>
                <span class="doc-type">{{ doc.document_type || 'Unknown Document' }}</span>
              </div>
              <button class="btn-download-doc" (click)="downloadCandidateDoc(doc)" title="Download/View">
                <i class="fas fa-download"></i>
              </button>
            </div>
          </div>
          <div class="drawer-hint" *ngIf="fetchingDocuments"><i class="fas fa-spinner fa-spin"></i> Fetching documents...</div>
          <p class="drawer-hint" *ngIf="!fetchingDocuments && candidateDocuments.length === 0">No documents uploaded yet.</p>
        </div>

        <div class="drawer-actions">
          <button class="btn-pipeline-lg" *ngIf="selectedCandidate && canOpenPipeline(selectedCandidate)" (click)="openPipelineModal(selectedCandidate)"><i class="fas fa-project-diagram"></i> Change Pipeline Stage</button>
          <div class="terminal-note" *ngIf="selectedCandidate && !canOpenPipeline(selectedCandidate)">
            <i class="fas fa-lock"></i> Pipeline is locked because this application is {{ selectedCandidate.status }}.
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ INLINE PIPELINE MODAL ═══ -->
    <div class="modal-overlay" *ngIf="showPipelineModal" (click)="closePipelineModal()">
      <div class="modal-card pipeline-modal" (click)="$event.stopPropagation()">
        <div class="modal-header pipeline-modal-header">
          <h3><i class="fas fa-route"></i> Pipeline <span class="pipeline-modal-sub">/ {{ pipelineCandidate?.candidate_name }}</span></h3>
          <button class="modal-close pipeline-modal-close" type="button" (click)="closePipelineModal()" aria-label="Close"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body pipeline-modal-body" *ngIf="pipelineCandidate">
          <div class="pipeline-info-row pipeline-info-card">
            <div class="pipeline-avatar">{{ getInitials(pipelineCandidate.candidate_name) }}</div>
            <div class="pipeline-info-text">
              <span class="pipeline-cand-name">{{ pipelineCandidate.candidate_name }}</span>
              <span class="pipeline-job-name"><i class="fas fa-briefcase"></i> {{ getJobTitle(pipelineCandidate.requisition_id) }}</span>
            </div>
          </div>

          <div class="pipeline-feedback-panel" *ngIf="pipelineInterviewFeedback.length > 0">
            <h4 class="pipeline-feedback-title"><i class="fas fa-clipboard-check"></i> Interviewer feedback</h4>
            <div class="pipeline-feedback-block" *ngFor="let block of pipelineInterviewFeedback">
              <div class="pipeline-feedback-block-head">
                {{ block.label }} <span class="fb-id">#{{ block.interview_id }}</span>
                <span class="fb-score" *ngIf="block.weightedAvg10">
                  Score <strong>{{ block.weightedAvg10 }}</strong>/10
                </span>
              </div>
              <div class="pipeline-feedback-row" *ngFor="let r of block.rows">
                <div class="fb-who"><i class="fas fa-user-tie"></i> {{ r.interviewerName }}</div>
                <div class="fb-meta">
                  <span class="fb-rating" *ngIf="r.weighted"><i class="fas fa-star"></i> {{ r.weighted }}/10</span>
                  <span class="fb-rec" *ngIf="r.recommendation">{{ r.recommendation }}</span>
                </div>
                <div class="fb-breakdown" *ngIf="r.technical || r.aptitude || r.communication || r.culture">
                  <span *ngIf="r.technical"><strong>T</strong>: {{ r.technical }}</span>
                  <span *ngIf="r.aptitude"><strong>A</strong>: {{ r.aptitude }}</span>
                  <span *ngIf="r.communication"><strong>C</strong>: {{ r.communication }}</span>
                  <span *ngIf="r.culture"><strong>Cu</strong>: {{ r.culture }}</span>
                </div>
                <p class="fb-comments" *ngIf="r.comments">{{ r.comments }}</p>
              </div>
            </div>
          </div>

          <div class="pipeline-stages">
            <div class="pipeline-journey-head">
              <div class="pipeline-journey-title">
                <span class="pj-label">Candidate journey</span>
                <span class="pj-flow"><i class="fas fa-long-arrow-alt-right"></i> Read left to right</span>
              </div>
              <div class="pipeline-legend" aria-hidden="true">
                <span class="pl-legend-item"><i class="pl-dot pl-dot--done"></i> Done</span>
                <span class="pl-legend-item"><i class="pl-dot pl-dot--current"></i> Current</span>
                <span class="pl-legend-item"><i class="pl-dot pl-dot--next"></i> Next</span>
              </div>
            </div>
            <p class="pipeline-tree-hint">
              <i class="fas fa-info-circle"></i>
              Tap a <strong>stage</strong> to queue a move (confirm below). <strong>Reject</strong> stops the process.
            </p>
            <div class="pipeline-tree-outer">
              <div class="pipeline-tree pipeline-tree--horizontal">
                <ng-container *ngFor="let row of pipelineTreeRows; let ri = index">
                  <div class="tree-connector-h" *ngIf="ri > 0" aria-hidden="true">
                    <span class="tree-connector-line"></span>
                  </div>
                  <div class="tree-segment pipeline-step"
                       [class.tree-segment--single]="row.layout === 'single'"
                       [class.tree-segment--fork2]="row.layout === 'fork2'"
                       [class.tree-segment--fork3]="row.layout === 'fork3'"
                       [class.pipeline-step--fork]="row.layout === 'fork2' || row.layout === 'fork3'">
                    <div class="tree-caption" *ngIf="row.caption">{{ row.caption }}</div>
                    <div class="tree-row"
                         [class.tree-row--single]="row.layout === 'single'"
                         [class.tree-row--fork2]="row.layout === 'fork2'"
                         [class.tree-row--fork3]="row.layout === 'fork3'">
                      <div class="tree-node-wrap"
                           *ngFor="let n of row.nodes"
                           [class.completed]="n.status === 'completed'"
                           [class.current]="n.status === 'current'"
                           [class.pending]="n.status === 'pending'"
                           [class.muted]="n.status === 'muted'"
                           [class.clickable]="n.clickable"
                           [class.node-reject]="n.key === 'st-rejected' || n.key === 'rej-end'"
                           (click)="onPipelineTreeNodeClick(n)">
                        <div class="tree-node-visual">
                          <div class="tree-node-ring" *ngIf="n.status === 'current'"></div>
                          <div class="tree-node-circle">
                            <i class="fas" [ngClass]="n.icon"></i>
                          </div>
                        </div>
                        <span class="tree-node-label">{{ n.label }}</span>
                      </div>
                    </div>
                  </div>
                </ng-container>
              </div>
            </div>
          </div>

          <!-- ─── BPM Workflow Actions (Screening only - MVP) ─── -->
          <div class="workflow-actions"
               *ngIf="pipelineCandidate && pipelineCandidate.stage_name && pipelineCandidate.stage_name.toLowerCase().includes('screening')">
            <div class="workflow-title">Take Actions</div>
            <div class="workflow-btns">
              <button class="btn-confirm-sm" (click)="openScreeningApproveForm()" [disabled]="isStageMoveInProgress">
                <i class="fas fa-check"></i> Shortlist
              </button>
              <button class="btn-reject-sm" (click)="rejectScreening()" [disabled]="isStageMoveInProgress">
                <i class="fas fa-times"></i> Reject
              </button>
            </div>
          </div>

          <!-- Screening -> create Technical Round 1 -->
          <div class="screening-form card"
               *ngIf="showScreeningApproveForm && pipelineCandidate">
            <div class="screening-form-header">
              <h4><i class="fas fa-user-check"></i> Shortlist & Schedule Round 1</h4>
              <button class="btn-cancel-sm" (click)="closeScreeningApproveForm()">
                <i class="fas fa-times"></i> Cancel
              </button>
            </div>

            <div class="form-row">
              <label>First Interviewer (U1) <span class="req">*</span></label>
              <select class="form-input" [(ngModel)]="screeningFirstInterviewerId"
                      (ngModelChange)="onScreeningFirstInterviewerChange()">
                <option value="" disabled>Select interviewer</option>
                <option *ngFor="let u of technicalInterviewers" [value]="u['user_id']">
                  {{ u['first_name'] }} {{ u['last_name'] }}
                </option>
              </select>
            </div>

            <div class="form-row">
              <label>Interview date <span class="req">*</span></label>
              <input type="date" class="form-input" [(ngModel)]="screeningDate"
                     [min]="minScheduleDateISO"
                     (change)="onScreeningDateChange()" />
              <div class="hint">Must be tomorrow or later.</div>
            </div>

            <div class="form-row">
              <label>Meeting link <span class="req">*</span></label>
              <input type="url" class="form-input" [(ngModel)]="screeningMeetingLink"
                     placeholder="https://teams.microsoft.com/l/meetup-join/..." autocomplete="off" />
              <div class="hint">Teams, Google Meet, or Zoom — required to schedule.</div>
            </div>

            <div class="form-row">
              <label>Choose Slot <span class="req">*</span></label>
              <select class="form-input" [(ngModel)]="screeningSelectedSlotId"
                      (ngModelChange)="onScreeningSlotChange()">
                <option value="" disabled>Select slot</option>
                <option *ngFor="let s of screeningSlots" [value]="s['slot_id']">
                  {{ s['start_time'] }} - {{ s['end_time'] }}
                </option>
              </select>
              <div class="hint" *ngIf="screeningSlots.length === 0">
                No slots available for selected interviewer/date.
              </div>
            </div>

            <div class="form-row" *ngIf="screeningAvailableAdditionalInterviewers.length > 0">
              <label>Optional Additional Interviewers (0..N)</label>
              <div class="checkbox-list">
                <label class="checkbox-item" *ngFor="let u of screeningAvailableAdditionalInterviewers">
                  <input type="checkbox"
                         [checked]="screeningSelectedAdditionalInterviewerIds[u['user_id']]"
                         (change)="toggleScreeningAdditionalInterviewer(u['user_id'], $any($event.target).checked)" />
                  {{ u['first_name'] }} {{ u['last_name'] }}
                </label>
              </div>
            </div>

            <div class="screening-actions">
              <button class="btn-confirm-sm"
                      (click)="confirmScreeningApprove()"
                      [disabled]="screeningIsSubmitting || !screeningSchedulingReady()">
                <i class="fas" [ngClass]="screeningIsSubmitting ? 'fa-spinner fa-spin' : 'fa-check'"></i>
                {{ screeningIsSubmitting ? 'Creating...' : 'Confirm' }}
              </button>
            </div>
          </div>

          <!-- ─── Technical Round Loop (BPM-driven) ─── -->
          <div class="workflow-actions"
               *ngIf="pipelineCandidate
                 && pipelineCandidate.stage_name
                 && pipelineCandidate.stage_name.toLowerCase().includes('interview')
                 && !hrInterviewRoundNumber
                 && !showTechnicalNextRoundForm
                 && !showStopTechnicalForm
                 && !showHrInterviewForm">
            <div class="workflow-title">Technical Round Decision</div>

            <div class="hint" *ngIf="isTechnicalFeedbackChecking">Checking compulsory feedback...</div>

            <div class="form-row" *ngIf="!isTechnicalFeedbackChecking && latestTechnicalRoundNumber">
              <div class="hint" style="margin: 0 0 10px;">
                Latest Technical Round: <strong>{{ latestTechnicalRoundNumber }}</strong>
              </div>
              <div class="hint" *ngIf="!latestTechnicalFeedbackComplete">
                Waiting for feedback from all assigned interviewers.
              </div>
              <div class="hint" *ngIf="latestTechnicalFeedbackComplete">
                Feedback complete. You can proceed.
              </div>
            </div>

            <div class="workflow-btns" *ngIf="!isTechnicalFeedbackChecking && latestTechnicalRoundNumber">
              <button class="btn-confirm-sm"
                      (click)="openTechnicalNextRoundForm()"
                      [disabled]="!latestTechnicalFeedbackComplete || technicalNextRoundIsSubmitting">
                <i class="fas fa-plus"></i> Next Technical Interview
              </button>
              <button class="btn-reject-sm"
                      (click)="openStopTechnicalForm()"
                      [disabled]="!latestTechnicalFeedbackComplete || technicalNextRoundIsSubmitting">
                <i class="fas fa-stop-circle"></i> Stop Technical
              </button>
            </div>

            <div class="hint" *ngIf="!isTechnicalFeedbackChecking && !latestTechnicalRoundNumber">
              No technical rounds found yet.
            </div>
          </div>

          <!-- ─── Stop Technical Choices ─── -->
          <div class="screening-form card" *ngIf="showStopTechnicalForm">
            <div class="screening-form-header">
              <h4><i class="fas fa-stop-circle"></i> Stop Technical</h4>
              <button class="btn-cancel-sm" (click)="closeStopTechnicalForm()">
                <i class="fas fa-times"></i> Close
              </button>
            </div>

            <div class="hint" style="margin-bottom: 12px;">
              Do you want to schedule an optional HR interview?
            </div>

            <div class="screening-actions">
              <button class="btn-reject-sm" (click)="moveToOfferDirect()" [disabled]="technicalNextRoundIsSubmitting">
                <i class="fas fa-handshake"></i> Move to Offer
              </button>
              <button class="btn-confirm-sm" (click)="openHrInterviewForm()" [disabled]="technicalNextRoundIsSubmitting">
                <i class="fas fa-user"></i> Create HR Interview
              </button>
            </div>
          </div>

          <!-- ─── Next Technical Round Scheduling ─── -->
          <div class="screening-form card" *ngIf="showTechnicalNextRoundForm && pipelineCandidate">
            <div class="screening-form-header">
              <h4><i class="fas fa-user-check"></i> Create Technical Round {{ technicalNextRoundNumber }}</h4>
              <button class="btn-cancel-sm" (click)="closeTechnicalNextRoundForm()">
                <i class="fas fa-times"></i> Cancel
              </button>
            </div>

            <div class="form-row">
              <label>First Interviewer (U1) <span class="req">*</span></label>
              <select class="form-input"
                      [(ngModel)]="technicalNextFirstInterviewerId"
                      (ngModelChange)="onTechnicalNextFirstInterviewerChange()">
                <option value="" disabled>Select interviewer</option>
                <option *ngFor="let u of technicalInterviewers" [value]="u['user_id']">
                  {{ u['first_name'] }} {{ u['last_name'] }}
                </option>
              </select>
            </div>

            <div class="form-row">
              <label>Interview date <span class="req">*</span></label>
              <input type="date"
                     class="form-input"
                     [min]="minScheduleDateISO"
                     [(ngModel)]="technicalNextDate"
                     (change)="onTechnicalNextDateChange()" />
              <div class="hint">Must be tomorrow or later.</div>
            </div>

            <div class="form-row">
              <label>Meeting link <span class="req">*</span></label>
              <input type="url" class="form-input" [(ngModel)]="technicalNextMeetingLink"
                     placeholder="https://meet.google.com/..." autocomplete="off" />
              <div class="hint">Required — shared with candidate and interviewers.</div>
            </div>

            <div class="form-row">
              <label>Choose Slot <span class="req">*</span></label>
              <select class="form-input"
                      [(ngModel)]="technicalNextSelectedSlotId"
                      (ngModelChange)="onTechnicalNextSlotChange()">
                <option value="" disabled>Select slot</option>
                <option *ngFor="let s of technicalNextSlots" [value]="s['slot_id']">
                  {{ s['start_time'] }} - {{ s['end_time'] }}
                </option>
              </select>
              <div class="hint" *ngIf="technicalNextSlots.length === 0">
                No slots available for selected interviewer/date.
              </div>
            </div>

            <div class="form-row" *ngIf="technicalNextAvailableAdditionalInterviewers.length > 0">
              <label>Optional Additional Interviewers (0..N)</label>
              <div class="checkbox-list">
                <label class="checkbox-item" *ngFor="let u of technicalNextAvailableAdditionalInterviewers">
                  <input type="checkbox"
                         [checked]="technicalNextSelectedAdditionalInterviewerIds[u['user_id']]"
                         (change)="toggleTechnicalNextAdditionalInterviewer(u['user_id'], $any($event.target).checked)" />
                  {{ u['first_name'] }} {{ u['last_name'] }}
                </label>
              </div>
            </div>

            <div class="screening-actions">
              <button class="btn-confirm-sm"
                      (click)="confirmTechnicalNextRound()"
                      [disabled]="technicalNextRoundIsSubmitting || !technicalNextSchedulingReady()">
                <i class="fas" [ngClass]="technicalNextRoundIsSubmitting ? 'fa-spinner fa-spin' : 'fa-check'"></i>
                {{ technicalNextRoundIsSubmitting ? 'Creating...' : 'Confirm' }}
              </button>
            </div>
          </div>

          <!-- ─── HR Interview Scheduling (single interviewer) ─── -->
          <div class="screening-form card" *ngIf="showHrInterviewForm && pipelineCandidate">
            <div class="screening-form-header">
              <h4><i class="fas fa-user-check"></i> Schedule HR Interview</h4>
              <button class="btn-cancel-sm" (click)="closeHrInterviewForm()">
                <i class="fas fa-times"></i> Cancel
              </button>
            </div>

            <div class="form-row">
              <label>HR Interviewer (U1) <span class="req">*</span></label>
              <select class="form-input"
                      [(ngModel)]="hrInterviewFirstInterviewerId"
                      (ngModelChange)="onHrInterviewFirstInterviewerChange()">
                <option value="" disabled>Select interviewer</option>
                <option *ngFor="let u of technicalInterviewers" [value]="u['user_id']">
                  {{ u['first_name'] }} {{ u['last_name'] }}
                </option>
              </select>
            </div>

            <div class="form-row">
              <label>Interview date <span class="req">*</span></label>
              <input type="date"
                     class="form-input"
                     [min]="minScheduleDateISO"
                     [(ngModel)]="hrInterviewDate"
                     (change)="onHrInterviewDateChange()" />
              <div class="hint">Must be tomorrow or later.</div>
            </div>

            <div class="form-row">
              <label>Meeting link <span class="req">*</span></label>
              <input type="url" class="form-input" [(ngModel)]="hrInterviewMeetingLink"
                     placeholder="https://..." autocomplete="off" />
              <div class="hint">Required — HR and candidate use this to join.</div>
            </div>

            <div class="form-row">
              <label>Choose Slot <span class="req">*</span></label>
              <select class="form-input"
                      [(ngModel)]="hrInterviewSelectedSlotId"
                      (ngModelChange)="onHrInterviewSlotChange()">
                <option value="" disabled>Select slot</option>
                <option *ngFor="let s of hrInterviewSlots" [value]="s['slot_id']">
                  {{ s['start_time'] }} - {{ s['end_time'] }}
                </option>
              </select>
            </div>

            <div class="screening-actions">
              <button class="btn-confirm-sm"
                      (click)="confirmHrInterviewCreate()"
                      [disabled]="hrInterviewIsSubmitting || !hrInterviewSchedulingReady()">
                <i class="fas" [ngClass]="hrInterviewIsSubmitting ? 'fa-spinner fa-spin' : 'fa-check'"></i>
                {{ hrInterviewIsSubmitting ? 'Creating...' : 'Confirm' }}
              </button>
            </div>
          </div>

          <!-- ─── HR Interview Decision ─── -->
          <div class="workflow-actions"
               *ngIf="pipelineCandidate
                 && pipelineCandidate.stage_name
                 && pipelineCandidate.stage_name.toLowerCase().includes('interview')
                 && hrInterviewRoundNumber
                 && !showHrInterviewForm
                 && !showTechnicalNextRoundForm
                 && !showStopTechnicalForm">
            <div class="workflow-title">HR Interview Decision</div>

            <div class="hint" style="margin-bottom: 10px;">
              HR Interview Round: <strong>{{ hrInterviewRoundNumber }}</strong>
            </div>

            <div class="hint" *ngIf="isHrInterviewFeedbackChecking">Checking compulsory HR feedback...</div>

            <div class="workflow-btns" *ngIf="!isHrInterviewFeedbackChecking">
              <button class="btn-confirm-sm"
                      (click)="confirmHrInterviewPass()"
                      [disabled]="!hrInterviewFeedbackComplete || hrInterviewIsSubmitting">
                <i class="fas fa-check"></i> Pass -> Offer
              </button>
              <button class="btn-reject-sm"
                      (click)="confirmHrInterviewFail()"
                      [disabled]="!hrInterviewFeedbackComplete || hrInterviewIsSubmitting">
                <i class="fas fa-times"></i> Fail -> Reject
              </button>
            </div>

            <div class="hint" *ngIf="!hrInterviewFeedbackComplete && !isHrInterviewFeedbackChecking" style="margin-top: 10px;">
              Waiting for HR interview feedback from the assigned interviewer.
            </div>
          </div>

          <!-- ─── Argued Offer Resolution (BPM-driven) ─── -->
          <div class="workflow-actions"
               *ngIf="pipelineCandidate
                 && pipelineCandidate.stage_name
                 && (pipelineCandidate.stage_name.toLowerCase().includes('hold') || pipelineCandidate.stage_name.toLowerCase().includes('argued') || pipelineCandidate.stage_name.toLowerCase().includes('negotiat'))
                 && !isArgueResolving">
            <div class="workflow-title">Resolve Argued Offer</div>
            <div class="hint" style="margin-bottom: 10px;">
              Candidate negotiated this offer. Finalize outcome for application
              <strong>{{ pipelineCandidate.application_id }}</strong>.
            </div>
            <div class="workflow-btns">
              <button class="btn-confirm-sm" (click)="confirmArgueResolution('APPROVED')" [disabled]="isStageMoveInProgress">
                <i class="fas fa-check-circle"></i> Approve + Hire
              </button>
              <button class="btn-reject-sm" (click)="confirmArgueResolution('REJECTED')" [disabled]="isStageMoveInProgress">
                <i class="fas fa-times-circle"></i> Reject
              </button>
            </div>
          </div>

          <div class="workflow-actions"
               *ngIf="pipelineCandidate
                 && pipelineCandidate.stage_name
                 && (pipelineCandidate.stage_name.toLowerCase().includes('hold') || pipelineCandidate.stage_name.toLowerCase().includes('argued') || pipelineCandidate.stage_name.toLowerCase().includes('negotiat'))
                 && isArgueResolving">
            <div class="workflow-title">Resolving...</div>
            <div class="hint">Final decision in progress.</div>
          </div>

          <div class="workflow-actions readonly-workflow"
               *ngIf="pipelineCandidate && isTerminalStatus(pipelineCandidate.status)">
            <div class="workflow-title">Pipeline Locked</div>
            <div class="hint">This application is in terminal state (<strong>{{ pipelineCandidate.status }}</strong>). Further stage moves are disabled.</div>
          </div>

          <div class="pipeline-confirm" *ngIf="pendingStageMove">
            <div class="confirm-text">
              Move from <strong>{{ pipelineCandidate.stage_name }}</strong>
              <i class="fas fa-arrow-right"></i>
              <strong>{{ pendingStageMove.stage_name }}</strong>?
            </div>
            <div class="confirm-btns">
              <button class="btn-cancel-sm" (click)="pendingStageMove = null"><i class="fas fa-times"></i> Cancel</button>
              <button class="btn-confirm-sm" (click)="confirmStageMove()" [disabled]="isStageMoveInProgress">
                <i class="fas" [ngClass]="isStageMoveInProgress ? 'fa-spinner fa-spin' : 'fa-check'"></i>
                {{ isStageMoveInProgress ? 'Moving...' : 'Confirm' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ BLACKLIST MODAL ═══ -->
    <div class="modal-overlay" *ngIf="showBlacklistModal" (click)="closeBlacklistModal()">
      <div class="modal-card blacklist-modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3><i class="fas fa-ban" style="color:#dc2626;margin-right:8px"></i> Blacklist Candidate</h3>
          <button class="modal-close" type="button" (click)="closeBlacklistModal()" aria-label="Close"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body" *ngIf="blacklistTarget">
          <div class="blacklist-info">
            <div class="avatar-circle">{{ getInitials(blacklistTarget.candidate_name) }}</div>
            <div class="blacklist-info-text">
              <span class="name">{{ blacklistTarget.candidate_name }}</span>
              <span class="email">{{ blacklistTarget.candidate_email }}</span>
            </div>
          </div>

          <div class="form-row">
            <label>Blacklist Duration <span class="req">*</span></label>
            <div class="blacklist-duration-options">
              <button type="button" [class.selected]="blacklistDuration === 3" (click)="blacklistDuration = 3" class="duration-btn">
                <i class="fas fa-calendar-alt"></i> 3 Months
              </button>
              <button type="button" [class.selected]="blacklistDuration === 6" (click)="blacklistDuration = 6" class="duration-btn">
                <i class="fas fa-calendar-alt"></i> 6 Months
              </button>
              <button type="button" [class.selected]="blacklistDuration === 12" (click)="blacklistDuration = 12" class="duration-btn">
                <i class="fas fa-calendar-alt"></i> 1 Year
              </button>
              <button type="button" [class.selected]="blacklistDuration === 'FOREVER'" (click)="blacklistDuration = 'FOREVER'" class="duration-btn duration-btn--forever">
                <i class="fas fa-infinity"></i> Forever
              </button>
            </div>
          </div>

          <div class="form-row">
            <label>Reason</label>
            <input type="text" class="form-input" [(ngModel)]="blacklistReason" placeholder="Hired but did not join" />
          </div>

          <div class="blacklist-actions">
            <button class="btn-cancel-sm" (click)="closeBlacklistModal()"><i class="fas fa-times"></i> Cancel</button>
            <button class="btn-blacklist-confirm" (click)="confirmBlacklist()" [disabled]="isBlacklisting || !blacklistDuration">
              <i class="fas" [ngClass]="isBlacklisting ? 'fa-spinner fa-spin' : 'fa-ban'"></i>
              {{ isBlacklisting ? 'Blacklisting...' : 'Confirm Blacklist' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['../../hr-dashboard/hr-dashboard.scss'],
  styles: [`
    .header-with-action {
      display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;
      margin-bottom: 4px;
    }
    .header-btns {
      display: flex; gap: 8px; align-items: center;
    }
    .btn-refresh {
      padding: 10px; border-radius: 10px; border: 1px solid #e2e8f0; background: #fff; color: #64748b;
      cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
      transition: all 0.2s;
      &:hover { background: #f8fafc; color: #2563eb; border-color: #cbd5e1; }
      &:disabled { opacity: 0.6; cursor: not-allowed; }
    }
    .btn-add-candidate {
      padding: 10px 16px; border-radius: 10px; border: none; background: #2563eb; color: #fff;
      font-weight: 600; font-size: 14px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px;
      box-shadow: 0 2px 8px rgba(37, 99, 235, 0.25);
      &:hover { background: #1d4ed8; }
    }
    /* ── Filter Bar ── */
    .filter-bar {
      display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap;
      background: #fff; padding: 12px 18px; border-radius: 12px;
      border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(26, 58, 122, 0.06);
    }
    .filter-inline-label { font-size: 12px; font-weight: 600; color: #64748b; white-space: nowrap; }
    .filter-num { width: 64px; padding: 8px 10px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 13px; }
    .filter-exp { flex-wrap: wrap; }
    .filter-dash { color: #94a3b8; font-weight: 600; }
    .search-input-wide { width: min(280px, 42vw); }
    .filter-group { display: flex; align-items: center; gap: 8px;
      label { font-weight: 600; font-size: 13px; color: #475569; white-space: nowrap; }
    }
    .filter-select { padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; outline: none; cursor: pointer; &:focus { border-color: #2563eb; } }
    .job-select { min-width: 260px; }
    .search-wrap { position: relative;
      .search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); font-size: 14px; color: #64748b; }
      .search-input { padding: 10px 16px 10px 36px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; width: 220px; outline: none; &:focus { border-color: #2563eb; } }
    }
    .stats-pill { margin-left: auto; padding: 6px 14px; background: #eff6ff; color: #2563eb; border-radius: 20px; font-size: 13px; font-weight: 600; white-space: nowrap; }
    .btn-export-csv {
      padding: 8px 14px; border-radius: 8px; border: 1px solid #cbd5e1; background: #fff;
      font-size: 13px; font-weight: 600; color: #334155; cursor: pointer;
      display: inline-flex; align-items: center; gap: 8px;
      &:hover { background: #f8fafc; border-color: #94a3b8; }
    }

    /* ── Loading ── */
    .loading-state { display: flex; flex-direction: column; align-items: center; padding: 48px 24px; color: #94a3b8;
      .spinner { width: 36px; height: 36px; border: 3px solid #e2e8f0; border-top-color: #2563eb; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 12px; }
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Container ── */
    .candidates-container {
      background: #fff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; overflow: hidden;
    }
    .tabs-header {
      display: flex; border-bottom: 1px solid #e2e8f0; background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%); padding: 0 20px;
      button { background: none; border: none; padding: 14px 18px; font-size: 14px; font-weight: 600; color: #64748b; cursor: pointer; position: relative; transition: all 0.2s; display: flex; align-items: center; gap: 8px;
        &:hover { color: #1e293b; }
        &.active { color: #2563eb;
          &::after { content: ''; position: absolute; bottom: -1px; left: 0; width: 100%; height: 3px; background: #2563eb; border-radius: 3px 3px 0 0; }
        }
        .tab-count { padding: 2px 8px; background: #e2e8f0; border-radius: 10px; font-size: 11px; }
        &.active .tab-count { background: #dbeafe; color: #2563eb; }
      }
    }
    .tab-content { padding: 0; }

    /* ── Table ── */
    .candidates-table { width: 100%; border-collapse: collapse;
      th { text-align: left; padding: 14px 16px; color: #64748b; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; }
      td { padding: 14px 16px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; font-size: 14px; }
      .clickable-row { cursor: pointer; transition: background 0.15s; &:hover td { background: #f0f9ff; } }
    }
    .candidate-cell { display: flex; align-items: center; gap: 12px; }
    .avatar-circle { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #2563eb, #1a3a7a); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; flex-shrink: 0; }
    .cell-text { display: flex; flex-direction: column;
      .name { font-weight: 600; color: #1e293b; }
      .email { font-size: 12px; color: #94a3b8; }
    }
    .job-badge { padding: 4px 10px; background: #f1f5f9; border-radius: 6px; font-size: 13px; font-weight: 500; color: #475569; }
    .stage-badge { padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; background: #e2e8f0; color: #475569;
      &[data-stage="applied"] { background: #dbeafe; color: #1e40af; }
      &[data-stage="screening"] { background: #fef3c7; color: #92400e; }
      &[data-stage="interview"] { background: #ede9fe; color: #5b21b6; }
      &[data-stage="offer"] { background: #d1fae5; color: #065f46; }
      &[data-stage="hired"] { background: #dcfce7; color: #166534; }
    }
    .source-text { font-size: 13px; color: #64748b; }
    .date-text { font-size: 13px; color: #64748b; }
    .action-btns { display: flex; gap: 6px; }
    .btn-view { padding: 6px 12px; border: 1px solid #2563eb; background: #fff; color: #2563eb; border-radius: 6px; font-weight: 600; font-size: 12px; cursor: pointer; &:hover:not(:disabled) { background: #2563eb; color: #fff; } &:disabled { opacity: 0.5; cursor: not-allowed; border-color: #cbd5e1; color: #94a3b8; } }
    .btn-pipeline { padding: 6px 12px; border: 1px solid #10b981; background: #fff; color: #10b981; border-radius: 6px; font-weight: 600; font-size: 12px; cursor: pointer; &:hover:not(:disabled) { background: #10b981; color: #fff; } &:disabled { opacity: 0.5; cursor: not-allowed; border-color: #cbd5e1; color: #94a3b8; } }
    .terminal-pill { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0; }

    /* ── Empty State ── */
    .empty-state { text-align: center; padding: 60px 20px;
      .empty-icon { font-size: 48px; margin-bottom: 12px; }
      h3 { color: #475569; margin: 0 0 8px; }
      p { color: #94a3b8; font-size: 14px; margin: 0; }
    }

    /* ── DRAWER ── */
    .drawer-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.4); z-index: 900; animation: fadeIn 0.2s; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .drawer-panel { position: fixed; top: 0; right: -480px; width: 460px; height: 100vh; background: #fff; z-index: 1000; box-shadow: -4px 0 20px rgba(0,0,0,0.12); transition: right 0.3s ease; overflow-y: auto;
      &.open { right: 0; }
    }
    .drawer-header { padding: 20px 24px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; background: #fff; z-index: 1;
      h3 { margin: 0; font-size: 18px; color: #1e293b; }
      .drawer-close { background: none; border: none; font-size: 22px; cursor: pointer; color: #64748b; padding: 4px; &:hover { color: #ef4444; } }
    }
    .drawer-body { padding: 24px; }
    .profile-hero { display: flex; align-items: center; gap: 16px; margin-bottom: 28px; }
    .profile-hero-info { flex: 1; min-width: 0; }
    .profile-name-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 4px; flex-wrap: wrap; }
    .hero-action-btns { display: flex; flex-direction: column; gap: 4px; align-items: flex-end; }
    .avatar-large { width: 64px; height: 64px; border-radius: 50%; background: linear-gradient(135deg, #2563eb, #1a3a7a); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 22px; flex-shrink: 0; }
    .profile-name { margin: 0; font-size: 20px; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .btn-download-resume {
      padding: 6px 12px;
      border-radius: 8px;
      border: 1px solid #2563eb;
      background: #eff6ff;
      color: #2563eb;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
      white-space: nowrap;
      &:hover { background: #2563eb; color: #fff; transform: translateY(-1px); box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2); }
      &:active { transform: translateY(0); }
      i { font-size: 14px; }
    }
    .profile-email { font-size: 14px; color: #64748b; }
    .profile-section { margin-bottom: 24px;
      h4 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; margin: 0 0 12px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; }
    }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .info-item { display: flex; flex-direction: column; gap: 2px;
      .info-label { font-size: 12px; color: #94a3b8; }
      span:last-child { font-size: 14px; color: #1e293b; font-weight: 500; }
    }
    .skills-list { display: flex; flex-wrap: wrap; gap: 8px; }
    .skill-chip { padding: 6px 12px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 16px; font-size: 13px; color: #1e40af; font-weight: 500;
      small { font-weight: 400; color: #64748b; }
    }
    .drawer-hint { font-size: 13px; color: #94a3b8; margin: 0 0 10px; }
    .drawer-add-skill { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 8px; }
    .drawer-skill-select { flex: 1; min-width: 160px; max-width: 260px; padding: 8px 10px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 13px; }
    .drawer-skill-exp { width: 72px; padding: 8px 10px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 13px; }
    .drawer-actions { margin-top: 28px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
    .btn-pipeline-lg { width: 100%; padding: 12px; border: none; background: #2563eb; color: #fff; border-radius: 8px; font-weight: 600; font-size: 14px; cursor: pointer; &:hover { background: #1d4ed8; } }
    .terminal-note { margin-top: 8px; padding: 10px 12px; border-radius: 8px; background: #f8fafc; color: #64748b; border: 1px solid #e2e8f0; font-size: 12px; font-weight: 600; i { margin-right: 6px; } }

    /* ── INLINE PIPELINE MODAL ── */
    .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; animation: fadeIn 0.2s; }
    .modal-card { background: white; border-radius: 14px; width: 480px; max-width: 95%; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.15); overflow: hidden; }
    .pipeline-modal.modal-card {
      max-width: min(980px, 96vw);
      width: 96%;
      max-height: 92vh;
      border-radius: 18px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.22), 0 0 0 1px rgba(15, 23, 42, 0.04);
    }
    .modal-header { padding: 18px 24px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: #f8fafc;
      h3 { margin: 0; font-size: 17px; color: #1e293b; i { margin-right: 8px; color: #2563eb; } }
      .modal-close { background: none; border: none; font-size: 18px; cursor: pointer; color: #64748b; padding: 4px; &:hover { color: #ef4444; } }
    }
    .modal-body { padding: 20px 22px; }
    .pipeline-modal-header {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #0f172a 100%);
      border-bottom: 1px solid rgba(255,255,255,0.06);
      padding: 20px 24px;
      h3 { color: #f8fafc; font-size: 18px; font-weight: 700; letter-spacing: -0.02em; i { color: #38bdf8; margin-right: 10px; } }
    }
    .pipeline-modal-sub { font-weight: 500; color: #94a3b8; font-size: 15px; }
    .pipeline-modal-close { color: #94a3b8 !important; &:hover { color: #f8fafc !important; } }
    .pipeline-modal-body {
      background: linear-gradient(180deg, #f1f5f9 0%, #f8fafc 40%, #ffffff 100%);
      padding: 22px 24px 26px;
      overflow-y: auto;
      overscroll-behavior: contain;
      scrollbar-width: thin;
      scrollbar-color: #94a3b8 #f1f5f9;
    }
    .pipeline-modal-body::-webkit-scrollbar { width: 8px; }
    .pipeline-modal-body::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 6px; }
    .pipeline-modal-body::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 6px; }

    .pipeline-info-row { display: flex; align-items: center; gap: 16px; margin-bottom: 22px; }
    .pipeline-info-card {
      padding: 14px 18px;
      background: #fff;
      border-radius: 14px;
      border: 1px solid rgba(148, 163, 184, 0.35);
      box-shadow: 0 4px 14px -4px rgba(15, 23, 42, 0.08);
    }
    .pipeline-info-text { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    .pipeline-avatar { width: 52px; height: 52px; border-radius: 50%; background: linear-gradient(135deg, #0ea5e9, #2563eb); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 700; flex-shrink: 0; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35); }
    .pipeline-cand-name { font-size: 17px; font-weight: 700; color: #0f172a; display: block; letter-spacing: -0.02em; }
    .pipeline-job-name { font-size: 13px; color: #64748b; font-weight: 500; display: flex; align-items: center; gap: 8px; i { color: #94a3b8; font-size: 12px; } }

    .pipeline-feedback-panel {
      margin-bottom: 18px;
      padding: 14px 16px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      border-left: 4px solid #0ea5e9;
    }
    .pipeline-feedback-title {
      margin: 0 0 12px;
      font-size: 14px;
      font-weight: 800;
      color: #0f172a;
      i { color: #0ea5e9; margin-right: 8px; }
    }
    .pipeline-feedback-block {
      margin-bottom: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid #f1f5f9;
      &:last-child { margin-bottom: 0; padding-bottom: 0; border-bottom: none; }
    }
    .pipeline-feedback-block-head {
      font-size: 13px;
      font-weight: 700;
      color: #334155;
      margin-bottom: 8px;
      .fb-id { font-weight: 500; color: #94a3b8; font-size: 11px; margin-left: 6px; }
      .fb-score {
        margin-left: 10px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 2px 10px;
        border-radius: 999px;
        border: 1px solid #e2e8f0;
        background: #f8fafc;
        color: #0f172a;
        font-weight: 700;
        font-size: 12px;
      }
    }
    .pipeline-feedback-row {
      padding: 10px 12px;
      background: #f8fafc;
      border-radius: 8px;
      margin-bottom: 8px;
      &:last-child { margin-bottom: 0; }
    }
    .fb-who { font-size: 13px; font-weight: 600; color: #1e293b; margin-bottom: 4px; i { color: #64748b; margin-right: 6px; } }
    .fb-meta { display: flex; flex-wrap: wrap; gap: 10px; font-size: 12px; color: #475569; }
    .fb-rating { font-weight: 600; color: #b45309; i { margin-right: 4px; } }
    .fb-rec { padding: 2px 8px; background: #e0f2fe; color: #0369a1; border-radius: 6px; font-weight: 600; }
    .fb-comments { margin: 8px 0 0; font-size: 13px; color: #334155; line-height: 1.45; white-space: pre-wrap; }
    .fb-breakdown {
      margin-top: 6px;
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      font-size: 12px;
      color: #475569;
      strong { color: #0f172a; }
    }

    .pipeline-stages { position: relative; padding-bottom: 4px; }
    .pipeline-journey-head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 12px;
    }
    .pipeline-journey-title { display: flex; flex-direction: column; gap: 2px; }
    .pj-label { font-size: 11px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: #64748b; }
    .pj-flow { font-size: 12px; color: #94a3b8; font-weight: 500; i { margin-right: 6px; color: #cbd5e1; } }
    .pipeline-legend {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 14px;
      padding: 8px 12px;
      background: #fff;
      border-radius: 10px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
    }
    .pl-legend-item { font-size: 11px; font-weight: 600; color: #64748b; display: inline-flex; align-items: center; gap: 6px; }
    .pl-dot { width: 14px; height: 14px; border-radius: 50%; display: inline-block; border: 2px solid #fff; box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.12); }
    .pl-dot--done { background: linear-gradient(145deg, #3b82f6, #2563eb); }
    .pl-dot--current { background: linear-gradient(145deg, #a855f7, #7c3aed); box-shadow: 0 0 0 4px rgba(124, 58, 237, 0.2); }
    .pl-dot--next { background: #e2e8f0; }
    .pipeline-tree-hint {
      font-size: 12px;
      color: #475569;
      margin: 0 0 14px;
      line-height: 1.55;
      text-align: left;
      padding: 12px 14px 12px 14px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      border-left: 4px solid #38bdf8;
      box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
    }
    .pipeline-tree-hint i { color: #38bdf8; margin-right: 8px; }
    .pipeline-tree-outer {
      border-radius: 14px;
      padding: 8px;
      background: #eef2ff;
      border: 1px solid #dbeafe;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.6);
    }
    .pipeline-tree--horizontal {
      counter-reset: step-num;
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: flex-start;
      gap: 0;
      max-width: 100%;
      padding: 22px 20px 26px;
      min-height: 120px;
      background: #ffffff;
      border-radius: 15px;
      overflow-x: auto;
      overflow-y: hidden;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: thin;
      scrollbar-color: #94a3b8 #f1f5f9;
    }
    .pipeline-tree--horizontal::-webkit-scrollbar { height: 8px; }
    .pipeline-tree--horizontal::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 6px; margin: 0 8px; }
    .pipeline-tree--horizontal::-webkit-scrollbar-thumb { background: linear-gradient(90deg, #cbd5e1, #94a3b8); border-radius: 6px; }
    .tree-connector-h {
      display: flex;
      align-items: center;
      align-self: center;
      flex-shrink: 0;
      padding: 0 2px;
    }
    .tree-connector-line {
      display: block;
      width: 36px;
      height: 2px;
      border-radius: 4px;
      background: linear-gradient(90deg, #cbd5e1, #6366f1 45%, #94a3b8);
      position: relative;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
    }
    .tree-connector-line::before {
      content: "";
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #fff;
      border: 2px solid #94a3b8;
      box-shadow: 0 2px 4px rgba(15, 23, 42, 0.08);
    }
    .tree-connector-line::after {
      content: "";
      position: absolute;
      right: -2px;
      top: 50%;
      transform: translateY(-50%);
      width: 0;
      height: 0;
      border-top: 5px solid transparent;
      border-bottom: 5px solid transparent;
      border-left: 8px solid #64748b;
    }
    .tree-segment.pipeline-step {
      counter-increment: step-num;
      display: flex;
      flex-direction: column;
      align-items: center;
      flex-shrink: 0;
      min-width: 100px;
      max-width: 340px;
      position: relative;
      padding: 18px 16px 14px;
      background: #fff;
      border-radius: 10px;
      border: 1px solid #dbeafe;
      box-shadow: 0 3px 10px -5px rgba(15, 23, 42, 0.14);
    }
    .tree-segment.pipeline-step::after {
      content: counter(step-num);
      position: absolute;
      top: -10px;
      left: 50%;
      transform: translateX(-50%);
      min-width: 22px;
      height: 22px;
      padding: 0 6px;
      border-radius: 999px;
      background: linear-gradient(180deg, #1e293b, #0f172a);
      color: #f8fafc;
      font-size: 11px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 10px rgba(15, 23, 42, 0.25);
      z-index: 2;
    }
    .pipeline-step--fork {
      padding-top: 26px;
      background: #f8fafc;
      border: 1px dashed rgba(99, 102, 241, 0.45);
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
    }
    .pipeline-step--fork::before {
      content: "Branch";
      position: absolute;
      top: 10px;
      left: 12px;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #94a3b8;
      z-index: 1;
    }
    .pipeline-step--fork::after {
      top: -10px;
      left: 50%;
      right: auto;
      transform: translateX(-50%);
      background: linear-gradient(180deg, #334155, #1e293b);
      color: #f8fafc;
      border: 1px solid rgba(255,255,255,0.1);
      box-shadow: 0 4px 10px rgba(15, 23, 42, 0.2);
    }
    .tree-segment--fork2 { min-width: 210px; max-width: 300px; }
    .tree-segment--fork3 { min-width: 290px; max-width: 420px; }
    .tree-caption {
      font-size: 11px;
      font-weight: 600;
      color: #475569;
      text-align: center;
      margin-bottom: 12px;
      line-height: 1.4;
      max-width: 220px;
      padding: 6px 12px;
      background: #f1f5f9;
      border-radius: 999px;
      border: 1px solid #e2e8f0;
      letter-spacing: 0.01em;
    }
    .pipeline-step--fork .tree-caption {
      margin-top: 0;
      background: #fff;
      border-style: dashed;
    }
    .tree-row {
      display: flex;
      justify-content: center;
      align-items: flex-start;
      gap: 12px;
      flex-wrap: wrap;
      position: relative;
      width: 100%;
    }
    .tree-row--single .tree-node-wrap { min-width: 76px; }
    .tree-row--fork2,
    .tree-row--fork3 {
      flex-wrap: nowrap;
      justify-content: space-between;
      gap: clamp(8px, 2vw, 18px);
      padding-top: 12px;
    }
    .tree-row--fork2::before,
    .tree-row--fork3::before {
      content: "";
      position: absolute;
      top: 0;
      left: 6%;
      right: 6%;
      height: 2px;
      background: linear-gradient(90deg, transparent, #cbd5e1 10%, #94a3b8 50%, #cbd5e1 90%, transparent);
      border-radius: 2px;
    }
    .tree-row--fork2 .tree-node-wrap,
    .tree-row--fork3 .tree-node-wrap {
      flex: 1 1 0;
      min-width: 0;
      max-width: 140px;
      padding-top: 18px;
      position: relative;
    }
    .tree-row--fork2 .tree-node-wrap::before,
    .tree-row--fork3 .tree-node-wrap::before {
      content: "";
      position: absolute;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 2px;
      height: 16px;
      background: linear-gradient(180deg, #94a3b8, #cbd5e1);
      border-radius: 2px;
    }
    .tree-node-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      text-align: center;
      position: relative;
    }
    .tree-node-wrap.clickable { cursor: pointer; }
    .tree-node-wrap.clickable:hover .tree-node-circle {
      transform: translateY(-3px) scale(1.05);
      box-shadow: 0 12px 28px -6px rgba(37, 99, 235, 0.2);
    }
    .tree-node-visual {
      position: relative;
      width: 86px;
      height: 46px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .tree-node-ring {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 86px;
      height: 46px;
      border-radius: 12px;
      border: 2px solid rgba(124, 58, 237, 0.4);
      animation: ringPulse 2.2s ease-in-out infinite;
      pointer-events: none;
    }
    @keyframes ringPulse {
      0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
      50% { transform: translate(-50%, -50%) scale(1.08); opacity: 0.6; }
    }
    .tree-node-wrap.completed .tree-node-circle {
      background: linear-gradient(145deg, #3b82f6, #2563eb);
      color: #fff;
      border-color: transparent;
      box-shadow: 0 4px 16px rgba(37, 99, 235, 0.2);
    }
    .tree-node-wrap.current .tree-node-circle {
      background: linear-gradient(145deg, #a855f7, #7c3aed);
      color: #fff;
      border-color: transparent;
      box-shadow: 0 6px 20px rgba(124, 58, 237, 0.35);
      animation: none;
    }
    .tree-node-wrap.pending .tree-node-circle {
      background: #fff;
      color: #cbd5e1;
      border-color: #e2e8f0;
      box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
    }
    .tree-node-wrap.muted .tree-node-circle {
      background: linear-gradient(180deg, #f8fafc, #f1f5f9);
      color: #94a3b8;
      border-color: #e2e8f0;
      border-style: dashed;
    }
    .tree-node-wrap.muted .tree-node-label { color: #94a3b8; font-weight: 500; }
    .tree-node-wrap.node-reject .tree-node-circle {
      background: linear-gradient(180deg, #fff1f2, #ffffff);
      color: #e11d48;
      border-color: rgba(244, 63, 94, 0.35);
    }
    .tree-node-wrap.node-reject .tree-node-label { color: #be123c; }
    .tree-node-wrap.node-reject.current .tree-node-circle {
      background: linear-gradient(145deg, #fb7185, #e11d48);
      color: #fff;
      border-color: transparent;
      box-shadow: 0 6px 20px rgba(225, 29, 72, 0.35);
    }
    .tree-node-wrap.node-reject.current .tree-node-label { color: #9f1239; }
    .tree-node-wrap.node-reject .tree-node-ring { border-color: rgba(225, 29, 72, 0.35); }
    .tree-node-circle {
      width: 86px;
      height: 46px;
      border-radius: 10px;
      border: 2px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
      transition: transform 0.22s ease, box-shadow 0.22s ease;
      background: #fff;
      position: relative;
      z-index: 1;
    }
    .tree-node-label {
      font-size: 11px;
      font-weight: 700;
      color: #475569;
      letter-spacing: 0.01em;
      line-height: 1.35;
      max-width: 132px;
    }
    .tree-node-wrap.current .tree-node-label { color: #5b21b6; font-weight: 700; }
    .tree-node-wrap.completed .tree-node-label { color: #1d4ed8; }

    .pipeline-confirm { margin-top: 30px; padding: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; animation: slideDownConfirm 0.2s ease-out; }
    @keyframes slideDownConfirm { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
    .confirm-text { font-size: 14px; color: #334155; margin-bottom: 12px; text-align: center;
      strong { color: #0f172a; }
      i { color: #94a3b8; margin: 0 8px; }
    }
    .confirm-btns { display: flex; justify-content: center; gap: 10px; }
    .btn-cancel-sm { padding: 8px 16px; border: 1px solid #e2e8f0; border-radius: 6px; background: white; cursor: pointer; font-weight: 600; font-size: 13px; color: #64748b; &:hover { background: #f1f5f9; } }
    .btn-confirm-sm { padding: 8px 16px; border: none; border-radius: 6px; background: #2563eb; color: white; cursor: pointer; font-weight: 600; font-size: 13px; &:hover { background: #1d4ed8; } &:disabled { opacity: 0.5; cursor: not-allowed; } }

    /* ── Blacklist ── */
    .btn-blacklist {
      padding: 6px 12px; border: 1px solid #dc2626; background: #fff; color: #dc2626; border-radius: 6px;
      font-weight: 600; font-size: 12px; cursor: pointer;
      &:hover { background: #dc2626; color: #fff; }
    }
    .blacklisted-pill {
      display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 999px;
      font-size: 11px; font-weight: 700; background: #fef2f2; color: #991b1b; border: 1px solid #fecaca;
    }
    .blacklist-modal {
      max-width: 480px; width: 92%;
    }
    .blacklist-info {
      display: flex; align-items: center; gap: 14px; margin-bottom: 20px;
      padding: 14px; background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0;
    }
    .blacklist-info-text { display: flex; flex-direction: column; gap: 2px;
      .name { font-weight: 700; font-size: 15px; color: #0f172a; }
      .email { font-size: 13px; color: #64748b; }
    }
    .blacklist-duration-options {
      display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px;
    }
    .duration-btn {
      padding: 10px 16px; border: 2px solid #e2e8f0; border-radius: 10px; background: #fff;
      font-size: 13px; font-weight: 600; color: #475569; cursor: pointer;
      display: flex; align-items: center; gap: 8px; transition: all 0.2s;
      &:hover { border-color: #94a3b8; background: #f8fafc; }
      &.selected { border-color: #dc2626; background: #fef2f2; color: #dc2626; box-shadow: 0 0 0 3px rgba(220,38,38,0.1); }
    }
    .duration-btn--forever.selected { border-color: #7c2d12; background: #fff7ed; color: #7c2d12; box-shadow: 0 0 0 3px rgba(124,45,18,0.1); }
    .blacklist-actions {
      display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #e2e8f0;
    }
    .btn-blacklist-confirm {
      padding: 10px 20px; border: none; border-radius: 8px; background: #dc2626; color: #fff;
      font-weight: 700; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px;
      &:hover { background: #b91c1c; }
      &:disabled { opacity: 0.5; cursor: not-allowed; }
    }

    .btn-reject-sm {
      padding: 8px 16px;
      border: 1px solid #fecaca;
      border-radius: 6px;
      background: #fff;
      cursor: pointer;
      font-weight: 600;
      font-size: 13px;
      color: #dc2626;
      &:hover { background: #fee2e2; }
      &:disabled { opacity: 0.5; cursor: not-allowed; }
    }

    /* ─── BPM Workflow Actions ─── */
    .workflow-actions {
      margin-top: 16px;
      padding: 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
    }
    .workflow-title {
      font-weight: 800;
      font-size: 14px;
      color: #0f172a;
      margin-bottom: 10px;
      text-align: center;
    }
    .workflow-btns {
      display: flex;
      justify-content: center;
      gap: 10px;
    }
    .readonly-workflow {
      border-color: #cbd5e1;
      background: #f1f5f9;
    }

    /* ─── Screening Form ─── */
    .screening-form {
      margin-top: 16px;
      padding: 16px;
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
    }
    .screening-form-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .screening-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 6px;
    }

    .form-row { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
    .form-input {
      padding: 10px 14px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      outline: none;
      font-size: 14px;
    }
    .hint { font-size: 13px; color: #64748b; margin-top: 6px; }
    .checkbox-list { display: flex; flex-direction: column; gap: 6px; }
    .checkbox-item { display: flex; align-items: center; gap: 8px; font-size: 14px; color: #334155; }

    /* ─── Documents List ─── */
    .documents-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: 10px;
    }
    .doc-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      transition: all 0.2s;
      &:hover {
        background: #f1f5f9;
        border-color: #cbd5e1;
      }
    }
    .doc-info {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .doc-icon {
      color: #64748b;
      font-size: 16px;
    }
    .doc-type {
      font-size: 13px;
      font-weight: 600;
      color: #334155;
    }
    .btn-download-doc {
      background: none;
      border: none;
      color: #3b82f6;
      cursor: pointer;
      font-size: 16px;
      padding: 4px;
      border-radius: 4px;
      transition: all 0.2s;
      &:hover {
        background: #dbeafe;
        color: #2563eb;
      }
    }
  `]
})
export class CandidatesTab implements OnInit {
  isLoading = true;
  activeTab = 'active';

  // Data
  jobs: { requisition_id: string; title: string; department_name: string }[] = [];
  stages: { stage_id: string; stage_name: string; order: number }[] = [];
  skills: Record<string, string>[] = [];
  allCandidates: CandidateRow[] = [];
  filteredCandidates: CandidateRow[] = [];

  // Filters
  selectedJobId = 'ALL';
  searchQuery = '';
  stageFilter = '';
  skillFilterId = '';
  experienceMin: number | '' = '';
  experienceMax: number | '' = '';

  /** candidate_id → skill_ids (for skill filter & search) */
  candidateSkillsById = new Map<string, string[]>();

  showAddCandidateModal = false;

  /** Profile drawer: add skill */
  drawerSkillToAdd = '';
  drawerSkillYears = '1';
  drawerSkillSaving = false;

  // Counts
  activeCount = 0;
  hiredCount = 0;
  rejectedCount = 0;
  blacklistedCount = 0;

  // Drawer
  showDrawer = false;
  selectedCandidate: CandidateRow | null = null;
  candidateSkills: Record<string, string>[] = [];
  candidateDocuments: any[] = [];
  fetchingDocuments = false;
  requestingDocs = false;

  // Inline Pipeline Modal
  showPipelineModal = false;
  pipelineCandidate: CandidateRow | null = null;
  pendingStageMove: { stage_id: string; stage_name: string } | null = null;
  isStageMoveInProgress = false;

  // Dynamic pipeline dots (replace "Interview" stage dot with Round 1..N)
  technicalRoundNumbers: number[] = [];
  pipelineDotItems: Array<
    | { kind: 'stage'; stage: { stage_id: string; stage_name: string; order: number } }
    | { kind: 'technical_round'; roundNumber: number }
  > = [];

  /** Tree rows for pipeline modal (branching UI) */
  pipelineTreeRows: PipelineTreeRowVM[] = [];

  // Stage icon mapping
  private stageIcons: Record<string, string> = {
    'applied': 'fa-file-alt',
    'screening': 'fa-search',
    'interview': 'fa-comments',
    'offer': 'fa-handshake',
    'hired': 'fa-check-circle',
  };

  private loggedInUserId = '';
  private loggedInUserEmail = '';

  // Technical interviewers (for screening -> round 1)
  technicalInterviewers: Record<string, string>[] = [];

  // Screening -> Round 1 creation form (BPM-driven)
  showScreeningApproveForm = false;
  screeningIsSubmitting = false;
  screeningFirstInterviewerId = '';
  screeningDate = '';
  screeningSlots: Record<string, string>[] = [];
  screeningSelectedSlotId = '';
  screeningAvailableAdditionalInterviewers: Record<string, string>[] = [];
  screeningSelectedAdditionalInterviewerIds: Record<string, boolean> = {};
  /** Required for every scheduled round (Teams / Meet / Zoom URL). */
  screeningMeetingLink = '';
  private slotsCacheByInterviewerId = new Map<string, Record<string, string>[]>();

  // Technical round loop (after Screening -> technical rounds)
  latestTechnicalRoundNumber = '';
  latestTechnicalFeedbackComplete = false;
  isTechnicalFeedbackChecking = false;

  showTechnicalNextRoundForm = false;
  technicalNextRoundIsSubmitting = false;
  technicalNextRoundNumber = '';
  technicalNextFirstInterviewerId = '';
  technicalNextDate = '';
  technicalNextSlots: Record<string, string>[] = [];
  technicalNextSelectedSlotId = '';
  technicalNextAvailableAdditionalInterviewers: Record<string, string>[] = [];
  technicalNextSelectedAdditionalInterviewerIds: Record<string, boolean> = {};
  technicalNextMeetingLink = '';

  showStopTechnicalForm = false;

  // Optional HR Interview (single interviewer)
  hrInterviewRoundNumber = '';
  hrInterviewFeedbackComplete = false;
  isHrInterviewFeedbackChecking = false;

  showHrInterviewForm = false;
  hrInterviewIsSubmitting = false;
  hrInterviewFirstInterviewerId = '';
  hrInterviewDate = '';
  hrInterviewSlots: Record<string, string>[] = [];
  hrInterviewSelectedSlotId = '';
  hrInterviewMeetingLink = '';

  // HR resolution for candidate argue (ARGUED -> final decision)
  isArgueResolving = false;

  // ── Blacklist state ──
  showBlacklistModal = false;
  blacklistTarget: CandidateRow | null = null;
  blacklistDuration: number | 'FOREVER' | null = null;
  blacklistReason = 'Hired but did not join';
  isBlacklisting = false;

  /** Interviewer feedback rows for Pipeline modal (loaded with interview decision state). */
  pipelineInterviewFeedback: Array<{
    interview_id: string;
    label: string;
    weightedAvg10: string;
    rows: Array<{
      interviewerName: string;
      rating: string;
      recommendation: string;
      comments: string;
      technical: string;
      aptitude: string;
      communication: string;
      culture: string;
      weighted: string;
    }>;
  }> = [];

  private notifySub?: Subscription;

  constructor(
    private soap: SoapService,
    private router: Router,
    private notifyService: NotificationService,
    private toast: ToastService
  ) {}

  downloadResume(url: string | undefined): void {
    if (!url) return;
    // Handle data URL by creating a temporary link
    if (url.startsWith('data:')) {
      const link = document.createElement('a');
      link.href = url;
      // Try to determine extension from data URL
      const mime = url.split(';')[0].split(':')[1] || 'application/pdf';
      const ext = mime.includes('word') ? 'docx' : mime.includes('pdf') ? 'pdf' : 'bin';
      link.download = `Resume_${this.selectedCandidate?.candidate_name.replace(/\s+/g, '_')}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      // Direct URL
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  ngOnInit(): void {
    this.loggedInUserId = sessionStorage.getItem('loggedInUserId') || '';
    // Fallback for BPM DN when requisition owner / assignee cannot be resolved from DB.
    this.loggedInUserEmail =
      sessionStorage.getItem('loggedInUserEmail') || sessionStorage.getItem('loggedInUser') || '';
    
    // Listen for real-time application updates
    this.notifySub = this.notifyService.notifications$.subscribe(notif => {
      if (notif.type === 'CANDIDATE_APPLIED') {
        console.log('[Candidates] New candidate applied event received.');
        // User requested NOT to reload automatically here, toaster will handle notification
      }
    });

    this.loadData();
  }
 
  ngOnDestroy(): void {
    this.notifySub?.unsubscribe();
  }

  async loadData(): Promise<void> {
    this.isLoading = true;
    try {
      const [jobsRaw, deptsRaw, stagesRaw, skillsRaw, candidatesRaw, appsRaw, interviewersRaw] = await Promise.all([
        this.soap.getJobRequisitions(),
        this.soap.getDepartments(),
        this.soap.getPipelineStages(),
        this.soap.getSkills(),
        this.soap.getCandidates(),
        this.soap.getApplications(),
        this.soap.getAllInterviewers()
      ]);

      // Department map
      const deptMap = new Map<string, string>();
      deptsRaw.forEach(d => deptMap.set(d['department_id'] || '', d['department_name'] || ''));

      // Jobs (only APPROVED)
      this.jobs = jobsRaw
        .filter(j => (j['status'] || '').toUpperCase() === 'APPROVED')
        .map(j => ({
          requisition_id: j['requisition_id'] || '',
          title: j['title'] || '',
          department_name: deptMap.get(j['department_id'] || '') || ''
        }));

      // Stages
      this.stages = stagesRaw
        .map(s => ({ stage_id: s['stage_id'] || '', stage_name: s['stage_name'] || '', order: parseInt(s['stage_order'] || '0', 10) }))
        .sort((a, b) => a.order - b.order);

      // Skills
      this.skills = skillsRaw;

      // Technical interviewers (INTERVIEWER role)
      this.technicalInterviewers = (interviewersRaw || []).map((u: any) => ({
        user_id: u['user_id'] || u['User_id'] || '',
        first_name: u['first_name'] || u['First_name'] || '',
        last_name: u['last_name'] || u['Last_name'] || '',
        email: u['email'] || u['Email'] || ''
      })).filter(u => !!u.user_id);

      // Candidate map
      const candMap = new Map<string, Record<string, string>>();
      candidatesRaw.forEach(c => candMap.set(c['candidate_id'] || '', c));

      // Stage name map
      const stageMap = new Map<string, string>();
      this.stages.forEach(s => stageMap.set(s.stage_id, s.stage_name));

      // Build rows from applications
      this.allCandidates = appsRaw.map(a => {
        const cand = candMap.get(a['candidate_id'] || '');
        const name = cand ? ((cand['first_name'] || '') + ' ' + (cand['last_name'] || '')).trim() : a['candidate_id'] || '';
        return {
          application_id: a['application_id'] || '',
          candidate_id: a['candidate_id'] || '',
          requisition_id: a['requisition_id'] || '',
          candidate_name: name || 'Unknown',
          candidate_email: cand?.['email'] || '',
          candidate_phone: cand?.['phone'] || '',
          experience_years: cand?.['experience_years'] || '',
          location: cand?.['location'] || '',
          source: a['source'] || '',
          status: (a['status'] || '').toUpperCase(),
          current_stage_id: a['current_stage_id'] || '',
          stage_name: stageMap.get(a['current_stage_id'] || '') || 'New',
          applied_at: a['applied_at'] || a['created_at'] || '',
          // Add candidate raw data so it can be used for blacklist temp fields
          cand_raw: cand || {},
          _raw: a
        };
      });

      const uniqueCandIds = [
        ...new Set(this.allCandidates.map(c => c.candidate_id).filter(Boolean)),
      ];
      const skillEntries = await Promise.all(
        uniqueCandIds.map(async cid => {
          try {
            const rows = await this.soap.getCandidateSkills(cid);
            const ids = (rows || [])
              .map((r: Record<string, string>) => r['skill_id'] || '')
              .filter(Boolean);
            return [cid, ids] as [string, string[]];
          } catch {
            return [cid, []] as [string, string[]];
          }
        })
      );
      this.candidateSkillsById = new Map(skillEntries);

      this.computeCounts();
      this.applyFilters();
    } catch (err) {
      console.error('Failed to load candidates data:', err);
    } finally {
      this.isLoading = false;
    }
  }

  // ═══════════════════════════════════════════════════
  //  FILTERING
  // ═══════════════════════════════════════════════════

  computeCounts(): void {
    const jobFiltered = this.selectedJobId === 'ALL'
      ? this.allCandidates
      : this.allCandidates.filter(c => c.requisition_id === this.selectedJobId);

    this.activeCount = jobFiltered.filter(c => c.status === 'ACTIVE').length;
    this.hiredCount = jobFiltered.filter(c => c.status === 'HIRED').length;
    this.rejectedCount = jobFiltered.filter(c => c.status === 'REJECTED').length;
    this.blacklistedCount = jobFiltered.filter(c => this.isBlacklisted(c)).length;
  }

  onJobChange(): void {
    this.computeCounts();
    this.applyFilters();
  }

  applyFilters(): void {
    let list = this.allCandidates;

    // Tab filter
    if (this.activeTab === 'active') list = list.filter(c => c.status === 'ACTIVE');
    else if (this.activeTab === 'hired') list = list.filter(c => c.status === 'HIRED');
    else if (this.activeTab === 'rejected') list = list.filter(c => c.status === 'REJECTED');
    else if (this.activeTab === 'blacklisted') list = list.filter(c => this.isBlacklisted(c));

    // Job filter
    if (this.selectedJobId !== 'ALL') {
      list = list.filter(c => c.requisition_id === this.selectedJobId);
    }

    // Stage filter
    if (this.stageFilter) {
      list = list.filter(c => c.current_stage_id === this.stageFilter);
    }

    // Skill filter (candidate must have this skill)
    if (this.skillFilterId) {
      list = list.filter(c =>
        (this.candidateSkillsById.get(c.candidate_id) || []).includes(this.skillFilterId)
      );
    }

    // Experience range (years on candidate record)
    const minE = this.experienceMin === '' ? NaN : Number(this.experienceMin);
    const maxE = this.experienceMax === '' ? NaN : Number(this.experienceMax);
    if (!isNaN(minE) || !isNaN(maxE)) {
      list = list.filter(c => {
        const raw = String(c.experience_years || '').replace(/[^\d.]/g, '');
        const y = parseFloat(raw);
        const v = isNaN(y) ? 0 : y;
        if (!isNaN(minE) && v < minE) return false;
        if (!isNaN(maxE) && v > maxE) return false;
        return true;
      });
    }

    // Search: name, email, phone, location, source, stage, skill names, application summary
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(c => {
        const hay = [
          c.candidate_name,
          c.candidate_email,
          c.candidate_phone,
          c.location,
          c.source,
          c.stage_name,
        ]
          .join(' ')
          .toLowerCase();
        if (hay.includes(q)) return true;
        const words = q.split(/\s+/).filter(Boolean);
        if (words.length && words.every(w => hay.includes(w))) return true;

        const skillNames = (this.candidateSkillsById.get(c.candidate_id) || [])
          .map(id => (this.getSkillName(id) || '').toLowerCase())
          .join(' ');
        if (skillNames.includes(q) || words.every(w => skillNames.includes(w))) return true;

        const summary = (c._raw['summary'] || '').toLowerCase();
        if (summary.includes(q)) return true;

        return false;
      });
    }

    this.filteredCandidates = list;
  }

  async onHrCandidateSaved(): Promise<void> {
    this.showAddCandidateModal = false;
    await this.loadData();
  }

  getAvailableSkillsForDrawer(): Record<string, string>[] {
    if (!this.selectedCandidate) return [];
    const used = new Set(this.candidateSkills.map(s => s['skill_id'] || ''));
    return this.skills.filter(s => !used.has(s['skill_id'] || ''));
  }

  async addSkillToCandidate(): Promise<void> {
    if (!this.selectedCandidate || !this.drawerSkillToAdd) return;
    this.drawerSkillSaving = true;
    try {
      await this.soap.insertCandidateSkill(
        this.selectedCandidate.candidate_id,
        this.drawerSkillToAdd,
        this.drawerSkillYears || '0'
      );
      this.candidateSkills = await this.soap.getCandidateSkills(this.selectedCandidate.candidate_id);
      const ids = this.candidateSkills.map(s => s['skill_id'] || '').filter(Boolean);
      this.candidateSkillsById.set(this.selectedCandidate.candidate_id, ids);
      this.drawerSkillToAdd = '';
      this.drawerSkillYears = '1';
      this.applyFilters();
    } catch (e) {
      console.error('addSkillToCandidate', e);
    } finally {
      this.drawerSkillSaving = false;
    }
  }

  // ═══════════════════════════════════════════════════
  //  BLACKLIST LOGIC
  // ═══════════════════════════════════════════════════

  isBlacklisted(c: CandidateRow): boolean {
    return c['cand_raw']?.['temp1'] === 'BLACKLISTED';
  }

  getBlacklistExpiry(c: CandidateRow): string {
    const d = c['cand_raw']?.['temp2'];
    if (!d) return '';
    if (d.startsWith('9999')) return 'Forever';
    return this.formatDate(d);
  }

  openBlacklistModal(c: CandidateRow): void {
    this.blacklistTarget = c;
    this.blacklistDuration = 3;
    this.blacklistReason = 'Hired but did not join';
    this.showBlacklistModal = true;
  }

  closeBlacklistModal(): void {
    this.showBlacklistModal = false;
    this.blacklistTarget = null;
    this.blacklistDuration = null;
  }

  async confirmBlacklist(): Promise<void> {
    if (!this.blacklistTarget || !this.blacklistDuration) return;
    this.isBlacklisting = true;
    try {
      await this.soap.blacklistCandidate(
        this.blacklistTarget,
        this.blacklistDuration,
        this.blacklistReason
      );
      this.closeBlacklistModal();
      await this.loadData();
    } catch (e) {
      console.error('Failed to blacklist candidate', e);
      alert('Failed to blacklist candidate.');
    } finally {
      this.isBlacklisting = false;
    }
  }

  exportCandidatesCsv(): void {
    const rows = this.filteredCandidates;
    const lines: string[][] = [
      ['Candidate', 'Email', 'Phone', 'Job (requisition)', 'Stage', 'Status', 'Source', 'Applied']
    ];
    for (const c of rows) {
      lines.push([
        c.candidate_name,
        c.candidate_email,
        c.candidate_phone || '',
        this.getJobTitle(c.requisition_id),
        c.stage_name,
        c.status,
        c.source || '',
        this.formatDate(c.applied_at)
      ]);
    }
    downloadCsvLines(`candidates-export-${new Date().toISOString().slice(0, 10)}.csv`, lines);
  }

  // ═══════════════════════════════════════════════════
  //  PROFILE DRAWER
  // ═══════════════════════════════════════════════════

  async openProfile(c: CandidateRow): Promise<void> {
    this.selectedCandidate = c;
    this.showDrawer = true;
    this.candidateDocuments = [];
    try {
      this.candidateSkills = await this.soap.getCandidateSkills(c.candidate_id);
    } catch { this.candidateSkills = []; }

    // Fetch documents if hired
    if (c.status === 'HIRED') {
      this.fetchingDocuments = true;
      try {
        const allDocs = await this.soap.getCandidateDocuments(c.candidate_id);
        // Filter out request markers from the "Mandatory Documents" view
        this.candidateDocuments = allDocs.filter(d => d.document_type !== 'DOCUMENT_REQUEST');
      } catch (e) {
        console.error('Error fetching documents:', e);
      } finally {
        this.fetchingDocuments = false;
      }
    }
  }

  async requestDocuments(c: any): Promise<void> {
    if (!c) return;
    this.requestingDocs = true;
    try {
      const hrEmail = sessionStorage.getItem('email') || 'hr@yourcompany.com';
      const jobTitle = this.getJobTitle(c.requisition_id) || 'the position';
      await this.soap.requestCandidateDocuments(c, hrEmail, jobTitle);
      this.toast.success('Document request sent successfully to ' + (c.candidate_name || 'candidate') + '.');
    } catch (e: any) {
      console.error('Failed to request documents:', e);
      this.toast.error('Failed to send document request.');
    } finally {
      this.requestingDocs = false;
    }
  }

  downloadCandidateDoc(doc: any): void {
    const base64 = doc.temp1;
    if (!base64) {
      this.toast.error('Document content is empty.');
      return;
    }

    const type = doc.document_type || 'document';
    const candidateName = this.selectedCandidate?.candidate_name || 'candidate';
    const fileName = `${type}_${candidateName}.pdf`;

    const link = document.createElement('a');
    link.href = base64; // This is the data URL
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  closeDrawer(): void {
    this.showDrawer = false;
    this.selectedCandidate = null;
    this.candidateSkills = [];
    this.drawerSkillToAdd = '';
    this.drawerSkillYears = '1';
  }

  // ═══════════════════════════════════════════════════
  //  INLINE PIPELINE MODAL
  // ═══════════════════════════════════════════════════

  openPipelineModal(c: CandidateRow): void {
    if (!this.canOpenPipeline(c)) return;
    this.pipelineCandidate = c;
    this.pendingStageMove = null;
    this.showPipelineModal = true;

    // Reset BPM decision UI state
    this.showScreeningApproveForm = false;
    this.showTechnicalNextRoundForm = false;
    this.showStopTechnicalForm = false;
    this.showHrInterviewForm = false;

    // Default dots: static stages until we load interview state
    this.technicalRoundNumbers = [];
    this.pipelineDotItems = this.stages.map(s => ({ kind: 'stage', stage: s }));
    this.buildPipelineTreeRows();

    // Load interview decision state (feedback completeness)
    void this.loadInterviewDecisionState();
  }

  closePipelineModal(): void {
    this.showPipelineModal = false;
    this.pipelineCandidate = null;
    this.pendingStageMove = null;
    this.pipelineInterviewFeedback = [];

    // Reset BPM decision UI state
    this.showScreeningApproveForm = false;
    this.showTechnicalNextRoundForm = false;
    this.showStopTechnicalForm = false;
    this.showHrInterviewForm = false;

    this.technicalRoundNumbers = [];
    this.pipelineDotItems = [];
    this.pipelineTreeRows = [];

    this.screeningMeetingLink = '';
    this.technicalNextMeetingLink = '';
    this.hrInterviewMeetingLink = '';
  }

  getStageIcon(stageName: string): string {
    return this.stageIcons[stageName.toLowerCase()] || 'fa-circle';
  }

  getPipelineProgress(): string {
    if (!this.pipelineCandidate || this.pipelineDotItems.length <= 1) return '0%';
    const idx = this.getCurrentPipelineDotIndex();
    if (idx < 0) return '0%';
    return ((idx / (this.pipelineDotItems.length - 1)) * 100) + '%';
  }

  private getLatestTechnicalRoundNumberForDots(): number {
    if (this.latestTechnicalRoundNumber) return this.toRoundNumberInt(this.latestTechnicalRoundNumber);
    if (!this.technicalRoundNumbers.length) return 0;
    return Math.max(...this.technicalRoundNumbers);
  }

  private getCurrentPipelineDotIndex(): number {
    if (!this.pipelineCandidate) return -1;
    if (!this.pipelineDotItems.length) return -1;

    const interviewStage = this.findStageByKeyword('interview');
    const isInterviewStage = !!(interviewStage && this.pipelineCandidate.current_stage_id === interviewStage.stage_id);

    if (isInterviewStage && this.technicalRoundNumbers.length > 0) {
      const latest = this.getLatestTechnicalRoundNumberForDots();
      return this.pipelineDotItems.findIndex(it => it.kind === 'technical_round' && it.roundNumber === latest);
    }

    return this.pipelineDotItems.findIndex(it => it.kind === 'stage' && it.stage.stage_id === this.pipelineCandidate!.current_stage_id);
  }

  private rebuildPipelineDotItems(): void {
    if (!this.pipelineCandidate) {
      this.pipelineDotItems = this.stages.map(s => ({ kind: 'stage' as const, stage: s }));
      this.buildPipelineTreeRows();
      return;
    }

    const interviewStage = this.findStageByKeyword('interview');
    const inInterviewStage = !!(interviewStage && this.pipelineCandidate.current_stage_id === interviewStage.stage_id);

    if (inInterviewStage && interviewStage && this.technicalRoundNumbers.length > 0) {
      const items: typeof this.pipelineDotItems = [];
      for (const s of this.stages) {
        if (s.stage_id === interviewStage.stage_id) {
          for (const rn of this.technicalRoundNumbers) items.push({ kind: 'technical_round', roundNumber: rn });
        } else {
          items.push({ kind: 'stage', stage: s });
        }
      }
      this.pipelineDotItems = items;
      this.buildPipelineTreeRows();
      return;
    }

    this.pipelineDotItems = this.stages.map(s => ({ kind: 'stage', stage: s }));
    this.buildPipelineTreeRows();
  }

  /** Branching pipeline diagram: screening → V(interview | reject), then rounds, then V(next | HR | reject), then offer/hired */
  private buildPipelineTreeRows(): void {
    this.pipelineTreeRows = [];
    const c = this.pipelineCandidate;
    if (!c) return;

    const screening = this.stages.find(s => (s.stage_name || '').toLowerCase().includes('screening')) || null;
    const interview = this.stages.find(s => (s.stage_name || '').toLowerCase().includes('interview')) || null;
    const offer = this.stages.find(s => (s.stage_name || '').toLowerCase().includes('offer')) || null;
    const hired = this.stages.find(s => (s.stage_name || '').toLowerCase().includes('hired')) || null;
    const rejected =
      this.stages.find(s => /reject/i.test(s.stage_name || '')) || null;

    const currentId = c.current_stage_id;
    const cur = this.stages.find(s => s.stage_id === currentId);
    const currentOrder = cur?.order ?? -1;
    const screeningOrder = screening?.order ?? 0;
    const isRejected = (c.status || '').toUpperCase() === 'REJECTED';

    const mkStageNode = (
      stage: { stage_id: string; stage_name: string; order: number },
      key: string,
      icon: string
    ): PipelineTreeNodeVM => {
      const st = this.getPipelineStageStatus(stage);
      let status: 'completed' | 'current' | 'pending' | 'muted' =
        st === 'completed' ? 'completed' : st === 'current' ? 'current' : 'pending';
      if (isRejected && rejected && stage.stage_id === rejected.stage_id) {
        status = 'current';
      }
      return {
        key,
        label: stage.stage_name,
        icon,
        status,
        clickable: true,
        dotItem: { kind: 'stage', stage }
      };
    };

    const inInterviewStage = !!(interview && currentId === interview.stage_id);

    if (screening) {
      this.pipelineTreeRows.push({
        layout: 'single',
        caption: '',
        nodes: [mkStageNode(screening, 'st-screening', 'fa-search')]
      });
    }

    if (interview && rejected) {
      this.pipelineTreeRows.push({
        layout: 'fork2',
        caption: 'After screening — continue interviews or end here',
        nodes: [
          mkStageNode(interview, 'st-interview', 'fa-comments'),
          mkStageNode(rejected, 'st-rejected', 'fa-ban')
        ]
      });
    }

    // Technical rounds only appear once the candidate is in the Interview stage (dynamic branch)
    if (inInterviewStage && this.technicalRoundNumbers.length > 0) {
      const roundNodes: PipelineTreeNodeVM[] = this.technicalRoundNumbers.map(rn => {
        const st = this.getPipelineDotStatus({ kind: 'technical_round', roundNumber: rn });
        return {
          key: `tr-${rn}`,
          label: `Round ${rn}`,
          icon: this.getTechnicalRoundIcon(rn),
          status:
            st === 'completed' ? 'completed' : st === 'current' ? 'current' : 'pending',
          clickable: false,
          dotItem: { kind: 'technical_round', roundNumber: rn }
        };
      });
      this.pipelineTreeRows.push({
        layout: 'single',
        caption: 'Technical interviews',
        nodes: roundNodes
      });
    }

    if (inInterviewStage && interview && rejected) {
      this.pipelineTreeRows.push({
        layout: 'fork3',
        caption: 'During interviews — next round, HR, or reject',
        nodes: [
          {
            key: 'next-tech',
            label: 'Next technical round',
            icon: 'fa-arrow-right',
            status: 'muted',
            clickable: false
          },
          {
            key: 'hr-int',
            label: 'HR interview',
            icon: 'fa-user-tie',
            status: 'muted',
            clickable: false
          },
          {
            key: 'rej-end',
            label: rejected.stage_name,
            icon: 'fa-times-circle',
            status: isRejected ? 'current' : 'pending',
            clickable: true,
            dotItem: { kind: 'stage', stage: rejected }
          }
        ]
      });
    }

    const pastScreening =
      !screening ||
      currentOrder > screeningOrder ||
      (interview && currentId === interview.stage_id) ||
      (offer && currentId === offer.stage_id) ||
      (hired && currentId === hired.stage_id) ||
      isRejected;

    if (pastScreening && !isRejected && offer) {
      this.pipelineTreeRows.push({
        layout: 'single',
        caption: '',
        nodes: [mkStageNode(offer, 'st-offer', 'fa-handshake')]
      });
    }
    if (pastScreening && !isRejected && hired) {
      this.pipelineTreeRows.push({
        layout: 'single',
        caption: '',
        nodes: [mkStageNode(hired, 'st-hired', 'fa-check-circle')]
      });
    }
  }

  onPipelineTreeNodeClick(n: PipelineTreeNodeVM): void {
    if (!n.clickable || !n.dotItem) return;
    this.onPipelineDotClick(n.dotItem as any);
  }

  getPipelineDotStatus(item: { kind: 'stage' | 'technical_round' } & any): 'completed' | 'current' | 'pending' {
    if (item.kind === 'technical_round') {
      const latest = this.getLatestTechnicalRoundNumberForDots();
      if (item.roundNumber < latest) return 'completed';
      if (item.roundNumber === latest) return 'current';
      return 'pending';
    }

    // stage dot
    return this.getPipelineStageStatus(item.stage);
  }

  getTechnicalRoundIcon(roundNumber: number): string {
    // icon stays stable; we could also vary by roundNumber in the future
    return 'fa-list-check';
  }

  onPipelineDotClick(item: { kind: 'stage' | 'technical_round'; stage?: any }): void {
    if (item.kind !== 'stage') return;
    this.onPipelineStageClick(item.stage);
  }

  getPipelineStageStatus(stage: { stage_id: string; stage_name?: string }): 'completed' | 'current' | 'pending' {
    if (!this.pipelineCandidate) return 'pending';
    const currentOrder = this.stages.find(s => s.stage_id === this.pipelineCandidate!.current_stage_id)?.order || 0;
    const stageOrder = this.stages.find(s => s.stage_id === stage.stage_id)?.order || 0;
    if (stage.stage_id === this.pipelineCandidate.current_stage_id) return 'current';
    if (stageOrder < currentOrder) return 'completed';
    return 'pending';
  }

  onPipelineStageClick(stage: { stage_id: string; stage_name: string }): void {
    if (!this.pipelineCandidate || stage.stage_id === this.pipelineCandidate.current_stage_id) return;
    if (this.isTerminalStatus(this.pipelineCandidate.status)) return;
    const currentOrder = this.stages.find(s => s.stage_id === this.pipelineCandidate!.current_stage_id)?.order || 0;
    const targetOrder = this.stages.find(s => s.stage_id === stage.stage_id)?.order || 0;
    if (targetOrder < currentOrder) return;
    this.pendingStageMove = { stage_id: stage.stage_id, stage_name: stage.stage_name };
  }

  async confirmStageMove(): Promise<void> {
    if (!this.pipelineCandidate || !this.pendingStageMove) return;
    if (this.isTerminalStatus(this.pipelineCandidate.status)) return;
    const c = this.pipelineCandidate;
    const fromStageId = c.current_stage_id;
    const toStageId = this.pendingStageMove.stage_id;
    const toStageName = this.pendingStageMove.stage_name;
    this.isStageMoveInProgress = true;

    try {
      await this.soap.updateApplicationStage(c._raw, toStageId);
      await this.soap.insertStageHistory({
        application_id: c.application_id,
        from_stage_id: fromStageId,
        to_stage_id: toStageId,
        changed_by: this.loggedInUserId,
        comments: ''
      });

      // Update local state
      c.current_stage_id = toStageId;
      c.stage_name = toStageName;
      c._raw['current_stage_id'] = toStageId;
      this.pendingStageMove = null;
      this.applyFilters(); // refresh table
    } catch (err) {
      console.error('Stage move failed:', err);
      alert('Failed to move candidate. Please try again.');
    } finally {
      this.isStageMoveInProgress = false;
    }
  }

  isTerminalStatus(status: string): boolean {
    const s = String(status || '').toUpperCase();
    return s === 'HIRED' || s === 'REJECTED' || s === 'CANCELLED';
  }

  canOpenPipeline(c: CandidateRow | null | undefined): boolean {
    if (!c) return false;
    return !this.isTerminalStatus(c.status);
  }

  // ═══════════════════════════════════════════════════
  //  BPM-DRIVEN SCREENING (MVP: Shortlist + Round 1)
  // ═══════════════════════════════════════════════════

  private getTodayISODate(): string {
    return new Date().toISOString().split('T')[0];
  }

  /** Earliest selectable interview date (tomorrow — strictly future). */
  private getTomorrowLocalISODate(): string {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /** Template `[min]` on date inputs — interviews must be scheduled for a future calendar day. */
  get minScheduleDateISO(): string {
    return this.getTomorrowLocalISODate();
  }

  private assertDateIsFutureOnly(isoDate: string): boolean {
    if (!isoDate || isoDate.length < 10) return false;
    return isoDate >= this.getTomorrowLocalISODate();
  }

  private assertValidMeetingLink(link: string): boolean {
    const t = (link || '').trim();
    if (!t) return false;
    try {
      const u = new URL(t);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  }

  screeningSchedulingReady(): boolean {
    return (
      !!this.screeningFirstInterviewerId &&
      !!this.screeningSelectedSlotId &&
      !!this.screeningDate &&
      this.assertDateIsFutureOnly(this.screeningDate) &&
      this.assertValidMeetingLink(this.screeningMeetingLink)
    );
  }

  technicalNextSchedulingReady(): boolean {
    return (
      !!this.technicalNextFirstInterviewerId &&
      !!this.technicalNextSelectedSlotId &&
      !!this.technicalNextDate &&
      this.assertDateIsFutureOnly(this.technicalNextDate) &&
      this.assertValidMeetingLink(this.technicalNextMeetingLink)
    );
  }

  hrInterviewSchedulingReady(): boolean {
    return (
      !!this.hrInterviewFirstInterviewerId &&
      !!this.hrInterviewSelectedSlotId &&
      !!this.hrInterviewDate &&
      this.assertDateIsFutureOnly(this.hrInterviewDate) &&
      this.assertValidMeetingLink(this.hrInterviewMeetingLink)
    );
  }

  private findStageByKeyword(keyword: string): { stage_id: string; stage_name: string } | null {
    const k = (keyword || '').toLowerCase().trim();
    if (!k) return null;
    return this.stages.find(s => (s.stage_name || '').toLowerCase().includes(k)) || null;
  }

  private getSlotsCache(userId: string): Record<string, string>[] | undefined {
    return this.slotsCacheByInterviewerId.get(userId);
  }

  /** `ts_interview_slots.temp1`: '1' / booked = not selectable for new interviews. */
  private isSlotRowAvailable(s: Record<string, string>): boolean {
    const t = String(s['temp1'] ?? '').trim().toLowerCase();
    if (t === '1' || t === 'true' || t === 'booked') return false;
    return true;
  }

  private filterAvailableSlots(slots: Record<string, string>[]): Record<string, string>[] {
    return (slots || []).filter(s => this.isSlotRowAvailable(s));
  }

  private clearSlotsCache(): void {
    this.slotsCacheByInterviewerId.clear();
  }

  private async getSlotsForInterviewer(userId: string): Promise<Record<string, string>[]> {
    const cached = this.getSlotsCache(userId);
    if (cached) return cached;
    const slots = await this.soap.getInterviewSlotsForCreatedByUser(userId);
    this.slotsCacheByInterviewerId.set(userId, slots || []);
    return slots || [];
  }

  openScreeningApproveForm(): void {
    if (!this.pipelineCandidate) return;
    this.screeningIsSubmitting = false;
    this.showScreeningApproveForm = true;

    // Reset screening form
    this.screeningSelectedSlotId = '';
    this.screeningSlots = [];
    this.screeningSelectedAdditionalInterviewerIds = {};
    this.screeningAvailableAdditionalInterviewers = [];
    this.screeningMeetingLink = '';
    this.screeningDate = this.getTomorrowLocalISODate();

    // Default U1
    const u1 = this.technicalInterviewers[0]?.['user_id'] || '';
    this.screeningFirstInterviewerId = u1;

    if (this.screeningFirstInterviewerId) {
      void this.onScreeningFirstInterviewerChange();
    }
  }

  closeScreeningApproveForm(): void {
    this.showScreeningApproveForm = false;
    this.screeningIsSubmitting = false;
  }

  async onScreeningFirstInterviewerChange(): Promise<void> {
    this.screeningSelectedSlotId = '';
    this.screeningSlots = [];
    this.screeningSelectedAdditionalInterviewerIds = {};
    this.screeningAvailableAdditionalInterviewers = [];

    if (!this.screeningFirstInterviewerId || !this.screeningDate) return;

    const slots = await this.getSlotsForInterviewer(this.screeningFirstInterviewerId);
    this.screeningSlots = this.filterAvailableSlots(slots || []).filter(
      s => (s['slot_date'] || '') === this.screeningDate
    );

    if (this.screeningSlots.length > 0) {
      this.screeningSelectedSlotId = this.screeningSlots[0]['slot_id'] || '';
      await this.onScreeningSlotChange();
    }
  }

  async onScreeningDateChange(): Promise<void> {
    await this.onScreeningFirstInterviewerChange();
  }

  async onScreeningSlotChange(): Promise<void> {
    this.screeningSelectedAdditionalInterviewerIds = {};
    this.screeningAvailableAdditionalInterviewers = [];

    if (!this.screeningSelectedSlotId || !this.screeningFirstInterviewerId) return;

    const selectedSlot = this.screeningSlots.find(s => s['slot_id'] === this.screeningSelectedSlotId);
    if (!selectedSlot) return;

    const targetDate = selectedSlot['slot_date'] || this.screeningDate;
    const targetStartTime = selectedSlot['start_time'] || '';

    // Filter interviewers who have a slot at the same day + start_time.
    const available: Record<string, string>[] = [];
    for (const u of this.technicalInterviewers) {
      if (!u['user_id']) continue;
      if (u['user_id'] === this.screeningFirstInterviewerId) continue;

      const slots = await this.getSlotsForInterviewer(u['user_id']);
      const hasSameSlot = (slots || []).some(
        s =>
          (s['slot_date'] || '') === targetDate &&
          (s['start_time'] || '') === targetStartTime &&
          this.isSlotRowAvailable(s)
      );
      if (hasSameSlot) available.push(u);
    }

    this.screeningAvailableAdditionalInterviewers = available;
  }

  toggleScreeningAdditionalInterviewer(userId: string, checked: boolean): void {
    this.screeningSelectedAdditionalInterviewerIds[userId] = checked;
  }

  /**
   * Email for ApplicationTaskIDGenerationBPM: requisition owner or explicit assignee — not only session user.
   */
  private async resolveBpmAssigneeEmail(
    app: CandidateRow,
    options?: { assigneeUserId?: string }
  ): Promise<string> {
    return this.soap.resolveApplicationBpmAssigneeEmail(app._raw, {
      assigneeUserId: options?.assigneeUserId,
      fallbackEmail: this.loggedInUserEmail
    });
  }

  private async waitForTaskIdInTemp5(
    applicationId: string,
    timeoutMs = 15000,
    pollMs = 500
  ): Promise<{ taskId: string; app: Record<string, string> | null }> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const app = await this.soap.getApplicationById(applicationId);
      const taskId = String(app?.['temp5'] || '');
      if (taskId) return { taskId, app };
      await new Promise(resolve => setTimeout(resolve, pollMs));
    }
    return { taskId: '', app: null };
  }

  // Cordys tupleChangedError happens when another workflow/BPM updates the row
  // between reading the tuple and executing UpdateTs_applications.
  // We retry by refetching the latest application row and reapplying the temp update.
  private async updateApplicationTempWithRetry(
    applicationId: string,
    appRaw: Record<string, string>,
    updates: { temp1?: string; temp2?: string; temp3?: string; temp4?: string; temp5?: string; status?: string; current_stage_id?: string },
    retries: number = 3,
    retryDelayMs: number = 250
  ): Promise<any> {
    let lastErr: any;
    let workingRaw: Record<string, string> = appRaw;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        return await this.soap.updateApplicationTemp(workingRaw, updates);
      } catch (err: any) {
        lastErr = err;
        const msg = String(err?.message || err?.error || err?.responseText || err || '');
        // Cordys sometimes throws either:
        // - "Tuple is changed by other user : temp1"
        // - or "tupleChangedError"
        const isTupleChanged =
          /tuple\s*changed\s*by\s*other\s*user/i.test(msg) ||
          /tuplechangederror/i.test(msg) ||
          /tupleChangedError/i.test(msg);
        if (!isTupleChanged) throw err;

        const fresh = await this.soap.getApplicationById(applicationId);
        if (fresh) workingRaw = fresh;
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      }
    }

    throw lastErr;
  }

  // Cordys tupleChangedError also happens for stage/status updates.
  // We retry by refetching the latest tuple and reapplying the stage/status update.
  private async updateApplicationStageAndStatusWithRetry(
    applicationId: string,
    newStatus: string,
    newStageId: string,
    retries: number = 3,
    retryDelayMs: number = 250
  ): Promise<{ fromStageId: string }> {
    let lastErr: any;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const latest = await this.soap.getApplicationById(applicationId);
        const oldData = latest || {};
        const fromStageId = String(oldData?.['current_stage_id'] || '');

        await this.soap.updateApplicationStageAndStatus(oldData as any, newStatus, newStageId);
        return { fromStageId };
      } catch (err: any) {
        lastErr = err;
        const msg = String(err?.message || err?.error || err?.responseText || err || '');
        const isTupleChanged =
          /tuple\s*changed\s*by\s*other\s*user/i.test(msg) ||
          /tuplechangederror/i.test(msg) ||
          /tupleChangedError/i.test(msg);

        if (!isTupleChanged) throw err;

        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      }
    }

    throw lastErr;
  }

  async confirmScreeningApprove(): Promise<void> {
    if (!this.pipelineCandidate) return;
    if (!this.screeningFirstInterviewerId || !this.screeningSelectedSlotId) return;
    if (!this.screeningSchedulingReady()) {
      alert('Please select a future interview date, a slot, and a valid meeting link (https://...).');
      return;
    }

    const meetingLink = this.screeningMeetingLink.trim();

    this.screeningIsSubmitting = true;
    const app = this.pipelineCandidate;

    try {
      const assigneeEmail = await this.resolveBpmAssigneeEmail(app);
      if (!assigneeEmail) {
        alert(
          'Could not resolve BPM assignee email (job requisition owner / user record). Check requisition and ts_users.'
        );
        return;
      }

      const selectedAdditionalIds = Object.entries(this.screeningSelectedAdditionalInterviewerIds)
        .filter(([_, v]) => !!v)
        .map(([k]) => k);
      const interviewerIds = [this.screeningFirstInterviewerId, ...selectedAdditionalIds].filter(Boolean);

      const stepKey = 'SCREENING_DECISION';

      // Step A: set stepKey, trigger BPM, then read TaskId from temp5.
      await this.updateApplicationTempWithRetry(
        app.application_id,
        app._raw,
        { temp1: stepKey }
      );
      await this.soap.triggerApplicationTaskIDGenerationBPM(assigneeEmail, app.application_id);
      const { taskId, app: freshApp } = await this.waitForTaskIdInTemp5(app.application_id);

      if (!taskId) {
        alert('BPM TaskId was not written to ts_applications.temp5.');
        return;
      }

      // Step B: execute workflow logic in Angular/TypeScript
      const technicalRoundNumber = '1';
      await this.soap.createInterviewRound(
        app.application_id,
        technicalRoundNumber,
        'TECHNICAL',
        this.screeningSelectedSlotId,
        interviewerIds,
        this.loggedInUserId,
        meetingLink
      );
      this.clearSlotsCache();
      void this.onScreeningFirstInterviewerChange();

      // Send interview scheduling mails to candidate + assigned interviewers (non-blocking)
      try {
        const eventType = String(technicalRoundNumber) === '1' ? 'INTERVIEW_SCHEDULED' : 'NEXT_INTERVIEW_SCHEDULED';
        const jobTitle = this.getJobTitle(app.requisition_id);
        const candidateName = app.candidate_name;
        const candidateEmail = app.candidate_email;

        const uniqueInterviewerIds = Array.from(new Set((interviewerIds || []).filter(Boolean)));
        const userRows = await Promise.all(uniqueInterviewerIds.map(uid => this.soap.getUserById(uid).catch(() => null)));
        const interviewerInfos = userRows
          .filter(Boolean)
          .map((u: any) => {
            const email = String(u?.['email'] || u?.['Email'] || '').trim();
            const name = `${u?.['first_name'] || ''} ${u?.['last_name'] || ''}`.trim() || email || '';
            return { uid: String(u?.['user_id'] || u?.['User_id'] || ''), email, name };
          })
          .filter(x => x.email);

        if (candidateEmail) {
          const mail = buildMailBody(eventType as any, {
            recipientName: candidateName,
            candidateName,
            interviewType: 'TECHNICAL',
            roundNumber: technicalRoundNumber,
            requisitionId: app.requisition_id,
            jobTitle,
            meetingLink
          });
          await this.soap.sendAllMailsBPM(candidateEmail, mail.subject, mail.body);
        }

        for (const iv of interviewerInfos) {
          const mail = buildMailBody(eventType as any, {
            recipientName: iv.name,
            candidateName,
            interviewType: 'TECHNICAL',
            roundNumber: technicalRoundNumber,
            requisitionId: app.requisition_id,
            jobTitle,
            meetingLink
          });
          await this.soap.sendAllMailsBPM(iv.email, mail.subject, mail.body);
        }
      } catch (mailErr) {
        console.warn('[HR] Failed to send interview scheduled mail (non-blocking):', mailErr);
      }

      const interviewStage = this.findStageByKeyword('interview');
      const interviewStageId = interviewStage?.stage_id || app.current_stage_id;

      const fromStageId = app.current_stage_id;
      // Refetch to avoid Cordys tupleChangedError: BPM/workflow may have updated the row meanwhile.
      const latestAfterRound = await this.soap.getApplicationById(app.application_id);
      const latestFromStageId =
        latestAfterRound?.['current_stage_id'] || fromStageId;

      if (String(latestFromStageId) !== String(interviewStageId)) {
        await this.soap.updateApplicationStageAndStatus(
          latestAfterRound || freshApp || app._raw,
          'ACTIVE',
          interviewStageId
        );
        await this.soap.insertStageHistory({
          application_id: app.application_id,
          from_stage_id: latestFromStageId,
          to_stage_id: interviewStageId,
          changed_by: this.loggedInUserId,
          comments: 'Screening approved; Round 1 interviews created.'
        });
      }

      // Step C: complete BPM task
      await this.soap.performTaskAction(taskId, 'COMPLETE', { decision: 'APPROVED', stepKey });

      // Mail candidate shortlisted (non-blocking)
      try {
        const jobTitle = this.getJobTitle(app.requisition_id);
        const mail = buildMailBody('CANDIDATE_SHORTLISTED', {
          candidateName: app.candidate_name,
          requisitionId: app.requisition_id,
          jobTitle,
        });
        await this.soap.sendAllMailsBPM(app.candidate_email, mail.subject, mail.body);
      } catch (mailErr) {
        console.warn('[HR] Failed to send shortlisted mail (non-blocking):', mailErr);
      }

      // Clear temp5 using the latest DB tuple to avoid tupleChangedError.
      try {
        const latestAfterTask = await this.soap.getApplicationById(app.application_id);
        if (latestAfterTask) {
          await this.updateApplicationTempWithRetry(
            app.application_id,
            latestAfterTask,
            { temp5: '' }
          );
        }
      } catch (e) {
        // Non-blocking: if BPM already updated/cleared temp5, we can safely ignore.
        console.warn('[HR] Failed to clear temp5 (non-blocking):', e);
      }

      // Update local UI state
      app.status = 'ACTIVE';
      app.current_stage_id = interviewStageId;
      app.stage_name = interviewStage?.stage_name || app.stage_name;
      app._raw['status'] = 'ACTIVE';
      app._raw['current_stage_id'] = interviewStageId;
      app._raw['temp5'] = '';

      this.closeScreeningApproveForm();
      await this.loadInterviewDecisionState();
      this.applyFilters();
    } catch (err) {
      console.error('Screening approve failed:', err);
      alert('Failed to shortlist candidate. Check console for details.');
    } finally {
      this.screeningIsSubmitting = false;
    }
  }

  async rejectScreening(): Promise<void> {
    if (!this.pipelineCandidate) return;

    const app = this.pipelineCandidate;
    const stepKey = 'SCREENING_DECISION';

    try {
      const assigneeEmail = await this.resolveBpmAssigneeEmail(app);
      if (!assigneeEmail) {
        alert(
          'Could not resolve BPM assignee email (job requisition owner / user record). Check requisition and ts_users.'
        );
        return;
      }

      // BPM trigger -> TaskId in temp5
      await this.updateApplicationTempWithRetry(
        app.application_id,
        app._raw,
        { temp1: stepKey }
      );
      await this.soap.triggerApplicationTaskIDGenerationBPM(assigneeEmail, app.application_id);
      const { taskId, app: freshApp } = await this.waitForTaskIdInTemp5(app.application_id);
      if (!taskId) {
        alert('BPM TaskId was not written to ts_applications.temp5.');
        return;
      }

      // Workflow logic: cancel interviews + move to rejected
      await this.soap.cancelApplicationInterviews(app.application_id);

      const rejectedStage = this.findStageByKeyword('rejected');
      const rejectedStageId = rejectedStage?.stage_id || app.current_stage_id;

      const fromStageId = app.current_stage_id;
      // Refetch to avoid Cordys tupleChangedError: BPM/workflow may have updated the row meanwhile.
      const latestAfterRound = await this.soap.getApplicationById(app.application_id);
      const latestFromStageId =
        latestAfterRound?.['current_stage_id'] || fromStageId;

      if (String(latestFromStageId) !== String(rejectedStageId)) {
        await this.soap.updateApplicationStageAndStatus(
          latestAfterRound || freshApp || app._raw,
          'REJECTED',
          rejectedStageId
        );
        await this.soap.insertStageHistory({
          application_id: app.application_id,
          from_stage_id: latestFromStageId,
          to_stage_id: rejectedStageId,
          changed_by: this.loggedInUserId,
          comments: 'Screening rejected by HR.'
        });
      }

      // Complete BPM
      await this.soap.performTaskAction(taskId, 'COMPLETE', { decision: 'REJECTED', stepKey });

      // Mail candidate rejection (non-blocking)
      try {
        const jobTitle = this.getJobTitle(app.requisition_id);
        const mail = buildMailBody('CANDIDATE_REJECTED', {
          candidateName: app.candidate_name,
          requisitionId: app.requisition_id,
          jobTitle,
          rejectionReason: 'Thank you for your interest. We cannot proceed further at this time.'
        });
        await this.soap.sendAllMailsBPM(app.candidate_email, mail.subject, mail.body);
      } catch (mailErr) {
        console.warn('[HR] Failed to send rejection mail (non-blocking):', mailErr);
      }

      // Clear temp5 using latest DB tuple to avoid tupleChangedError.
      try {
        const latestAfterTask = await this.soap.getApplicationById(app.application_id);
        if (latestAfterTask) {
          await this.updateApplicationTempWithRetry(
            app.application_id,
            latestAfterTask,
            { temp5: '' }
          );
        }
      } catch (e) {
        console.warn('[HR] Failed to clear temp5 (non-blocking):', e);
      }

      // Update local UI
      app.status = 'REJECTED';
      app.current_stage_id = rejectedStageId;
      app.stage_name = rejectedStage?.stage_name || app.stage_name;
      app._raw['status'] = 'REJECTED';
      app._raw['current_stage_id'] = rejectedStageId;
      app._raw['temp5'] = '';

      this.applyFilters();
      this.closeScreeningApproveForm();
    } catch (err) {
      console.error('Screening reject failed:', err);
      alert('Failed to reject candidate. Check console for details.');
    }
  }

  // ═══════════════════════════════════════════════════
  //  INTERVIEW DECISION STATE LOADING
  // ═══════════════════════════════════════════════════

  private toRoundNumberInt(value: unknown): number {
    const n = parseInt(String(value || ''), 10);
    return Number.isNaN(n) ? 0 : n;
  }

  private async buildPipelineInterviewFeedbackBlocks(
    interviews: Record<string, string>[]
  ): Promise<
    Array<{
      interview_id: string;
      label: string;
      weightedAvg10: string;
      rows: Array<{
        interviewerName: string;
        rating: string;
        recommendation: string;
        comments: string;
        technical: string;
        aptitude: string;
        communication: string;
        culture: string;
        weighted: string;
      }>;
    }>
  > {
    const blocks: Array<{
      interview_id: string;
      label: string;
      weightedAvg10: string;
      rows: Array<{
        interviewerName: string;
        rating: string;
        recommendation: string;
        comments: string;
        technical: string;
        aptitude: string;
        communication: string;
        culture: string;
        weighted: string;
      }>;
    }> = [];

    for (const iv of interviews || []) {
      const iid = String(iv['interview_id'] || iv['Interview_id'] || '').trim();
      if (!iid) continue;

      let feedbackRows: Record<string, string>[] = [];
      try {
        feedbackRows = await this.soap.getInterviewFeedbackForInterview(iid);
      } catch {
        continue;
      }
      if (!feedbackRows?.length) continue;

      const label = `${iv['interview_type'] || '?'} · Round ${iv['round_number'] ?? '?'}`;
      const rows: Array<{
        interviewerName: string;
        rating: string;
        recommendation: string;
        comments: string;
        technical: string;
        aptitude: string;
        communication: string;
        culture: string;
        weighted: string;
      }> = [];

      const toNum = (v: unknown): number => {
        const n = Number.parseFloat(String(v ?? '').trim());
        return Number.isFinite(n) ? n : 0;
      };
      const weighted10 = (tech: number, apt: number, comm: number, cult: number): number =>
        Math.round(((tech * 0.4) + (apt * 0.4) + (comm * 0.1) + (cult * 0.1)) * 10) / 10;

      let sumWeighted = 0;
      let weightedCount = 0;

      for (const fr of feedbackRows) {
        const uid = String(fr['interviewer_id'] || fr['Interviewer_id'] || '').trim();
        let interviewerName = uid || 'Interviewer';
        if (uid) {
          try {
            const u = await this.soap.getUserById(uid);
            if (u) {
              const nm = `${u['first_name'] || u['First_name'] || ''} ${u['last_name'] || u['Last_name'] || ''}`.trim();
              if (nm) interviewerName = nm;
            }
          } catch {
            /* keep id */
          }
        }
        const tech = toNum(fr['temp1'] ?? fr['Temp1'] ?? fr['technical'] ?? '');
        const apt = toNum(fr['temp2'] ?? fr['Temp2'] ?? fr['aptitude'] ?? '');
        const comm = toNum(fr['temp3'] ?? fr['Temp3'] ?? fr['communication'] ?? '');
        const cult = toNum(fr['temp4'] ?? fr['Temp4'] ?? fr['culture'] ?? '');
        const legacyRating = toNum(fr['rating'] ?? '');
        const hasCategory = tech > 0 || apt > 0 || comm > 0 || cult > 0;
        const w = hasCategory ? weighted10(tech, apt, comm, cult) : (Math.round(legacyRating * 10) / 10);

        sumWeighted += w;
        weightedCount += 1;

        rows.push({
          interviewerName,
          rating: String(fr['rating'] ?? ''),
          recommendation: String(fr['recommendation'] ?? ''),
          comments: String(fr['comments'] ?? ''),
          technical: tech ? String(tech) : '',
          aptitude: apt ? String(apt) : '',
          communication: comm ? String(comm) : '',
          culture: cult ? String(cult) : '',
          weighted: w ? String(w) : ''
        });
      }

      const avg = weightedCount ? Math.round((sumWeighted / weightedCount) * 10) / 10 : 0;
      blocks.push({ interview_id: iid, label, weightedAvg10: avg ? String(avg) : '', rows });
    }

    return blocks;
  }

  async loadInterviewDecisionState(): Promise<void> {
    if (!this.pipelineCandidate) return;

    const appId = this.pipelineCandidate.application_id;
    if (!appId) return;

    try {
      const interviews = await this.soap.getInterviewsForApplication(appId);
      const hrInterviews = (interviews || []).filter(iv => String(iv['interview_type'] || '').toUpperCase() === 'HR');
      const technicalInterviews = (interviews || []).filter(iv => String(iv['interview_type'] || '').toUpperCase() === 'TECHNICAL');

      // Distinct technical round numbers for dynamic pipeline dots
      const techRoundSet = new Set<number>();
      for (const iv of technicalInterviews) {
        techRoundSet.add(this.toRoundNumberInt(iv['round_number'] || 0));
      }
      this.technicalRoundNumbers = Array.from(techRoundSet).sort((a, b) => a - b);

      // If HR interview exists, we show HR decision UI; technical "next" UI should be hidden.
      if (hrInterviews.length > 0) {
        const maxHrRound = Math.max(...hrInterviews.map(iv => this.toRoundNumberInt(iv['round_number'] || '0')));
        this.hrInterviewRoundNumber = String(maxHrRound);
        this.isHrInterviewFeedbackChecking = true;
        this.hrInterviewFeedbackComplete = await this.soap.isRoundFeedbackComplete(appId, this.hrInterviewRoundNumber, 'HR');
      } else {
        this.hrInterviewRoundNumber = '';
        this.hrInterviewFeedbackComplete = false;
      }

      if (!this.hrInterviewRoundNumber) {
        if (technicalInterviews.length > 0) {
          const maxTechRound = Math.max(...technicalInterviews.map(iv => this.toRoundNumberInt(iv['round_number'] || '0')));
          this.latestTechnicalRoundNumber = String(maxTechRound);
          this.isTechnicalFeedbackChecking = true;
          this.latestTechnicalFeedbackComplete = await this.soap.isRoundFeedbackComplete(appId, this.latestTechnicalRoundNumber, 'TECHNICAL');
        } else {
          this.latestTechnicalRoundNumber = '';
          this.latestTechnicalFeedbackComplete = false;
        }
      } else {
        this.latestTechnicalRoundNumber = '';
        this.latestTechnicalFeedbackComplete = false;
      }

      this.pipelineInterviewFeedback = await this.buildPipelineInterviewFeedbackBlocks(interviews || []);

      // UI fallback: if backend gating still returns false due to mapping inconsistencies,
      // enable actions when every latest-round technical interview already has feedback rows.
      if (!this.hrInterviewRoundNumber && this.latestTechnicalRoundNumber && !this.latestTechnicalFeedbackComplete) {
        const latestRound = this.latestTechnicalRoundNumber;
        const latestRoundInterviews = (technicalInterviews || []).filter(iv => {
          const rn = String(iv['round_number'] || iv['roundNumber'] || '');
          const st = String(iv['status'] || iv['Status'] || '').toUpperCase();
          return rn === latestRound && st !== 'CANCELLED';
        });
        const interviewsWithFeedback = new Set(
          (this.pipelineInterviewFeedback || [])
            .map(b => String(b.interview_id || '').trim())
            .filter(Boolean)
        );
        const allInterviewsHaveFeedback =
          latestRoundInterviews.length > 0 &&
          latestRoundInterviews.every(iv => {
            const iid = String(iv['interview_id'] || iv['Interview_id'] || '').trim();
            return !!iid && interviewsWithFeedback.has(iid);
          });
        if (allInterviewsHaveFeedback) {
          this.latestTechnicalFeedbackComplete = true;
        } else {
          // Final UX fallback: if at least one latest-round technical interview has feedback rows,
          // allow HR to proceed instead of blocking forever on stale/intermittent mapping data.
          const hasAnyLatestRoundFeedback =
            latestRoundInterviews.length > 0 &&
            latestRoundInterviews.some(iv => {
              const iid = String(iv['interview_id'] || iv['Interview_id'] || '').trim();
              return !!iid && interviewsWithFeedback.has(iid);
            });
          if (hasAnyLatestRoundFeedback) {
            this.latestTechnicalFeedbackComplete = true;
          }
        }
      }

      // Rebuild pipeline dot items for the currently selected candidate
      this.rebuildPipelineDotItems();
    } catch (err) {
      console.error('Failed to load interview decision state:', err);
      this.latestTechnicalRoundNumber = '';
      this.latestTechnicalFeedbackComplete = false;
      this.hrInterviewRoundNumber = '';
      this.hrInterviewFeedbackComplete = false;
      this.technicalRoundNumbers = [];
      this.pipelineInterviewFeedback = [];
      this.rebuildPipelineDotItems();
    } finally {
      this.isTechnicalFeedbackChecking = false;
      this.isHrInterviewFeedbackChecking = false;
    }
  }

  // ═══════════════════════════════════════════════════
  //  STOP TECHNICAL (UI actions)
  // ═══════════════════════════════════════════════════

  openStopTechnicalForm(): void {
    this.showStopTechnicalForm = true;
  }

  closeStopTechnicalForm(): void {
    this.showStopTechnicalForm = false;
  }

  // ═══════════════════════════════════════════════════
  //  NEXT TECHNICAL ROUND (UI scheduling)
  // ═══════════════════════════════════════════════════

  openTechnicalNextRoundForm(): void {
    if (!this.pipelineCandidate) return;
    if (!this.latestTechnicalRoundNumber) return;
    if (!this.latestTechnicalFeedbackComplete) return;

    const nextRoundInt = this.toRoundNumberInt(this.latestTechnicalRoundNumber) + 1;
    this.technicalNextRoundNumber = String(nextRoundInt);

    this.technicalNextRoundIsSubmitting = false;
    this.showTechnicalNextRoundForm = true;
    this.showStopTechnicalForm = false;
    this.showHrInterviewForm = false;

    // Reset scheduling fields
    this.technicalNextSelectedSlotId = '';
    this.technicalNextSlots = [];
    this.technicalNextAvailableAdditionalInterviewers = [];
    this.technicalNextSelectedAdditionalInterviewerIds = {};
    this.technicalNextMeetingLink = '';
    this.technicalNextDate = this.getTomorrowLocalISODate();

    const u1 = this.technicalInterviewers[0]?.['user_id'] || '';
    this.technicalNextFirstInterviewerId = u1;
    if (this.technicalNextFirstInterviewerId) {
      void this.onTechnicalNextFirstInterviewerChange();
    }
  }

  closeTechnicalNextRoundForm(): void {
    this.showTechnicalNextRoundForm = false;
    this.technicalNextRoundIsSubmitting = false;
  }

  async onTechnicalNextFirstInterviewerChange(): Promise<void> {
    this.technicalNextSelectedSlotId = '';
    this.technicalNextSlots = [];
    this.technicalNextAvailableAdditionalInterviewers = [];
    this.technicalNextSelectedAdditionalInterviewerIds = {};

    if (!this.technicalNextFirstInterviewerId || !this.technicalNextDate) return;

    const slots = await this.getSlotsForInterviewer(this.technicalNextFirstInterviewerId);
    this.technicalNextSlots = this.filterAvailableSlots(slots || []).filter(
      s => (s['slot_date'] || '') === this.technicalNextDate
    );
    if (this.technicalNextSlots.length > 0) {
      this.technicalNextSelectedSlotId = this.technicalNextSlots[0]['slot_id'] || '';
      await this.onTechnicalNextSlotChange();
    }
  }

  async onTechnicalNextDateChange(): Promise<void> {
    await this.onTechnicalNextFirstInterviewerChange();
  }

  async onTechnicalNextSlotChange(): Promise<void> {
    this.technicalNextAvailableAdditionalInterviewers = [];
    this.technicalNextSelectedAdditionalInterviewerIds = {};

    if (!this.technicalNextSelectedSlotId || !this.technicalNextFirstInterviewerId) return;

    const selectedSlot = this.technicalNextSlots.find(s => s['slot_id'] === this.technicalNextSelectedSlotId);
    if (!selectedSlot) return;

    const targetDate = selectedSlot['slot_date'] || this.technicalNextDate;
    const targetStartTime = selectedSlot['start_time'] || '';

    const available: Record<string, string>[] = [];
    for (const u of this.technicalInterviewers) {
      if (!u['user_id']) continue;
      if (u['user_id'] === this.technicalNextFirstInterviewerId) continue;

      const slots = await this.getSlotsForInterviewer(u['user_id']);
      const hasSameSlot = (slots || []).some(
        s =>
          (s['slot_date'] || '') === targetDate &&
          (s['start_time'] || '') === targetStartTime &&
          this.isSlotRowAvailable(s)
      );
      if (hasSameSlot) available.push(u);
    }

    this.technicalNextAvailableAdditionalInterviewers = available;
  }

  toggleTechnicalNextAdditionalInterviewer(userId: string, checked: boolean): void {
    this.technicalNextSelectedAdditionalInterviewerIds[userId] = checked;
  }

  async confirmTechnicalNextRound(): Promise<void> {
    if (!this.pipelineCandidate) return;
    if (!this.technicalNextRoundNumber) return;
    if (!this.technicalNextFirstInterviewerId || !this.technicalNextSelectedSlotId) return;
    if (!this.technicalNextSchedulingReady()) {
      alert('Please select a future interview date, a slot, and a valid meeting link (https://...).');
      return;
    }

    const meetingLink = this.technicalNextMeetingLink.trim();

    this.technicalNextRoundIsSubmitting = true;
    const app = this.pipelineCandidate;
    const stepKey = 'TECH_ROUND_DECISION';

    try {
      const assigneeEmail = await this.resolveBpmAssigneeEmail(app);
      if (!assigneeEmail) {
        alert(
          'Could not resolve BPM assignee email (job requisition owner / user record). Check requisition and ts_users.'
        );
        return;
      }

      const selectedAdditionalIds = Object.entries(this.technicalNextSelectedAdditionalInterviewerIds)
        .filter(([_, v]) => !!v)
        .map(([k]) => k);
      const interviewerIds = [this.technicalNextFirstInterviewerId, ...selectedAdditionalIds].filter(Boolean);

      await this.updateApplicationTempWithRetry(
        app.application_id,
        app._raw,
        { temp1: stepKey }
      );
      await this.soap.triggerApplicationTaskIDGenerationBPM(assigneeEmail, app.application_id);
      const { taskId } = await this.waitForTaskIdInTemp5(app.application_id);

      if (!taskId) {
        alert('BPM TaskId was not written to ts_applications.temp5.');
        return;
      }

      await this.soap.createInterviewRound(
        app.application_id,
        this.technicalNextRoundNumber,
        'TECHNICAL',
        this.technicalNextSelectedSlotId,
        interviewerIds,
        this.loggedInUserId,
        meetingLink
      );
      this.clearSlotsCache();
      void this.onTechnicalNextFirstInterviewerChange();

      // Send interview scheduling mails to candidate + assigned interviewers (non-blocking)
      try {
        const roundNumStr = String(this.technicalNextRoundNumber);
        const eventType =
          roundNumStr === '1' ? 'INTERVIEW_SCHEDULED' : 'NEXT_INTERVIEW_SCHEDULED';
        const jobTitle = this.getJobTitle(app.requisition_id);
        const candidateName = app.candidate_name;
        const candidateEmail = app.candidate_email;

        const uniqueInterviewerIds = Array.from(new Set((interviewerIds || []).filter(Boolean)));
        const userRows = await Promise.all(
          uniqueInterviewerIds.map(uid => this.soap.getUserById(uid).catch(() => null))
        );
        const interviewerInfos = userRows
          .filter(Boolean)
          .map((u: any) => {
            const email = String(u?.['email'] || u?.['Email'] || '').trim();
            const name = `${u?.['first_name'] || ''} ${u?.['last_name'] || ''}`.trim() || email || '';
            return { uid: String(u?.['user_id'] || u?.['User_id'] || ''), email, name };
          })
          .filter(x => x.email);

        if (candidateEmail) {
          const mail = buildMailBody(eventType as any, {
            recipientName: candidateName,
            candidateName,
            interviewType: 'TECHNICAL',
            roundNumber: roundNumStr,
            requisitionId: app.requisition_id,
            jobTitle,
            meetingLink
          });
          await this.soap.sendAllMailsBPM(candidateEmail, mail.subject, mail.body);
        }

        for (const iv of interviewerInfos) {
          const mail = buildMailBody(eventType as any, {
            recipientName: iv.name,
            candidateName,
            interviewType: 'TECHNICAL',
            roundNumber: roundNumStr,
            requisitionId: app.requisition_id,
            jobTitle,
            meetingLink
          });
          await this.soap.sendAllMailsBPM(iv.email, mail.subject, mail.body);
        }
      } catch (mailErr) {
        console.warn('[HR] Failed to send interview scheduled mail (non-blocking):', mailErr);
      }

      // Keep candidate in "Interview" pipeline; do not force stage move every technical round.
      await this.soap.performTaskAction(taskId, 'COMPLETE', {
        decision: 'NEXT',
        stepKey,
        roundNumber: this.technicalNextRoundNumber
      });

      // Clear temp5 using latest DB tuple to avoid tupleChangedError.
      try {
        const latestAfterTask = await this.soap.getApplicationById(app.application_id);
        if (latestAfterTask) {
          await this.updateApplicationTempWithRetry(
            app.application_id,
            latestAfterTask,
            { temp5: '' }
          );
        }
      } catch (e) {
        // Non-blocking: if BPM already updated/cleared temp5, continue.
        console.warn('[HR] Failed to clear temp5 (non-blocking):', e);
      }

      this.showTechnicalNextRoundForm = false;
      this.showStopTechnicalForm = false;
      this.technicalNextRoundIsSubmitting = false;
      app._raw['temp5'] = '';

      await this.loadInterviewDecisionState();
      this.applyFilters();
    } catch (err) {
      console.error('Technical next round failed:', err);
      alert('Failed to create next technical round. Check console.');
    } finally {
      this.technicalNextRoundIsSubmitting = false;
    }
  }

  // ═══════════════════════════════════════════════════
  //  MOVE TO OFFER (no HR interview path)
  // ═══════════════════════════════════════════════════

  async moveToOfferDirect(): Promise<void> {
    if (!this.pipelineCandidate) return;

    const app = this.pipelineCandidate;
    const stepKey = 'MOVE_TO_OFFER';

    this.technicalNextRoundIsSubmitting = true;
    try {
      const assigneeEmail = await this.resolveBpmAssigneeEmail(app);
      if (!assigneeEmail) {
        alert(
          'Could not resolve BPM assignee email (job requisition owner / user record). Check requisition and ts_users.'
        );
        return;
      }

      const offerStage = this.findStageByKeyword('offer');
      if (!offerStage) {
        alert('Offer stage not configured in mt_pipeline_stages.');
        return;
      }

      await this.soap.updateApplicationTemp(app._raw, { temp1: stepKey });
      await this.soap.triggerApplicationTaskIDGenerationBPM(assigneeEmail, app.application_id);
      const { taskId } = await this.waitForTaskIdInTemp5(app.application_id);

      if (!taskId) {
        alert('BPM TaskId was not written to ts_applications.temp5.');
        return;
      }

      // Refetch latest tuple before moving stage to avoid Cordys tupleChangedError (temp1/temp5 may be updated by BPM).
      const latestAfterBpm = await this.soap.getApplicationById(app.application_id);
      const fromStageId = latestAfterBpm?.['current_stage_id'] || app.current_stage_id;
      await this.soap.updateApplicationStageAndStatus(
        latestAfterBpm || app._raw,
        'ACTIVE',
        offerStage.stage_id
      );
      await this.soap.insertStageHistory({
        application_id: app.application_id,
        from_stage_id: fromStageId,
        to_stage_id: offerStage.stage_id,
        changed_by: this.loggedInUserId,
        comments: 'Technical stopped; moved to Offer.'
      });

      await this.soap.performTaskAction(taskId, 'COMPLETE', { decision: 'MOVE_TO_OFFER', stepKey });
      await this.soap.updateApplicationTemp(app._raw, { temp5: '' });

      app.current_stage_id = offerStage.stage_id;
      app.stage_name = offerStage.stage_name;
      app.status = 'ACTIVE';
      app._raw['current_stage_id'] = offerStage.stage_id;
      app._raw['status'] = 'ACTIVE';

      this.showStopTechnicalForm = false;
      await this.loadInterviewDecisionState();
      this.closePipelineModal();
      // Bring HR to Offers screen to create/send the offer.
      this.router.navigate(['/hr/offers']);
    } catch (err) {
      console.error('Move to offer failed:', err);
      alert('Failed to move candidate to Offer.');
    } finally {
      this.technicalNextRoundIsSubmitting = false;
    }
  }

  // ═══════════════════════════════════════════════════
  //  OPTIONAL HR INTERVIEW scheduling + decision
  // ═══════════════════════════════════════════════════

  openHrInterviewForm(): void {
    if (!this.pipelineCandidate) return;
    if (!this.latestTechnicalRoundNumber) {
      alert('Latest technical round not found.');
      return;
    }

    const nextRoundInt = this.toRoundNumberInt(this.latestTechnicalRoundNumber) + 1;
    this.hrInterviewRoundNumber = String(nextRoundInt);

    this.hrInterviewIsSubmitting = false;
    this.showHrInterviewForm = true;
    this.showStopTechnicalForm = false;
    this.showTechnicalNextRoundForm = false;

    this.hrInterviewSelectedSlotId = '';
    this.hrInterviewSlots = [];
    this.hrInterviewFirstInterviewerId = this.technicalInterviewers[0]?.['user_id'] || '';
    this.hrInterviewMeetingLink = '';
    this.hrInterviewDate = this.getTomorrowLocalISODate();

    if (this.hrInterviewFirstInterviewerId) {
      void this.onHrInterviewFirstInterviewerChange();
    }
  }

  closeHrInterviewForm(): void {
    this.showHrInterviewForm = false;
    this.hrInterviewIsSubmitting = false;
  }

  async onHrInterviewFirstInterviewerChange(): Promise<void> {
    this.hrInterviewSelectedSlotId = '';
    this.hrInterviewSlots = [];

    if (!this.hrInterviewFirstInterviewerId || !this.hrInterviewDate) return;

    const slots = await this.getSlotsForInterviewer(this.hrInterviewFirstInterviewerId);
    this.hrInterviewSlots = this.filterAvailableSlots(slots || []).filter(
      s => (s['slot_date'] || '') === this.hrInterviewDate
    );
    if (this.hrInterviewSlots.length > 0) {
      this.hrInterviewSelectedSlotId = this.hrInterviewSlots[0]['slot_id'] || '';
    }
  }

  async onHrInterviewDateChange(): Promise<void> {
    await this.onHrInterviewFirstInterviewerChange();
  }

  onHrInterviewSlotChange(): void {
    // No-op (slot selection already stored in hrInterviewSelectedSlotId)
  }

  async confirmHrInterviewCreate(): Promise<void> {
    if (!this.pipelineCandidate) return;
    if (!this.hrInterviewRoundNumber) return;
    if (!this.hrInterviewFirstInterviewerId || !this.hrInterviewSelectedSlotId) return;
    if (!this.hrInterviewSchedulingReady()) {
      alert('Please select a future interview date, a slot, and a valid meeting link (https://...).');
      return;
    }

    const meetingLink = this.hrInterviewMeetingLink.trim();

    this.hrInterviewIsSubmitting = true;
    const app = this.pipelineCandidate;
    const stepKey = 'OPTIONAL_HR_INTERVIEW_DECISION';

    try {
      const assigneeEmail = await this.resolveBpmAssigneeEmail(app, {
        assigneeUserId: this.hrInterviewFirstInterviewerId
      });
      if (!assigneeEmail) {
        alert(
          'Could not resolve BPM assignee email for the selected HR interviewer (or requisition owner fallback).'
        );
        return;
      }

      // Retry temp updates because BPM/workflow may update the tuple meanwhile.
      await this.updateApplicationTempWithRetry(
        app.application_id,
        app._raw,
        { temp1: stepKey }
      );
      await this.soap.triggerApplicationTaskIDGenerationBPM(assigneeEmail, app.application_id);
      const { taskId } = await this.waitForTaskIdInTemp5(app.application_id);

      if (!taskId) {
        alert('BPM TaskId was not written to ts_applications.temp5.');
        return;
      }

      // Create HR interview (single interviewer)
      await this.soap.createInterviewRound(
        app.application_id,
        this.hrInterviewRoundNumber,
        'HR',
        this.hrInterviewSelectedSlotId,
        [this.hrInterviewFirstInterviewerId],
        this.loggedInUserId,
        meetingLink
      );
      this.clearSlotsCache();
      void this.onHrInterviewFirstInterviewerChange();

      // Send interview scheduling mails to candidate + assigned HR interviewer (non-blocking)
      try {
        const roundNumStr = String(this.hrInterviewRoundNumber);
        const eventType =
          roundNumStr === '1' ? 'INTERVIEW_SCHEDULED' : 'NEXT_INTERVIEW_SCHEDULED';
        const jobTitle = this.getJobTitle(app.requisition_id);
        const candidateName = app.candidate_name;
        const candidateEmail = app.candidate_email;

        const interviewerUserIds = [this.hrInterviewFirstInterviewerId].filter(Boolean);
        const userRows = await Promise.all(
          interviewerUserIds.map(uid => this.soap.getUserById(uid).catch(() => null))
        );
        const interviewerInfos = userRows
          .filter(Boolean)
          .map((u: any) => {
            const email = String(u?.['email'] || u?.['Email'] || '').trim();
            const name = `${u?.['first_name'] || ''} ${u?.['last_name'] || ''}`.trim() || email || '';
            return { email, name };
          })
          .filter(x => x.email);

        if (candidateEmail) {
          const mail = buildMailBody(eventType as any, {
            recipientName: candidateName,
            candidateName,
            interviewType: 'HR',
            roundNumber: roundNumStr,
            requisitionId: app.requisition_id,
            jobTitle,
            meetingLink
          });
          await this.soap.sendAllMailsBPM(candidateEmail, mail.subject, mail.body);
        }

        for (const iv of interviewerInfos) {
          const mail = buildMailBody(eventType as any, {
            recipientName: iv.name,
            candidateName,
            interviewType: 'HR',
            roundNumber: roundNumStr,
            requisitionId: app.requisition_id,
            jobTitle,
            meetingLink
          });
          await this.soap.sendAllMailsBPM(iv.email, mail.subject, mail.body);
        }
      } catch (mailErr) {
        console.warn('[HR] Failed to send HR interview scheduling mail (non-blocking):', mailErr);
      }

      // Keep candidate in Interview stage (or move back to it if needed)
      const interviewStage = this.findStageByKeyword('interview');
      if (interviewStage) {
        await this.soap.updateApplicationStageAndStatus(app._raw, 'ACTIVE', interviewStage.stage_id);
      }

      // COMPLETE can fail if workflow already moved the task to COMPLETED.
      try {
        await this.soap.performTaskAction(taskId, 'COMPLETE', {
          decision: 'YES',
          stepKey,
          roundNumber: this.hrInterviewRoundNumber
        });
      } catch (e: any) {
        const msg = String(e?.message || e?.error || e?.responseText || e || '');
        const isAlreadyCompleted = msg.toUpperCase().includes('NOT ALLOWED') && msg.toUpperCase().includes('STATE OF THE TASK IS') && msg.toUpperCase().includes('COMPLETED');
        if (!isAlreadyCompleted) throw e;
      }

      // Clear temp5 using latest DB tuple to avoid tupleChangedError.
      const latestAfterTask = await this.soap.getApplicationById(app.application_id);
      if (latestAfterTask) {
        await this.updateApplicationTempWithRetry(
          app.application_id,
          latestAfterTask,
          { temp5: '' }
        );
      }

      this.showHrInterviewForm = false;
      await this.loadInterviewDecisionState();
      this.applyFilters();
    } catch (err) {
      console.error('Create HR interview failed:', err);
      alert('Failed to create HR interview.');
    } finally {
      this.hrInterviewIsSubmitting = false;
    }
  }

  async confirmHrInterviewPass(): Promise<void> {
    if (!this.pipelineCandidate) return;
    if (!this.hrInterviewRoundNumber) return;
    if (!this.hrInterviewFeedbackComplete) return;

    const app = this.pipelineCandidate;
    const stepKey = 'HR_INTERVIEW_DECISION';

    this.hrInterviewIsSubmitting = true;
    try {
      const assigneeEmail = await this.resolveBpmAssigneeEmail(app);
      if (!assigneeEmail) {
        alert(
          'Could not resolve BPM assignee email (job requisition owner / user record). Check requisition and ts_users.'
        );
        return;
      }

      const offerStage = this.findStageByKeyword('offer');
      if (!offerStage) {
        alert('Offer stage not configured in mt_pipeline_stages.');
        return;
      }

      await this.updateApplicationTempWithRetry(
        app.application_id,
        app._raw,
        { temp1: stepKey }
      );
      await this.soap.triggerApplicationTaskIDGenerationBPM(assigneeEmail, app.application_id);
      const { taskId } = await this.waitForTaskIdInTemp5(app.application_id);

      if (!taskId) {
        alert('BPM TaskId was not written to ts_applications.temp5.');
        return;
      }

      const { fromStageId } = await this.updateApplicationStageAndStatusWithRetry(
        app.application_id,
        'ACTIVE',
        offerStage.stage_id
      );
      await this.soap.insertStageHistory({
        application_id: app.application_id,
        from_stage_id: fromStageId,
        to_stage_id: offerStage.stage_id,
        changed_by: this.loggedInUserId,
        comments: 'HR interview passed; moved to Offer.'
      });

      try {
        await this.soap.performTaskAction(taskId, 'COMPLETE', {
          decision: 'PASS',
          stepKey,
          roundNumber: this.hrInterviewRoundNumber
        });
      } catch (e: any) {
        const msg = String(e?.message || e?.error || e?.responseText || e || '');
        const isAlreadyCompleted = msg.toUpperCase().includes('NOT ALLOWED') &&
          msg.toUpperCase().includes('STATE OF THE TASK IS') &&
          msg.toUpperCase().includes('COMPLETED');
        if (!isAlreadyCompleted) throw e;
      }

      const latestAfterTask = await this.soap.getApplicationById(app.application_id);
      if (latestAfterTask) {
        await this.updateApplicationTempWithRetry(
          app.application_id,
          latestAfterTask,
          { temp5: '' }
        );
      }

      app.current_stage_id = offerStage.stage_id;
      app.stage_name = offerStage.stage_name;
      app.status = 'ACTIVE';
      app._raw['current_stage_id'] = offerStage.stage_id;
      app._raw['status'] = 'ACTIVE';

      this.showStopTechnicalForm = false;
      await this.loadInterviewDecisionState();
      this.closePipelineModal();
      // Bring HR to Offers screen to create/send the offer.
      this.router.navigate(['/hr/offers']);
    } catch (err) {
      console.error('HR interview pass failed:', err);
      alert('Failed to pass to Offer.');
    } finally {
      this.hrInterviewIsSubmitting = false;
    }
  }

  async confirmHrInterviewFail(): Promise<void> {
    if (!this.pipelineCandidate) return;
    if (!this.hrInterviewRoundNumber) return;
    if (!this.hrInterviewFeedbackComplete) return;

    const app = this.pipelineCandidate;
    const stepKey = 'HR_INTERVIEW_DECISION';

    this.hrInterviewIsSubmitting = true;
    try {
      const assigneeEmail = await this.resolveBpmAssigneeEmail(app);
      if (!assigneeEmail) {
        alert(
          'Could not resolve BPM assignee email (job requisition owner / user record). Check requisition and ts_users.'
        );
        return;
      }

      const rejectedStage = this.findStageByKeyword('rejected');
      if (!rejectedStage) {
        alert('Rejected stage not configured in mt_pipeline_stages.');
        return;
      }

      await this.updateApplicationTempWithRetry(
        app.application_id,
        app._raw,
        { temp1: stepKey }
      );
      await this.soap.triggerApplicationTaskIDGenerationBPM(assigneeEmail, app.application_id);
      const { taskId } = await this.waitForTaskIdInTemp5(app.application_id);

      if (!taskId) {
        alert('BPM TaskId was not written to ts_applications.temp5.');
        return;
      }

      // Cancel remaining interviews for this application
      await this.soap.cancelApplicationInterviews(app.application_id);

      const { fromStageId } = await this.updateApplicationStageAndStatusWithRetry(
        app.application_id,
        'REJECTED',
        rejectedStage.stage_id
      );
      await this.soap.insertStageHistory({
        application_id: app.application_id,
        from_stage_id: fromStageId,
        to_stage_id: rejectedStage.stage_id,
        changed_by: this.loggedInUserId,
        comments: 'HR interview failed; rejected candidate.'
      });

      try {
        await this.soap.performTaskAction(taskId, 'COMPLETE', {
          decision: 'FAIL',
          stepKey,
          roundNumber: this.hrInterviewRoundNumber
        });
      } catch (e: any) {
        const msg = String(e?.message || e?.error || e?.responseText || e || '');
        const isAlreadyCompleted =
          msg.toUpperCase().includes('NOT ALLOWED') &&
          msg.toUpperCase().includes('STATE OF THE TASK IS') &&
          msg.toUpperCase().includes('COMPLETED');
        if (!isAlreadyCompleted) throw e;
      }

      const latestAfterTask = await this.soap.getApplicationById(app.application_id);
      if (latestAfterTask) {
        await this.updateApplicationTempWithRetry(
          app.application_id,
          latestAfterTask,
          { temp5: '' }
        );
      }

      app.current_stage_id = rejectedStage.stage_id;
      app.stage_name = rejectedStage.stage_name;
      app.status = 'REJECTED';
      app._raw['current_stage_id'] = rejectedStage.stage_id;
      app._raw['status'] = 'REJECTED';

      this.showStopTechnicalForm = false;
      await this.loadInterviewDecisionState();
      this.applyFilters();
    } catch (err) {
      console.error('HR interview fail failed:', err);
      alert('Failed to reject candidate.');
    } finally {
      this.hrInterviewIsSubmitting = false;
    }
  }

  // ═══════════════════════════════════════════════════
  //  ARGUED OFFER RESOLUTION (BPM-driven)
  // ═══════════════════════════════════════════════════════════

  private async resolveArguedOfferForCandidateApplication(
    app: CandidateRow,
    resolution: 'APPROVED' | 'REJECTED'
  ): Promise<void> {
    const appId = app.application_id;
    if (!appId) return;

    // BPM step key (required by your BPM design)
    const stepKey = 'ARGUE_RESOLUTION';

    const assigneeEmail = await this.resolveBpmAssigneeEmail(app);
    if (!assigneeEmail) {
      alert(
        'Could not resolve BPM assignee email (job requisition owner / user record). Check requisition and ts_users.'
      );
      return;
    }

    // Fetch all applications for that candidate (needed for canceling others on approve)
    const candidateApps = await this.soap.getApplicationsByCandidate(app.candidate_id);
    const candidateAppIds = (candidateApps || []).map(a => a['application_id'] || '').filter(Boolean);

    // Fetch offers for each candidate application
    const offersResults = await Promise.all(
      candidateAppIds.map(id => this.soap.getOffersByApplication(id).catch(() => []))
    );
    const offerMap = new Map<string, Record<string, string>>();
    offersResults.forEach((offers, idx) => {
      const applicationId = candidateAppIds[idx];
      const firstOffer = (offers || [])[0];
      if (applicationId && firstOffer) offerMap.set(applicationId, firstOffer);
    });

    // Resolve stage IDs from mt_pipeline_stages
    const hiredStage = this.findStageByKeyword('hired');
    const cancelledStage = this.stages.find(s => (s.stage_name || '').toLowerCase().includes('cancel'));
    const rejectedStage = this.findStageByKeyword('rejected');
    const hiredStageId = hiredStage?.stage_id || '';
    const cancelledStageId = cancelledStage?.stage_id || '';
    const rejectedStageId = rejectedStage?.stage_id || '';

    if (resolution === 'APPROVED' && !hiredStageId) {
      alert('Hired stage is not configured in mt_pipeline_stages.');
      return;
    }
    if (resolution === 'APPROVED' && !cancelledStageId) {
      alert('Cancelled stage is not configured in mt_pipeline_stages.');
      return;
    }
    if (resolution === 'REJECTED' && !rejectedStageId) {
      alert('Rejected stage is not configured in mt_pipeline_stages.');
      return;
    }

    // 1) Update temp stepKey + trigger BPM + read TaskId from temp5
    await this.soap.updateApplicationTemp(app._raw, { temp1: stepKey });
    await this.soap.triggerApplicationTaskIDGenerationBPM(assigneeEmail, appId);
    const { taskId } = await this.waitForTaskIdInTemp5(appId);

    if (!taskId) {
      alert('BPM TaskId was not written to ts_applications.temp5.');
      return;
    }

    // 2) Apply workflow resolution in DB (Angular/TypeScript core logic)
    const winnerOffer = offerMap.get(appId);
    if (resolution === 'APPROVED') {
      if (!winnerOffer || !winnerOffer['offer_id']) {
        alert('No offer record found for the argued application.');
        return;
      }

      // a) Mark winning offer accepted
      await this.soap.updateOfferStatus(winnerOffer['offer_id'] || '', 'ACCEPTED');

      // b) Mark winning application HIRED + stage move
      await this.soap.updateApplicationStageAndStatus(app._raw, 'HIRED', hiredStageId);
      const fromStageId = app.current_stage_id;

      await this.soap.insertStageHistory({
        application_id: app.application_id,
        from_stage_id: fromStageId,
        to_stage_id: hiredStageId,
        changed_by: this.loggedInUserId,
        comments: 'Argued offer resolved by HR: Approved (Hire).'
      });

      // c) Cancel other ACTIVE applications + cancel interviews + reject their offers
      for (const otherApp of candidateApps || []) {
        const otherAppId = otherApp['application_id'] || '';
        if (!otherAppId) continue;
        if (String(otherAppId) === String(appId)) continue;
        const otherStatus = String(otherApp['status'] || '').toUpperCase();
        if (otherStatus !== 'ACTIVE') continue;

        if (cancelledStageId) {
          await this.soap.updateApplicationStageAndStatus(otherApp as any, 'CANCELLED', cancelledStageId);
        }

        const otherInterviews = await this.soap.getInterviewsForApplication(otherAppId);
        for (const iv of otherInterviews) {
          const interviewId = iv['interview_id'] || iv['Interview_id'] || '';
          if (!interviewId) continue;
          await this.soap.updateInterviewStatus(interviewId, 'CANCELLED');
        }

        const otherOffer = offerMap.get(otherAppId);
        if (otherOffer && otherOffer['offer_id']) {
          await this.soap.updateOfferStatus(otherOffer['offer_id'], 'REJECTED');
        }
      }
    } else {
      // REJECTED
      if (!winnerOffer || !winnerOffer['offer_id']) {
        alert('No offer record found for the argued application.');
        return;
      }

      const fromStageId = app.current_stage_id;

      await this.soap.updateOfferStatus(winnerOffer['offer_id'] || '', 'REJECTED');
      await this.soap.updateApplicationStageAndStatus(app._raw, 'REJECTED', rejectedStageId);

      await this.soap.insertStageHistory({
        application_id: app.application_id,
        from_stage_id: fromStageId,
        to_stage_id: rejectedStageId,
        changed_by: this.loggedInUserId,
        comments: 'Argued offer resolved by HR: Rejected.'
      });
    }

    // 3) Complete BPM task
    await this.soap.performTaskAction(taskId, 'COMPLETE', {
      decision: resolution,
      stepKey
    });

    // 4) Clear temp5 (task id) to avoid re-complete
    await this.soap.updateApplicationTemp(app._raw, { temp5: '' });

    // 5) Notify candidate + HR about final argued-offer outcome (non-blocking)
    try {
      const jobTitle = this.getJobTitle(app.requisition_id);
      const candidateEmail = app.candidate_email;
      const hrEmail = assigneeEmail; // BPM assignee email == HR recipient in this flow

      // Winner offer record (may be needed for joining date)
      const winnerOffer = offerMap.get(appId) || {};
      const mailEvent = resolution === 'APPROVED' ? 'OFFER_ACCEPTED' : 'OFFER_REJECTED';

      const mail = buildMailBody(mailEvent as any, {
        candidateName: app.candidate_name,
        jobTitle,
        joiningDate: winnerOffer['joining_date'] || winnerOffer['joining'] || '',
        rejectionReason: winnerOffer['rejection_reason'] || ''
      });

      if (candidateEmail) {
        await this.soap.sendAllMailsBPM(candidateEmail, mail.subject, mail.body);
      }
      if (hrEmail) {
        await this.soap.sendAllMailsBPM(hrEmail, mail.subject, mail.body);
      }
    } catch (mailErr) {
      console.warn('[HR] Failed to send argued-offer final outcome mail (non-blocking):', mailErr);
    }
  }

  async confirmArgueResolution(resolution: 'APPROVED' | 'REJECTED'): Promise<void> {
    if (!this.pipelineCandidate) return;

    this.isArgueResolving = true;
    try {
      await this.resolveArguedOfferForCandidateApplication(this.pipelineCandidate, resolution);

      this.closePipelineModal();
      await this.loadData();
    } catch (err) {
      console.error('Argue resolution failed:', err);
      alert('Failed to resolve argued offer. Check console for details.');
    } finally {
      this.isArgueResolving = false;
    }
  }

  // ═══════════════════════════════════════════════════
  //  NAVIGATION (kept for pipeline board page link)
  // ═══════════════════════════════════════════════════

  goToPipeline(requisitionId: string): void {
    this.closeDrawer();
    this.router.navigate(['/hr/pipeline'], { queryParams: { job: requisitionId } });
  }

  // ═══════════════════════════════════════════════════
  //  HELPERS
  // ═══════════════════════════════════════════════════

  getJobTitle(reqId: string): string {
    return this.jobs.find(j => j.requisition_id === reqId)?.title || reqId;
  }

  getSkillName(skillId: string): string {
    return this.skills.find(s => s['skill_id'] === skillId)?.['skill_name'] || skillId;
  }

  getInitials(name: string): string {
    return name.split(' ').map(w => w.charAt(0)).slice(0, 2).join('').toUpperCase();
  }

  formatDate(d: string): string {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
