import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-manager-jobs',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './manager-jobs.html',
  styleUrls: ['./manager-jobs.scss'],
})
export class ManagerJobs implements OnInit {
  jobRequests = [
    { id: 'REQ-2041', title: 'Senior Frontend Engineer', type: 'Full-time', priority: 'High', status: 'Approved', date: 'Oct 20, 2026' },
    { id: 'REQ-2042', title: 'Product Design Lead', type: 'Full-time', priority: 'Medium', status: 'Pending Approval', date: 'Oct 24, 2026' },
    { id: 'REQ-2043', title: 'DevOps Specialist', type: 'Contract', priority: 'High', status: 'Draft', date: 'Oct 25, 2026' }
  ];

  ngOnInit(): void {
    // Show latest created requisitions on top.
    this.jobRequests = [...this.jobRequests].sort((a, b) => {
      const aTime = new Date(a.date).getTime();
      const bTime = new Date(b.date).getTime();
      return (bTime || 0) - (aTime || 0);
    });
  }
}
