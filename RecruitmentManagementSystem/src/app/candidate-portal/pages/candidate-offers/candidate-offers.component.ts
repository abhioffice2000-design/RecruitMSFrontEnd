import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  CordysService,
  CordysOffer,
  CordysJobRequisition
} from '../../services/cordys.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-candidate-offers',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './candidate-offers.component.html',
  styleUrls: ['./candidate-offers.component.scss']
})
export class CandidateOffersComponent implements OnInit {
  offers: CordysOffer[] = [];
  jobRequisitions: CordysJobRequisition[] = [];
  isLoading = true;

  private getCandidateId(): string {
    // Must use the same key that candidate-login flow sets.
    return sessionStorage.getItem('loggedInCandidateId') || sessionStorage.getItem('candidateId') || '';
  }

  constructor(private cordysService: CordysService) {}

  ngOnInit() {
    this.loadOffers();
  }

  /** Load offers via GetTs_offersObjects; filter by current candidate. */
  private loadOffers(): void {
    const candidateId = this.getCandidateId();
    if (!candidateId) {
      this.offers = [];
      this.isLoading = false;
      return;
    }

    forkJoin({
      offers: this.cordysService.getOffers(),
      jobs: this.cordysService.getJobRequisitions()
    }).subscribe({
      next: ({ offers, jobs }) => {
        this.jobRequisitions = jobs;
        this.offers = (offers || [])
          .filter(o => {
            const cid = (o as any)?.candidate_id || (o as any)?.Candidate_id || (o as any)?.candidateId || '';
            // Never show drafts to candidates; they should only see once HR sends the offer.
            return cid === candidateId && (o.offer_status || o.status) !== 'DRAFT';
          });
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Offers: Failed to load:', err);
        this.offers = [];
        this.isLoading = false;
      }
    });
  }

  getJobTitle(requisitionId: string): string {
    const job = this.jobRequisitions.find(j => j.requisition_id === requisitionId);
    return job?.job_title || requisitionId || 'Offer';
  }

  getSalaryDisplay(offer: CordysOffer): string {
    if (offer.salary && offer.salary.trim()) return `₹${offer.salary}`;
    return 'As per discussion';
  }

  formatDate(dateStr: string): string {
    if (!dateStr || !dateStr.trim()) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  }

  getOfferStatusClass(status: string): string {
    const s = (status || '').toLowerCase();
    if (s === 'accepted') return 'status-accepted';
    if (s === 'pending' || s === 'sent') return 'status-pending';
    if (s === 'rejected' || s === 'declined') return 'status-declined';
    if (s === 'expired') return 'status-expired';
    return 'status-default';
  }
}
