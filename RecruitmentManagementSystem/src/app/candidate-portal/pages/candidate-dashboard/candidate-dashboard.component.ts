import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SoapService } from '../../../services/soap.service';

@Component({
  selector: 'app-candidate-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './candidate-dashboard.component.html',
  styleUrls: ['./candidate-dashboard.component.scss'],
})
export class CandidateDashboardComponent implements OnInit {
  totalApplications = 0;
  activeApplications = 0;
  openJobs = 0;
  recentApps: { jobTitle: string; stageName: string; status: string; applied_at: string }[] = [];

  constructor(private soap: SoapService, public router: Router) {}

  async ngOnInit(): Promise<void> {
    const candidateId = sessionStorage.getItem('loggedInCandidateId') || '';
    try {
      const [jobs, stages] = await Promise.all([
        this.soap.getJobRequisitions(),
        this.soap.getPipelineStages(),
      ]);
      const apps = candidateId ? await this.soap.getApplicationsByCandidate(candidateId) : [];

      this.openJobs = jobs.filter(j => (j['status'] || '').toUpperCase() === 'APPROVED').length;

      const jobMap = new Map<string, string>();
      jobs.forEach(j => jobMap.set(j['requisition_id'] || '', j['title'] || ''));

      const stageMap = new Map<string, string>();
      stages.forEach(s => stageMap.set(s['stage_id'] || '', s['stage_name'] || ''));

      this.totalApplications = apps.length;
      this.activeApplications = apps.filter(a => (a['status'] || '').toUpperCase() === 'ACTIVE').length;

      this.recentApps = apps
        .sort(
          (a, b) =>
            new Date(b['applied_at'] || b['created_at'] || '').getTime() -
            new Date(a['applied_at'] || a['created_at'] || '').getTime()
        )
        .slice(0, 5)
        .map(a => ({
          jobTitle: jobMap.get(a['requisition_id'] || '') || a['requisition_id'] || '',
          stageName: stageMap.get(a['current_stage_id'] || '') || 'New',
          status: a['status'] || 'ACTIVE',
          applied_at: a['applied_at'] || a['created_at'] || '',
        }));
    } catch (e) {
      console.error('Dashboard load error:', e);
    }
  }

  formatDate(d: string): string {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
