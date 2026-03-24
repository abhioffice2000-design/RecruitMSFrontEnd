import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import jsPDF from 'jspdf';
import { SoapService } from '../../../services/soap.service';
import { buildMailBody, type MailEvent } from '../../../services/mail-templates';

interface AppRow {
  application_id: string;
  requisition_id: string;
  jobTitle: string;
  department: string;
  status: string;
  current_stage_id: string;
  stageName: string;
  stageOrder: number;
  applied_at: string;
  _raw: Record<string, string>;
  offer: {
    offer_id: string;
    salary: string;
    currency: string;
    joining: string;
    expiry: string;
    status: string;
    createdAt: string;
    createdBy: string;
    updatedAt: string;
    updatedBy: string;
    arguedReason: string;
  } | null;
}

@Component({
  selector: 'app-candidate-applications',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-wrap animate-fade-in">
      <div class="page-header">
        <div>
          <h1><i class="fas fa-file-alt"></i> My Applications</h1>
          <p>Track the status of your submitted applications.</p>
        </div>
        <button class="btn-browse" (click)="router.navigate(['/candidate/jobs'])">
          <i class="fas fa-search"></i> Browse More Jobs
        </button>
      </div>

      <div class="loading" *ngIf="isLoading"><div class="spinner"></div><p>Loading...</p></div>

      <div class="empty" *ngIf="!isLoading && applications.length === 0">
        <i class="fas fa-inbox empty-icon-fa"></i>
        <h3>No Applications Yet</h3>
        <p>You haven't applied to any jobs yet. Start browsing open positions!</p>
        <button class="btn-browse-sm" (click)="router.navigate(['/candidate/jobs'])">
          <i class="fas fa-search"></i> Browse Jobs
        </button>
      </div>

      <div class="app-list" *ngIf="!isLoading && applications.length > 0">
        <div class="app-card" *ngFor="let app of applications">
          <!-- Card Header -->
          <div class="card-top">
            <div class="card-left">
              <div class="job-avatar">{{ app.jobTitle.charAt(0) }}</div>
              <div>
                <span class="job-title">{{ app.jobTitle }}</span>
                <span class="job-dept">{{ app.department }}</span>
              </div>
            </div>
            <div class="card-right">
              <span class="status-pill" [ngClass]="app.status.toLowerCase()">
                <i class="fas" [ngClass]="getStatusIcon(app.status)"></i> {{ app.status }}
              </span>
              <span class="date-text"><i class="fas fa-calendar-alt"></i> {{ formatDate(app.applied_at) }}</span>
            </div>
          </div>

          <!-- Pipeline Progress -->
          <div class="pipeline-progress">
            <div class="progress-track">
              <div class="progress-fill" [style.width]="getProgress(app)"></div>
            </div>
            <div class="stage-dots">
              <div class="stage-dot-wrap" *ngFor="let stage of stages"
                   [class.completed]="getStageStatus(app, stage) === 'completed'"
                   [class.current]="getStageStatus(app, stage) === 'current'"
                   [class.pending]="getStageStatus(app, stage) === 'pending'">
                <div class="stage-dot">
                  <i class="fas" [ngClass]="stage.icon"></i>
                </div>
                <span class="stage-label">{{ stage.stage_name }}</span>
              </div>
            </div>
          </div>

          <!-- Current Stage Info -->
          <div class="stage-info-bar">
            <span class="current-stage-text">
              <i class="fas fa-map-marker-alt"></i> Current Stage: <strong>{{ app.stageName }}</strong>
            </span>
            <span class="app-id"><i class="fas fa-hashtag"></i> {{ app.application_id }}</span>
          </div>

          <!-- Offer Banner (only show after HR sends the offer) -->
          <div class="offer-banner" *ngIf="app.offer && app.offer.status === 'SENT'">
            <div class="offer-info">
              <i class="fas fa-gift offer-gift-icon"></i>
              <div>
                <span class="offer-title">{{ app.offer.status === 'SENT' ? 'Offer Received!' : 'Offer Created (Draft)' }}</span>
                <span class="offer-details">
                  <i class="fas fa-rupee-sign"></i> {{ app.offer.salary }} {{ app.offer.currency }}
                  &nbsp;·&nbsp;
                  <i class="fas fa-calendar-check"></i> Join by {{ formatDate(app.offer.joining) }}
                  &nbsp;·&nbsp;
                  <i class="fas fa-clock"></i> Expires {{ formatDate(app.offer.expiry) }}
                  <br />
                  <i class="fas fa-user-edit"></i> Created: {{ formatDate(app.offer.createdAt) }}
                  <span *ngIf="app.offer.createdBy"> ({{ app.offer.createdBy }})</span>
                  &nbsp;·&nbsp;
                  <i class="fas fa-sync-alt"></i> Updated: {{ formatDate(app.offer.updatedAt) }}
                  <span *ngIf="app.offer.updatedBy"> ({{ app.offer.updatedBy }})</span>
                </span>
              </div>
            </div>
            <div class="offer-actions" *ngIf="app.offer.status === 'SENT'">
              <button class="btn-download" (click)="downloadOfferLetter(app)">
                <i class="fas fa-download"></i> Download Letter
              </button>
              <button class="btn-accept" (click)="acceptOffer(app)" [disabled]="app.offer.status !== 'SENT'">
                <i class="fas fa-check"></i> Accept
              </button>
              <button class="btn-reject" (click)="rejectOffer(app)" [disabled]="app.offer.status !== 'SENT'">
                <i class="fas fa-times"></i> Decline
              </button>
              <button class="btn-argue" (click)="openArgueOfferModal(app)" [disabled]="app.offer.status !== 'SENT'">
                <i class="fas fa-scale-balanced"></i> Argue
              </button>
            </div>
          </div>
          <div class="offer-accepted-banner" *ngIf="app.offer && app.offer.status === 'ACCEPTED'">
            <i class="fas fa-check-circle"></i> You accepted this offer · Join by {{ formatDate(app.offer.joining) }}
            <div class="offer-details" style="margin-top:8px; display:block; color: inherit;">
              <i class="fas fa-user-edit"></i> Created: {{ formatDate(app.offer.createdAt) }} <span *ngIf="app.offer.createdBy">({{ app.offer.createdBy }})</span>
              &nbsp;·&nbsp;
              <i class="fas fa-sync-alt"></i> Updated: {{ formatDate(app.offer.updatedAt) }} <span *ngIf="app.offer.updatedBy">({{ app.offer.updatedBy }})</span>
            </div>
            <div style="margin-top:10px;">
              <button class="btn-download" (click)="downloadOfferLetter(app)">
                <i class="fas fa-download"></i> Download Offer Letter
              </button>
            </div>
          </div>
          <div class="offer-rejected-banner" *ngIf="app.offer && app.offer.status === 'REJECTED'">
            <i class="fas fa-times-circle"></i> You declined this offer
            <div class="offer-details" style="margin-top:8px; display:block; color: inherit;">
              <i class="fas fa-user-edit"></i> Created: {{ formatDate(app.offer.createdAt) }} <span *ngIf="app.offer.createdBy">({{ app.offer.createdBy }})</span>
              &nbsp;·&nbsp;
              <i class="fas fa-sync-alt"></i> Updated: {{ formatDate(app.offer.updatedAt) }} <span *ngIf="app.offer.updatedBy">({{ app.offer.updatedBy }})</span>
            </div>
          </div>
          <div class="offer-argued-banner" *ngIf="app.offer && app.offer.status === 'ARGUED'">
            <i class="fas fa-hourglass-half"></i> You argued this offer · HR review pending
            <div class="offer-details" style="margin-top:8px; display:block; color: inherit;">
              <i class="fas fa-user-edit"></i> Created: {{ formatDate(app.offer.createdAt) }} <span *ngIf="app.offer.createdBy">({{ app.offer.createdBy }})</span>
              &nbsp;·&nbsp;
              <i class="fas fa-sync-alt"></i> Updated: {{ formatDate(app.offer.updatedAt) }} <span *ngIf="app.offer.updatedBy">({{ app.offer.updatedBy }})</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="modal-overlay" *ngIf="showArgueOfferModal" (click)="closeArgueOfferModal()">
      <div class="modal-card" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3><i class="fas fa-scale-balanced"></i> Argue Offer</h3>
          <button type="button" class="modal-close" (click)="closeArgueOfferModal()" [disabled]="argueOfferSubmitting">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <p class="modal-subtitle" *ngIf="argueOfferTargetApp">
          Share why you want changes for <strong>{{ argueOfferTargetApp.jobTitle }}</strong>.
        </p>
        <textarea
          class="argue-textarea"
          [(ngModel)]="argueOfferReason"
          [disabled]="argueOfferSubmitting"
          maxlength="1000"
          placeholder="Example: I request a salary revision based on my experience and current market standards."
        ></textarea>
        <div class="argue-char-count">{{ argueOfferReason.length }}/1000</div>
        <div class="modal-actions">
          <button type="button" class="btn-cancel" (click)="closeArgueOfferModal()" [disabled]="argueOfferSubmitting">
            Cancel
          </button>
          <button
            type="button"
            class="btn-submit"
            (click)="submitArgueOffer()"
            [disabled]="argueOfferSubmitting || !argueOfferReason.trim()"
          >
            <i class="fas" [ngClass]="argueOfferSubmitting ? 'fa-spinner fa-spin' : 'fa-paper-plane'"></i>
            {{ argueOfferSubmitting ? 'Submitting...' : 'Submit Reason' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .animate-fade-in { animation: fadeIn 0.3s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    .page-header {
      display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px;
      h1 { margin: 0 0 4px; font-size: 24px; color: #1e293b; i { margin-right: 8px; color: #2563eb; } }
      p { color: #64748b; margin: 0; }
    }
    .btn-browse {
      padding: 10px 20px; background: #2563eb; color: #fff; border: none; border-radius: 8px;
      font-weight: 600; font-size: 13px; cursor: pointer; i { margin-right: 6px; }
      &:hover { background: #1d4ed8; }
    }

    .loading { display: flex; flex-direction: column; align-items: center; padding: 60px; color: #94a3b8;
      .spinner { width: 32px; height: 32px; border: 3px solid #e2e8f0; border-top-color: #2563eb; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 12px; }
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .empty {
      text-align: center; padding: 60px 20px; background: #fff; border-radius: 14px; border: 1px dashed #e2e8f0;
      .empty-icon-fa { font-size: 48px; color: #cbd5e1; margin-bottom: 16px; display: block; }
      h3 { color: #475569; margin: 0 0 8px; }
      p { color: #94a3b8; font-size: 14px; margin: 0 0 16px; }
    }
    .btn-browse-sm { padding: 10px 20px; background: #2563eb; color: #fff; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; i { margin-right: 6px; } &:hover { background: #1d4ed8; } }

    .app-list { display: flex; flex-direction: column; gap: 16px; }

    .app-card {
      background: #fff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05); transition: box-shadow 0.2s;
      &:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
    }

    .card-top {
      display: flex; justify-content: space-between; align-items: center; padding: 18px 22px;
    }
    .card-left { display: flex; align-items: center; gap: 14px; }
    .job-avatar {
      width: 44px; height: 44px; border-radius: 10px; background: linear-gradient(135deg, #2563eb, #7c3aed);
      color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 18px;
    }
    .job-title { display: block; font-weight: 600; color: #1e293b; font-size: 16px; }
    .job-dept { display: block; font-size: 13px; color: #64748b; }
    .card-right { display: flex; align-items: center; gap: 12px; }
    .status-pill {
      padding: 5px 14px; border-radius: 20px; font-size: 12px; font-weight: 600;
      i { margin-right: 4px; }
      &.active { background: #dcfce7; color: #166534; }
      &.hired { background: #dbeafe; color: #1e40af; }
      &.rejected { background: #fee2e2; color: #991b1b; }
    }
    .date-text { font-size: 12px; color: #94a3b8; i { margin-right: 4px; } }

    /* Pipeline Progress */
    .pipeline-progress { padding: 12px 22px 20px; background: #fafcff; border-top: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9; }
    .progress-track { height: 6px; background: #e2e8f0; border-radius: 999px; margin: 0 28px; position: relative; overflow: hidden; }
    .progress-fill { height: 100%; background: linear-gradient(90deg, #2563eb 0%, #7c3aed 60%, #8b5cf6 100%); border-radius: 999px; transition: width 0.5s ease; box-shadow: 0 0 12px rgba(124,58,237,0.28); }
    .stage-dots { display: flex; justify-content: space-between; margin-top: -16px; position: relative; z-index: 1; }
    .stage-dot-wrap {
      display: flex; flex-direction: column; align-items: center; gap: 6px; width: 60px;
      &.completed .stage-dot { background: #2563eb; color: #fff; border-color: #2563eb; }
      &.current .stage-dot { background: #7c3aed; color: #fff; border-color: #7c3aed; box-shadow: 0 0 0 4px rgba(124,58,237,0.2); animation: pulse 2s infinite; }
      &.pending .stage-dot { background: #fff; color: #cbd5e1; border-color: #e2e8f0; }
    }
    @keyframes pulse { 0%, 100% { box-shadow: 0 0 0 4px rgba(124,58,237,0.2); } 50% { box-shadow: 0 0 0 8px rgba(124,58,237,0.08); } }
    .stage-dot { width: 30px; height: 30px; border-radius: 50%; border: 2px solid #e2e8f0; display: flex; align-items: center; justify-content: center; font-size: 11px; transition: all 0.3s; background: white; box-shadow: 0 2px 8px rgba(15,23,42,0.08); }
    .stage-label { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.35px; text-align: center; }

    /* Stage Info */
    .stage-info-bar {
      padding: 12px 22px; background: #f8fafc; border-top: 1px solid #f1f5f9;
      display: flex; justify-content: space-between; align-items: center;
    }
    .current-stage-text { font-size: 13px; color: #475569; i { color: #7c3aed; margin-right: 6px; } strong { color: #1e293b; } }
    .app-id { font-size: 12px; color: #94a3b8; i { margin-right: 4px; } }

    /* Offer Banner */
    .offer-banner {
      padding: 16px 22px; background: linear-gradient(135deg, #eff6ff, #f0fdf4); border-top: 1px solid #e2e8f0;
      display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;
    }
    .offer-info { display: flex; align-items: center; gap: 14px; }
    .offer-gift-icon { font-size: 28px; color: #2563eb; }
    .offer-title { display: block; font-weight: 700; color: #1e293b; font-size: 15px; }
    .offer-details { font-size: 13px; color: #475569; i { margin-right: 2px; color: #64748b; } }
    .offer-actions { display: flex; gap: 8px; }
    .btn-download { padding: 8px 18px; background: #fff; color: #2563eb; border: 1px solid #bfdbfe; border-radius: 8px; font-weight: 600; font-size: 13px; cursor: pointer; i { margin-right: 4px; } &:hover { background: #eff6ff; } }
    .btn-accept { padding: 8px 18px; background: #16a34a; color: #fff; border: none; border-radius: 8px; font-weight: 600; font-size: 13px; cursor: pointer; i { margin-right: 4px; } &:hover { background: #15803d; } &:disabled { opacity: 0.5; } }
    .btn-reject { padding: 8px 18px; background: #fff; color: #dc2626; border: 1px solid #fecaca; border-radius: 8px; font-weight: 600; font-size: 13px; cursor: pointer; i { margin-right: 4px; } &:hover { background: #fee2e2; } &:disabled { opacity: 0.5; } }
    .btn-argue { padding: 8px 18px; background: #fff; color: #7c3aed; border: 1px solid #ddd6fe; border-radius: 8px; font-weight: 600; font-size: 13px; cursor: pointer; i { margin-right: 4px; } &:hover { background: #f3e8ff; } &:disabled { opacity: 0.5; } }
    .offer-accepted-banner { padding: 12px 22px; background: #dcfce7; border-top: 1px solid #bbf7d0; color: #166534; font-weight: 600; font-size: 13px; i { margin-right: 6px; } }
    .offer-rejected-banner { padding: 12px 22px; background: #fee2e2; border-top: 1px solid #fecaca; color: #991b1b; font-weight: 600; font-size: 13px; i { margin-right: 6px; } }
    .offer-argued-banner { padding: 12px 22px; background: #ede9fe; border-top: 1px solid #ddd6fe; color: #5b21b6; font-weight: 600; font-size: 13px; i { margin-right: 6px; } }

    .modal-overlay {
      position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45); z-index: 1000;
      display: flex; align-items: center; justify-content: center; padding: 16px;
    }
    .modal-card {
      width: 100%; max-width: 560px; background: #fff; border-radius: 14px; border: 1px solid #e2e8f0;
      box-shadow: 0 16px 40px rgba(15, 23, 42, 0.2); padding: 16px;
    }
    .modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    .modal-header h3 { margin: 0; font-size: 18px; color: #1e293b; i { color: #7c3aed; margin-right: 6px; } }
    .modal-close {
      width: 32px; height: 32px; border-radius: 8px; border: 1px solid #e2e8f0; background: #fff;
      color: #64748b; cursor: pointer;
      &:hover { background: #f8fafc; color: #334155; }
      &:disabled { opacity: 0.5; cursor: not-allowed; }
    }
    .modal-subtitle { margin: 0 0 10px; color: #64748b; font-size: 13px; }
    .argue-textarea {
      width: 100%; min-height: 120px; resize: vertical; border: 1px solid #cbd5e1; border-radius: 10px;
      padding: 10px 12px; font-size: 14px; color: #0f172a; outline: none;
      &:focus { border-color: #7c3aed; box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.15); }
      &:disabled { background: #f8fafc; }
    }
    .argue-char-count { margin-top: 6px; text-align: right; color: #94a3b8; font-size: 12px; }
    .modal-actions { margin-top: 14px; display: flex; justify-content: flex-end; gap: 8px; }
    .btn-cancel {
      padding: 8px 14px; border-radius: 8px; border: 1px solid #e2e8f0; background: #fff; color: #475569;
      font-weight: 600; cursor: pointer;
      &:hover { background: #f8fafc; }
      &:disabled { opacity: 0.5; cursor: not-allowed; }
    }
    .btn-submit {
      padding: 8px 14px; border-radius: 8px; border: none; background: #7c3aed; color: #fff;
      font-weight: 600; cursor: pointer;
      i { margin-right: 6px; }
      &:hover { background: #6d28d9; }
      &:disabled { opacity: 0.5; cursor: not-allowed; }
    }
  `]
})
export class CandidateApplicationsComponent implements OnInit {
  applications: AppRow[] = [];
  stages: { stage_id: string; stage_name: string; order: number; icon: string }[] = [];
  isLoading = true;
  candidateId = '';
  showArgueOfferModal = false;
  argueOfferSubmitting = false;
  argueOfferReason = '';
  argueOfferTargetApp: AppRow | null = null;

  private stageIcons: Record<string, string> = {
    'applied': 'fa-file-alt',
    'screening': 'fa-search',
    'interview': 'fa-comments',
    'offer': 'fa-handshake',
    'hired': 'fa-check-circle',
  };

  constructor(private soap: SoapService, public router: Router) {}

  async ngOnInit(): Promise<void> {
    this.candidateId = sessionStorage.getItem('loggedInCandidateId') || '';
    try {
      // Fetch stages, jobs, depts in parallel; then fetch ONLY this candidate's apps
      const [stagesRaw, jobs, depts] = await Promise.all([
        this.soap.getPipelineStages(),
        this.soap.getJobRequisitions(),
        this.soap.getDepartments()
      ]);

      // Get applications for this candidate only
      const apps = this.candidateId
        ? await this.soap.getApplicationsByCandidate(this.candidateId)
        : await this.soap.getApplications();

      // Fetch offers for each application individually
      const offerResults = await Promise.all(
        apps.map(a => this.soap.getOffersByApplication(a['application_id'] || '').catch(() => []))
      );
      const offers = offerResults.flat();

      this.stages = stagesRaw
        .map(s => ({
          stage_id: s['stage_id'] || '',
          stage_name: s['stage_name'] || '',
          order: parseInt(s['stage_order'] || '0', 10),
          // Use keyword matching so variants like "Offer Letter" still get the correct icon.
          icon: (() => {
            const name = (s['stage_name'] || '').toLowerCase();
            if (name.includes('applied')) return this.stageIcons['applied'];
            if (name.includes('screening')) return this.stageIcons['screening'];
            if (name.includes('interview')) return this.stageIcons['interview'];
            if (name.includes('offer')) return this.stageIcons['offer'];
            if (name.includes('hired')) return this.stageIcons['hired'];
            return 'fa-circle';
          })()
        }))
        .sort((a, b) => a.order - b.order);

      const jobMap = new Map<string, string>();
      jobs.forEach(j => jobMap.set(j['requisition_id'] || '', j['title'] || ''));

      const deptMap = new Map<string, string>();
      depts.forEach(d => deptMap.set(d['department_id'] || '', d['department_name'] || ''));

      const jobDeptMap = new Map<string, string>();
      jobs.forEach(j => jobDeptMap.set(j['requisition_id'] || '', deptMap.get(j['department_id'] || '') || ''));

      const stageNameMap = new Map<string, string>();
      this.stages.forEach(s => stageNameMap.set(s.stage_id, s.stage_name));

      const stageOrderMap = new Map<string, number>();
      this.stages.forEach(s => stageOrderMap.set(s.stage_id, s.order));

      // Build offer map: application_id → offer
      const offerMap = new Map<string, Record<string, string>>();
      offers.forEach(o => offerMap.set(o['application_id'] || '', o));

      this.applications = apps.map(a => {
        const appOffer = offerMap.get(a['application_id'] || '');
        return {
          application_id: a['application_id'] || '',
          requisition_id: a['requisition_id'] || '',
          jobTitle: jobMap.get(a['requisition_id'] || '') || a['requisition_id'] || '',
          department: jobDeptMap.get(a['requisition_id'] || '') || '',
          status: a['status'] || 'ACTIVE',
          current_stage_id: a['current_stage_id'] || '',
          stageName: stageNameMap.get(a['current_stage_id'] || '') || 'New',
          stageOrder: stageOrderMap.get(a['current_stage_id'] || '') || 0,
          applied_at: a['applied_at'] || a['created_at'] || '',
          _raw: a as Record<string, string>,
          offer: appOffer ? {
            offer_id: appOffer['offer_id'] || '',
            salary: appOffer['offered_salary'] || '',
            currency: appOffer['salary_currency'] || 'LPA',
            joining: appOffer['joining_date'] || '',
            expiry: appOffer['expiration_date'] || '',
            status: appOffer['status'] || 'DRAFT',
            createdAt: appOffer['created_at'] || '',
            createdBy: appOffer['created_by_user'] || appOffer['created_by'] || '',
            updatedAt: appOffer['updated_at'] || '',
            updatedBy: appOffer['updated_by_user'] || appOffer['updated_by'] || '',
            arguedReason: appOffer['temp1'] || appOffer['Temp1'] || ''
          } : null
        };
      });

    } catch (e) {
      console.error('Failed to load applications:', e);
    } finally {
      this.isLoading = false;
    }
  }

  getStageStatus(app: AppRow, stage: { stage_id: string; order: number }): 'completed' | 'current' | 'pending' {
    if (stage.stage_id === app.current_stage_id) return 'current';
    if (stage.order < app.stageOrder) return 'completed';
    return 'pending';
  }

  getProgress(app: AppRow): string {
    if (this.stages.length <= 1) return '0%';
    const idx = this.stages.findIndex(s => s.stage_id === app.current_stage_id);
    if (idx < 0) return '0%';
    return ((idx / (this.stages.length - 1)) * 100) + '%';
  }

  getStatusIcon(status: string): string {
    switch (status.toUpperCase()) {
      case 'ACTIVE': return 'fa-spinner';
      case 'HIRED': return 'fa-check-circle';
      case 'REJECTED': return 'fa-times-circle';
      default: return 'fa-circle';
    }
  }

  formatDate(d: string): string {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  private async resolveCandidateAndHrEmails(app: AppRow): Promise<{
    candidateEmail: string;
    candidateName: string;
    hrEmail: string;
  }> {
    const raw = app._raw || {};
    const candidateId = raw['candidate_id'] || raw['Candidate_id'] || '';
    const candidateRow = candidateId ? await this.soap.getCandidateById(candidateId) : null;

    const candidateEmail = String(
      (candidateRow as any)?.['email'] || (candidateRow as any)?.['Email'] || ''
    ).trim();
    const candidateName = (
      `${(candidateRow as any)?.['first_name'] || (candidateRow as any)?.['First_name'] || ''} ${(candidateRow as any)?.['last_name'] || (candidateRow as any)?.['Last_name'] || ''}`
    ).trim();

    const jobId = app.requisition_id || '';
    const job = jobId ? await this.soap.getJobRequisitionById(jobId) : null;
    const hrUserId = job?.['created_by_user'] || job?.['Created_by_user'] || '';
    const hrUser = hrUserId ? await this.soap.getUserById(hrUserId) : null;
    const hrEmail = String(hrUser?.['email'] || hrUser?.['Email'] || '').trim();

    return {
      candidateEmail,
      candidateName: candidateName || 'Candidate',
      hrEmail
    };
  }

  async acceptOffer(app: AppRow): Promise<void> {
    if (!app.offer) return;
    try {
      const currentOrder = app.stageOrder;

      // Prefer moving to "Offer Letter" (or "Accepted Offer") stage AFTER the current Offer stage.
      const stageName = (s: { stage_name: string }) => (s.stage_name || '').toLowerCase();
      const offerLetterStages = this.stages
        .filter(s => stageName(s).includes('offer') && stageName(s).includes('letter'));
      const acceptedOfferStages = this.stages
        .filter(s => stageName(s).includes('offer') && stageName(s).includes('accepted'));
      const offerStages = this.stages
        .filter(s => stageName(s).includes('offer'));

      const pickNextStage = (candidates: typeof this.stages) => {
        const after = candidates
          .filter(s => s.stage_id !== app.current_stage_id && s.order >= currentOrder)
          .sort((a, b) => a.order - b.order);
        if (after[0]) return after[0];
        // If ordering doesn't have "next", pick the highest-order matching stage (excluding current).
        const fallback = candidates
          .filter(s => s.stage_id !== app.current_stage_id)
          .sort((a, b) => b.order - a.order)[0];
        return fallback || candidates.sort((a, b) => a.order - b.order)[0];
      };

      const targetStage =
        pickNextStage(offerLetterStages) ||
        pickNextStage(acceptedOfferStages) ||
        pickNextStage(offerStages.filter(s => s.stage_id !== app.current_stage_id)) ||
        null;

      // stage_name can be "Hired" or "Hired Stage" etc, so use keyword match
      const hiredStage = this.stages.find(s => stageName(s).includes('hired'));
      const cancelledStage = this.stages.find(s => (s.stage_name || '').toLowerCase().includes('cancel'));

      const targetStageId = targetStage?.stage_id || hiredStage?.stage_id || app.current_stage_id;
      const targetStageName = targetStage?.stage_name || hiredStage?.stage_name || app.stageName;
      const targetStageOrder = targetStage?.order ?? hiredStage?.order ?? app.stageOrder;
      const cancelledStageId = cancelledStage?.stage_id || app.current_stage_id;

      // 1) Mark winning offer accepted
      await this.soap.updateOfferStatus(app.offer.offer_id, 'ACCEPTED');
      app.offer.status = 'ACCEPTED';

      // 2) Mark winning application HIRED + move stage
      // Retry stage move if Cordys throws tupleChangedError (concurrent BPM update).
      let moveAttemptRaw = app._raw;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await this.soap.updateApplicationStageAndStatus(moveAttemptRaw, 'HIRED', targetStageId);
          break;
        } catch (e: any) {
          const msg = String(e?.message || e?.error || e?.responseText || e || '');
          const isTupleChanged = /tuple\s*changed\s*by\s*other\s*user/i.test(msg) || /tuplechangederror/i.test(msg) || /tupleChangedError/i.test(msg);
          if (!isTupleChanged || attempt === 2) throw e;
          const refreshedMove = await this.soap.getApplicationById(app.application_id);
          if (refreshedMove) moveAttemptRaw = refreshedMove as any;
        }
      }
      // Refetch to ensure UI matches DB (prevents stale tuple / stage mismatch).
      const refreshed = await this.soap.getApplicationById(app.application_id);
      if (refreshed) {
        const refreshedStageId = refreshed['current_stage_id'] || targetStageId;
        const refreshedStage = this.stages.find(s => s.stage_id === refreshedStageId);
        app.status = refreshed['status'] || 'HIRED';
        app.current_stage_id = refreshedStageId;
        app.stageName = refreshedStage?.stage_name || targetStageName;
        app.stageOrder = refreshedStage?.order ?? targetStageOrder;
        app._raw = refreshed as any;
      } else {
        app.status = 'HIRED';
        app.current_stage_id = targetStageId;
        app.stageName = targetStageName;
        app.stageOrder = targetStageOrder;
      }

      // 3) Cancel all other ACTIVE applications + reject their offers
      for (const other of this.applications) {
        if (other.application_id === app.application_id) continue;
        if ((other.status || '').toUpperCase() !== 'ACTIVE') continue;

        await this.soap.updateApplicationStageAndStatus(other._raw, 'CANCELLED', cancelledStageId);
        other.status = 'CANCELLED';
        other.current_stage_id = cancelledStageId;
        other.stageName = cancelledStage?.stage_name || other.stageName;
        other.stageOrder = cancelledStage?.order ?? other.stageOrder;

        // Cancel interviews belonging to that application.
        const otherInterviews = await this.soap.getInterviewsForApplication(other.application_id);
        for (const iv of otherInterviews) {
          const interviewId = iv['interview_id'] || iv['Interview_id'] || '';
          if (!interviewId) continue;
          await this.soap.updateInterviewStatus(interviewId, 'CANCELLED');
        }

        if (other.offer && other.offer.offer_id) {
          await this.soap.updateOfferStatus(other.offer.offer_id, 'REJECTED');
          other.offer.status = 'REJECTED';
        }
      }

      // Notify candidate + HR (non-blocking)
      try {
        const { candidateEmail, candidateName, hrEmail } = await this.resolveCandidateAndHrEmails(app);
        const mail = buildMailBody('OFFER_ACCEPTED', {
          candidateName,
          jobTitle: app.jobTitle,
          joiningDate: app.offer.joining
        });

        if (candidateEmail) {
          await this.soap.sendAllMailsBPM(candidateEmail, mail.subject, mail.body);
        }
        if (hrEmail) {
          await this.soap.sendAllMailsBPM(hrEmail, mail.subject, mail.body);
        }
      } catch (mailErr) {
        console.warn('[CandidateOffers] Failed to send offer accepted mail (non-blocking):', mailErr);
      }
    } catch (e) {
      console.error('Failed to accept offer:', e);
    }
  }

  async rejectOffer(app: AppRow): Promise<void> {
    if (!app.offer) return;
    try {
      const rejectedStage = this.stages.find(s => (s.stage_name || '').toLowerCase().includes('reject'));
      const rejectedStageId = rejectedStage?.stage_id || app.current_stage_id;

      await this.soap.updateOfferStatus(app.offer.offer_id, 'REJECTED');
      app.offer.status = 'REJECTED';

      await this.soap.updateApplicationStageAndStatus(app._raw, 'REJECTED', rejectedStageId);
      app.status = 'REJECTED';
      app.current_stage_id = rejectedStageId;
      app.stageName = rejectedStage?.stage_name || app.stageName;
      app.stageOrder = rejectedStage?.order ?? app.stageOrder;

      // Notify candidate + HR (non-blocking)
      try {
        const { candidateEmail, candidateName, hrEmail } = await this.resolveCandidateAndHrEmails(app);
        const mail = buildMailBody('OFFER_REJECTED', {
          candidateName,
          jobTitle: app.jobTitle,
          rejectionReason: ''
        });

        if (candidateEmail) {
          await this.soap.sendAllMailsBPM(candidateEmail, mail.subject, mail.body);
        }
        if (hrEmail) {
          await this.soap.sendAllMailsBPM(hrEmail, mail.subject, mail.body);
        }
      } catch (mailErr) {
        console.warn('[CandidateOffers] Failed to send offer rejected mail (non-blocking):', mailErr);
      }
    } catch (e) {
      console.error('Failed to reject offer:', e);
    }
  }

  openArgueOfferModal(app: AppRow): void {
    if (!app.offer || app.offer.status !== 'SENT') return;
    this.argueOfferTargetApp = app;
    this.argueOfferReason = '';
    this.argueOfferSubmitting = false;
    this.showArgueOfferModal = true;
  }

  closeArgueOfferModal(): void {
    if (this.argueOfferSubmitting) return;
    this.showArgueOfferModal = false;
    this.argueOfferTargetApp = null;
    this.argueOfferReason = '';
  }

  async submitArgueOffer(): Promise<void> {
    const app = this.argueOfferTargetApp;
    if (!app?.offer) return;
    const reason = this.argueOfferReason.trim();
    if (!reason) return;

    this.argueOfferSubmitting = true;
    try {
      const arguedStage = this.stages.find(s => {
        const name = (s.stage_name || '').toLowerCase();
        return name.includes('hold') || name.includes('argued');
      });
      const arguedStageId = arguedStage?.stage_id || app.current_stage_id;

      await this.soap.updateOfferStatus(app.offer.offer_id, 'ARGUED', reason);
      app.offer.status = 'ARGUED';
      app.offer.arguedReason = reason;

      // Application stays active in the pipeline but is "On Hold / Argued" for HR resolution.
      await this.soap.updateApplicationStageAndStatus(app._raw, 'HOLD', arguedStageId);
      app.status = 'HOLD';
      app.current_stage_id = arguedStageId;
      app.stageName = arguedStage?.stage_name || app.stageName;
      app.stageOrder = arguedStage?.order ?? app.stageOrder;

      // Notify candidate + HR (non-blocking)
      try {
        const { candidateEmail, candidateName, hrEmail } = await this.resolveCandidateAndHrEmails(app);
        const mail = buildMailBody('OFFER_ARGUED', {
          candidateName,
          jobTitle: app.jobTitle
        });

        if (candidateEmail) {
          await this.soap.sendAllMailsBPM(candidateEmail, mail.subject, mail.body);
        }
        if (hrEmail) {
          await this.soap.sendAllMailsBPM(hrEmail, mail.subject, mail.body);
        }
      } catch (mailErr) {
        console.warn('[CandidateOffers] Failed to send offer argued mail (non-blocking):', mailErr);
      }

      this.showArgueOfferModal = false;
      this.argueOfferTargetApp = null;
      this.argueOfferReason = '';
    } catch (e) {
      console.error('Failed to argue offer:', e);
    } finally {
      this.argueOfferSubmitting = false;
    }
  }

  async downloadOfferLetter(app: AppRow): Promise<void> {
    if (!app.offer) return;
    const candidateName = this.getCandidateDisplayName(app);
    const safeJob = this.toSafeFileName(app.jobTitle || 'job');
    const safeCandidate = this.toSafeFileName(candidateName || 'candidate');
    const fileName = `offer-letter-${safeCandidate}-${safeJob}.pdf`;
    const doc = await this.buildOfferLetterPdf(app, candidateName);
    doc.save(fileName);
  }

  private getCandidateDisplayName(app: AppRow): string {
    const first = String(app._raw['first_name'] || app._raw['First_name'] || '').trim();
    const last = String(app._raw['last_name'] || app._raw['Last_name'] || '').trim();
    const full = `${first} ${last}`.trim();
    return full || 'Candidate';
  }

  private toSafeFileName(input: string): string {
    return String(input || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'file';
  }

  private formatReadableDate(d: string): string {
    if (!d) return '-';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  private async buildOfferLetterPdf(app: AppRow, candidateName: string): Promise<jsPDF> {
    const offeredSalary = `${app.offer?.salary || '-'} ${app.offer?.currency || ''}`.trim();
    const joiningDate = this.formatReadableDate(app.offer?.joining || '');
    const expiryDate = this.formatReadableDate(app.offer?.expiry || '');
    const generatedOn = this.formatReadableDate(new Date().toISOString());
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const left = 48;
    let y = 56;

    doc.setFillColor(11, 61, 145);
    doc.rect(0, 0, pageWidth, 78, 'F');
    const logoDataUrl = await this.getImageDataUrl('/assets/images/adnatelogo.png').catch(() => '');
    if (logoDataUrl) {
      try {
        doc.addImage(logoDataUrl, 'PNG', pageWidth - 130, 16, 90, 46);
      } catch {
        // Non-blocking fallback: keep PDF generation without logo.
      }
    }
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('Offer Letter', left, 35);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text('Recruitment Management System', left, 54);

    y = 110;
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(11);
    doc.text(`Date: ${generatedOn}`, left, y);
    y += 24;

    doc.setFont('helvetica', 'normal');
    doc.text(`Dear ${candidateName},`, left, y);
    y += 24;

    const bodyLine =
      `We are pleased to offer you the position of ${app.jobTitle}. ` +
      'Please find your offer details below:';
    const bodyLines = doc.splitTextToSize(bodyLine, pageWidth - left * 2);
    doc.text(bodyLines, left, y);
    y += bodyLines.length * 15 + 12;

    const rows: Array<[string, string]> = [
      ['Application ID', app.application_id || '-'],
      ['Requisition ID', app.requisition_id || '-'],
      ['Job Title', app.jobTitle || '-'],
      ['Offered Salary', offeredSalary || '-'],
      ['Joining Date', joiningDate || '-'],
      ['Offer Valid Until', expiryDate || '-']
    ];

    const tableTop = y - 12;
    const tableHeight = rows.length * 22 + 16;
    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(left - 8, tableTop, pageWidth - left * 2 + 16, tableHeight, 6, 6, 'FD');

    rows.forEach(([k, v]) => {
      doc.setFont('helvetica', 'bold');
      doc.text(`${k}:`, left, y);
      doc.setFont('helvetica', 'normal');
      doc.text(String(v), left + 130, y);
      y += 22;
    });

    y += 10;
    const note =
      'Please review and confirm your response in the candidate portal before the expiry date.';
    const noteLines = doc.splitTextToSize(note, pageWidth - left * 2);
    doc.text(noteLines, left, y);
    y += noteLines.length * 15 + 24;

    doc.text('Warm regards,', left, y);
    y += 18;
    doc.setFont('helvetica', 'bold');
    doc.text('HR Team', left, y);
    y += 16;
    doc.setFont('helvetica', 'normal');
    doc.text('Adnate IT Solutions', left, y);

    y += 36;
    doc.setDrawColor(148, 163, 184);
    doc.line(left, y, left + 200, y);
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('Authorized Signature', left, y + 14);

    doc.setDrawColor(226, 232, 240);
    doc.line(left, pageHeight - 42, pageWidth - left, pageHeight - 42);
    doc.setFontSize(9);
    doc.text('This is a system-generated offer letter.', left, pageHeight - 26);

    return doc;
  }

  private async getImageDataUrl(url: string): Promise<string> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load image: ${url}`);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to convert image to data URL'));
      reader.readAsDataURL(blob);
    });
  }
}
