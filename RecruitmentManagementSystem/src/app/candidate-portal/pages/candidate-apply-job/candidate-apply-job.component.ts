import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SoapService } from '../../../services/soap.service';
import { AiResumeService } from '../../../services/ai-resume.service';
import { buildMailBody } from '../../../services/mail-templates';
import { fileToResumeDataUrl } from '../../../shared/resume-storage.util';
import type { MailEvent } from '../../../services/mail-templates';

declare var $: any;

// ─── Interfaces for dynamic form arrays ────────────────────
interface EducationEntry {
  degree: string;
  field_of_study: string;
  institution: string;
  start_year: string;
  end_year: string;
  grade: string;
}

interface ExperienceEntry {
  company: string;
  role: string;
  start_date: string;
  end_date: string;
  description: string;
  is_current: boolean;
}

interface InternshipEntry {
  company: string;
  role: string;
  duration: string;
  description: string;
}

interface ProjectEntry {
  title: string;
  description: string;
  technologies: string;
  url: string;
}

interface CertificationEntry {
  name: string;
  issuing_org: string;
  year: string;
}

@Component({
  selector: 'app-candidate-apply-job',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './candidate-apply-job.component.html',
  styleUrls: ['./candidate-apply-job.component.scss']
})
export class CandidateApplyJobComponent implements OnInit {
  requisitionId = '';
  jobTitle = '';
  jobDepartment = '';
  jobDescription = '';
  jobSkills: { skill_id: string; skill_name: string; required_level: string }[] = [];
  isLoading = true;
  isSubmitting = false;
  submitted = false;
  alreadyApplied = false;
  existingApplicationId = '';

  // ─── Form Fields (Scalar) ──────────────────────────────────
  form = {
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    linkedin_url: '',
    experience_years: '',
    location: '',
    cover_letter: '',
    summary: '',
    current_salary: '',
    expected_salary: '',
    notice_period: '',
    highest_qualification: '',
    portfolio_url: '',
    github_url: '',
    willing_to_relocate: false,
    available_joining_date: '',
    source: 'Career Portal'
  };

  // ─── Dynamic Arrays ────────────────────────────────────────
  educations: EducationEntry[] = [];
  experiences: ExperienceEntry[] = [];
  internships: InternshipEntry[] = [];
  projects: ProjectEntry[] = [];
  certifications: CertificationEntry[] = [];

  // ─── Skills Selection ─────────────────────────────────────
  allSkills: { skill_id: string; skill_name: string }[] = [];
  selectedSkills: { skill_id: string; skill_name: string; experience_years: string }[] = [];
  skillToAdd = '';
  skillExpToAdd = '1';

  // ─── Resume / AI Parsing ──────────────────────────────────
  resumeFile: File | null = null;
  resumeFileName = '';
  isDragOver = false;
  isParsing = false;
  parseSuccess = false;
  parseError = '';
  // null = not parsed/unknown, true = parsed looks like a resume, false = parsed looks like NOT a resume
  resumeDetectedAsResume: boolean | null = null;

  // ─── Pipeline Stages ──────────────────────────────────────
  firstStageId = '';

  // ─── Errors ───────────────────────────────────────────────
  errors: Record<string, string> = {};

  // ─── Collapsible Sections ─────────────────────────────────
  collapsedSections: Record<string, boolean> = {};

  // ─── Toast ────────────────────────────────────────────────
  toastMessage = '';
  toastType: 'success' | 'error' = 'success';
  showToastFlag = false;
  private toastTimeout: any;

  get requiredSkillsText(): string {
    return this.jobSkills.map(s => s.skill_name).join(', ');
  }

