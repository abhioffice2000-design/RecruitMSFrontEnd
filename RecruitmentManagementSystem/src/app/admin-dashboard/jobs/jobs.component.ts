import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SoapService } from '../../services/soap.service';

@Component({
  selector: 'app-jobs',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './jobs.component.html',
  styleUrls: ['./jobs.component.scss']
})
export class JobsComponent implements OnInit {
  isLoading = true;
  jobs: any[] = [];
  departments: any[] = [];
  allApplications: any[] = [];

  // Job Details State
  selectedJob: any = null;
  selectedJobSkills: any[] = [];
  showDetailModal = false;

  constructor(private soapService: SoapService) { }

  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    this.isLoading = true;
    try {
      const [jobsRaw, deptsRaw, appsRaw] = await Promise.all([
        this.soapService.getJobRequisitions(),
        this.soapService.getDepartments(),
        this.soapService.getApplications()
      ]);

      const deptMap = new Map<string, string>();
      deptsRaw.forEach((d: any) => deptMap.set(d.department_id, d.department_name));
      this.departments = deptsRaw;
      this.allApplications = appsRaw;

      this.jobs = jobsRaw.map((j: any) => {
        const apps = appsRaw.filter((a: any) => a.requisition_id === j.requisition_id);
        return {
          id: j.requisition_id,
          title: j.title,
          dept: deptMap.get(j.department_id) || 'N/A',
          location: j.temp1 || 'Headquarters', // Mapping location to temp1 or default
          type: j.temp2 || 'Full-time',       // Mapping type to temp2 or default
          status: this.mapStatus(j.status),
          applicants: apps.length,
          daysLeft: this.calculateDaysLeft(j.created_at),
          _raw: j
        };
      });
    } catch (err) {
      console.error('Failed to load jobs:', err);
    } finally {
      this.isLoading = false;
    }
  }

  mapStatus(status: string): string {
    const s = (status || '').toUpperCase();
    if (s === 'APPROVED') return 'Active';
    if (s === 'CLOSED') return 'Closed';
    if (s === 'PENDING') return 'Draft';
    return status;
  }

  calculateDaysLeft(createdAt: string): number {
    if (!createdAt) return 0;
    const created = new Date(createdAt);
    const deadline = new Date(created.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from creation
    const now = new Date();
    const diff = deadline.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  }

  getJobsByStatus(status: string): any[] {
    return this.jobs.filter(j => j.status === status);
  }

  async viewDetails(job: any) {
    this.selectedJob = job;
    this.showDetailModal = true;
    this.selectedJobSkills = [];
    
    try {
      // Use the same service as HR to get job skills
      const skills = await this.soapService.getJobSkillsByRequisition(job.id);
      this.selectedJobSkills = skills || [];
    } catch (err) {
      console.error('Failed to load job skills:', err);
    }
  }

  closeDetailModal() {
    this.showDetailModal = false;
    this.selectedJob = null;
    this.selectedJobSkills = [];
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  }
}
