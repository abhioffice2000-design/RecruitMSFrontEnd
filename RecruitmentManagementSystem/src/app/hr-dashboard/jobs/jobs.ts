import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SoapService } from '../../services/soap.service';
import { buildMailBody, MailEvent } from '../../services/mail-templates';

declare var $: any;

// ===== Interfaces =====
interface Department {
  department_id: string;
  department_name: string;
}

interface Skill {
  skill_id: string;
  skill_name: string;
}

interface JobRequisition {
  requisition_id: string;
  title: string;
  department_id: string;
  department_name?: string;
  description: string;
  experience_min: string;
  experience_max: string;
  salary_min: string;
  salary_max: string;
  salary_currency: string;
  open_positions: string;
  status: string;
  posting_source: string;
  created_by_user: string;
  created_at: string;
  approval_status?: string;
  temp1?: string;  // Manager email
  temp2?: string;  // BPM Task ID
  temp3?: string;  // Rejection reason (manager)
  temp4?: string;  // Referral sent flag or HR_CLOSE_* code
  temp5?: string;  // HR closure notes / misc
  _raw?: Record<string, string>;  // Raw data for updates
}

interface SelectedSkill {
  skill_id: string;
  skill_name: string;
  required_level: string;
}

// ===== Form model =====
interface JobForm {
  title: string;
  department_id: string;
  description: string;
  experience_min: string;
  experience_max: string;
  salary_min: string;
  salary_max: string;
  salary_currency: string;
  open_positions: string;
  posting_source: string;
}

@Component({
  selector: 'app-jobs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './jobs.html',
  styleUrls: ['../../hr-dashboard/hr-dashboard.scss', './jobs.scss'],
})
export class JobsTab implements OnInit {
  // ─── State ──────────────────────────────────────
  showForm = false;
  isLoading = false;
  isSubmitting = false;
  jobs: JobRequisition[] = [];
  departments: Department[] = [];
  allSkills: Skill[] = [];
  loggedInUserId = '';
  loggedInUserEmail = '';

  // ─── Form ───────────────────────────────────────
  form: JobForm = this.emptyForm();
  selectedSkills: SelectedSkill[] = [];
  skillToAdd = '';
  skillLevelToAdd = 'Intermediate';

  // ─── Edit / Resubmit ────────────────────────────
  isEditing = false;
  editingReqId = '';
  editingOldData: Record<string, string> = {};

  // ─── Validation ─────────────────────────────────
  errors: Record<string, string> = {};

  // ─── Search / Filter ────────────────────────────
  searchTerm = '';
  statusFilter = 'ALL';

  // ─── Toast ──────────────────────────────────────
  toastMessage = '';
  toastType: 'success' | 'error' = 'success';
  showToastFlag = false;
  private toastTimeout: any;

  // ─── Detail View ────────────────────────────────
  selectedJob: JobRequisition | null = null;
  selectedJobSkills: SelectedSkill[] = [];
  showDetailModal = false;

  /** HR formal closure (hiring complete / withdrawn) — approved requisitions only */
  showHrCloseModal = false;
  jobPendingClose: JobRequisition | null = null;
  hrCloseReasonCode: 'HIRING_COMPLETE' | 'WITHDRAWN' | 'OTHER' = 'HIRING_COMPLETE';
  hrCloseComment = '';
  isClosing = false;

  constructor(private soap: SoapService) {}

  ngOnInit(): void {
    this.loggedInUserId = sessionStorage.getItem('loggedInUserId') || '';
    this.loggedInUserEmail =
      sessionStorage.getItem('loggedInUserEmail') || sessionStorage.getItem('loggedInUser') || '';
    this.loadJobs();
    this.loadDepartments();
    this.loadSkills();
  }

  // ═══════════════════════════════════════════════════
  //  DATA LOADING
  // ═══════════════════════════════════════════════════

