import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

/**
 * Employee referrals: track applications with `referred_by` in the Candidates list
 * and use the referral email flow when a job is approved (Manager Dashboard).
 */
@Component({
  selector: 'app-referrals',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="dashboard-content referrals-page">
      <div class="header">
        <h2>Referrals</h2>
        <p class="sub">
          Internal referral emails are sent automatically when a manager <strong>approves</strong> a job requisition.
          Referred applications appear in <strong>Candidates</strong> when <code>referred_by</code> is set on the application.
        </p>
      </div>
      <div class="card">
        <h3>How it works</h3>
        <ol>
          <li>Manager approves a requisition → eligible internal users receive a <em>Referral opportunity</em> email.</li>
          <li>Employees refer candidates through your standard process; HR records referral on the application.</li>
          <li>Use <a routerLink="/hr/candidates">Candidates</a> to filter and export lists (CSV).</li>
        </ol>
      </div>
    </div>
  `,
  styles: [
    `
      .referrals-page .sub {
        color: #64748b;
        font-size: 14px;
        max-width: 720px;
        line-height: 1.5;
        margin-top: 8px;
      }
      .card {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 20px 22px;
        max-width: 720px;
      }
      .card h3 {
        margin: 0 0 12px;
        font-size: 16px;
        color: #0f172a;
      }
      .card ol {
        margin: 0;
        padding-left: 20px;
        color: #475569;
        line-height: 1.6;
      }
      .card a {
        color: #2563eb;
        font-weight: 600;
      }
    `
  ]
})
export class ReferralsTab {}
