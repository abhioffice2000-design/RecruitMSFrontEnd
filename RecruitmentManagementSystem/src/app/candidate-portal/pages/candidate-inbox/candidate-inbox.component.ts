import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SoapService } from '../../../services/soap.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-candidate-inbox',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="inbox-wrap animate-fade-in" style="padding: 24px; max-width: 900px; margin: 0 auto;">
      <div class="page-header" style="margin-bottom: 24px;">
        <h1 style="font-size: 24px; color: #1e293b; display: flex; align-items: center; gap: 10px;">
          <i class="fas fa-inbox" style="color: #0b3d91;"></i> My Inbox
        </h1>
        <p style="color: #64748b; margin-top: 4px;">Important updates and requests from the recruitment team.</p>
      </div>

      <div class="messages-list" *ngIf="!loading && messages.length > 0; else emptyState">
        <div class="message-card" *ngFor="let msg of messages" 
             style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); transition: transform 0.2s;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 40px; height: 40px; background: #eff6ff; color: #3b82f6; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px;">
                <i class="fas" [ngClass]="msg.type === 'DOCUMENT_REQUEST' ? 'fa-file-signature' : 'fa-bell'"></i>
              </div>
              <div>
                <h3 style="font-size: 16px; font-weight: 600; color: #1e293b; margin: 0;">{{ msg.subject }}</h3>
                <span style="font-size: 12px; color: #94a6b8;">{{ formatDate(msg.date) }}</span>
              </div>
            </div>
            <span *ngIf="msg.type === 'DOCUMENT_REQUEST'" 
                  style="background: #fff7ed; color: #c2410c; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: uppercase;">
              Action Required
            </span>
          </div>
          
          <p style="color: #475569; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
            {{ msg.content }}
          </p>

          <div class="message-actions" *ngIf="msg.type === 'DOCUMENT_REQUEST'" style="border-top: 1px solid #f1f5f9; padding-top: 16px;">
            <button class="btn-action" (click)="goToApplications()" 
                    style="background: #0b3d91; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 14px; cursor: pointer; display: flex; align-items: center; gap: 8px;">
              <i class="fas fa-upload"></i> Upload Documents Now
            </button>
          </div>
        </div>
      </div>

      <ng-template #emptyState>
        <div *ngIf="!loading" style="text-align: center; padding: 60px 20px; background: #f8fafc; border: 2px dashed #e2e8f0; border-radius: 16px;">
          <div style="font-size: 48px; color: #cbd5e1; margin-bottom: 16px;">
            <i class="fas fa-envelope-open"></i>
          </div>
          <h3 style="color: #475569; font-size: 18px; font-weight: 600;">No messages yet</h3>
          <p style="color: #94a6b8; max-width: 300px; margin: 8px auto 0;">Your inbox is empty. We'll notify you here when there's an update on your application.</p>
        </div>
        <div *ngIf="loading" style="text-align: center; padding: 40px;">
          <i class="fas fa-spinner fa-spin" style="font-size: 32px; color: #0b3d91;"></i>
          <p style="margin-top: 12px; color: #64748b;">Loading your messages...</p>
        </div>
      </ng-template>
    </div>
  `,
  styles: [`
    .message-card:hover { transform: translateY(-2px); border-color: #cbd5e1; }
    .btn-action:hover { background: #082d6b; }
  `]
})
export class CandidateInboxComponent implements OnInit {
  messages: any[] = [];
  loading = true;

  constructor(private soap: SoapService, private router: Router) {}

  async ngOnInit(): Promise<void> {
    const candidateId = sessionStorage.getItem('loggedInCandidateId') || '';
    if (!candidateId) {
      this.loading = false;
      return;
    }

    try {
      const docs = await this.soap.getCandidateDocuments(candidateId);
      this.messages = docs
        .filter(d => d.document_type === 'DOCUMENT_REQUEST')
        .map(d => ({
          id: d.document_id,
          type: d.document_type,
          subject: 'Action Required: Mandatory Documents Requested',
          content: d.temp1 || 'HR has requested you to upload mandatory documents for your application.',
          date: d.created_at || d.uploaded_at,
          fullData: d
        }));
    } catch (e) {
      console.error('Failed to load inbox:', e);
    } finally {
      this.loading = false;
    }
  }

  formatDate(d: string): string {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-IN', { 
      day: '2-digit', month: 'short', year: 'numeric', 
      hour: '2-digit', minute: '2-digit' 
    });
  }

  goToApplications(): void {
    this.router.navigate(['/candidate/applications']);
  }
}