  constructor(
    private soap: SoapService,
    private aiResume: AiResumeService,
    private route: ActivatedRoute,
    public router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.requisitionId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.requisitionId) {
      this.router.navigate(['/candidate/jobs']);
      return;
    }
    // Start with one blank education & experience entry
    this.addEducation();
    this.addExperience();
    this.loadData();
  }

  // ═══════════════════════════════════════════════════════════
  //  DATA LOADING
  // ═══════════════════════════════════════════════════════════

  async loadData(): Promise<void> {
    this.isLoading = true;
    try {
      const [job, depts, skills, jobSkillsRaw, stages] = await Promise.all([
        this.soap.getJobRequisitionById(this.requisitionId),
        this.soap.getDepartments(),
        this.soap.getSkills(),
        this.soap.getJobSkillsByRequisition(this.requisitionId),
        this.soap.getPipelineStages()
      ]);

      if (!job) {
        this.showToast('Job not found.', 'error');
        this.router.navigate(['/candidate/jobs']);
        return;
      }

      this.jobTitle = job['title'] || '';
      this.jobDescription = job['description'] || '';

      const dept = depts.find(d => d['department_id'] === job['department_id']);
      this.jobDepartment = dept ? (dept['department_name'] || '') : (job['department_id'] || '');

      this.allSkills = skills.map(s => ({
        skill_id: s['skill_id'] || '',
        skill_name: s['skill_name'] || ''
      }));

      const skillMap = new Map(this.allSkills.map(s => [s.skill_id, s.skill_name]));
      this.jobSkills = jobSkillsRaw.map(js => ({
        skill_id: js['skill_id'] || '',
        skill_name: skillMap.get(js['skill_id'] || '') || js['skill_id'] || '',
        required_level: js['required_level'] || ''
      }));

      // Sort stages by order and pick the first
      if (stages.length > 0) {
        const sorted = [...stages].sort((a, b) =>
          parseInt(a['stage_order'] || '0') - parseInt(b['stage_order'] || '0')
        );
        this.firstStageId = sorted[0]['stage_id'] || '';
      }

      // Pre-fill email from session (logged-in candidate)
      const email = sessionStorage.getItem('loggedInUserEmail') || '';
      if (email) this.form.email = email;

      // ── Duplicate check: has this candidate already applied? ──
      const candidateId = sessionStorage.getItem('loggedInCandidateId') || '';
      if (candidateId) {
        try {
          const existingApps = await this.soap.getApplicationsByCandidate(candidateId);
          const dup = existingApps.find(a => a['requisition_id'] === this.requisitionId);
          if (dup) {
            this.alreadyApplied = true;
            this.existingApplicationId = dup['application_id'] || '';
          }
        } catch (e) {
          console.warn('[ApplyJob] Could not check for existing applications:', e);
        }
      }

    } catch (err) {
      console.error('[ApplyJob] loadData failed:', err);
      this.showToast('Failed to load job details. Please try again.', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  DYNAMIC ARRAY HELPERS — Education
  // ═══════════════════════════════════════════════════════════

  addEducation(): void {
    this.educations.push({
      degree: '', field_of_study: '', institution: '',
      start_year: '', end_year: '', grade: ''
    });
  }

  removeEducation(i: number): void {
    if (this.educations.length > 1) this.educations.splice(i, 1);
  }

  // ═══════════════════════════════════════════════════════════
  //  DYNAMIC ARRAY HELPERS — Experience
  // ═══════════════════════════════════════════════════════════

  addExperience(): void {
    this.experiences.push({
      company: '', role: '', start_date: '', end_date: '',
      description: '', is_current: false
    });
  }

  removeExperience(i: number): void {
    if (this.experiences.length > 1) this.experiences.splice(i, 1);
  }

  // ═══════════════════════════════════════════════════════════
  //  DYNAMIC ARRAY HELPERS — Internships
  // ═══════════════════════════════════════════════════════════

  addInternship(): void {
    this.internships.push({
      company: '', role: '', duration: '', description: ''
    });
  }

  removeInternship(i: number): void {
    this.internships.splice(i, 1);
  }

  // ═══════════════════════════════════════════════════════════
  //  DYNAMIC ARRAY HELPERS — Projects
  // ═══════════════════════════════════════════════════════════

  addProject(): void {
    this.projects.push({
      title: '', description: '', technologies: '', url: ''
    });
  }

  removeProject(i: number): void {
    this.projects.splice(i, 1);
  }

  // ═══════════════════════════════════════════════════════════
  //  DYNAMIC ARRAY HELPERS — Certifications
  // ═══════════════════════════════════════════════════════════

  addCertification(): void {
    this.certifications.push({
      name: '', issuing_org: '', year: ''
    });
  }

  removeCertification(i: number): void {
    this.certifications.splice(i, 1);
  }

  // ═══════════════════════════════════════════════════════════
  //  SECTION TOGGLE
  // ═══════════════════════════════════════════════════════════

  toggleSection(section: string): void {
    this.collapsedSections[section] = !this.collapsedSections[section];
  }

  isSectionCollapsed(section: string): boolean {
    return !!this.collapsedSections[section];
  }

  // ═══════════════════════════════════════════════════════════
  //  RESUME DRAG & DROP + AI PARSING
  // ═══════════════════════════════════════════════════════════

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
    if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      this.handleFile(event.dataTransfer.files[0]);
    }
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input && input.files && input.files.length > 0) {
      this.handleFile(input.files[0]);
    }
  }

  handleFile(file: File): void {
    const allowedExts = ['.pdf', '.doc', '.docx'];
    const lowerName = (file.name || '').toLowerCase();
    const allowedByExt = allowedExts.some(ext => lowerName.endsWith(ext));

    // Some browsers may report empty/incorrect MIME type; extension is the fallback.
    if (!allowedByExt && file.type) {
      this.showToast('Please upload a PDF or DOC/DOCX file.', 'error');
      return;
    }

    if (!allowedByExt) {
      this.showToast('Please upload a PDF or DOC/DOCX file.', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.showToast('File size must be under 5MB.', 'error');
      return;
    }
    this.resumeFile = file;
    this.resumeFileName = file.name;
    this.parseError = '';
    this.parseSuccess = false;
    this.resumeDetectedAsResume = null;

    // Automatically start AI parsing
    this.parseResumeWithAI();
  }

  async parseResumeWithAI(): Promise<void> {
    if (!this.resumeFile) return;
    this.isParsing = true;
    this.parseError = '';
    this.parseSuccess = false;

    try {
      // Reset resume-derived fields before re-parsing
      this.resetResumeDerivedFields();

      const parsed = await this.aiResume.parseResume(this.resumeFile);

      const looksLikeResume = this.isLikelyResume(parsed);
      if (!looksLikeResume) {
        this.parseSuccess = false;
        this.resumeDetectedAsResume = false;
        this.parseError =
          'Uploaded document does not look like a resume/CV. Please upload a resume (PDF/DOC/DOCX).';
        this.showToast(this.parseError, 'error');
        this.cdr.detectChanges();
        return;
      }
      this.resumeDetectedAsResume = true;

      // Auto-fill scalar form fields
      if (parsed.first_name)        this.form.first_name        = parsed.first_name;
      if (parsed.last_name)         this.form.last_name         = parsed.last_name;
      if (!this.form.email && parsed.email)  this.form.email    = parsed.email;
      if (parsed.phone)             this.form.phone             = parsed.phone;
      if (parsed.location)          this.form.location          = parsed.location;
      if (parsed.linkedin_url)      this.form.linkedin_url      = parsed.linkedin_url;
      if (parsed.experience_years)  this.form.experience_years  = parsed.experience_years;
      if (parsed.summary)           this.form.summary           = parsed.summary;
      if (parsed.current_salary)    this.form.current_salary    = parsed.current_salary;
      if (parsed.expected_salary)   this.form.expected_salary   = parsed.expected_salary;
      if (parsed.notice_period)     this.form.notice_period     = parsed.notice_period;
      if (parsed.highest_qualification) this.form.highest_qualification = parsed.highest_qualification;
      if (parsed.portfolio_url)     this.form.portfolio_url     = parsed.portfolio_url;
      if (parsed.github_url)        this.form.github_url        = parsed.github_url;

      // Auto-fill Education
      if (parsed.education?.length > 0) {
        this.educations = parsed.education.map(e => ({
          degree: e.degree || '',
          field_of_study: e.field_of_study || '',
          institution: e.institution || '',
          start_year: e.start_year || '',
          end_year: e.end_year || '',
          grade: e.grade || ''
        }));
      }

      // Auto-fill Experience
      if (parsed.experience?.length > 0) {
        this.experiences = parsed.experience.map(e => ({
          company: e.company || '',
          role: e.role || '',
          start_date: e.start_date || '',
          end_date: e.end_date || '',
          description: e.description || '',
          is_current: !!e.is_current
        }));
      }

      // Auto-fill Internships
      if (parsed.internships?.length > 0) {
        this.internships = parsed.internships.map(i => ({
          company: i.company || '',
          role: i.role || '',
          duration: i.duration || '',
          description: i.description || ''
        }));
      }

      // Auto-fill Projects
      if (parsed.projects?.length > 0) {
        this.projects = parsed.projects.map(p => ({
          title: p.title || '',
          description: p.description || '',
          technologies: p.technologies || '',
          url: p.url || ''
        }));
      }

      // Auto-fill Certifications
      if (parsed.certifications?.length > 0) {
        this.certifications = parsed.certifications.map(c => ({
          name: c.name || '',
          issuing_org: c.issuing_org || '',
          year: c.year || ''
        }));
      }

      // Map AI-detected skills to DB skills
      if (parsed.skills?.length > 0) {
        for (const aiSkill of parsed.skills) {
          const match = this.allSkills.find(s =>
            s.skill_name.toLowerCase() === (aiSkill.skill_name || '').toLowerCase()
          );
          if (match && !this.selectedSkills.find(s => s.skill_id === match.skill_id)) {
            this.selectedSkills.push({
              skill_id: match.skill_id,
              skill_name: match.skill_name,
              experience_years: aiSkill.experience_years || '1'
            });
          }
        }
      }

      this.parseSuccess = true;
      this.cdr.detectChanges(); // Force UI update since fetch might run outside Zone
    } catch (err: any) {
      console.error('[ApplyJob] AI parse failed:', err);
      this.parseError = err?.message || 'AI parsing failed. Please fill in the form manually.';
      this.resumeDetectedAsResume = null; // unknown; allow manual submission if user fills the form
    } finally {
      this.isParsing = false;
    }
  }

  removeResume(): void {
    this.resumeFile = null;
    this.resumeFileName = '';
    this.parseSuccess = false;
    this.parseError = '';
    this.resumeDetectedAsResume = null;
    this.resetResumeDerivedFields();
  }

  private resetResumeDerivedFields(): void {
    // Scalars derived from resume
    this.form.first_name = '';
    this.form.last_name = '';
    this.form.email = this.form.email || '';
    this.form.phone = '';
    this.form.linkedin_url = '';
    this.form.experience_years = '';
    this.form.location = '';
    this.form.summary = '';
    this.form.current_salary = '';
    this.form.expected_salary = '';
    this.form.notice_period = '';
    this.form.highest_qualification = '';
    this.form.portfolio_url = '';
    this.form.github_url = '';

    // Dynamic arrays derived from resume
    this.educations = [
      { degree: '', field_of_study: '', institution: '', start_year: '', end_year: '', grade: '' }
    ];
    this.experiences = [
      { company: '', role: '', start_date: '', end_date: '', description: '', is_current: false }
    ];
    this.internships = [];
    this.projects = [];
    this.certifications = [];

    // Skills selection derived from resume
    this.selectedSkills = [];
  }

  private isLikelyResume(parsed: any): boolean {
    // Heuristic: resume-like docs usually produce multiple meaningful fields.
    const email = (parsed?.email || '').trim();
    const phone = (parsed?.phone || '').trim();
    const linkedin = (parsed?.linkedin_url || '').trim();
    const github = (parsed?.github_url || '').trim();
    const summary = (parsed?.summary || '').trim();

    const skillsCount = Array.isArray(parsed?.skills) ? parsed.skills.length : 0;
    const educationCount = Array.isArray(parsed?.education) ? parsed.education.length : 0;
    const experienceCount = Array.isArray(parsed?.experience) ? parsed.experience.length : 0;

    let signals = 0;
    if (email) signals += 2;
    if (phone) signals += 1;
    if (linkedin) signals += 1;
    if (github) signals += 1;
    if (skillsCount > 0) signals += 1;
    if (educationCount > 0) signals += 1;
    if (experienceCount > 0) signals += 1;
    if (summary && summary.length >= 30) signals += 1;

    return signals >= 3;
  }

  // ═══════════════════════════════════════════════════════════
  //  SKILLS MANAGEMENT
  // ═══════════════════════════════════════════════════════════

  get availableSkills() {
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
        experience_years: this.skillExpToAdd
      });
      this.skillToAdd = '';
      this.skillExpToAdd = '1';
    }
  }

  removeSkill(idx: number): void {
    this.selectedSkills.splice(idx, 1);
  }

  // ═══════════════════════════════════════════════════════════
  //  FORM VALIDATION
  // ═══════════════════════════════════════════════════════════

  validate(): boolean {
    this.errors = {};

    if (!this.resumeFile) {
      this.errors['resume'] = 'Resume / CV is required to submit the application.';
    } else if (this.resumeDetectedAsResume === false) {
      this.errors['resume'] = 'Please upload a valid resume/CV (PDF/DOC/DOCX).';
    }

    if (!this.form.first_name.trim())
      this.errors['first_name'] = 'First name is required.';

    if (!this.form.last_name.trim())
      this.errors['last_name'] = 'Last name is required.';

    if (!this.form.email.trim()) {
      this.errors['email'] = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.form.email)) {
      this.errors['email'] = 'Invalid email format.';
    }

    if (!this.form.phone.trim())
      this.errors['phone'] = 'Phone number is required.';

    if (!this.form.experience_years)
      this.errors['experience_years'] = 'Experience is required.';

    if (!this.form.location.trim())
      this.errors['location'] = 'Location is required.';

    // Validate at least 1 education entry has a degree
    const hasValidEducation = this.educations.some(e => e.degree.trim() && e.institution.trim());
    if (!hasValidEducation)
      this.errors['education'] = 'At least one education entry with degree and institution is required.';

    return Object.keys(this.errors).length === 0;
  }

  // ═══════════════════════════════════════════════════════════
  //  HELPER: Clean arrays (remove empty entries before submit)
  // ═══════════════════════════════════════════════════════════

  private cleanEducations(): EducationEntry[] {
    return this.educations.filter(e => e.degree.trim() || e.institution.trim());
  }

  private cleanExperiences(): ExperienceEntry[] {
    return this.experiences.filter(e => e.company.trim() || e.role.trim());
  }

  private cleanInternships(): InternshipEntry[] {
    return this.internships.filter(i => i.company.trim() || i.role.trim());
  }

  private cleanProjects(): ProjectEntry[] {
    return this.projects.filter(p => p.title.trim());
  }

  private cleanCertifications(): CertificationEntry[] {
    return this.certifications.filter(c => c.name.trim());
  }

  // ═══════════════════════════════════════════════════════════
  //  SUBMIT APPLICATION — Full DB-correct flow
  // ═══════════════════════════════════════════════════════════

  async submitApplication(): Promise<void> {
    if (!this.validate()) {
      this.showToast('Please fix the highlighted errors.', 'error');
      return;
    }

    this.isSubmitting = true;

    try {
      // ── Step 1: Find or create candidate ──────────────────
      let candidateId = sessionStorage.getItem('loggedInCandidateId') || '';

      if (!candidateId) {
        // Check if already exists (avoids prevent_duplicate_candidate DB trigger error)
        const existing = await this.soap.getCandidateByEmail(this.form.email.trim());
        if (existing.length > 0) {
          candidateId = existing[0]['candidate_id'] || '';
          console.log('[Apply] Using existing candidate:', candidateId);
        } else {
          // Insert new candidate
          let insertResp: any;
          try {
            insertResp = await this.soap.insertCandidate({
              first_name:       this.form.first_name.trim(),
              last_name:        this.form.last_name.trim(),
              email:            this.form.email.trim(),
              phone:            this.form.phone.trim(),
              linkedin_url:     this.form.linkedin_url.trim(),
              experience_years: this.form.experience_years,
              location:         this.form.location.trim()
            });
          } catch (insertErr: any) {
            // Race-condition duplicate → fall back to lookup
            const msg = insertErr?.responseText || insertErr?.message || '';
            if (msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('already exists')) {
              const found = await this.soap.getCandidateByEmail(this.form.email.trim());
              if (found.length > 0) candidateId = found[0]['candidate_id'] || '';
            } else {
              throw insertErr;
            }
          }

          // Extract candidate_id from JSON response
          if (!candidateId && insertResp) {
            try {
              const nodes = $.cordys.json.find(insertResp, 'candidate_id');
              if (nodes) {
                const node = Array.isArray(nodes) ? nodes[0] : nodes;
                candidateId = typeof node === 'string' ? node : (node?.text || '');
              }
            } catch (e) {
              console.warn('[Apply] Could not extract candidate_id from response:', e);
            }
          }

          // Final fallback
          if (!candidateId) {
            const found = await this.soap.getCandidateByEmail(this.form.email.trim());
            if (found.length > 0) candidateId = found[0]['candidate_id'] || '';
          }
        }
      }

      if (!candidateId) {
        throw new Error('Could not determine Candidate ID. Please contact support.');
      }

      // Persist for My Applications page
      sessionStorage.setItem('loggedInCandidateId', candidateId);

      // ── Step 1.5: Final duplicate check (belt & suspenders) ──
      try {
        const existingApps = await this.soap.getApplicationsByCandidate(candidateId);
        const dup = existingApps.find(a => a['requisition_id'] === this.requisitionId);
        if (dup) {
          this.alreadyApplied = true;
          this.existingApplicationId = dup['application_id'] || '';
          this.showToast('You have already applied to this job.', 'error');
          return;
        }
      } catch (e) {
        console.warn('[Apply] Duplicate check failed, proceeding:', e);
      }

      // ── Step 2: Insert candidate skills ───────────────────
      for (const skill of this.selectedSkills) {
        try {
          await this.soap.insertCandidateSkill(
            candidateId, skill.skill_id, skill.experience_years
          );
        } catch (e) {
          // Skill association may already exist — not fatal
          console.warn('[Apply] Skill insert skipped (may exist):', skill.skill_id);
        }
      }

      // ── Step 3: Persist resume (data URL) for HR review ────
      let resumeUrl = '';
      if (this.resumeFile) {
        try {
          const dataUrl = await fileToResumeDataUrl(this.resumeFile);
          resumeUrl = dataUrl || '';
          if (!dataUrl && this.resumeFile.size > 0) {
            console.warn('[Apply] Resume exceeds inline size limit; application saved without resume_url.');
          }
        } catch (e) {
          console.warn('[Apply] Could not encode resume for storage:', e);
        }
      }

      // ── Step 4: Insert application with all new fields ────
      await this.soap.insertApplication({
        candidate_id:     candidateId,
        requisition_id:   this.requisitionId,
        source:           this.form.source,
        current_stage_id: this.firstStageId,
        notes:            '',

        // JSONB fields (stringified JSON arrays)
        education_details:      JSON.stringify(this.cleanEducations()),
        experience_details:     JSON.stringify(this.cleanExperiences()),
        internship_details:     JSON.stringify(this.cleanInternships()),
        project_details:        JSON.stringify(this.cleanProjects()),
        certification_details:  JSON.stringify(this.cleanCertifications()),

        // Scalar fields
        cover_letter:           this.form.cover_letter.trim(),
        summary:                this.form.summary.trim(),
        current_salary:         this.form.current_salary.trim(),
        expected_salary:        this.form.expected_salary.trim(),
        notice_period:          this.form.notice_period,
        total_experience:       this.form.experience_years,
        highest_qualification:  this.form.highest_qualification.trim(),
        resume_url:             resumeUrl,
        portfolio_url:          this.form.portfolio_url.trim(),
        github_url:             this.form.github_url.trim(),
        linkedin_url:           this.form.linkedin_url.trim(),
        willing_to_relocate:    this.form.willing_to_relocate ? 'true' : 'false',
        available_joining_date: this.form.available_joining_date
      });

      // Mail candidate about application received (non-blocking)
      try {
        const candidateName = `${this.form.first_name} ${this.form.last_name}`.trim() || this.form.email.trim();
        const appliedOn = new Date().toISOString();
        const apps = await this.soap.getApplicationsByCandidate(candidateId);
        const insertedApp = apps.find(a => a['requisition_id'] === this.requisitionId) || null;

        const mail = buildMailBody('CANDIDATE_APPLIED' as MailEvent, {
          candidateName,
          requisitionId: this.requisitionId,
          jobTitle: this.jobTitle,
          appliedOn: insertedApp?.['applied_at'] || insertedApp?.['created_at'] || appliedOn
        });

        await this.soap.sendAllMailsBPM(this.form.email.trim(), mail.subject, mail.body);
      } catch (mailErr) {
        console.warn('[ApplyJob] Failed to send candidate application mail (non-blocking):', mailErr);
      }

      this.submitted = true;
      this.showToast('Application submitted successfully!', 'success');

    } catch (err: any) {
      console.error('[Apply] Submission failed:', err);
      const msg = err?.responseText || err?.message || 'Unknown error';
      this.showToast('Submission failed: ' + msg, 'error');
    } finally {
      this.isSubmitting = false;
    }
  }

  goBack(): void {
    this.router.navigate(['/candidate/jobs']);
  }

  // ─── Toast ────────────────────────────────────────────────
  showToast(message: string, type: 'success' | 'error'): void {
    this.toastMessage = message;
    this.toastType = type;
    this.showToastFlag = true;
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => this.showToastFlag = false, 5000);
  }
}
