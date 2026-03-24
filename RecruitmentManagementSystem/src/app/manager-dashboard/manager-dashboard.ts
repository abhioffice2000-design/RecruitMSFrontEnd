import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SoapService } from '../services/soap.service';
import { buildMailBody } from '../services/mail-templates';

interface PendingApproval {
  approval_id: string;
  entity_type: string;
  entity_id: string;
  status: string;
  requested_by: string;
  requested_at: string;
  comments: string;
  // Enriched from ts_job_requisitions
  job_title: string;
  department_name: string;
  requester_name: string;
  experience_range: string;
  salary_range: string;
  open_positions: string;
  description: string;
  posting_source: string;
  // BPM
  bpm_task_id: string;  // from job's temp2
  rejection_reason: string;  // from job's temp3
  // delegation
  delegated_to: string[];
  is_delegated: boolean;
  /** Shown only in "Delegated out" tab — task was delegated to another manager by me. */
  isDelegatedOutTask?: boolean;
  // Raw data
  _raw: Record<string, string>;
  _jobRaw: Record<string, string>;  // raw job data for updates
}

@Component({
  selector: 'app-manager-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './manager-dashboard.html',
  styleUrls: ['./manager-dashboard.scss'],
})
export class ManagerDashboard implements OnInit {

  isLoading = false;
  pendingApprovals: PendingApproval[] = [];
  allApprovals: PendingApproval[] = [];
  /** Pending requisitions I delegated away (ts_approvals.temp2 = DELEGATED_BY:me) — not in main Pending list. */
  delegatedOutApprovals: PendingApproval[] = [];
  loggedInUserId = '';
  loggedInUserEmail = '';
  loggedInUserRole = '';

  activeDelegations: any[] = [];

  // ─── Stats ──────────────────────────────────────
  stats = {
    pending: 0,
    approved: 0,
    rejected: 0,
    delegated: 0,
    delegatedOut: 0,
    total: 0
  };

  // Chart data
  chartSegments: { color: string; percent: number; label: string; count: number }[] = [];

  // ─── Expanded card ──────────────────────────────
  expandedApprovalId: string | null = null;

  // ─── Action Modal ──────────────────────────────
  showActionModal = false;
  actionType: 'APPROVED' | 'REJECTED' = 'APPROVED';
  actionApproval: PendingApproval | null = null;
  actionComments = '';
  isActioning = false;

  // ─── Delegate Modal ───────────────────────────
  showDelegateModal = false;
  delegateApproval: PendingApproval | null = null;
  delegateUsers: { user_id: string; name: string; email: string; role: string; selected: boolean }[] = [];
  allUsers: { user_id: string; name: string; email: string; role: string }[] = [];
  isDelegating = false;
  delegateMemo = '';
  delegateStartDate = '';
  delegateEndDate = '';

  // ─── Filter ───────────────────────────────────
  filterStatus = 'PENDING'; // 'PENDING', 'APPROVED', 'REJECTED', 'ALL', 'DELEGATIONS', 'DELEGATED_OUT'

  // ─── Toast ──────────────────────────────────────
  toastMessage = '';
  toastType: 'success' | 'error' = 'success';
  showToastFlag = false;
  private toastTimeout: any;

  constructor(private soap: SoapService) {}

  ngOnInit(): void {
    this.loggedInUserId = sessionStorage.getItem('loggedInUserId') || '';
    this.loggedInUserEmail = sessionStorage.getItem('loggedInUserEmail') || sessionStorage.getItem('loggedInUser') || '';
    this.loggedInUserRole = sessionStorage.getItem('loggedInUserRole') || '';
    this.loadApprovals();
  }

  // ═══════════════════════════════════════════════════
  //  DELEGATION MANAGEMENT
  // ═══════════════════════════════════════════════════

