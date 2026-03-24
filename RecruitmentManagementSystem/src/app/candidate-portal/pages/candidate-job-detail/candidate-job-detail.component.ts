import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SoapService } from '../../../services/soap.service';

// Local interface matching ts_job_requisitions fields
interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  companyType: string;
  companySize: string;
  type: string;
  experienceLevel: string;
  department: string;
  postedDate: string;
  salary: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  benefits: string[];
  skills: string[];
  applicants: number;
  saved: boolean;
}

@Component({
  selector: 'app-candidate-job-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './candidate-job-detail.component.html',
  styleUrls: ['./candidate-job-detail.component.scss']
})
export class CandidateJobDetailComponent implements OnInit {
  job: Job | null = null;
  applied = false;

  constructor(private route: ActivatedRoute, private soap: SoapService) {}

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id') || '';
    if (!id) return;

    try {
      const data = await this.soap.getJobRequisitionById(id);
      if (data) {
        this.job = {
          id: data['requisition_id'] || '',
          title: data['title'] || 'Untitled Position',
          company: 'Adnate IT Solutions',
          location: 'Hyderabad, India',
          companyType: 'IT Services',
          companySize: '50-200 employees',
          type: data['posting_source'] || 'Full-time',
          experienceLevel: `${data['experience_min'] || '0'}-${data['experience_max'] || 'Any'} years`,
          department: data['department_id'] || '',
          postedDate: data['created_at'] || new Date().toISOString(),
          salary: data['salary_min'] && data['salary_max']
            ? `${data['salary_currency'] || 'INR'} ${data['salary_min']} - ${data['salary_max']}`
            : 'Not Disclosed',
          description: data['description'] || '',
          responsibilities: [],
          requirements: [],
          benefits: [],
          skills: [],
          applicants: 0,
          saved: false,
        };

        // Load skills for this requisition
        try {
          const skills = await this.soap.getJobSkillsByRequisition(id);
          this.job.skills = skills.map(s => s['skill_name'] || s['skill_id'] || '');
        } catch (e) {
          console.warn('Failed to load skills:', e);
        }
      }
    } catch (err) {
      console.error('Failed to load job detail:', err);
    }
  }

  apply() {
    // Placeholder — would navigate to apply page or submit application
    if (this.job && !this.applied) {
      this.applied = true;
    }
  }

  toggleSave() {
    if (this.job) {
      this.job.saved = !this.job.saved;
    }
  }

  getTimeAgo(dateStr: string): string {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
    if (diff === 0) return 'today';
    if (diff === 1) return 'yesterday';
    return diff + ' days ago';
  }
}
