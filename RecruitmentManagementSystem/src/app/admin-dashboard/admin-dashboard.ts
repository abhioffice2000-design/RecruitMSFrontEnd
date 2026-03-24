import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SoapService } from '../services/soap.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-dashboard.html',
  styleUrls: ['./admin-dashboard.scss']
})
export class AdminDashboard implements OnInit {

  metrics = [
    { id: 'candidates', title: 'Total Candidates', value: '...', trend: 'Live', isPositive: true, icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
    { id: 'jobs', title: 'Active Jobs', value: '42', trend: '+4%', isPositive: true, icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' }
  ];

  recentActivities = [
    { id: 1, candidate: 'Sarah Jenkins', role: 'Senior Frontend Dev', time: '2 mins ago', status: 'Pending' },
    { id: 2, candidate: 'Michael Chen', role: 'Backend Engineer', time: '1 hour ago', status: 'In Progress' },
    { id: 3, candidate: 'Amanda Ross', role: 'Product Manager', time: '3 hours ago', status: 'Wait for response' },
    { id: 4, candidate: 'David Smith', role: 'DevOps Engineer', time: '5 hours ago', status: 'Closed' },
    { id: 5, candidate: 'Emily Davis', role: 'UI/UX Designer', time: '1 day ago', status: 'Completed' }
  ];

  constructor(private soapService: SoapService, private router: Router) { }

  ngOnInit() {
    this.fetchMetrics();
    this.fetchRecentActivities();
  }

  fetchRecentActivities() {
    this.soapService.getRecentActivities().then(data => {
      if (!data || data.length === 0) {
        console.log('No recent activities found');
        return;
      }

      this.recentActivities = data.map((item: any, index: number) => {
        // Handle potential nested structures or different field names
        console.log("item is", item);

        const jobTitle =
          item['ts_job_requisitions']?.['job_title'] ||
          item['title'] ||
          item['Title'] ||
          'No Role Specified';

        const candidateName =
          item['candidate_name'] ||
          (item['first_name'] && item['last_name'] ? `${item['first_name']} ${item['last_name']}` : null) ||
          item['name'] ||
          item['email'] ||
          'Unknown Candidate';

        return {
          id: index + 1,
          candidate: candidateName,
          role: jobTitle,
          status: item['status'] || 'Pending',
          time: this.formatProfessionalTime(item['applied_at'] || item['created_at'] || item['time'] || item['updated_at'])
        };
      });
    }).catch(err => {
      console.error('Failed to fetch recent activities:', err);
    });
  }

  formatProfessionalTime(timeStr: any): string {
    if (!timeStr) return 'Recently';
    try {
      const date = new Date(timeStr);
      if (isNaN(date.getTime())) return timeStr;

      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);

      if (diffMins < 0) return 'Just now'; // Future dates?
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffMins < 1440) {
        const hours = Math.floor(diffMins / 60);
        return `${hours}h ago`;
      }

      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: now.getFullYear() !== date.getFullYear() ? 'numeric' : undefined
      });
    } catch {
      return timeStr;
    }
  }

  fetchMetrics() {
    // Fetch actual candidates count from DB
    this.soapService.getAllCandidatesCount().then(count => {
      const candidatesMetric = this.metrics.find(m => m.id === 'candidates');
      if (candidatesMetric) {
        candidatesMetric.value = count.toLocaleString();
      }
    }).catch(err => {
      console.error('Failed to fetch candidate count:', err);
      const candidatesMetric = this.metrics.find(m => m.id === 'candidates');
      if (candidatesMetric) candidatesMetric.value = '0';
    });

    // Fetch actual jobs count from DB
    this.soapService.getAllJobsCount().then(count => {
      const jobsMetric = this.metrics.find(m => m.id === 'jobs');
      if (jobsMetric) {
        jobsMetric.value = count.toLocaleString();
      }
    }).catch(err => {
      console.error('Failed to fetch jobs count:', err);
      const jobsMetric = this.metrics.find(m => m.id === 'jobs');
      if (jobsMetric) jobsMetric.value = '0';
    });

  }

  onMetricClick(metricId: string) {
    if (metricId === 'candidates') {
      this.router.navigate(['/admin/candidates']);
    }
  }

}