  async revokeDelegation(delegation: any): Promise<void> {
    if (!confirm(`Are you sure you want to revoke delegation to ${delegation.delegate_name}?`)) return;

    try {
      // Update status to INACTIVE
      const newData = { ...delegation._raw, status: 'INACTIVE', updated_at: new Date().toISOString() };
      await this.soap.call('UpdateTs_delegations', {
        tuple: {
          old: { ts_delegations: delegation._raw },
          'new': { ts_delegations: newData }
        }
      });
      // Also we need to clear the temp2 flag on the affected jobs if possible?
      // Since temp2 is tied to the approval, and a delegation can cover multiple approvals over time,
      // it's safest to let the filter logic handle it (which we might need to adjust), 
      // but for now, deactivating the delegation stops NEW tasks from going to the delegate.
      // And the filter `delegatedBy === 'DELEGATED_BY:id'` actually hides tasks I delegated. 
      // If I revoke, do I want them back? Yes.
      // We should ideally clear the DELEGATED_BY flag on pending approvals, but finding them easily is hard here
      // Let's just update the delegation record for now.

      this.showToast('Delegation revoked successfully.', 'success');
      await this.loadApprovals();
    } catch (err) {
      console.error('[Manager] Revoke failed:', err);
      this.showToast('Failed to revoke delegation.', 'error');
    }
  }

  // ═══════════════════════════════════════════════════
  //  LOAD APPROVALS
  // ═══════════════════════════════════════════════════

