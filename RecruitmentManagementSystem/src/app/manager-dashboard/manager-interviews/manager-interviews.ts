import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

declare var $: any;

interface Interview {
  interview_id: string;
  application_id: string;
  interview_type: string;
  round_number: string;
  slot_id: string;
  meeting_link: string;
  status: string;
  created_by_user: string;
  // Enriched from slot
  slot_date: string;
  start_time: string;
  end_time: string;
}

@Component({
  selector: 'app-manager-interviews',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './manager-interviews.html',
  styleUrls: ['./manager-interviews.scss'],
})
export class ManagerInterviews implements OnInit {
  upcomingInterviews: Interview[] = [];

  private readonly NAMESPACE = 'http://schemas.cordys.com/RMST1DatabaseMetadata';

  ngOnInit(): void {
    this.loadInterviews();
  }

  // Load all interviews via GetTs_interviewsObjects
  loadInterviews(): void {
    $.cordys.ajax({
      method: 'GetTs_interviewsObjects',
      namespace: this.NAMESPACE,
      parameters: {
        fromInterview_id: '',
        toInterview_id: ''
      },
      dataType: 'xml'
    })
    .done((xml: any) => {
      const rows = xml.getElementsByTagName('tuple');
      const list: Interview[] = [];
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const interview: Interview = {
          interview_id: r.getElementsByTagName('interview_id')[0]?.textContent || '',
          application_id: r.getElementsByTagName('application_id')[0]?.textContent || '',
          interview_type: r.getElementsByTagName('interview_type')[0]?.textContent || '',
          round_number: r.getElementsByTagName('round_number')[0]?.textContent || '1',
          slot_id: r.getElementsByTagName('slot_id')[0]?.textContent || '',
          meeting_link: r.getElementsByTagName('meeting_link')[0]?.textContent || '',
          status: r.getElementsByTagName('status')[0]?.textContent || '',
          created_by_user: r.getElementsByTagName('created_by_user')[0]?.textContent || '',
          slot_date: '',
          start_time: '',
          end_time: ''
        };
        list.push(interview);
        // Enrich with slot date/time
        if (interview.slot_id) {
          this.enrichWithSlot(interview);
        }
      }
      this.upcomingInterviews = list;
    })
    .fail((err: any) => {
      console.error('Manager interviews fetch error:', err);
    });
  }

  enrichWithSlot(interview: Interview): void {
    $.cordys.ajax({
      method: 'GetTs_interview_slotsObject',
      namespace: this.NAMESPACE,
      parameters: { Slot_id: interview.slot_id },
      dataType: 'xml'
    })
    .done((xml: any) => {
      const r = xml.getElementsByTagName('tuple')[0];
      if (r) {
        interview.slot_date = r.getElementsByTagName('slot_date')[0]?.textContent || '';
        interview.start_time = r.getElementsByTagName('start_time')[0]?.textContent || '';
        interview.end_time = r.getElementsByTagName('end_time')[0]?.textContent || '';
      }
    });
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'SCHEDULED': return 'badge-warning';
      case 'COMPLETED': return 'badge-success';
      case 'CANCELLED': return 'badge-neutral';
      default: return 'badge-neutral';
    }
  }
}
