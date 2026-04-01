import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SoapService } from '../../services/soap.service';
import { buildMailBody } from '../../services/mail-templates';
import jsPDF from 'jspdf';

interface OfferRow {
  offer_id: string;
  application_id: string;
  candidate_name: string;
  job_title: string;
  designation?: string;
  offered_salary: string;
  salary_currency: string;
  joining_date: string;
  expiration_date: string;
  status: string;
  created_by_user?: string;
  created_at: string;
  updated_at?: string;
  updated_by_user?: string;
  argued_reason?: string;
}

interface CandidateOption {
  application_id: string;
  candidate_name: string;
  job_title: string;
  candidate_id: string;
}

@Component({
  selector: 'app-offers-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="offers-wrap animate-fade-in">
      <!-- Header -->
      <div class="page-header">
        <div>
          <h2><i class="fas fa-handshake"></i> Offer Management</h2>
          <p>Create, track, and manage candidate offers</p>
        </div>
        <button class="btn-create" (click)="openCreateModal()">
          <i class="fas fa-plus"></i> Create Offer
        </button>
      </div>

      <!-- Stats Row -->
      <div class="stats-row">
        <div class="stat-card" *ngFor="let s of stats">
          <div class="stat-icon-wrap" [ngClass]="s.colorClass">
            <i class="fas" [ngClass]="s.icon"></i>
          </div>
          <div class="stat-body">
            <div class="stat-val">{{ s.value }}</div>
            <div class="stat-label">{{ s.label }}</div>
          </div>
        </div>
      </div>

      <!-- Filter Bar -->
      <div class="filter-bar">
        <div class="filter-group">
          <label>Status:</label>
          <select [(ngModel)]="statusFilter" (ngModelChange)="applyFilters()" class="filter-select">
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="SENT">Sent</option>
            <option value="NEGOTIATED">Negotiated</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="REJECTED">Rejected</option>
            <option value="EXPIRED">Expired</option>
          </select>
        </div>
        <div class="search-wrap">
          <i class="fas fa-search search-icon"></i>
          <input class="search-input" placeholder="Search by candidate or job..."
                 [(ngModel)]="searchQuery" (ngModelChange)="applyFilters()">
        </div>
        <span class="stats-pill"><i class="fas fa-file-signature"></i> {{ filteredOffers.length }} offers</span>
      </div>

      <!-- Loading -->
      <div class="loading-state" *ngIf="isLoading">
        <div class="spinner"></div>
        <p>Loading offers...</p>
      </div>

      <!-- Empty -->
      <div class="empty-state" *ngIf="!isLoading && filteredOffers.length === 0">
        <i class="fas fa-file-contract empty-icon"></i>
        <h3>No offers found</h3>
        <p>Create a new offer to get started.</p>
      </div>

      <!-- Offers Table -->
      <div class="offers-container" *ngIf="!isLoading && filteredOffers.length > 0">
        <table class="offers-table">
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Job Position</th>
              <th>Salary</th>
              <th>Joining Date</th>
              <th>Expires</th>
              <th>Status</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let o of filteredOffers">
              <td>
                <div class="candidate-cell">
                  <div class="avatar-circle">{{ o.candidate_name.charAt(0) }}</div>
                  <span class="name-text">{{ o.candidate_name }}</span>
                </div>
              </td>
              <td><span class="job-badge">{{ o.job_title }}</span></td>
              <td><span class="salary-text">{{ o.offered_salary }} {{ o.salary_currency }}</span></td>
              <td><span class="date-text"><i class="fas fa-calendar-check"></i> {{ formatDate(o.joining_date) }}</span></td>
              <td>
                <span class="date-text" [class.expired-text]="isExpired(o)">
                  <i class="fas fa-clock"></i> {{ formatDate(o.expiration_date) }}
                  <span class="exp-label" *ngIf="isExpired(o)"> (Expired)</span>
                </span>
              </td>
              <td>
                <span class="status-badge" [attr.data-status]="o.status.toLowerCase()">
                  <i class="fas" [ngClass]="getStatusIcon(o.status)"></i> {{ getStatusLabel(o.status) }}
                </span>
                <div class="argued-reason" *ngIf="(o.status === 'ARGUED' || o.status === 'NEGOTIATED') && o.argued_reason">
                  <i class="fas fa-comment-dots"></i> {{ o.argued_reason }}
                </div>
              </td>
              <td>
                <span class="date-text">
                  <i class="fas fa-history"></i> {{ formatDate(o.updated_at || o.created_at) }}
                </span>
              </td>
              <td>
                <div class="action-btns">
                  <button class="btn-action btn-send" *ngIf="o.status === 'DRAFT'" (click)="sendOffer(o)" title="Send Offer">
                    <i class="fas fa-paper-plane"></i>
                  </button>
                  <button class="btn-action btn-revoke" *ngIf="o.status === 'SENT'" (click)="revokeOffer(o)" title="Revoke Offer">
                    <i class="fas fa-undo"></i>
                  </button>
                  <button class="btn-action btn-send" *ngIf="o.status === 'ARGUED' || o.status === 'NEGOTIATED'" (click)="openEditResendModal(o)" title="Edit & Resend Offer">
                    <i class="fas fa-pen-to-square"></i>
                  </button>
                  <button class="btn-action btn-view" (click)="viewOffer(o)" title="View Details">
                    <i class="fas fa-eye"></i>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ═══ CREATE OFFER MODAL ═══ -->
      <div class="modal-overlay" *ngIf="showCreateModal" (click)="closeCreateModal()">
        <div class="modal-card" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3><i class="fas fa-file-signature"></i> Create New Offer</h3>
            <button class="modal-close" (click)="closeCreateModal()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Candidate (Offer Stage Only) <span class="req">*</span></label>
              <select [(ngModel)]="newOffer.application_id" class="form-input">
                <option value="">-- Select Candidate --</option>
                <option *ngFor="let c of offerCandidates" [value]="c.application_id">
                  {{ c.candidate_name }} — {{ c.job_title }}
                </option>
              </select>
            </div>
            <div class="form-group">
              <label>Designation <span class="req">*</span></label>
              <input type="text" [(ngModel)]="newOffer.designation" class="form-input" placeholder="e.g. Software Engineer">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Offered Salary <span class="req">*</span></label>
                <input type="text" [(ngModel)]="newOffer.offered_salary" class="form-input" placeholder="e.g. 22">
              </div>
              <div class="form-group">
                <label>Currency</label>
                <select [(ngModel)]="newOffer.salary_currency" class="form-input">
                  <option value="INR">INR</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Joining Date <span class="req">*</span></label>
                <input type="date" [(ngModel)]="newOffer.joining_date" class="form-input">
              </div>
              <div class="form-group">
                <label>Offer Expiry Date <span class="req">*</span></label>
                <input type="date" [(ngModel)]="newOffer.expiration_date" class="form-input">
              </div>
            </div>

            <div class="form-divider"></div>

            <div class="form-group">
              <label>Offer Letter</label>
              <div class="doc-help">Choose how the offer letter should be shared with the candidate.</div>

              <div class="segmented">
                <button type="button" class="seg-btn"
                        [class.active]="offerLetterMode === 'GENERATED'"
                        (click)="setOfferLetterMode('GENERATED')">
                  <i class="fas fa-wand-magic-sparkles"></i> Generated
                </button>
                <button type="button" class="seg-btn"
                        [class.active]="offerLetterMode === 'MANUAL'"
                        (click)="setOfferLetterMode('MANUAL')">
                  <i class="fas fa-upload"></i> Manual Upload
                </button>
              </div>

              <div class="letter-panel" *ngIf="offerLetterMode === 'GENERATED'">
                <div class="letter-panel-head">
                  <div class="letter-title">
                    <div class="letter-badge gen"><i class="fas fa-bolt"></i></div>
                    <div>
                      <div class="letter-h">Generate offer letter PDF</div>
                      <div class="letter-sub">Uses the offer details you entered above and uploads it to candidate documents as <b>OFFER_LETTER</b>.</div>
                    </div>
                  </div>
                  <div class="letter-actions">
                    <button class="btn-doc-secondary" type="button"
                            (click)="previewGeneratedOfferLetter()"
                            [disabled]="isGeneratingLetter || !canGenerateOfferLetter()">
                      <i class="fas" [ngClass]="isGeneratingLetter ? 'fa-spinner fa-spin' : 'fa-file-pdf'"></i>
                      Preview
                    </button>
                    <button class="btn-doc-primary" type="button"
                            (click)="generateAndUploadOfferLetter()"
                            [disabled]="isGeneratingLetter || !canGenerateOfferLetter()">
                      <i class="fas" [ngClass]="isGeneratingLetter ? 'fa-spinner fa-spin' : 'fa-cloud-arrow-up'"></i>
                      {{ isGeneratingLetter ? 'Generating...' : 'Generate & Upload' }}
                    </button>
                  </div>
                </div>

                <div class="mini-grid" *ngIf="newOffer.application_id">
                  <div class="mini-item">
                    <div class="mini-k">Candidate</div>
                    <div class="mini-v">{{ getSelectedCandidateLabel() }}</div>
                  </div>
                  <div class="mini-item">
                    <div class="mini-k">Designation</div>
                    <div class="mini-v">{{ (newOffer.designation || '-') }}</div>
                  </div>
                  <div class="mini-item">
                    <div class="mini-k">Salary</div>
                    <div class="mini-v">{{ (newOffer.offered_salary || '-') }} {{ (newOffer.salary_currency || '') }}</div>
                  </div>
                  <div class="mini-item">
                    <div class="mini-k">Joining</div>
                    <div class="mini-v">{{ newOffer.joining_date ? formatDate(newOffer.joining_date) : '-' }}</div>
                  </div>
                  <div class="mini-item">
                    <div class="mini-k">Expiry</div>
                    <div class="mini-v">{{ newOffer.expiration_date ? formatDate(newOffer.expiration_date) : '-' }}</div>
                  </div>
                </div>

                <div class="doc-status" *ngIf="docUploadStatus">{{ docUploadStatus }}</div>
              </div>

              <div class="letter-panel" *ngIf="offerLetterMode === 'MANUAL'">
                <div class="letter-panel-head">
                  <div class="letter-title">
                    <div class="letter-badge man"><i class="fas fa-paperclip"></i></div>
                    <div>
                      <div class="letter-h">Upload offer letter document</div>
                      <div class="letter-sub">Upload the offer letter file (PDF preferred). This will be stored for the selected candidate.</div>
                    </div>
                  </div>
                </div>

                <div class="form-row doc-row">
                  <div class="form-group" style="margin-bottom:0;">
                    <label style="margin-bottom:6px;">Document Type</label>
                    <select [(ngModel)]="docUploadType" class="form-input">
                      <option value="OFFER_LETTER">Offer Letter</option>
                      <option value="OFFER_ATTACHMENT">Offer Attachment</option>
                      <option value="NDA">NDA</option>
                      <option value="ID_PROOF">ID Proof</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div class="form-group" style="margin-bottom:0;">
                    <label style="margin-bottom:6px;">Select Files</label>
                    <input type="file" (change)="onDocFilesSelected($event)" class="form-input" multiple>
                  </div>
                </div>

                <div class="doc-files" *ngIf="docFiles.length > 0">
                  <div class="doc-file" *ngFor="let f of docFiles">
                    <i class="fas fa-paperclip"></i> {{ f.name }}
                  </div>
                </div>
                <div class="doc-actions">
                  <button class="btn-doc-secondary" type="button" (click)="clearDocFiles()" [disabled]="isUploadingDocs || docFiles.length === 0">Clear</button>
                  <button
                    class="btn-doc-primary"
                    type="button"
                    (click)="uploadDocsForSelectedCandidate()"
                    [disabled]="isUploadingDocs || !newOffer.application_id || docFiles.length === 0"
                    title="Upload selected documents"
                  >
                    <i class="fas" [ngClass]="isUploadingDocs ? 'fa-spinner fa-spin' : 'fa-upload'"></i>
                    {{ isUploadingDocs ? 'Uploading...' : 'Upload' }}
                  </button>
                </div>
                <div class="doc-status" *ngIf="docUploadStatus">{{ docUploadStatus }}</div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" (click)="closeCreateModal()">Cancel</button>
            <button class="btn-submit" (click)="submitOffer()" [disabled]="isSubmitting">
              <i class="fas" [ngClass]="isSubmitting ? 'fa-spinner fa-spin' : 'fa-check'"></i>
              {{ isSubmitting ? 'Creating...' : 'Create Offer' }}
            </button>
          </div>
        </div>
      </div>

      <!-- ═══ EDIT & RESEND MODAL (NEGOTIATED) ═══ -->
      <div class="modal-overlay" *ngIf="showEditResendModal" (click)="closeEditResendModal()">
        <div class="modal-card" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3><i class="fas fa-pen-to-square"></i> Edit & Resend Offer</h3>
            <button class="modal-close" (click)="closeEditResendModal()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <div class="detail-item" *ngIf="editingOffer">
              <span class="detail-label"><i class="fas fa-user"></i> Candidate</span>
              <span class="detail-value">{{ editingOffer.candidate_name }} — {{ editingOffer.job_title }}</span>
            </div>

            <div class="form-group" *ngIf="editingOffer?.argued_reason">
              <label>Candidate Negotiation Reason</label>
              <div class="argued-reason" style="margin-top:0;">
                <i class="fas fa-comment-dots"></i> {{ editingOffer?.argued_reason }}
              </div>
            </div>

            <div class="form-group">
              <label>Designation <span class="req">*</span></label>
              <input type="text" [(ngModel)]="editOffer.designation" class="form-input" placeholder="e.g. Software Engineer">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Offered Salary <span class="req">*</span></label>
                <input type="text" [(ngModel)]="editOffer.offered_salary" class="form-input" placeholder="e.g. 22">
              </div>
              <div class="form-group">
                <label>Currency</label>
                <select [(ngModel)]="editOffer.salary_currency" class="form-input">
                  <option value="INR">INR</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Joining Date <span class="req">*</span></label>
                <input type="date" [(ngModel)]="editOffer.joining_date" class="form-input">
              </div>
              <div class="form-group">
                <label>Offer Expiry Date <span class="req">*</span></label>
                <input type="date" [(ngModel)]="editOffer.expiration_date" class="form-input">
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" (click)="closeEditResendModal()">Cancel</button>
            <button class="btn-submit" (click)="submitEditResend()" [disabled]="isEditSubmitting">
              <i class="fas" [ngClass]="isEditSubmitting ? 'fa-spinner fa-spin' : 'fa-paper-plane'"></i>
              {{ isEditSubmitting ? 'Resending...' : 'Save & Resend' }}
            </button>
          </div>
        </div>
      </div>

      <!-- ═══ VIEW OFFER MODAL ═══ -->
      <div class="modal-overlay" *ngIf="viewingOffer" (click)="viewingOffer = null">
        <div class="modal-card" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3><i class="fas fa-file-alt"></i> Offer Details</h3>
            <button class="modal-close" (click)="viewingOffer = null"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body" *ngIf="viewingOffer">
            <div class="detail-grid">
              <div class="detail-item">
                <span class="detail-label"><i class="fas fa-user"></i> Candidate</span>
                <span class="detail-value">{{ viewingOffer.candidate_name }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label"><i class="fas fa-briefcase"></i> Position</span>
                <span class="detail-value">{{ viewingOffer.job_title }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label"><i class="fas fa-id-badge"></i> Designation</span>
                <span class="detail-value">{{ viewingOffer.designation || '-' }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Salary</span>
                <span class="detail-value">{{ viewingOffer.offered_salary }} {{ viewingOffer.salary_currency }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label"><i class="fas fa-calendar-check"></i> Joining</span>
                <span class="detail-value">{{ formatDate(viewingOffer.joining_date) }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label"><i class="fas fa-clock"></i> Expiry</span>
                <span class="detail-value">{{ formatDate(viewingOffer.expiration_date) }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label"><i class="fas fa-info-circle"></i> Status</span>
                <span class="status-badge" [attr.data-status]="viewingOffer.status.toLowerCase()">
                  <i class="fas" [ngClass]="getStatusIcon(viewingOffer.status)"></i> {{ getStatusLabel(viewingOffer.status) }}
                </span>
              </div>
              <div class="detail-item" *ngIf="viewingOffer.status === 'ARGUED' || viewingOffer.status === 'NEGOTIATED'">
                <span class="detail-label"><i class="fas fa-comment-dots"></i> Candidate Negotiation Reason</span>
                <span class="detail-value">{{ viewingOffer.argued_reason || '-' }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label"><i class="fas fa-user"></i> Created By</span>
                <span class="detail-value">{{ viewingOffer.created_by_user || '-' }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label"><i class="fas fa-calendar-alt"></i> Created At</span>
                <span class="detail-value">{{ formatDateTime(viewingOffer.created_at) }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label"><i class="fas fa-sync-alt"></i> Last Update</span>
                <span class="detail-value">{{ formatDateTime(viewingOffer.updated_at) }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label"><i class="fas fa-user-edit"></i> Updated By</span>
                <span class="detail-value">{{ viewingOffer.updated_by_user || '-' }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Toast -->
      <div class="toast-notification" *ngIf="showToast"
           [class.toast-success]="toastType === 'success'" [class.toast-error]="toastType === 'error'">
        <i class="fas" [ngClass]="toastType === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'"></i>
        {{ toastMessage }}
      </div>
    </div>
  `,
  styles: [`
    .animate-fade-in { animation: fadeIn 0.3s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

    .page-header {
      display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px;
      h2 { margin: 0 0 4px; font-size: 22px; color: #1e293b; i { margin-right: 8px; color: #2563eb; } }
      p { color: #64748b; margin: 0; font-size: 14px; }
    }
    .btn-create {
      padding: 10px 20px; background: linear-gradient(135deg, #2563eb, #7c3aed); color: #fff;
      border: none; border-radius: 10px; font-weight: 600; font-size: 14px; cursor: pointer;
      transition: all 0.2s; i { margin-right: 6px; }
      &:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(37,99,235,0.3); }
    }

    /* Stats */
    .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 20px; }
    .stat-card { display: flex; align-items: center; gap: 14px; background: #fff; padding: 16px 20px; border-radius: 12px; border: 1px solid #e2e8f0; }
    .stat-icon-wrap { width: 42px; height: 42px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 16px; }
    .stat-icon-wrap.clr-gray { background: #f1f5f9; color: #64748b; }
    .stat-icon-wrap.clr-blue { background: #dbeafe; color: #2563eb; }
    .stat-icon-wrap.clr-purple { background: #ede9fe; color: #5b21b6; }
    .stat-icon-wrap.clr-green { background: #dcfce7; color: #16a34a; }
    .stat-icon-wrap.clr-red { background: #fee2e2; color: #dc2626; }
    .stat-val { font-size: 24px; font-weight: 700; color: #1e293b; }
    .stat-label { font-size: 12px; color: #64748b; }

    /* Filter */
    .filter-bar {
      display: flex; align-items: center; gap: 14px; margin-bottom: 20px; flex-wrap: wrap;
      background: #fff; padding: 14px 20px; border-radius: 12px; border: 1px solid #e2e8f0;
    }
    .filter-group { display: flex; align-items: center; gap: 8px;
      label { font-weight: 600; font-size: 13px; color: #475569; }
    }
    .filter-select { padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 13px; outline: none; &:focus { border-color: #2563eb; } }
    .search-wrap { position: relative;
      .search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); font-size: 13px; color: #64748b; }
      .search-input { padding: 8px 14px 8px 34px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 13px; width: 220px; outline: none; &:focus { border-color: #2563eb; } }
    }
    .stats-pill { margin-left: auto; padding: 6px 14px; background: #eff6ff; color: #2563eb; border-radius: 20px; font-size: 12px; font-weight: 600; i { margin-right: 4px; } }

    /* Loading / Empty */
    .loading-state { display: flex; flex-direction: column; align-items: center; padding: 60px; color: #94a3b8;
      .spinner { width: 36px; height: 36px; border: 3px solid #e2e8f0; border-top-color: #2563eb; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 12px; }
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .empty-state { text-align: center; padding: 60px; background: #fff; border-radius: 12px; border: 1px solid #e2e8f0;
      .empty-icon { font-size: 48px; color: #cbd5e1; margin-bottom: 12px; }
      h3 { color: #475569; margin: 0 0 8px; }
      p { color: #94a3b8; font-size: 14px; margin: 0; }
    }

    /* Table */
    .offers-container { background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }
    .offers-table { width: 100%; border-collapse: collapse;
      th { text-align: left; padding: 14px 16px; color: #64748b; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; }
      td { padding: 14px 16px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; font-size: 14px; }
      tr:hover td { background: #f0f9ff; }
    }
    .candidate-cell { display: flex; align-items: center; gap: 10px; }
    .avatar-circle { width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #2563eb, #7c3aed); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; flex-shrink: 0; }
    .name-text { font-weight: 600; color: #1e293b; }
    .job-badge { padding: 4px 10px; background: #f1f5f9; border-radius: 6px; font-size: 13px; font-weight: 500; color: #475569; }
    .salary-text { font-weight: 600; color: #1e293b; i { margin-right: 2px; color: #16a34a; } }
    .date-text { font-size: 13px; color: #64748b; i { margin-right: 4px; }
      &.expired-text { color: #dc2626; }
    }
    .exp-label { font-size: 11px; font-weight: 600; }
    .status-badge { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; i { margin-right: 4px; }
      &[data-status="draft"] { background: #f1f5f9; color: #64748b; }
      &[data-status="sent"] { background: #dbeafe; color: #1e40af; }
      &[data-status="accepted"] { background: #dcfce7; color: #166534; }
      &[data-status="rejected"] { background: #fee2e2; color: #991b1b; }
      &[data-status="argued"] { background: #ede9fe; color: #5b21b6; }
      &[data-status="negotiated"] { background: #ede9fe; color: #5b21b6; }
      &[data-status="expired"] { background: #fef3c7; color: #92400e; }
    }
    .argued-reason { margin-top: 6px; color: #5b21b6; font-size: 12px; line-height: 1.4; i { margin-right: 4px; } }

    /* Actions */
    .action-btns { display: flex; gap: 6px; }
    .btn-action { width: 32px; height: 32px; border: none; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 13px; transition: all 0.15s; }
    .btn-send { background: #dbeafe; color: #2563eb; &:hover { background: #2563eb; color: #fff; } }
    .btn-revoke { background: #fef3c7; color: #d97706; &:hover { background: #d97706; color: #fff; } }
    .btn-view { background: #f1f5f9; color: #64748b; &:hover { background: #64748b; color: #fff; } }

    /* Modal */
    .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; animation: fadeIn 0.2s; }
    .modal-card { background: white; border-radius: 14px; width: 520px; max-width: 95%; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.15); overflow: hidden; }
    .modal-header { padding: 18px 24px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: #f8fafc;
      h3 { margin: 0; font-size: 17px; color: #1e293b; i { margin-right: 8px; color: #2563eb; } }
      .modal-close { background: none; border: none; font-size: 18px; cursor: pointer; color: #64748b; &:hover { color: #ef4444; } }
    }
    .modal-body { padding: 24px; }
    .modal-footer { padding: 16px 24px; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 10px; background: #f8fafc; }

    .form-group { margin-bottom: 16px;
      label { display: block; font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 6px; }
      .req { color: #ef4444; }
    }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .form-input { width: 100%; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; outline: none; box-sizing: border-box; &:focus { border-color: #2563eb; } }
    .btn-cancel { padding: 10px 20px; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; cursor: pointer; font-weight: 600; color: #64748b; &:hover { background: #f1f5f9; } }
    .btn-submit { padding: 10px 20px; border: none; border-radius: 8px; background: #2563eb; color: #fff; cursor: pointer; font-weight: 600; i { margin-right: 6px; } &:hover { background: #1d4ed8; } &:disabled { opacity: 0.5; } }
    .form-divider { height: 1px; background: #e2e8f0; margin: 16px 0; }
    .doc-help { font-size: 12px; color: #64748b; margin-top: -2px; margin-bottom: 10px; }
    .doc-row { grid-template-columns: 1fr 1fr; }
    .doc-files { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; margin-top: 10px; }
    .doc-file { font-size: 12px; color: #334155; i { color: #64748b; margin-right: 6px; } }
    .doc-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 10px; }
    .btn-doc-secondary {
      padding: 8px 14px; border-radius: 8px; border: 1px solid #e2e8f0; background: #fff; cursor: pointer;
      font-weight: 700; font-size: 12px; color: #64748b;
      &:hover { background: #f1f5f9; }
      &:disabled { opacity: 0.55; cursor: not-allowed; }
    }
    .btn-doc-primary {
      padding: 8px 14px; border-radius: 8px; border: none; background: #0f172a; cursor: pointer;
      font-weight: 700; font-size: 12px; color: #fff;
      i { margin-right: 6px; }
      &:hover { background: #111827; }
      &:disabled { opacity: 0.55; cursor: not-allowed; }
    }
    .doc-status { margin-top: 10px; font-size: 12px; color: #334155; }

    /* Offer letter mode */
    .segmented {
      display: inline-flex;
      gap: 6px;
      padding: 6px;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      background: #f8fafc;
      margin-bottom: 12px;
    }
    .seg-btn {
      border: none;
      background: transparent;
      padding: 8px 12px;
      border-radius: 10px;
      cursor: pointer;
      font-weight: 800;
      font-size: 12px;
      color: #64748b;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: all 0.15s ease;
      i { font-size: 12px; }
      &:hover { background: #eef2ff; color: #1e40af; }
      &.active {
        background: #ffffff;
        color: #0f172a;
        box-shadow: 0 1px 0 rgba(15,23,42,0.08);
      }
    }
    .letter-panel {
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      background: linear-gradient(180deg, #ffffff, #fbfdff);
      padding: 14px;
    }
    .letter-panel-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }
    .letter-title { display: flex; gap: 12px; align-items: flex-start; }
    .letter-badge {
      width: 36px; height: 36px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      &.gen { background: #dcfce7; color: #16a34a; }
      &.man { background: #dbeafe; color: #2563eb; }
    }
    .letter-h { font-weight: 800; color: #0f172a; font-size: 13px; margin-bottom: 2px; }
    .letter-sub { font-size: 12px; color: #64748b; line-height: 1.35; }
    .letter-actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }

    .mini-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; }
    .mini-item { border: 1px dashed #e2e8f0; background: #f8fafc; border-radius: 12px; padding: 10px 12px; }
    .mini-k { font-size: 11px; font-weight: 800; color: #94a3b8; margin-bottom: 3px; }
    .mini-v { font-size: 12px; font-weight: 700; color: #334155; }

    /* Detail Grid */
    .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .detail-item { display: flex; flex-direction: column; gap: 4px; }
    .detail-label { font-size: 12px; color: #94a3b8; font-weight: 600; i { margin-right: 4px; } }
    .detail-value { font-size: 15px; color: #1e293b; font-weight: 500; }

    /* Toast */
    .toast-notification { position: fixed; bottom: 24px; right: 24px; padding: 14px 24px; border-radius: 10px; color: #fff; font-weight: 600; font-size: 14px; z-index: 2000; animation: slideUp 0.3s ease-out; i { margin-right: 8px; }
      &.toast-success { background: #16a34a; }
      &.toast-error { background: #dc2626; }
    }
    @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  `]
})
export class OffersTab implements OnInit {
  isLoading = true;
  allOffers: OfferRow[] = [];
  filteredOffers: OfferRow[] = [];
  statusFilter = '';
  searchQuery = '';

  private loggedInUserId = '';

  // Stats
  stats: { value: number; label: string; icon: string; colorClass: string }[] = [];

  // Create Modal
  showCreateModal = false;
  isSubmitting = false;
  offerCandidates: CandidateOption[] = [];
  newOffer = { application_id: '', designation: '', offered_salary: '', salary_currency: 'INR', joining_date: '', expiration_date: '' };

  // Optional documents upload (Create modal)
  docUploadType: 'OFFER_LETTER' | 'OFFER_ATTACHMENT' | 'NDA' | 'ID_PROOF' | 'OTHER' = 'OFFER_LETTER';
  docFiles: File[] = [];
  isUploadingDocs = false;
  docUploadStatus = '';

  offerLetterMode: 'GENERATED' | 'MANUAL' = 'GENERATED';
  isGeneratingLetter = false;

  // Edit & resend modal (for negotiated offers)
  showEditResendModal = false;
  isEditSubmitting = false;
  editingOffer: OfferRow | null = null;
  editOffer = { designation: '', offered_salary: '', salary_currency: 'INR', joining_date: '', expiration_date: '' };

  // View Modal
  viewingOffer: OfferRow | null = null;

  // Toast
  showToast = false;
  toastMessage = '';
  toastType: 'success' | 'error' = 'success';
  private toastTimeout: any;

  constructor(private soap: SoapService) {}

  ngOnInit(): void {
    this.loggedInUserId = sessionStorage.getItem('loggedInUserId') || '';
    this.loadData();
  }

  async loadData(): Promise<void> {
    this.isLoading = true;
    try {
      const [offers, apps, candidates, jobs, pipelineStages] = await Promise.all([
        this.soap.getOffers(),
        this.soap.getApplications(),
        this.soap.getCandidates(),
        this.soap.getJobRequisitions(),
        this.soap.getPipelineStages()
      ]);

      const candMap = new Map<string, string>();
      candidates.forEach(c => candMap.set(c['candidate_id'] || '', `${c['first_name'] || ''} ${c['last_name'] || ''}`));

      const jobMap = new Map<string, string>();
      jobs.forEach(j => jobMap.set(j['requisition_id'] || '', j['title'] || ''));

      const appMap = new Map<string, Record<string, string>>();
      apps.forEach(a => appMap.set(a['application_id'] || '', a));

      const offerStageId = (pipelineStages || []).find(s =>
        (s['stage_name'] || '').toLowerCase().includes('offer')
      )?.['stage_id'];

      this.allOffers = offers.map(o => {
        const app = appMap.get(o['application_id'] || '') || {};
        return {
          offer_id: o['offer_id'] || '',
          application_id: o['application_id'] || '',
          candidate_name: candMap.get(app['candidate_id'] || '') || 'Unknown',
          job_title: jobMap.get(app['requisition_id'] || '') || 'Unknown',
          designation: o['temp3'] || o['Temp3'] || '',
          offered_salary: o['offered_salary'] || '',
          salary_currency: o['salary_currency'] || 'INR',
          joining_date: o['joining_date'] || '',
          expiration_date: o['expiration_date'] || '',
          status: o['status'] || 'DRAFT',
          created_by_user: o['created_by_user'] || o['created_by'] || '',
          created_at: o['created_at'] || '',
          updated_at: o['updated_at'] || '',
          updated_by_user: o['updated_by_user'] || o['updated_by'] || '',
          argued_reason: o['temp1'] || o['Temp1'] || ''
        };
      });

      // Build offer candidate list — only applications at Offer stage (S4) without an existing offer
      const existingOfferAppIds = new Set(offers.map(o => o['application_id'] || ''));
      this.offerCandidates = apps
        // Only show applications that are currently at the configured "Offer" stage.
        .filter(a => {
          const currentStageId = a['current_stage_id'] || '';
          const isAtOfferStage = offerStageId ? currentStageId === offerStageId : currentStageId === 'S4';
          return isAtOfferStage && !existingOfferAppIds.has(a['application_id'] || '');
        })
        .map(a => ({
          application_id: a['application_id'] || '',
          candidate_name: candMap.get(a['candidate_id'] || '') || 'Unknown',
          job_title: jobMap.get(a['requisition_id'] || '') || 'Unknown',
          candidate_id: a['candidate_id'] || ''
        }));

      this.computeStats();
      this.applyFilters();
    } catch (err) {
      console.error('Failed to load offers:', err);
      this.toast('Failed to load offers.', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  computeStats(): void {
    const draft = this.allOffers.filter(o => o.status === 'DRAFT').length;
    const sent = this.allOffers.filter(o => o.status === 'SENT').length;
    const negotiated = this.allOffers.filter(o => o.status === 'NEGOTIATED' || o.status === 'ARGUED').length;
    const accepted = this.allOffers.filter(o => o.status === 'ACCEPTED').length;
    const rejected = this.allOffers.filter(o => o.status === 'REJECTED').length;
    this.stats = [
      { value: draft, label: 'Drafts', icon: 'fa-file', colorClass: 'clr-gray' },
      { value: sent, label: 'Sent', icon: 'fa-paper-plane', colorClass: 'clr-blue' },
      { value: negotiated, label: 'Negotiated', icon: 'fa-scale-balanced', colorClass: 'clr-purple' },
      { value: accepted, label: 'Accepted', icon: 'fa-check-circle', colorClass: 'clr-green' },
      { value: rejected, label: 'Rejected', icon: 'fa-times-circle', colorClass: 'clr-red' },
    ];
  }

  applyFilters(): void {
    let list = [...this.allOffers];
    if (this.statusFilter) {
      if (this.statusFilter === 'NEGOTIATED') {
        list = list.filter(o => o.status === 'NEGOTIATED' || o.status === 'ARGUED');
      } else {
        list = list.filter(o => o.status === this.statusFilter);
      }
    }
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(o => o.candidate_name.toLowerCase().includes(q) || o.job_title.toLowerCase().includes(q));
    }
    this.filteredOffers = list;
  }

  // ── CREATE ──
  openCreateModal(): void {
    this.newOffer = { application_id: '', designation: '', offered_salary: '', salary_currency: 'INR', joining_date: '', expiration_date: '' };
    this.offerLetterMode = 'GENERATED';
    this.docUploadType = 'OFFER_LETTER';
    this.docFiles = [];
    this.docUploadStatus = '';
    this.showCreateModal = true;
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
  }

  async submitOffer(): Promise<void> {
    if (
      !this.newOffer.application_id ||
      !String(this.newOffer.designation || '').trim() ||
      this.newOffer.offered_salary === '' ||
      !this.newOffer.joining_date ||
      !this.newOffer.expiration_date
    ) {
      this.toast('Please fill all required fields.', 'error');
      return;
    }

    const allowedCurrencies = new Set(['INR', 'USD', 'EUR', 'GBP']);
    const currency = (this.newOffer.salary_currency || '').toUpperCase();
    if (!allowedCurrencies.has(currency)) {
      this.toast('Please select a valid currency.', 'error');
      return;
    }

    const offeredSalaryNum = Number(this.newOffer.offered_salary);
    if (!Number.isFinite(offeredSalaryNum) || offeredSalaryNum <= 0) {
      this.toast('Offered Salary must be a positive number.', 'error');
      return;
    }

    const joinDate = this.parseLocalDate(this.newOffer.joining_date);
    const expDate = this.parseLocalDate(this.newOffer.expiration_date);
    const today = this.getLocalTodayMidnight();

    if (!joinDate || !expDate) {
      this.toast('Please provide valid dates.', 'error');
      return;
    }

    // Future only (not today)
    if (joinDate <= today) {
      this.toast('Joining date must be in the future (not today).', 'error');
      return;
    }
    if (expDate <= today) {
      this.toast('Offer expiry date must be in the future (not today).', 'error');
      return;
    }

    // Expiry must be before joining
    if (expDate >= joinDate) {
      this.toast('Offer expiry date must be before joining date.', 'error');
      return;
    }
    if (!this.loggedInUserId) {
      this.toast('Session user missing. Please login again.', 'error');
      return;
    }
    this.isSubmitting = true;
    try {
      // Required by DB FK: ts_offers_created_by_user_fkey -> ts_users
      const payload = {
        ...this.newOffer,
        salary_currency: currency,
        created_by_user: this.loggedInUserId,
        temp3: String(this.newOffer.designation || '').trim()
      };
      await this.soap.insertOffer(this.newOffer.application_id, payload);
      this.toast('Offer created successfully!', 'success');
      this.showCreateModal = false;
      await this.loadData();
    } catch (err) {
      this.toast('Failed to create offer.', 'error');
    } finally {
      this.isSubmitting = false;
    }
  }

  private parseLocalDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    // Expect YYYY-MM-DD from <input type="date">
    const parts = dateStr.split('-').map(n => parseInt(n, 10));
    if (parts.length !== 3 || parts.some(n => !Number.isFinite(n))) return null;
    const [y, m, d] = parts;
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }

  private getLocalTodayMidnight(): Date {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate(), 0, 0, 0, 0);
  }

  // ── ACTIONS ──
  async sendOffer(o: OfferRow): Promise<void> {
    try {
      await this.soap.updateOfferStatus(o.offer_id, 'SENT');
      o.status = 'SENT';
      o.argued_reason = '';
      this.computeStats();
      this.toast('Offer sent to candidate!', 'success');

      // Send offer sent email (non-blocking)
      try {
        const app = await this.soap.getApplicationById(o.application_id);
        const candidateId = app?.['candidate_id'] || app?.['Candidate_id'] || '';
        const cand = candidateId ? await this.soap.getCandidateById(candidateId) : null;
        const candidateEmail = String(cand?.['email'] || cand?.['Email'] || '').trim();

        if (candidateEmail) {
          const mail = buildMailBody('OFFER_SENT', {
            candidateName: o.candidate_name,
            jobTitle: o.job_title,
            requisitionId: app?.['requisition_id'] || '',
            offeredSalary: o.offered_salary,
            salaryCurrency: o.salary_currency,
            joiningDate: o.joining_date,
            expirationDate: o.expiration_date
          });
          await this.soap.sendAllMailsBPM(candidateEmail, mail.subject, mail.body);
        }
      } catch (mailErr) {
        console.warn('[Offers] Failed to send offer sent mail (non-blocking):', mailErr);
      }
    } catch (err) {
      this.toast('Failed to send offer.', 'error');
    }
  }

  async revokeOffer(o: OfferRow): Promise<void> {
    try {
      await this.soap.updateOfferStatus(o.offer_id, 'DRAFT');
      o.status = 'DRAFT';
      this.computeStats();
      this.toast('Offer revoked back to draft.', 'success');
    } catch (err) {
      this.toast('Failed to revoke offer.', 'error');
    }
  }

  openEditResendModal(o: OfferRow): void {
    if (o.status !== 'ARGUED' && o.status !== 'NEGOTIATED') return;
    this.editingOffer = o;
    this.editOffer = {
      designation: o.designation || '',
      offered_salary: o.offered_salary || '',
      salary_currency: o.salary_currency || 'INR',
      joining_date: o.joining_date || '',
      expiration_date: o.expiration_date || ''
    };
    this.isEditSubmitting = false;
    this.showEditResendModal = true;
  }

  closeEditResendModal(): void {
    if (this.isEditSubmitting) return;
    this.showEditResendModal = false;
    this.editingOffer = null;
    this.editOffer = { designation: '', offered_salary: '', salary_currency: 'INR', joining_date: '', expiration_date: '' };
  }

  async submitEditResend(): Promise<void> {
    const o = this.editingOffer;
    if (!o) return;

    if (
      !String(this.editOffer.designation || '').trim() ||
      this.editOffer.offered_salary === '' ||
      !this.editOffer.joining_date ||
      !this.editOffer.expiration_date
    ) {
      this.toast('Please fill all required fields.', 'error');
      return;
    }

    const allowedCurrencies = new Set(['INR', 'USD', 'EUR', 'GBP']);
    const currency = (this.editOffer.salary_currency || '').toUpperCase();
    if (!allowedCurrencies.has(currency)) {
      this.toast('Please select a valid currency.', 'error');
      return;
    }

    const offeredSalaryNum = Number(this.editOffer.offered_salary);
    if (!Number.isFinite(offeredSalaryNum) || offeredSalaryNum <= 0) {
      this.toast('Offered Salary must be a positive number.', 'error');
      return;
    }

    const joinDate = this.parseLocalDate(this.editOffer.joining_date);
    const expDate = this.parseLocalDate(this.editOffer.expiration_date);
    const today = this.getLocalTodayMidnight();
    if (!joinDate || !expDate) {
      this.toast('Please provide valid dates.', 'error');
      return;
    }
    if (joinDate <= today) {
      this.toast('Joining date must be in the future (not today).', 'error');
      return;
    }
    if (expDate <= today) {
      this.toast('Offer expiry date must be in the future (not today).', 'error');
      return;
    }
    if (expDate >= joinDate) {
      this.toast('Offer expiry date must be before joining date.', 'error');
      return;
    }

    this.isEditSubmitting = true;
    try {
      await this.soap.updateOfferDetails(o.offer_id, {
        temp3: String(this.editOffer.designation || '').trim(),
        offered_salary: this.editOffer.offered_salary,
        salary_currency: currency,
        joining_date: this.editOffer.joining_date,
        expiration_date: this.editOffer.expiration_date,
        status: 'SENT',
        temp1: '',
        updated_by: this.loggedInUserId
      });

      o.designation = String(this.editOffer.designation || '').trim();
      o.offered_salary = this.editOffer.offered_salary;
      o.salary_currency = currency;
      o.joining_date = this.editOffer.joining_date;
      o.expiration_date = this.editOffer.expiration_date;
      o.status = 'SENT';
      o.argued_reason = '';
      o.updated_by_user = this.loggedInUserId || o.updated_by_user;
      o.updated_at = new Date().toISOString();

      this.computeStats();
      this.applyFilters();
      this.closeEditResendModal();
      this.toast('Offer updated and resent successfully!', 'success');

      // Send offer sent email (non-blocking)
      try {
        const app = await this.soap.getApplicationById(o.application_id);
        const candidateId = app?.['candidate_id'] || app?.['Candidate_id'] || '';
        const cand = candidateId ? await this.soap.getCandidateById(candidateId) : null;
        const candidateEmail = String(cand?.['email'] || cand?.['Email'] || '').trim();
        if (candidateEmail) {
          const mail = buildMailBody('OFFER_SENT', {
            candidateName: o.candidate_name,
            jobTitle: o.job_title,
            requisitionId: app?.['requisition_id'] || '',
            offeredSalary: o.offered_salary,
            salaryCurrency: o.salary_currency,
            joiningDate: o.joining_date,
            expirationDate: o.expiration_date
          });
          await this.soap.sendAllMailsBPM(candidateEmail, mail.subject, mail.body);
        }
      } catch (mailErr) {
        console.warn('[Offers] Failed to send offer resent mail (non-blocking):', mailErr);
      }
    } catch (err) {
      console.error('Failed to edit and resend offer:', err);
      this.toast('Failed to edit and resend offer.', 'error');
    } finally {
      this.isEditSubmitting = false;
    }
  }

  viewOffer(o: OfferRow): void {
    this.viewingOffer = o;
  }

  // ── HELPERS ──
  getStatusIcon(status: string): string {
    switch (status) {
      case 'DRAFT': return 'fa-file';
      case 'SENT': return 'fa-paper-plane';
      case 'ACCEPTED': return 'fa-check-circle';
      case 'REJECTED': return 'fa-times-circle';
      case 'ARGUED':
      case 'NEGOTIATED': return 'fa-scale-balanced';
      case 'EXPIRED': return 'fa-clock';
      default: return 'fa-circle';
    }
  }

  getStatusLabel(status: string): string {
    if (status === 'ARGUED') return 'NEGOTIATED';
    return status || '-';
  }

  isExpired(o: OfferRow): boolean {
    if (!o.expiration_date) return false;
    return new Date(o.expiration_date) < new Date() && o.status !== 'ACCEPTED' && o.status !== 'REJECTED';
  }

  formatDate(d: string): string {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  formatDateTime(d: string | undefined): string {
    if (!d) return '-';
    // Show date + time if available; fall back to date-only.
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '-';
    return dt.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  toast(msg: string, type: 'success' | 'error'): void {
    this.toastMessage = msg;
    this.toastType = type;
    this.showToast = true;
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => this.showToast = false, 4000);
  }

  // ── OPTIONAL DOC UPLOAD (CREATE MODAL) ──
  onDocFilesSelected(ev: Event): void {
    const input = ev.target as HTMLInputElement | null;
    const files = input?.files ? Array.from(input.files) : [];
    this.docFiles = files;
    this.docUploadStatus = '';
  }

  clearDocFiles(): void {
    this.docFiles = [];
    this.docUploadStatus = '';
  }

  private fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read file.'));
      reader.onload = () => resolve(String(reader.result || ''));
      reader.readAsDataURL(file);
    });
  }

  async uploadDocsForSelectedCandidate(): Promise<void> {
    if (this.isUploadingDocs) return;
    if (!this.newOffer.application_id || this.docFiles.length === 0) return;

    const selected = this.offerCandidates.find(c => c.application_id === this.newOffer.application_id);
    const candidateId = selected?.candidate_id || '';
    if (!candidateId) {
      this.docUploadStatus = 'Candidate not found for the selected application.';
      return;
    }

    this.isUploadingDocs = true;
    this.docUploadStatus = 'Uploading...';
    try {
      for (const f of this.docFiles) {
        const dataUrl = await this.fileToDataUrl(f);
        await this.soap.uploadCandidateDocument(candidateId, this.docUploadType, dataUrl);
      }
      this.docUploadStatus = `Uploaded ${this.docFiles.length} file(s).`;
      this.docFiles = [];
    } catch (e) {
      this.docUploadStatus = 'Failed to upload document(s).';
    } finally {
      this.isUploadingDocs = false;
    }
  }

  setOfferLetterMode(mode: 'GENERATED' | 'MANUAL'): void {
    this.offerLetterMode = mode;
    this.docUploadStatus = '';
    if (mode === 'MANUAL' && !this.docUploadType) this.docUploadType = 'OFFER_LETTER';
  }

  getSelectedCandidateLabel(): string {
    const selected = this.offerCandidates.find(c => c.application_id === this.newOffer.application_id);
    if (!selected) return '-';
    return `${selected.candidate_name} — ${selected.job_title}`;
  }

  canGenerateOfferLetter(): boolean {
    if (!this.newOffer.application_id) return false;
    if (!String(this.newOffer.designation || '').trim()) return false;
    if (this.newOffer.offered_salary === '') return false;
    if (!this.newOffer.joining_date || !this.newOffer.expiration_date) return false;

    const allowedCurrencies = new Set(['INR', 'USD', 'EUR', 'GBP']);
    const currency = (this.newOffer.salary_currency || '').toUpperCase();
    if (!allowedCurrencies.has(currency)) return false;

    const offeredSalaryNum = Number(this.newOffer.offered_salary);
    if (!Number.isFinite(offeredSalaryNum) || offeredSalaryNum <= 0) return false;

    const joinDate = this.parseLocalDate(this.newOffer.joining_date);
    const expDate = this.parseLocalDate(this.newOffer.expiration_date);
    const today = this.getLocalTodayMidnight();
    if (!joinDate || !expDate) return false;
    if (joinDate <= today) return false;
    if (expDate <= today) return false;
    if (expDate >= joinDate) return false;
    return true;
  }

  async previewGeneratedOfferLetter(): Promise<void> {
    if (this.isGeneratingLetter) return;
    if (!this.canGenerateOfferLetter()) {
      this.toast('Fill offer details first to generate the letter.', 'error');
      return;
    }
    try {
      this.isGeneratingLetter = true;
      const doc = await this.buildOfferLetterPdfForCreateModal();
      const fileName = this.getOfferLetterFileName();
      doc.save(fileName);
    } catch (e) {
      console.error('[Offers] Failed to preview offer letter:', e);
      this.toast('Failed to generate offer letter preview.', 'error');
    } finally {
      this.isGeneratingLetter = false;
    }
  }

  async generateAndUploadOfferLetter(): Promise<void> {
    if (this.isGeneratingLetter) return;
    if (!this.canGenerateOfferLetter()) {
      this.toast('Fill offer details first to generate the letter.', 'error');
      return;
    }

    const selected = this.offerCandidates.find(c => c.application_id === this.newOffer.application_id);
    const candidateId = selected?.candidate_id || '';
    if (!candidateId) {
      this.toast('Candidate not found for the selected application.', 'error');
      return;
    }

    this.isGeneratingLetter = true;
    this.docUploadStatus = 'Generating offer letter...';
    try {
      const doc = await this.buildOfferLetterPdfForCreateModal();
      const dataUrl = doc.output('datauristring');
      await this.soap.uploadCandidateDocument(candidateId, 'OFFER_LETTER', dataUrl);
      this.docUploadStatus = 'Offer letter generated and uploaded successfully.';
      this.toast('Offer letter uploaded to candidate documents.', 'success');
    } catch (e) {
      console.error('[Offers] Failed to generate/upload offer letter:', e);
      this.docUploadStatus = 'Failed to generate/upload offer letter.';
      this.toast('Failed to generate/upload offer letter.', 'error');
    } finally {
      this.isGeneratingLetter = false;
    }
  }

  private getOfferLetterFileName(): string {
    const selected = this.offerCandidates.find(c => c.application_id === this.newOffer.application_id);
    const safeJob = this.toSafeFileName(selected?.job_title || 'job');
    const safeCandidate = this.toSafeFileName(selected?.candidate_name || 'candidate');
    return `offer-letter-${safeCandidate}-${safeJob}.pdf`;
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

  private async buildOfferLetterPdfForCreateModal(): Promise<jsPDF> {
    const selected = this.offerCandidates.find(c => c.application_id === this.newOffer.application_id);
    const candidateName = selected?.candidate_name || 'Candidate';
    const jobTitle = selected?.job_title || 'Job';

    const offeredSalary = `${this.newOffer.offered_salary || '-'} ${(this.newOffer.salary_currency || '').toUpperCase()}`.trim();
    const joiningDate = this.formatReadableDate(this.newOffer.joining_date || '');
    const expiryDate = this.formatReadableDate(this.newOffer.expiration_date || '');
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
        // Non-blocking fallback.
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
      `We are pleased to offer you the position of ${jobTitle}. ` +
      'Please find your offer details below:';
    const bodyLines = doc.splitTextToSize(bodyLine, pageWidth - left * 2);
    doc.text(bodyLines, left, y);
    y += bodyLines.length * 15 + 12;

    const rows: Array<[string, string]> = [
      ['Application ID', this.newOffer.application_id || '-'],
      ['Job Title', jobTitle || '-'],
      ['Designation', String(this.newOffer.designation || '').trim() || '-'],
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
    const note = 'Please review and respond to the offer in the portal before the expiry date.';
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
