import { Component, OnInit } from '@angular/core';
import { MockDataService } from '../../services/mock-data.service';
import { Job } from '../../models/job.model';

@Component({
  selector: 'app-candidate-saved-jobs',
  template: `
    <div class="saved-jobs-page animate-fade-in">
      <div class="page-header">
        <h1>Saved Jobs</h1>
        <p>Jobs you've bookmarked for later</p>
      </div>
      <div class="jobs-list">
        <div *ngFor="let job of savedJobs; let i = index" class="job-card card card-hover" [style.animation-delay]="i * 0.06 + 's'">
          <div class="job-left">
            <div class="company-logo">{{ job.company[0] }}</div>
            <div class="job-info">
              <h3 [routerLink]="['/jobs', job.id]">{{ job.title }}</h3>
              <p class="company">{{ job.company }} &middot; {{ job.location }}</p>
              <div class="tags">
                <span class="badge" [ngClass]="'badge-' + job.type.toLowerCase()">{{ job.type }}</span>
                <span class="tag"><i class="fa-solid fa-briefcase"></i> {{ job.experienceLevel }}</span>
                <span class="salary"><i class="fa-solid fa-money-bill-wave"></i> {{ job.salary }}</span>
              </div>
            </div>
          </div>
          <div class="job-right">
            <button class="btn btn-outline btn-sm" (click)="unsave(job.id)"><i class="fa-solid fa-heart"></i> Unsave</button>
            <button class="btn btn-primary btn-sm" [routerLink]="['/jobs', job.id]"><i class="fa-solid fa-arrow-right"></i> View & Apply</button>
          </div>
        </div>
      </div>
      <div *ngIf="savedJobs.length === 0" class="empty-state card">
        <i class="fa-regular fa-bookmark empty-icon"></i>
        <h3>No saved jobs yet</h3>
        <p>Browse jobs and save positions you're interested in.</p>
        <a class="btn btn-primary" routerLink="/jobs"><i class="fa-solid fa-magnifying-glass"></i> Explore Jobs</a>
      </div>
    </div>
  `,
  styles: [`
    .saved-jobs-page { padding: 28px 32px; max-width: 1100px; }
    .page-header { margin-bottom: 24px; h1 { font-size: 1.5rem; font-weight: 800; color: var(--gray-900); margin-bottom: 4px; } p { font-size: 0.875rem; color: var(--gray-500); } }
    .jobs-list { display: flex; flex-direction: column; gap: 12px; }
    .job-card { display: flex; justify-content: space-between; align-items: center; padding: 24px; animation: fadeIn 0.4s ease-out both; }
    .job-left { display: flex; gap: 16px; flex: 1; }
    .company-logo { width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg, var(--primary-50), var(--primary-100)); color: var(--primary); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1.125rem; flex-shrink: 0; }
    .job-info h3 { font-size: 1rem; font-weight: 700; color: var(--gray-900); cursor: pointer; margin-bottom: 4px; &:hover { color: var(--primary); } }
    .company { font-size: 0.8125rem; color: var(--gray-500); margin-bottom: 8px; }
    .tags { display: flex; align-items: center; gap: 10px; }
    .tag { font-size: 0.75rem; color: var(--gray-500); i { margin-right: 3px; } }
    .salary { font-size: 0.8125rem; font-weight: 600; color: var(--success); i { margin-right: 3px; } }
    .job-right { display: flex; gap: 8px; flex-shrink: 0; }
    .empty-state { padding: 48px; margin-top: 24px; text-align: center; .empty-icon { font-size: 2.5rem; color: var(--gray-300); margin-bottom: 16px; display: block; } }
    @media (max-width: 768px) { .saved-jobs-page { padding: 16px; } .job-card { flex-direction: column; gap: 16px; } .job-right { width: 100%; justify-content: flex-end; } }
  `]
})
export class CandidateSavedJobsComponent implements OnInit {
  savedJobs: Job[] = [];
  constructor(private dataService: MockDataService) {}
  ngOnInit() { this.savedJobs = this.dataService.getSavedJobs(); }
  unsave(id: number) {
    this.dataService.toggleSaveJob(id);
    this.savedJobs = this.dataService.getSavedJobs();
  }
}
