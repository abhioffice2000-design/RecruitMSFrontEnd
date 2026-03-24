import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HeroService } from '../../hero.service';

declare var $: any;

const NAMESPACE = 'http://schemas.cordys.com/RMST1DatabaseMetadata';

interface ApplicationRow {
  application_id: string;
  candidate_id: string;
  requisition_id: string;
  candidate_name: string;
  candidate_email: string;
  jobProfile: string;
  appliedDate: string;
  status: string;
  stage_name: string;
}

@Component({
  selector: 'app-inbox',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dashboard-content">
      <div class="header">
        <h2>Inbox - Applications</h2>
      </div>

      <!-- Loading -->
      <div class="loading-state" *ngIf="isLoading">
        <div class="spinner"></div>
        <p>Loading applications...</p>
      </div>

      <div class="inbox-container" *ngIf="!isLoading">
        <div class="inbox-header">
          <h3>Recent Applications</h3>
          <div class="controls">
            <input type="text" placeholder="Search applications..."
                   class="search-input" [(ngModel)]="searchQuery"
                   (ngModelChange)="applyFilters()">
            <select class="filter-select" [(ngModel)]="statusFilter"
                    (ngModelChange)="applyFilters()">
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="REJECTED">Rejected</option>
              <option value="HOLD">Hold</option>
            </select>
          </div>
        </div>

        <!-- Empty State -->
        <div class="empty-state" *ngIf="filteredApplications.length === 0">
          <div class="empty-icon">📬</div>
          <h4>No applications found</h4>
          <p>No applications match your current filters.</p>
        </div>

        <div class="applications-list" *ngIf="filteredApplications.length > 0">
          <div class="application-item" *ngFor="let app of filteredApplications">
            <div class="candidate-info">
              <div class="avatar-circle">{{ getInitials(app.candidate_name) }}</div>
              <div class="details">
                <span class="name">{{ app.candidate_name }}</span>
                <span class="email">{{ app.candidate_email }}</span>
              </div>
            </div>

            <div class="job-info">
              <span class="label">Job Profile</span>
              <span class="value">{{ app.jobProfile }}</span>
            </div>

            <div class="date-info">
              <span class="label">Applied Date</span>
              <span class="value">{{ app.appliedDate }}</span>
            </div>

            <div class="stage-info">
              <span class="label">Stage</span>
              <span class="stage-badge" [attr.data-stage]="app.stage_name.toLowerCase()">{{ app.stage_name }}</span>
            </div>

            <div class="status-info">
              <span class="status-badge" [ngClass]="app.status.toLowerCase()">
                {{ app.status }}
              </span>
            </div>
          </div>
        </div>

        <div class="summary-text" *ngIf="filteredApplications.length > 0">
          Showing {{ filteredApplications.length }} of {{ allApplications.length }} applications
        </div>
      </div>
    </div>
  `,
  styleUrls: ['../../hr-dashboard/hr-dashboard.scss'],
  styles: [`
    /* ── Loading ── */
    .loading-state {
      display: flex; flex-direction: column; align-items: center; padding: 60px; color: #94a3b8;
      .spinner {
        width: 36px; height: 36px; border: 3px solid #e2e8f0; border-top-color: #2563eb;
        border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 12px;
      }
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Empty ── */
    .empty-state {
      text-align: center; padding: 60px 20px; color: #94a3b8;
      .empty-icon { font-size: 48px; margin-bottom: 12px; }
      h4 { color: #475569; margin: 0 0 8px; }
      p { margin: 0; font-size: 14px; }
    }

    .inbox-container {
      background: #fff;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      border: 1px solid #e2e8f0;

      .inbox-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 24px;
        padding-bottom: 16px;
        border-bottom: 1px solid #f1f5f9;

        h3 {
          margin: 0;
          font-size: 20px;
          color: #1e293b;
          font-weight: 700;
        }

        .controls {
          display: flex;
          gap: 12px;

          input, select {
            padding: 8px 16px;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            font-size: 14px;
            color: #1e293b;
            outline: none;

            &:focus {
              border-color: #2563eb;
            }
          }

          input { width: 250px; }
        }
      }

      .applications-list {
        display: flex;
        flex-direction: column;
        gap: 12px;

        .application-item {
          display: grid;
          grid-template-columns: 2fr 1.5fr 1fr 1fr 0.8fr;
          align-items: center;
          padding: 16px;
          border-radius: 8px;
          border: 1px solid #f1f5f9;
          transition: all 0.2s ease;
          background: #fafbfc;

          &:hover {
            border-color: #bfdbfe;
            background: #fff;
            box-shadow: 0 2px 8px rgba(37, 99, 235, 0.05);
          }

          .candidate-info {
            display: flex;
            align-items: center;
            gap: 16px;

            .avatar-circle {
              width: 44px; height: 44px; border-radius: 50%;
              background: linear-gradient(135deg, #2563eb, #7c3aed);
              color: #fff; display: flex; align-items: center;
              justify-content: center; font-weight: 700; font-size: 14px;
              flex-shrink: 0;
            }

            .details {
              display: flex;
              flex-direction: column;
              gap: 4px;

              .name {
                font-weight: 600;
                color: #1e293b;
                font-size: 15px;
              }
              .email {
                font-size: 13px;
                color: #94a3b8;
              }
            }
          }

          .job-info, .date-info, .stage-info {
            display: flex;
            flex-direction: column;
            gap: 4px;

            .label {
              font-size: 12px;
              color: #94a3b8;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .value {
              font-size: 14px;
              font-weight: 500;
              color: #1e293b;
            }
          }

          .stage-badge {
            padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600;
            background: #e2e8f0; color: #475569; display: inline-block;
            &[data-stage="applied"] { background: #dbeafe; color: #1e40af; }
            &[data-stage="screening"] { background: #fef3c7; color: #92400e; }
            &[data-stage="interview"] { background: #ede9fe; color: #5b21b6; }
            &[data-stage="offer"] { background: #d1fae5; color: #065f46; }
            &[data-stage="hired"] { background: #dcfce7; color: #166534; }
          }

          .status-badge {
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            text-align: center;
            display: inline-block;

            &.active { background: #dcfce7; color: #166534; }
            &.rejected { background: #fee2e2; color: #991b1b; }
            &.hold { background: #fef3c7; color: #b45309; }
          }
        }
      }
    }

    .summary-text {
      padding: 12px 0 0;
      text-align: right;
      color: #94a3b8;
      font-size: 13px;
    }
  `]
})
export class InboxTab implements OnInit {
  isLoading = true;
  allApplications: ApplicationRow[] = [];
  filteredApplications: ApplicationRow[] = [];
  searchQuery = '';
  statusFilter = '';

  constructor(private hero: HeroService) {}

  ngOnInit(): void {
    this.loadData();
  }

  // ═══════════════════════════════════════════════════
  //  DATA LOADING
  // ═══════════════════════════════════════════════════

  async loadData(): Promise<void> {
    this.isLoading = true;
    try {
      // Fetch all in parallel
      const [appsResp, candidatesResp, jobsResp, stagesResp] = await Promise.all([
        this.hero.ajax('GetTs_applicationsObjects', NAMESPACE, {
          fromApplication_id: '0',
          toApplication_id: 'zzzzzzzzzz'
        }),
        this.hero.ajax('GetTs_candidatesObjects', NAMESPACE, {
          fromCandidate_id: '0',
          toCandidate_id: 'zzzzzzzzzz'
        }),
        this.hero.ajax('GetTs_job_requisitionsObjects', NAMESPACE, {
          fromRequisition_id: '0',
          toRequisition_id: 'zzzzzzzzzz'
        }),
        this.hero.ajax('GetMt_pipeline_stagesObjects', NAMESPACE, {
          fromStage_id: '0',
          toStage_id: 'zzzzzzzzzz'
        })
      ]);

      // Parse tuples
      const apps = this.extractTuples(appsResp, 'ts_applications');
      const candidates = this.extractTuples(candidatesResp, 'ts_candidates');
      const jobs = this.extractTuples(jobsResp, 'ts_job_requisitions');
      const stages = this.extractTuples(stagesResp, 'mt_pipeline_stages');

      // Build lookup maps
      const candMap = new Map<string, any>();
      candidates.forEach((c: any) => candMap.set(c.candidate_id || '', c));

      const jobMap = new Map<string, string>();
      jobs.forEach((j: any) => jobMap.set(j.requisition_id || '', j.title || ''));

      const stageMap = new Map<string, string>();
      stages.forEach((s: any) => stageMap.set(s.stage_id || '', s.stage_name || ''));

      // Build rows
      this.allApplications = apps.map((a: any) => {
        const cand = candMap.get(a.candidate_id || '');
        const firstName = cand?.first_name || '';
        const lastName = cand?.last_name || '';
        const name = (firstName + ' ' + lastName).trim() || 'Unknown';

        return {
          application_id: a.application_id || '',
          candidate_id: a.candidate_id || '',
          requisition_id: a.requisition_id || '',
          candidate_name: name,
          candidate_email: cand?.email || '',
          jobProfile: jobMap.get(a.requisition_id || '') || a.requisition_id || '',
          appliedDate: this.formatDate(a.applied_at || a.created_at || ''),
          status: (a.status || 'ACTIVE').toUpperCase(),
          stage_name: stageMap.get(a.current_stage_id || '') || 'New'
        };
      });

      // Sort by most recent first
      this.allApplications.sort((a, b) => {
        return (b.appliedDate || '').localeCompare(a.appliedDate || '');
      });

      this.applyFilters();
    } catch (err) {
      console.error('[Inbox] Failed to load applications:', err);
    } finally {
      this.isLoading = false;
    }
  }

  // ═══════════════════════════════════════════════════
  //  EXTRACT TUPLES from Cordys XML/JSON response
  // ═══════════════════════════════════════════════════

  extractTuples(resp: any, entityName: string): any[] {
    try {
      const tuples = $.cordys.json.find(resp, 'tuple');
      if (!tuples) return [];
      const tupleArr = Array.isArray(tuples) ? tuples : [tuples];
      return tupleArr.map((t: any) => {
        const old = t.old || t;
        return old[entityName] || old;
      });
    } catch (e) {
      console.warn('[Inbox] extractTuples error:', e);
      return [];
    }
  }

  // ═══════════════════════════════════════════════════
  //  FILTERING
  // ═══════════════════════════════════════════════════

  applyFilters(): void {
    let list = [...this.allApplications];

    if (this.statusFilter) {
      list = list.filter(a => a.status === this.statusFilter);
    }

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(a =>
        a.candidate_name.toLowerCase().includes(q) ||
        a.candidate_email.toLowerCase().includes(q) ||
        a.jobProfile.toLowerCase().includes(q)
      );
    }

    this.filteredApplications = list;
  }

  // ═══════════════════════════════════════════════════
  //  HELPERS
  // ═══════════════════════════════════════════════════

  getInitials(name: string): string {
    return name.split(' ').map(w => w.charAt(0)).slice(0, 2).join('').toUpperCase();
  }

  formatDate(d: string): string {
    if (!d) return '';
    try {
      return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return d;
    }
  }
}
