import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SoapService } from '../../services/soap.service';

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
  _raw: Record<string, string>;
}

@Component({
  selector: 'app-candidates',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './candidates.component.html',
  styleUrls: ['./candidates.component.scss']
})
export class CandidatesComponent implements OnInit {
  Math = Math;
  isLoading = true;
  selectedCandidate: CandidateRow | null = null;
  candidateSkills: any[] = [];

  // Data
  jobs: any[] = [];
  stages: any[] = [];
  allCandidates: CandidateRow[] = [];
  filteredCandidates: CandidateRow[] = [];

  // Pagination
  pageSize = 8;
  currentPage = 1;

  // Filters
  searchQuery = '';
  statusFilter = 'All Statuses';

  constructor(private soapService: SoapService) { }

  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    this.isLoading = true;
    try {
      const [jobsRaw, deptsRaw, stagesRaw, candidatesRaw, appsRaw] = await Promise.all([
        this.soapService.getJobRequisitions(),
        this.soapService.getDepartments(),
        this.soapService.getPipelineStages(),
        this.soapService.getCandidates(),
        this.soapService.getApplications()
      ]);

      // Department map
      const deptMap = new Map<string, string>();
      deptsRaw.forEach((d: any) => deptMap.set(d['department_id'], d['department_name']));

      // Jobs map (Filter for APPROVED only, like HR)
      this.jobs = jobsRaw
        .filter((j: any) => (j['status'] || '').toUpperCase() === 'APPROVED')
        .map((j: any) => ({
          requisition_id: j['requisition_id'],
          title: j['title'],
          department_name: deptMap.get(j['department_id']) || 'N/A'
        }));

      // Stage map
      this.stages = stagesRaw
        .map((s: any) => ({ 
          stage_id: s['stage_id'], 
          stage_name: s['stage_name'], 
          order: parseInt(s['stage_order'] || '0') 
        }))
        .sort((a: any, b: any) => a.order - b.order);
      
      const stageMap = new Map<string, string>();
      this.stages.forEach((s: any) => stageMap.set(s.stage_id, s.stage_name));

      // Candidate map
      const candMap = new Map<string, any>();
      candidatesRaw.forEach((c: any) => candMap.set(c['candidate_id'], c));

      // Build rows from all candidates (not just those with applications)
      this.allCandidates = candidatesRaw.map((c: any) => {
        // Find the latest application for this candidate to show relevant role/status
        const candApps = appsRaw.filter((a: any) => 
          (a['candidate_id'] || a['Candidate_id']) === (c['candidate_id'] || c['Candidate_id'])
        );
        const latestApp = candApps.length > 0 ? candApps[candApps.length - 1] : null;
        
        const getVal = (obj: any, key: string) => {
          if (!obj) return '';
          const capitalized = key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();
          return obj[key] || obj[capitalized] || obj[key.toLowerCase()] || '';
        };

        const fn = getVal(c, 'first_name');
        const ln = getVal(c, 'last_name');
        const name = `${fn} ${ln}`.trim() || 'No Name';
        const cid = getVal(c, 'candidate_id');

        return {
          application_id: getVal(latestApp, 'application_id') || 'N/A',
          candidate_id: cid,
          requisition_id: getVal(latestApp, 'requisition_id') || 'None',
          candidate_name: name,
          candidate_email: getVal(c, 'email') || 'N/A',
          candidate_phone: getVal(c, 'phone') || 'N/A',
          experience_years: getVal(c, 'experience_years') || '0',
          location: getVal(c, 'location') || 'N/A',
          source: getVal(latestApp, 'source') || 'Direct',
          status: latestApp ? this.mapStatus(getVal(latestApp, 'status'), getVal(c, 'temp1')) : (getVal(c, 'temp1') === 'BLACKLISTED' ? 'Blacklisted' : 'Registered'),
          current_stage_id: getVal(latestApp, 'current_stage_id'),
          stage_name: latestApp ? (stageMap.get(getVal(latestApp, 'current_stage_id')) || 'New') : 'N/A',
          applied_at: getVal(latestApp, 'applied_at') || getVal(latestApp, 'created_at') || getVal(c, 'created_at') || '',
          _raw: c
        };
      });
      console.log('Admin ALL Candidates', this.allCandidates);

      this.applyFilters();
    } catch (err) {
      console.error('Failed to load candidates:', err);
    } finally {
      this.isLoading = false;
    }
  }

  mapStatus(rawStatus: string, temp1?: string): string {
    if (temp1 === 'BLACKLISTED') return 'Blacklisted';
    const s = (rawStatus || '').toUpperCase();
    if (s === 'ACTIVE') return 'In Review';
    if (s === 'HIRED') return 'Hired';
    if (s === 'REJECTED') return 'Rejected';
    return rawStatus || 'New Applied';
  }

  applyFilters() {
    let list = this.allCandidates;

    if (this.statusFilter !== 'All Statuses') {
      if (this.statusFilter === 'Blacklisted') {
        list = list.filter(c => this.isBlacklisted(c));
      } else {
        list = list.filter(c => c.status === this.statusFilter && !this.isBlacklisted(c));
      }
    }

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(c => 
        c.candidate_name.toLowerCase().includes(q) || 
        c.candidate_id.toLowerCase().includes(q) ||
        this.getJobTitle(c.requisition_id).toLowerCase().includes(q)
      );
    }

    this.filteredCandidates = list;
    this.currentPage = 1; // Reset to first page on filter change
  }

  get totalPages(): number {
    return Math.ceil(this.filteredCandidates.length / this.pageSize);
  }

  get pagedCandidates(): CandidateRow[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredCandidates.slice(start, start + this.pageSize);
  }

  get pageNumbers(): number[] {
    const total = this.totalPages;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    
    // Simplified page range
    if (this.currentPage <= 4) return [1, 2, 3, 4, 5, 0, total];
    if (this.currentPage >= total - 3) return [1, 0, total - 4, total - 3, total - 2, total - 1, total];
    
    return [1, 0, this.currentPage - 1, this.currentPage, this.currentPage + 1, 0, total];
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.goToPage(this.currentPage + 1);
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.goToPage(this.currentPage - 1);
    }
  }

  getJobTitle(reqId: string): string {
    return this.jobs.find(j => j.requisition_id === reqId)?.title || 'Unknown Role';
  }

  // ═══════════════════════════════════════════════════
  //  REMOVE FROM BLACKLIST MODAL
  // ═══════════════════════════════════════════════════

  removingBlacklistCandidate: CandidateRow | null = null;
  isSubmittingRemoveBlacklist = false;

  isBlacklisted(c: CandidateRow): boolean {
    return (c._raw?.['temp1'] || c._raw?.['TEMP1']) === 'BLACKLISTED';
  }

  openRemoveBlacklistModal(c: CandidateRow) {
    this.removingBlacklistCandidate = c;
  }

  closeRemoveBlacklistModal() {
    this.removingBlacklistCandidate = null;
  }

  async confirmRemoveBlacklist(): Promise<void> {
    if (!this.removingBlacklistCandidate) return;
    this.isSubmittingRemoveBlacklist = true;

    try {
      await this.soapService.removeFromBlacklist(this.removingBlacklistCandidate);
      const updatedCandidateId = this.removingBlacklistCandidate.candidate_id;
      this.closeRemoveBlacklistModal();
      
      // Close details modal if open for the same candidate
      if (this.selectedCandidate && this.selectedCandidate.candidate_id === updatedCandidateId) {
        this.closeDetails();
      }
      
      await this.loadData();
    } catch (e) {
      console.error('Failed to remove from blacklist:', e);
      // Fallback alert for hard errors, but UI flow is now modal-based
      alert('Failed to remove candidate from blacklist.');
    } finally {
      this.isSubmittingRemoveBlacklist = false;
    }
  }

  // Modal State
  blacklistingCandidate: CandidateRow | null = null;
  blacklistDuration: string = '3';
  blacklistReason: string = '';
  isSubmittingBlacklist = false;

  openBlacklistModal(c: CandidateRow) {
    this.blacklistingCandidate = c;
    this.blacklistDuration = '3';
    this.blacklistReason = '';
  }

  closeBlacklistModal() {
    this.blacklistingCandidate = null;
    this.isSubmittingBlacklist = false;
  }

  async submitBlacklist() {
    if (!this.blacklistingCandidate) return;
    this.isSubmittingBlacklist = true;

    try {
      const duration = this.blacklistDuration === 'FOREVER' ? 'FOREVER' : parseInt(this.blacklistDuration, 10);
      await this.soapService.blacklistCandidate(this.blacklistingCandidate, duration, this.blacklistReason);
      
      this.closeBlacklistModal();
      await this.loadData();
    } catch (err) {
      console.error('Failed to blacklist candidate:', err);
      alert('Failed to blacklist candidate.');
      this.isSubmittingBlacklist = false;
    }
  }

  async viewDetails(candidate: CandidateRow) {
    this.selectedCandidate = candidate;
    try {
      this.candidateSkills = await this.soapService.getSkills(); // Simplified for now, should be candidate-specific
      // In a real scenario, we'd filter matching skills or call getCandidateSkills
      const allSkills = await this.soapService.getCandidateSkills(candidate.candidate_id);
      this.candidateSkills = allSkills;
    } catch {
      this.candidateSkills = [];
    }
  }

  closeDetails() {
    this.selectedCandidate = null;
    this.candidateSkills = [];
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  }

  formatDate(d: string): string {
    if (!d) return 'N/A';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}