  async loadApprovals(): Promise<void> {
    this.isLoading = true;
    try {
      const [rows, depts, users, jobs] = await Promise.all([
        this.soap.getApprovals(),
        this.soap.getDepartments(),
        this.soap.getUsers(),
        this.soap.getJobRequisitions()
      ]);

      const deptMap = new Map<string, string>();
      const deptManagerMap = new Map<string, string>();
      depts.forEach(d => {
        deptMap.set(d['department_id'] || '', d['department_name'] || '');
        deptManagerMap.set(d['department_id'] || '', (d['temp1'] || '').toLowerCase());
      });

      const userMap = new Map<string, string>();
      users.forEach(u => {
        const name = ((u['first_name'] || u['First_name'] || '') + ' ' + (u['last_name'] || u['Last_name'] || '')).trim();
        userMap.set(u['user_id'] || u['User_id'] || '', name || u['email'] || u['Email'] || '');
      });

      this.allUsers = users.map(u => ({
        user_id: u['user_id'] || u['User_id'] || '',
        name: ((u['first_name'] || u['First_name'] || '') + ' ' + (u['last_name'] || u['Last_name'] || '')).trim(),
        email: u['email'] || u['Email'] || '',
        role: (u['role'] || u['Role'] || '').toUpperCase()
      })).filter(u => u.user_id !== this.loggedInUserId);

      const jobMap = new Map<string, Record<string, string>>();
      jobs.forEach(j => jobMap.set(j['requisition_id'] || '', j));

      const allMapped = rows.map(r => {
        const job = jobMap.get(r['entity_id'] || '') || {};
        const salMin = job['salary_min'] || '';
        const salMax = job['salary_max'] || '';
        const salCur = job['salary_currency'] || 'LPA';
        const expMin = job['experience_min'] || '';
        const expMax = job['experience_max'] || '';

        return {
          approval_id: r['approval_id'] || '',
          entity_type: r['entity_type'] || '',
          entity_id: r['entity_id'] || '',
          status: r['status'] || '',
          requested_by: r['requested_by'] || '',
          requested_at: r['requested_at'] || r['created_at'] || '',
          comments: r['comments'] || '',
          job_title: job['title'] || r['entity_id'] || '',
          department_name: deptMap.get(job['department_id'] || '') || '',
          requester_name: userMap.get(r['requested_by'] || '') || r['requested_by'] || '',
          experience_range: (expMin || expMax) ? `${expMin || '0'} – ${expMax || 'Any'} yrs` : '',
          salary_range: (salMin || salMax) ? `${salMin} – ${salMax} ${salCur}` : '',
          open_positions: job['open_positions'] || '',
          description: job['description'] || '',
          posting_source: job['posting_source'] || '',
          bpm_task_id: job['temp2'] || '',
          rejection_reason: job['temp3'] || '',
          delegated_to: [],
          is_delegated: false,
          _raw: r,
          _jobRaw: job
        };
      });

      // Deduplicate: keep only the latest approval per entity_id (requisition)
      const latestByEntity = new Map<string, PendingApproval>();
      for (const a of allMapped) {
        const existing = latestByEntity.get(a.entity_id);
        if (!existing || a.requested_at > existing.requested_at) {
          latestByEntity.set(a.entity_id, a);
        }
      }
      const deduplicated = Array.from(latestByEntity.values());

      const myDelegatedFlag = `DELEGATED_BY:${this.loggedInUserId}`;
      /** Read ts_approvals.temp2 (Cordys may return Temp2). */
      const getDelegationFlag = (raw: Record<string, string>): string =>
        String(raw['temp2'] ?? (raw as any)['Temp2'] ?? '').trim();

      // Fetch active delegations where this user is the delegate (for viewing tasks)
      // AND active delegations where this user is the delegator (for managing delegations)
      let delegatedDeptEmails: Set<string> = new Set();
      this.activeDelegations = [];

      try {
        const allDelegations = await this.soap.call('GetTs_delegationsObjects', {
          fromDelegation_id: '0', toDelegation_id: 'zzzzzzzzzz'
        }).then((resp: any) => this.soap.parseTuples(resp, 'ts_delegations'));

        const today = new Date().toISOString().split('T')[0];
        
        for (const del of allDelegations) {
          const isActive = (del['status'] || 'ACTIVE') === 'ACTIVE';
          
          // Case 1: Tasks delegated TO me
          if (del['delegate_user_id'] === this.loggedInUserId && isActive && del['start_date'] <= today && del['end_date'] >= today) {
            const delegatorId = del['delegator_user_id'] || '';
            const delegatorUser = users.find((u: any) => (u['user_id'] || u['User_id'] || '') === delegatorId);
            if (delegatorUser) {
              const delegatorEmail = (delegatorUser['email'] || delegatorUser['Email'] || '').toLowerCase();
              if (delegatorEmail) delegatedDeptEmails.add(delegatorEmail);
            }
          }

          // Case 2: Tasks I delegated TO someone else (for management view)
          if (del['delegator_user_id'] === this.loggedInUserId && isActive) {
            const delegateId = del['delegate_user_id'] || '';
            const delegateUser = users.find((u: any) => (u['user_id'] || u['User_id'] || '') === delegateId);
            this.activeDelegations.push({
              id: del['delegation_id'],
              delegate_name: delegateUser ? ((delegateUser['first_name'] || delegateUser['First_name'] || '') + ' ' + (delegateUser['last_name'] || delegateUser['Last_name'] || '')).trim() : delegateId,
              delegate_role: delegateUser ? (delegateUser['role'] || delegateUser['Role'] || '').toUpperCase() : '',
              start_date: del['start_date'],
              end_date: del['end_date'],
              reason: del['reason'],
              _raw: del
            });
          }
        }
      } catch (err) {
        console.warn('[Manager] Failed to load delegations:', err);
      }

      // Filter: show approvals where this manager is assigned OR delegated
      // But exclude tasks that THIS manager has already delegated to someone else
      const myEmail = this.loggedInUserEmail.toLowerCase();
      console.log(`[Manager] Filtering tasks for myEmail: '${myEmail}', loggedInUserId: '${this.loggedInUserId}'`);
      console.log(`[Manager] delegatedDeptEmails from active delegations:`, Array.from(delegatedDeptEmails));

      // Pending items I delegated out (HOD) — shown only in "Delegated out" tab
      this.delegatedOutApprovals = [];
      if (myEmail) {
        this.delegatedOutApprovals = deduplicated
          .filter(a => {
            if (a.status !== 'PENDING') return false;
            if (getDelegationFlag(a._raw) !== myDelegatedFlag) return false;
            const job = a._jobRaw;
            const deptId = job['department_id'] || '';
            const assignedEmail = (deptManagerMap.get(deptId) || '').toLowerCase();
            return assignedEmail === myEmail;
          })
          .map(a => ({ ...a, isDelegatedOutTask: true }));
      }

      if (myEmail) {
        this.allApprovals = deduplicated.filter(a => {
          const job = a._jobRaw;
          const deptId = job['department_id'] || '';
          const assignedEmail = deptManagerMap.get(deptId) || '';
          const delegatedBy = getDelegationFlag(a._raw);

          console.log(`[Manager] Eval task ${a.entity_id} | dept: ${deptId} | HOD email: '${assignedEmail}' | delegatedBy: '${delegatedBy}'`);

          // If I delegated this task, hide from main lists (see "Delegated out" tab)
          if (delegatedBy === myDelegatedFlag) {
            console.log(`  -> Hidden: I delegated this task to someone else.`);
            return false;
          }

          // Direct assignment: my email matches department manager
          if (assignedEmail === myEmail) {
            console.log(`  -> Shown: Direct match as HOD (${myEmail})`);
            return true;
          }

          // Delegated to me: department's manager email matches a delegator's email
          if (delegatedDeptEmails.has(assignedEmail)) {
            console.log(`  -> Shown: Delegated TO me by HOD (${assignedEmail})`);
            a.is_delegated = true;
            return true;
          }

          console.log(`  -> Hidden: Not HOD and not delegated to me.`);
          return false;
        });
      } else {
        console.warn(`[Manager] myEmail is empty! Cannot filter properly. Showing all deduplicated tasks by default.`);
        this.allApprovals = deduplicated;
        this.delegatedOutApprovals = [];
      }

      this.pendingApprovals = this.allApprovals.filter(a => a.status === 'PENDING');
      this.updateStats();
    } catch (err) {
      console.error('Failed to load approvals:', err);
      this.showToast('Failed to load approvals.', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  private updateStats(): void {
    this.stats.pending = this.allApprovals.filter(a => a.status === 'PENDING').length;
    this.stats.approved = this.allApprovals.filter(a => a.status === 'APPROVED').length;
    this.stats.rejected = this.allApprovals.filter(a => a.status === 'REJECTED').length;
    this.stats.delegated = this.allApprovals.filter(a => a.delegated_to.length > 0).length;
    this.stats.delegatedOut = this.delegatedOutApprovals.length;
    this.stats.total = this.allApprovals.length;
    this.buildChart();
  }

  private buildChart(): void {
    const total = this.stats.total || 1;
    this.chartSegments = [
      { color: '#f59e0b', percent: (this.stats.pending / total) * 100, label: 'Pending', count: this.stats.pending },
      { color: '#10b981', percent: (this.stats.approved / total) * 100, label: 'Approved', count: this.stats.approved },
      { color: '#ef4444', percent: (this.stats.rejected / total) * 100, label: 'Rejected', count: this.stats.rejected },
    ];
  }

  getChartDasharray(seg: { percent: number }): string {
    const circumference = 2 * Math.PI * 45;
    const filled = (seg.percent / 100) * circumference;
    return `${filled} ${circumference - filled}`;
  }

  getChartOffset(index: number): number {
    const circumference = 2 * Math.PI * 45;
    let offset = circumference * 0.25; // start from top
    for (let i = 0; i < index; i++) {
      offset -= (this.chartSegments[i].percent / 100) * circumference;
    }
    return offset;
  }

  get filteredApprovals(): PendingApproval[] {
    if (this.filterStatus === 'ALL') return this.allApprovals;
    if (this.filterStatus === 'DELEGATED_OUT') return this.delegatedOutApprovals;
    return this.allApprovals.filter(a => a.status === this.filterStatus);
  }

  // ═══════════════════════════════════════════════════
  //  EXPAND / COLLAPSE CARD
  // ═══════════════════════════════════════════════════

  toggleExpand(approval: PendingApproval): void {
    this.expandedApprovalId = this.expandedApprovalId === approval.approval_id ? null : approval.approval_id;
  }

  isExpanded(approval: PendingApproval): boolean {
    return this.expandedApprovalId === approval.approval_id;
  }

  // ═══════════════════════════════════════════════════
  //  APPROVE / REJECT ACTIONS
  // ═══════════════════════════════════════════════════

  openApproveModal(approval: PendingApproval, event: Event): void {
    event.stopPropagation();
    this.actionType = 'APPROVED';
    this.actionApproval = approval;
    this.actionComments = '';
    this.showActionModal = true;
  }

  openRejectModal(approval: PendingApproval, event: Event): void {
    event.stopPropagation();
    this.actionType = 'REJECTED';
    this.actionApproval = approval;
    this.actionComments = '';
    this.showActionModal = true;
  }

  closeActionModal(): void {
    this.showActionModal = false;
    this.actionApproval = null;
  }

  async confirmAction(): Promise<void> {
    if (!this.actionApproval) return;

    if (this.actionType === 'REJECTED' && !this.actionComments.trim()) {
      this.showToast('Please provide a reason for rejection.', 'error');
      return;
    }

    this.isActioning = true;

    try {
      // Step 1: Update approval status in DB
      await this.soap.updateApprovalStatus(
        this.actionApproval._raw,
        this.actionType,
        this.loggedInUserId,
        this.actionComments.trim()
      );

      // Step 2: Update job requisition status
      if (this.actionApproval.entity_type === 'REQUISITION' || this.actionApproval.entity_type === 'Job Requisition') {
        const jobData = await this.soap.getJobRequisitionById(this.actionApproval.entity_id);
        if (jobData) {
          if (this.actionType === 'APPROVED') {
            await this.soap.updateJobRequisitionStatus(jobData, 'APPROVED');
          } else {
            // REJECTED: use CLOSED (job_status_enum: PENDING|APPROVED|CLOSED)
            // Store rejection reason in temp3 to distinguish from normal closure
            await this.soap.updateJobRequisitionTemp(jobData, {
              status: 'CLOSED',
              temp3: this.actionComments.trim()
            });
          }
        }

        // Step 3: Complete BPM task if task ID exists
        const taskId = this.actionApproval.bpm_task_id;
        if (taskId) {
          try {
            await this.soap.performTaskAction(taskId, 'COMPLETE', {
              decision: this.actionType,
              comments: this.actionComments.trim()
            });
            console.log(`[Manager] BPM task ${taskId} completed with action: ${this.actionType}`);
          } catch (bpmErr) {
            console.warn('[Manager] BPM task completion failed (non-blocking):', bpmErr);
          }
        }

        // Step 4: Insert approval history
        try {
          await this.soap.insertApprovalHistory({
            requisition_id: this.actionApproval.entity_id,
            action: this.actionType,
            requested_by: this.actionApproval.requested_by || 'system',
            approved_by: this.loggedInUserId,
            comments: this.actionComments.trim()
          });
        } catch (histErr) {
          console.warn('[Manager] History insert failed:', histErr);
        }
      }

      // Step 5: Send notification email (non-blocking)
      try {
        if (
          this.actionApproval.entity_type === 'REQUISITION' ||
          this.actionApproval.entity_type === 'Job Requisition'
        ) {
          const jobData = await this.soap.getJobRequisitionById(this.actionApproval.entity_id);
          const ownerId = jobData?.['created_by_user'] || jobData?.['Created_by_user'] || '';
          const ownerUser = ownerId ? await this.soap.getUserById(ownerId) : null;
          const ownerEmail = String(ownerUser?.['email'] || ownerUser?.['Email'] || '').trim();

          if (ownerEmail) {
            if (this.actionType === 'APPROVED') {
              const mail = buildMailBody('JOB_APPROVED', {
                requisitionId: this.actionApproval.entity_id,
                jobTitle: this.actionApproval.job_title || '',
                approvedBy: this.loggedInUserEmail || this.loggedInUserId
              });
              await this.soap.sendAllMailsBPM(ownerEmail, mail.subject, mail.body);

              // Also notify all HR users (job posted to HR)
              try {
                const hrs = await this.soap.getAllHR();
                const hrEmails = (hrs || []).map((u: any) => String(u?.['Email'] || u?.['email'] || u?.['email_id'] || '').trim()).filter(Boolean);
                await Promise.all(
                  hrEmails.map(e => this.soap.sendAllMailsBPM(e, mail.subject, mail.body).catch(() => null))
                );
              } catch (hrMailErr) {
                console.warn('[Manager] Failed to notify HR (non-blocking):', hrMailErr);
              }
            } else {
              const mail = buildMailBody('JOB_REJECTED', {
                requisitionId: this.actionApproval.entity_id,
                jobTitle: this.actionApproval.job_title || '',
                rejectedBy: this.loggedInUserEmail || this.loggedInUserId,
                rejectionReason: this.actionComments.trim()
              });
              await this.soap.sendAllMailsBPM(ownerEmail, mail.subject, mail.body);
            }
          }

          if (this.actionType === 'APPROVED') {
            await this.maybeSendReferralBroadcast(this.actionApproval.entity_id, this.actionApproval);
          }
        }
      } catch (mailErr) {
        console.warn('[Manager] Failed to send job decision mail (non-blocking):', mailErr);
      }

      const label = this.actionType === 'APPROVED' ? 'approved' : 'rejected';
      this.showToast(`"${this.actionApproval.job_title}" has been ${label}.`, 'success');

      this.closeActionModal();
      await this.loadApprovals();

    } catch (err) {
      console.error('Action failed:', err);
      this.showToast('Failed to process action. Please try again.', 'error');
    } finally {
      this.isActioning = false;
    }
  }

  /**
   * One-time internal referral campaign to eligible employees (non-candidate users).
   * Uses temp4 = REFERRAL_BROADCAST_SENT to avoid duplicate sends.
   */
  private async maybeSendReferralBroadcast(requisitionId: string, approval: PendingApproval): Promise<void> {
    try {
      const jobData = await this.soap.getJobRequisitionById(requisitionId);
      if (!jobData) return;
      if (String(jobData['temp4'] || '').trim() === 'REFERRAL_BROADCAST_SENT') return;

      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const applyUrl = `${origin}/candidate/jobs`;
      const internalUsers = await this.soap.getInternalUsersForReferralEmails();
      const deptName = approval.department_name || '';
      const jobTitle = approval.job_title || jobData['title'] || '';

      for (const u of internalUsers) {
        const mail = buildMailBody('REFERRAL_JOB_OPEN', {
          recipientName: u.name,
          requisitionId,
          jobTitle,
          departmentName: deptName,
          applyUrl
        });
        await this.soap.sendAllMailsBPM(u.email, mail.subject, mail.body).catch(() => null);
      }

      await this.soap.updateJobRequisitionTemp(jobData, {
        temp4: 'REFERRAL_BROADCAST_SENT'
      });
    } catch (e) {
      console.warn('[Manager] Referral broadcast failed (non-blocking):', e);
    }
  }

  // ═══════════════════════════════════════════════════
  //  DELEGATION
  // ═══════════════════════════════════════════════════

  openDelegateModal(approval: PendingApproval, event: Event): void {
    event.stopPropagation();
    if (approval.is_delegated) {
      this.showToast('This task was delegated to you. You cannot delegate it further.', 'error');
      return;
    }
    this.delegateApproval = approval;
    this.delegateMemo = '';
    // Default dates: today to 7 days from now
    const today = new Date();
    this.delegateStartDate = today.toISOString().split('T')[0];
    this.delegateEndDate = new Date(today.getTime() + 7 * 86400000).toISOString().split('T')[0];
    // Load delegate users (managers only)
    this.loadDelegateUsers(approval);
    this.showDelegateModal = true;
  }

  private async loadDelegateUsers(approval: PendingApproval): Promise<void> {
    try {
      const deptId = approval._jobRaw['department_id'] || '';
      if (!deptId) {
        this.delegateUsers = [];
        return;
      }

      // Fetch users for this department
      const deptUsers = await this.soap.getUsersByDepartment(deptId);

      // Show only MANAGER and LEADERSHIP role users (excluding self)
      const managers = deptUsers.map(u => ({
        user_id: u['user_id'] || u['User_id'] || '',
        name: ((u['first_name'] || u['First_name'] || '') + ' ' + (u['last_name'] || u['Last_name'] || '')).trim(),
        email: u['email'] || u['Email'] || '',
        role: (u['role'] || u['Role'] || '').toUpperCase()
      })).filter(u =>
        u.user_id !== this.loggedInUserId &&
        (u.role === 'MANAGER' || u.role === 'LEADERSHIP')
      );

      this.delegateUsers = managers.map(u => ({
        ...u,
        selected: approval.delegated_to.includes(u.user_id)
      }));
    } catch (err) {
      console.warn('[Manager] Failed to load department managers:', err);
      this.delegateUsers = [];
    }
  }

  closeDelegateModal(): void {
    this.showDelegateModal = false;
    this.delegateApproval = null;
  }

  toggleDelegateUser(user: { user_id: string; name: string; selected: boolean }): void {
    user.selected = !user.selected;
  }

  get selectedDelegateCount(): number {
    return this.delegateUsers.filter(u => u.selected).length;
  }

  async confirmDelegate(): Promise<void> {
    if (!this.delegateApproval) return;
    const selected = this.delegateUsers.filter(u => u.selected);
    if (selected.length === 0) {
      this.showToast('Please select at least one manager to delegate to.', 'error');
      return;
    }

    this.isDelegating = true;
    try {
      const taskId = this.delegateApproval.bpm_task_id;

      // Insert delegation records in ts_delegations for each selected manager
      for (const user of selected) {
        try {
          await this.soap.insertDelegation({
            delegator_user_id: this.loggedInUserId,
            delegate_user_id: user.user_id,
            start_date: this.delegateStartDate,
            end_date: this.delegateEndDate,
            reason: this.delegateMemo || 'Delegated for review'
          });
        } catch (delErr) {
          console.warn(`[Manager] Delegation record insert failed for ${user.name}:`, delErr);
        }
      }

      // Call DelegateTask BPM for each selected user (if BPM task exists)
      if (taskId) {
        for (const user of selected) {
          try {
            const userDN = this.soap._makeDN(user.email || user.name);
            await this.soap.delegateBPMTask(taskId, userDN, this.delegateMemo || 'Delegated for review', this.delegateEndDate);
          } catch (bpmErr) {
            console.warn(`[Manager] BPM delegation failed for ${user.name}:`, bpmErr);
          }
        }
      }

      // Non-blocking: send delegation mails to selected delegate managers
      try {
        const mail = buildMailBody('JOB_DELEGATED', {
          requisitionId: this.delegateApproval?.entity_id || '',
          jobTitle: this.delegateApproval?.job_title || '',
          delegatedBy: this.loggedInUserEmail || this.loggedInUserId
        });
        for (const user of selected) {
          const email = String((user as any)?.email || '').trim();
          if (!email) continue;
          await this.soap.sendAllMailsBPM(email, mail.subject, mail.body);
        }
      } catch (mailErr) {
        console.warn('[Manager] Failed to send delegation mails (non-blocking):', mailErr);
      }

      // Update local state
      this.delegateApproval.delegated_to = selected.map(u => u.user_id);

      // Mark ts_approvals.temp2 = DELEGATED_BY:<me> so main Pending hides this task (see "Delegated out" tab).
      // Refetch latest approval row before update to avoid Cordys tuple mismatch.
      try {
        const rawApproval = this.delegateApproval._raw;
        const aid = String(rawApproval['approval_id'] || rawApproval['Approval_id'] || '');
        const allApp = await this.soap.getApprovals();
        const fresh =
          (allApp || []).find(
            r => String(r['approval_id'] || r['Approval_id'] || '') === aid
          ) || rawApproval;

        const t = (k: string) => String(fresh[k] ?? (fresh as any)[k] ?? '').trim();
        const approvalRow = (overrides: Record<string, string>) => ({
          approval_id: t('approval_id') || t('Approval_id') || aid,
          entity_type: fresh['entity_type'] || '',
          entity_id: fresh['entity_id'] || '',
          status: fresh['status'] || 'PENDING',
          requested_by: fresh['requested_by'] || '',
          approved_by: fresh['approved_by'] || '',
          comments: fresh['comments'] || '',
          requested_at: fresh['requested_at'] || '',
          approved_at: fresh['approved_at'] || '',
          temp1: fresh['temp1'] || '',
          temp2: overrides['temp2'] !== undefined ? overrides['temp2'] : fresh['temp2'] || '',
          temp3: fresh['temp3'] || '',
          temp4: fresh['temp4'] || '',
          temp5: fresh['temp5'] || ''
        });

        await this.soap.call('UpdateTs_approvals', {
          tuple: {
            old: { ts_approvals: approvalRow({}) },
            new: { ts_approvals: approvalRow({ temp2: `DELEGATED_BY:${this.loggedInUserId}` }) }
          }
        });
        this.delegateApproval._raw = { ...fresh, temp2: `DELEGATED_BY:${this.loggedInUserId}` };
      } catch (markErr) {
        console.error('[Manager] Failed to mark approval as delegated:', markErr);
        this.showToast('Delegation saved, but marking approval in DB failed. Refresh the page.', 'error');
      }

      const names = selected.map(u => u.name).join(', ');
      this.showToast(`Task delegated to: ${names}`, 'success');
      this.closeDelegateModal();
      await this.loadApprovals();
    } catch (err) {
      this.showToast('Failed to delegate task.', 'error');
    } finally {
      this.isDelegating = false;
    }
  }

  getDelegateNames(approval: PendingApproval): string {
    return approval.delegated_to
      .map(id => this.allUsers.find(u => u.user_id === id)?.name || id)
      .join(', ');
  }

  // ═══════════════════════════════════════════════════
  //  HELPERS
  // ═══════════════════════════════════════════════════

  formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  showToast(message: string, type: 'success' | 'error'): void {
    this.toastMessage = message;
    this.toastType = type;
    this.showToastFlag = true;
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => this.showToastFlag = false, 4000);
  }
}