  async loadJobs(): Promise<void> {
    this.isLoading = true;
    try {
      const rows = await this.soap.getJobRequisitions();
      // Map department names
      const deptMap = new Map<string, string>();
      this.departments.forEach(d => deptMap.set(d.department_id, d.department_name));

      this.jobs = rows.map(r => {
        // CLOSED: manager rejection = temp3 without HR_CLOSE in temp4; HR closure = temp4 starts with HR_CLOSE
        let displayStatus = r['status'] || 'PENDING';
        if (displayStatus === 'CLOSED') {
          const t4 = (r['temp4'] || '').trim();
          if (t4.startsWith('HR_CLOSE')) {
            displayStatus = 'CLOSED';
          } else if (r['temp3']) {
            displayStatus = 'REJECTED';
          } else {
            displayStatus = 'CLOSED';
          }
        }
        return {
          requisition_id: r['requisition_id'] || '',
          title: r['title'] || '',
          department_id: r['department_id'] || '',
          department_name: deptMap.get(r['department_id'] || '') || r['department_id'] || '',
          description: r['description'] || '',
          experience_min: r['experience_min'] || '',
          experience_max: r['experience_max'] || '',
          salary_min: r['salary_min'] || '',
          salary_max: r['salary_max'] || '',
          salary_currency: r['salary_currency'] || 'INR',
          open_positions: r['open_positions'] || '1',
          status: displayStatus,
          posting_source: r['posting_source'] || '',
          created_by_user: r['created_by_user'] || '',
          created_at: r['created_at'] || '',
          temp1: r['temp1'] || '',
          temp2: r['temp2'] || '',
          temp3: r['temp3'] || '',
          temp4: r['temp4'] || '',
          temp5: r['temp5'] || '',
          _raw: r,
        };
      });

      // Re-map department names after departments load
      if (this.departments.length > 0) {
        this.jobs.forEach(j => {
          j.department_name = deptMap.get(j.department_id) || j.department_id;
        });
      }
    } catch (err) {
      console.error('Failed to load jobs:', err);
      this.showToast('Failed to load job requisitions.', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  async loadDepartments(): Promise<void> {
    try {
      const rows = await this.soap.getDepartments();
      this.departments = rows.map(r => ({
        department_id: r['department_id'] || '',
        department_name: r['department_name'] || ''
      }));
      // Re-map job department names now that departments are loaded
      const deptMap = new Map<string, string>();
      this.departments.forEach(d => deptMap.set(d.department_id, d.department_name));
      this.jobs.forEach(j => {
        j.department_name = deptMap.get(j.department_id) || j.department_id;
      });
    } catch (err) {
      console.error('Failed to load departments:', err);
    }
  }

  async loadSkills(): Promise<void> {
    try {
      const rows = await this.soap.getSkills();
      this.allSkills = rows.map(r => ({
        skill_id: r['skill_id'] || '',
        skill_name: r['skill_name'] || ''
      }));
    } catch (err) {
      console.error('Failed to load skills:', err);
    }
  }

  // ═══════════════════════════════════════════════════
  //  FORM LIFECYCLE
  // ═══════════════════════════════════════════════════

  openForm(): void {
    this.form = this.emptyForm();
    this.selectedSkills = [];
    this.errors = {};
    this.isEditing = false;
    this.editingReqId = '';
    this.editingOldData = {};
    this.showForm = true;
  }

  closeForm(): void {
    this.showForm = false;
    this.isEditing = false;
    this.editingReqId = '';
    this.editingOldData = {};
    this.errors = {};
  }

  /**
   * Edit a rejected job requisition — loads data into form in edit mode.
   */
  editJob(job: JobRequisition): void {
    this.form = {
      title: job.title,
      department_id: job.department_id,
      description: job.description,
      experience_min: job.experience_min,
      experience_max: job.experience_max,
      salary_min: job.salary_min,
      salary_max: job.salary_max,
      salary_currency: job.salary_currency,
      open_positions: job.open_positions,
      posting_source: job.posting_source,
    };
    this.isEditing = true;
    this.editingReqId = job.requisition_id;
    this.editingOldData = job._raw || {};
    this.selectedSkills = [];
    this.errors = {};
    this.showForm = true;

    // Load existing skills for this job
    this.soap.getJobSkillsByRequisition(job.requisition_id).then(skills => {
      this.selectedSkills = skills.map(s => ({
        skill_id: s['skill_id'] || '',
        skill_name: this.allSkills.find(sk => sk.skill_id === s['skill_id'])?.skill_name || s['skill_id'],
        required_level: s['required_level'] || 'Intermediate'
      }));
    }).catch(e => console.warn('[Jobs] Failed to load skills for edit:', e));
  }

  emptyForm(): JobForm {
    return {
      title: '',
      department_id: '',
      description: '',
      experience_min: '',
      experience_max: '',
      salary_min: '',
      salary_max: '',
      salary_currency: 'INR',
      open_positions: '1',
      posting_source: 'Career Portal',
    };
  }

  // ═══════════════════════════════════════════════════
  //  SKILL MANAGEMENT
  // ═══════════════════════════════════════════════════

  get availableSkills(): Skill[] {
    const usedIds = new Set(this.selectedSkills.map(s => s.skill_id));
    return this.allSkills.filter(s => !usedIds.has(s.skill_id));
  }

  addSkill(): void {
    if (!this.skillToAdd) return;
    const skill = this.allSkills.find(s => s.skill_id === this.skillToAdd);
    if (skill) {
      this.selectedSkills.push({
        skill_id: skill.skill_id,
        skill_name: skill.skill_name,
        required_level: this.skillLevelToAdd
      });
      this.skillToAdd = '';
      this.skillLevelToAdd = 'Intermediate';
    }
  }

  removeSkill(index: number): void {
    this.selectedSkills.splice(index, 1);
  }

  // ═══════════════════════════════════════════════════
  //  VALIDATION
  // ═══════════════════════════════════════════════════

  validate(): boolean {
    this.errors = {};

    if (!this.form.title.trim()) {
      this.errors['title'] = 'Job title is required';
    } else if (this.form.title.trim().length < 3) {
      this.errors['title'] = 'Title must be at least 3 characters';
    }

    if (!this.form.department_id) {
      this.errors['department_id'] = 'Please select a department';
    }

    if (!this.form.description.trim()) {
      this.errors['description'] = 'Job description is required';
    } else if (this.form.description.trim().length < 20) {
      this.errors['description'] = 'Description must be at least 20 characters';
    }

    if (this.form.experience_min && this.form.experience_max) {
      if (Number(this.form.experience_min) > Number(this.form.experience_max)) {
        this.errors['experience'] = 'Min experience cannot be greater than max';
      }
    }

    if (this.form.salary_min && this.form.salary_max) {
      if (Number(this.form.salary_min) > Number(this.form.salary_max)) {
        this.errors['salary'] = 'Min salary cannot be greater than max salary';
      }
    }

    if (!this.form.open_positions || Number(this.form.open_positions) < 1) {
      this.errors['open_positions'] = 'At least 1 open position required';
    }

    return Object.keys(this.errors).length === 0;
  }

  // ═══════════════════════════════════════════════════
  //  SUBMIT — Create Requisition + Skills + Approval
  // ═══════════════════════════════════════════════════

  async submitJob(): Promise<void> {
    if (!this.validate()) {
      this.showToast('Please fix the validation errors.', 'error');
      return;
    }

    this.isSubmitting = true;

    try {
      // ─── EDIT / RESUBMIT MODE ───
      if (this.isEditing && this.editingReqId) {
        await this.resubmitJob();
        return;
      }

      // ─── CREATE NEW MODE ───
      // Step 1: Insert Job Requisition
      const reqResponse = await this.soap.insertJobRequisition({
        title: this.form.title.trim(),
        department_id: this.form.department_id,
        description: this.form.description.trim(),
        experience_min: this.form.experience_min || '0',
        experience_max: this.form.experience_max || '0',
        salary_min: this.form.salary_min || '0',
        salary_max: this.form.salary_max || '0',
        salary_currency: this.form.salary_currency,
        open_positions: this.form.open_positions,
        posting_source: this.form.posting_source,
        created_by_user: this.loggedInUserId,
      });

      // Extract the generated requisition_id — multiple strategies
      let reqId = '';

      // Strategy 0: Use the ID we generated in insertJobRequisition
      if (reqResponse?._generatedReqId) {
        reqId = reqResponse._generatedReqId;
      }

      // Strategy 1: $.cordys.json.find
      if (!reqId) try {
        const nodes = $.cordys.json.find(reqResponse, 'requisition_id');
        if (nodes) {
          const node = Array.isArray(nodes) ? nodes[0] : nodes;
          reqId = typeof node === 'string' ? node : (node?.text || node?.toString() || '');
        }
      } catch (e) {
        console.warn('[Jobs] Strategy 1 (cordys.json.find) failed:', e);
      }

      // Strategy 2: Direct property traversal on response object
      if (!reqId && reqResponse) {
        try {
          const tuple = reqResponse?.tuple || reqResponse?.Body?.UpdateTs_job_requisitionsResponse?.tuple;
          const jobObj = tuple?.['new']?.ts_job_requisitions || tuple?.old?.ts_job_requisitions || {};
          reqId = jobObj?.requisition_id || '';
          if (!reqId) {
            const respStr = JSON.stringify(reqResponse);
            const match = respStr.match(/"requisition_id"\s*:\s*"([^"]+)"/);
            if (match) reqId = match[1];
          }
        } catch (e) {
          console.warn('[Jobs] Strategy 2 (traversal) failed:', e);
        }
      }

      // Strategy 3: Fallback — query latest requisitions
      if (!reqId) {
        try {
          const allReqs = await this.soap.getJobRequisitions();
          const match = allReqs.find(r =>
            r['title'] === this.form.title.trim() &&
            r['department_id'] === this.form.department_id &&
            r['created_by_user'] === this.loggedInUserId
          );
          if (match) reqId = match['requisition_id'] || '';
        } catch (e) {
          console.warn('[Jobs] Strategy 3 (DB lookup) failed:', e);
        }
      }

      // Step 2: Insert Job Skills
      if (reqId) {
        for (const skill of this.selectedSkills) {
          try {
            await this.soap.insertJobSkill(reqId, skill.skill_id, skill.required_level);
          } catch (e) {
            console.warn(`[Jobs] Failed to insert skill ${skill.skill_name}:`, e);
          }
        }

        // Step 3: Auto-create Approval record
        try {
          await this.soap.insertApproval({
            entity_type: 'REQUISITION',
            entity_id: reqId,
            requested_by: this.loggedInUserId,
            comments: `New requisition: ${this.form.title.trim()}`
          });
        } catch (e) {
          console.warn('[Jobs] Failed to create approval:', e);
        }

        // Step 4: Trigger BPM and store manager email + task ID
        await this.triggerBPMForRequisition(reqId);

        this.showToast(`Requisition ${reqId} created and sent for BPM approval!`, 'success');
      } else {
        console.warn('[Jobs] Requisition created but ID could not be extracted.');
        this.showToast('Job requisition created successfully!', 'success');
      }

      this.closeForm();
      await this.loadJobs();

    } catch (err) {
      console.error('Failed to create requisition:', err);
      this.showToast('Failed to create job requisition. Please try again.', 'error');
    } finally {
      this.isSubmitting = false;
    }
  }

  /**
   * Trigger BPM for a requisition: send to manager email from mt_departments.temp1.
   */
  private async triggerBPMForRequisition(reqId: string): Promise<void> {
    try {
      // 1) First fetch the department id from the form
      const deptId = this.form.department_id;
      if (!deptId) {
        console.warn('[Jobs] No department ID available to fetch manager email.');
        return;
      }

      // 2) Look up the department directly to get the manager email from temp1
      let managerEmail = '';
      try {
        const dept = await this.soap.getDepartmentById(deptId);
        if (dept && dept['temp1']) {
          managerEmail = dept['temp1'];
        }
      } catch (e) {
        console.warn('[Jobs] Failed to fetch department for manager email:', e);
      }

      if (!managerEmail) {
        console.warn('[Jobs] No manager email found in department temp1. BPM trigger skipped.');
        return;
      }

      // Trigger BPM
      const bpmResp = await this.soap.triggerRequisitionBPM(managerEmail, reqId);
      console.log('[Jobs] BPM triggered, response:', JSON.stringify(bpmResp).substring(0, 300));

      // Extract task ID from BPM response
      let taskId = '';
      try {
        const tid = $.cordys.json.find(bpmResp, 'TaskId');
        taskId = typeof tid === 'string' ? tid : (Array.isArray(tid) ? tid[0] : '');
      } catch (e) { /* ignore */ }
      if (!taskId) {
        try {
          const respStr = JSON.stringify(bpmResp);
          const m = respStr.match(/"TaskId"\s*:\s*"([^"]+)"/i);
          if (m) taskId = m[1];
        } catch (e) { /* ignore */ }
      }

      const freshData = await this.soap.getJobRequisitionById(reqId);
      if (freshData) {
        // temp1 = manager approver email (for HR stepper); temp2 = BPM task id when returned
        const tempUpdates: { temp1: string; temp2?: string } = { temp1: managerEmail };
        if (taskId) tempUpdates.temp2 = taskId;
        await this.soap.updateJobRequisitionTemp(freshData, tempUpdates);
        if (taskId) console.log(`[Jobs] BPM Task ID stored: ${taskId}`);

        // Mail to manager for approval
        try {
          const mail = buildMailBody('JOB_CREATED_FOR_APPROVAL', {
            requisitionId: reqId,
            jobTitle: freshData['title'] || '',
            departmentName: freshData['department_name'] || '',
            requestedBy: freshData['created_by_user'] || this.loggedInUserEmail || ''
          });
          await this.soap.sendAllMailsBPM(managerEmail, mail.subject, mail.body);
        } catch (mailErr) {
          console.warn('[Jobs] Failed to send job approval mail (non-blocking):', mailErr);
        }
      }

    } catch (err) {
      console.error('[Jobs] BPM trigger failed (non-blocking):', err);
      // BPM failure is non-blocking — requisition was already created
    }
  }

  /**
   * Resubmit a rejected job requisition — update the job, re-trigger BPM.
   */
  private async resubmitJob(): Promise<void> {
    try {
      const oldData = this.editingOldData;
      const newData: Record<string, string> = {
        ...oldData,
        title: this.form.title.trim(),
        department_id: this.form.department_id,
        description: this.form.description.trim(),
        experience_min: this.form.experience_min || '0',
        experience_max: this.form.experience_max || '0',
        salary_min: this.form.salary_min || '0',
        salary_max: this.form.salary_max || '0',
        salary_currency: this.form.salary_currency,
        open_positions: this.form.open_positions,
        posting_source: this.form.posting_source,
        status: 'PENDING',
        temp3: '',  // Clear rejection reason
      };

      // Update the job requisition
      await this.soap.updateJobRequisition(oldData, newData);

      // Re-create approval record
      try {
        await this.soap.insertApproval({
          entity_type: 'REQUISITION',
          entity_id: this.editingReqId,
          requested_by: this.loggedInUserId,
          comments: `Resubmitted: ${this.form.title.trim()}`
        });
      } catch (e) {
        console.warn('[Jobs] Failed to create re-approval:', e);
      }

      // Re-trigger BPM
      await this.triggerBPMForRequisition(this.editingReqId);

      this.showToast(`Requisition ${this.editingReqId} resubmitted for approval!`, 'success');
      this.closeForm();
      await this.loadJobs();

    } catch (err) {
      console.error('Failed to resubmit:', err);
      this.showToast('Failed to resubmit requisition.', 'error');
    } finally {
      this.isSubmitting = false;
    }
  }

  // ═══════════════════════════════════════════════════
  //  VIEW DETAILS
  // ═══════════════════════════════════════════════════

  async viewDetails(job: JobRequisition): Promise<void> {
    this.selectedJob = job;
    this.selectedJobSkills = [];
    this.showDetailModal = true;

    try {
      const skills = await this.soap.getJobSkillsByRequisition(job.requisition_id);
      this.selectedJobSkills = skills.map(s => ({
        skill_id: s['skill_id'] || '',
        skill_name: this.allSkills.find(sk => sk.skill_id === s['skill_id'])?.skill_name || s['skill_id'],
        required_level: s['required_level'] || ''
      }));
    } catch (err) {
      console.error('Failed to load job skills:', err);
    }
  }

  closeDetailModal(): void {
    this.showDetailModal = false;
    this.selectedJob = null;
  }

  openHrCloseModal(job: JobRequisition): void {
    if ((job.status || '').toUpperCase() !== 'APPROVED') return;
    this.jobPendingClose = job;
    this.hrCloseReasonCode = 'HIRING_COMPLETE';
    this.hrCloseComment = '';
    this.showHrCloseModal = true;
  }

  cancelHrCloseModal(): void {
    this.showHrCloseModal = false;
    this.jobPendingClose = null;
    this.isClosing = false;
  }

  getHrCloseReasonLabel(code: string): string {
    switch (code) {
      case 'HIRING_COMPLETE':
        return 'Hiring complete — position filled';
      case 'WITHDRAWN':
        return 'Requirement withdrawn';
      case 'OTHER':
        return 'Other';
      default:
        return code;
    }
  }

  hrClosureDetail(job: JobRequisition): { code: string; notes: string } | null {
    const t4 = (job.temp4 || '').trim();
    if (!t4.startsWith('HR_CLOSE')) return null;
    const code = t4.replace(/^HR_CLOSE_/, '');
    return { code, notes: (job.temp5 || '').trim() };
  }

  async confirmHrCloseRequisition(): Promise<void> {
    if (!this.jobPendingClose?._raw) return;
    if (this.hrCloseReasonCode === 'OTHER' && !this.hrCloseComment.trim()) {
      this.showToast('Please add a short comment for “Other”.', 'error');
      return;
    }

    this.isClosing = true;
    const job = this.jobPendingClose;
    const raw = job._raw!;

    try {
      const code = `HR_CLOSE_${this.hrCloseReasonCode}`;
      await this.soap.updateJobRequisitionTemp(raw, {
        status: 'CLOSED',
        temp4: code,
        temp5: this.hrCloseComment.trim() || '-'
      });

      const reasonLabel = this.getHrCloseReasonLabel(this.hrCloseReasonCode);
      const mail = buildMailBody('JOB_REQUISITION_CLOSED', {
        requisitionId: job.requisition_id,
        jobTitle: job.title,
        departmentName: job.department_name || '',
        closureReason: reasonLabel,
        closureComment: this.hrCloseComment.trim() || '-',
        closedBy: this.loggedInUserEmail || this.loggedInUserId
      });

      const ownerId = raw['created_by_user'] || '';
      const ownerUser = ownerId ? await this.soap.getUserById(ownerId) : null;
      const ownerEmail = String(ownerUser?.['email'] || ownerUser?.['Email'] || '').trim();
      if (ownerEmail) {
        await this.soap.sendAllMailsBPM(ownerEmail, mail.subject, mail.body);
      }

      const hrs = await this.soap.getAllHR();
      const sent = new Set<string>();
      if (ownerEmail) sent.add(ownerEmail.toLowerCase());
      for (const hr of hrs || []) {
        const e = String(hr['email'] || hr['Email'] || '').trim();
        if (!e || sent.has(e.toLowerCase())) continue;
        sent.add(e.toLowerCase());
        await this.soap.sendAllMailsBPM(e, mail.subject, mail.body).catch(() => null);
      }

      this.showToast('Requisition closed. Stakeholders were notified.', 'success');
      this.cancelHrCloseModal();
      this.showDetailModal = false;
      this.selectedJob = null;
      await this.loadJobs();
    } catch (err) {
      console.error('HR close requisition failed:', err);
      this.showToast('Failed to close requisition. Try again.', 'error');
    } finally {
      this.isClosing = false;
    }
  }

  // ═══════════════════════════════════════════════════
  //  FILTERING
  // ═══════════════════════════════════════════════════

  get filteredJobs(): JobRequisition[] {
    const term = (this.searchTerm || '').toString().trim().toLowerCase();

    return this.jobs.filter(j => {
      const title = (j.title || '').toString().toLowerCase();
      const reqId = (j.requisition_id || '').toString().toLowerCase();
      const dept = (j.department_name || '').toString().toLowerCase();
      const jobStatus = (j.status || '').toString().toUpperCase();

      const matchesSearch =
        !term ||
        title.includes(term) ||
        reqId.includes(term) ||
        dept.includes(term);

      const matchesStatus =
        this.statusFilter === 'ALL' ||
        jobStatus === (this.statusFilter || '').toString().toUpperCase();

      return matchesSearch && matchesStatus;
    });
  }

  // ═══════════════════════════════════════════════════
  //  HELPERS
  // ═══════════════════════════════════════════════════

  getStatusClass(status: string): string {
    switch (status) {
      case 'APPROVED': return 'badge-success';
      case 'PENDING': return 'badge-warning';
      case 'CLOSED': return 'badge-danger';
      case 'REJECTED': return 'badge-rejected';
      default: return 'badge-muted';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'APPROVED': return 'Approved';
      case 'PENDING': return 'Pending Approval';
      case 'CLOSED': return 'Closed';
      case 'REJECTED': return 'Rejected';
      default: return status;
    }
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  /**
   * Steps for the requisition detail modal: HR submit → manager (temp1/temp2) → outcome → published.
   */
  getRequisitionApprovalSteps(job: JobRequisition): {
    title: string;
    subtitle: string;
    meta: string;
    state: 'done' | 'current' | 'pending' | 'error';
  }[] {
    const st = (job.status || '').toUpperCase();
    const t4 = (job.temp4 || '').trim();
    let displaySt = st;
    if (st === 'CLOSED') {
      if (t4.startsWith('HR_CLOSE')) displaySt = 'CLOSED';
      else if (job.temp3) displaySt = 'REJECTED';
    }
    const mgr = (job.temp1 || '').trim();
    const task = (job.temp2 || '').trim();

    const step1 = {
      title: 'Requisition created',
      subtitle: 'HR submitted this role for leadership approval.',
      meta: `Owner user: ${job.created_by_user || '—'} · ${this.formatDate(job.created_at)}`,
      state: 'done' as const,
    };

    let step2State: 'done' | 'current' | 'pending' | 'error' = 'pending';
    let step2Sub = 'Waiting for BPM to route the task.';
    if (displaySt === 'PENDING') {
      step2State = 'current';
      step2Sub = mgr
        ? `Sent for approval — approver mailbox: ${mgr}`
        : 'Pending — manager email will appear after routing.';
    } else if (displaySt === 'APPROVED') {
      step2State = 'done';
      step2Sub = mgr ? `Manager approved (${mgr}).` : 'Manager approved.';
    } else if (displaySt === 'REJECTED') {
      step2State = 'error';
      step2Sub = job.temp3 ? `Rejected — ${job.temp3}` : 'Rejected by manager.';
    } else {
      step2State = 'done';
      step2Sub = `Status: ${displaySt}`;
    }

    const step2 = {
      title: 'Manager review',
      subtitle: step2Sub,
      meta: task ? `BPM task id: ${task}` : (mgr ? 'Task id not stored yet.' : ''),
      state: step2State,
    };

    const step3Done = displaySt === 'APPROVED';
    const step3 = {
      title: 'Open for applications',
      subtitle: step3Done
        ? 'Approved — candidates can apply to this job.'
        : displaySt === 'REJECTED'
          ? 'Not published — requisition was rejected.'
        : 'Available only after manager approval.',
      meta: '',
      state: (step3Done ? 'done' : displaySt === 'REJECTED' ? 'error' : 'pending') as
        'done' | 'current' | 'pending' | 'error',
    };

    return [step1, step2, step3];
  }

  getDeptName(deptId: string): string {
    const dept = this.departments.find(d => d.department_id === deptId);
    return dept ? dept.department_name : deptId;
  }

  // ─── Toast ──────────────────────────────────────
  showToast(message: string, type: 'success' | 'error'): void {
    this.toastMessage = message;
    this.toastType = type;
    this.showToastFlag = true;
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => this.showToastFlag = false, 4000);
  }
}
