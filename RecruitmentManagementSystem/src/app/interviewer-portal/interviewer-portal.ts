import { Component, NgZone, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ThemeToggleComponent } from '../shared/theme-toggle/theme-toggle.component';
import { ThemeService } from '../services/theme.service';
import { HeaderComponent } from '../layout/header/header.component';
import { SoapService } from '../services/soap.service';

declare var $: any;

// ===== Matches ts_interview_slots =====
interface InterviewSlot {
  slot_id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  created_by_user: string;
  temp1: string; // '0'=available, '1'=booked
}

// ===== Matches ts_interviews =====
interface Interview {
  interview_id: string;
  application_id: string;
  interview_type: string;
  round_number: string;
  slot_id: string;
  meeting_link: string;
  status: string;
  created_by_user: string;
  // Enriched client-side (from slot data)
  slot_date?: string;
  start_time?: string;
  end_time?: string;
  /** This user already submitted ts_interview_feedback for this interview. */
  feedbackSubmitted?: boolean;
}

// ===== Matches ts_interview_feedback =====
interface FeedbackForm {
  interview_id: string;
  rating: number;
  recommendation: string;
  comments: string;
}

// ===== Matches ts_notifications (read via GetTs_notificationsObjects if available) =====
interface Notification {
  notification_id: string;
  title: string;
  message: string;
  entity_type: string;
  entity_id: string;
  status: string;
  sent_at: string;
}

// ===== Matches ts_delegations =====
interface Delegation {
  delegation_id: string;
  delegator_user_id: string;
  delegate_user_id: string;
  start_date: string;
  end_date: string;
  status: string;
  reason: string;
}

@Component({
  selector: 'app-interviewer-portal',
  standalone: true,
  imports: [CommonModule, FormsModule, ThemeToggleComponent, HeaderComponent],
  templateUrl: './interviewer-portal.html',
  styleUrls: [
    '../hr-dashboard/hr-dashboard.scss',
    './interviewer-shell.scss',
    './interviewer-portal.scss',
  ],
})
export class InterviewerPortal implements OnInit {
  // ─── Sidebar ─────────────────────────────────────────────
  sidebarCollapsed = false;
  /** Mobile overlay nav (narrow screens) */
  mobileNavOpen = false;
  activeView = 'dashboard';
  loggedInUser = '';
  loggedInUserId = '';

  navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'fas fa-th-large' },
    { id: 'interviews', label: 'My Interviews', icon: 'fas fa-video' },
    { id: 'availability', label: 'Availability', icon: 'fas fa-calendar-alt' },
    { id: 'notifications', label: 'Notifications', icon: 'fas fa-bell' },
    { id: 'delegation', label: 'Delegation', icon: 'fas fa-user-friends' },
  ];

  // ─── Dashboard Stats ────────────────────────────────────
  stats = {
    upcoming: 0,
    completed: 0,
    pendingFeedback: 0,
    slotsThisWeek: 0,
  };

  // ─── Interviews ─────────────────────────────────────────
  interviews: Interview[] = [];
  interviewFilter: 'ALL' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' = 'ALL';

  // ─── Availability ───────────────────────────────────────
  slots: InterviewSlot[] = [];
  newSlot = { date: '', startTime: '', endTime: '' };
  showSlotForm = false;

  // UI constraints for slot creation
  minSlotDate = ''; // today or future only
  startTimeOptions: string[] = []; // allowed START times in half-hour increments (09:30–18:00)

  // ─── Feedback ───────────────────────────────────────────
  feedbackInterview: Interview | null = null;
  feedbackForm: FeedbackForm = {
    interview_id: '',
    rating: 0,
    recommendation: '',
    comments: '',
  };
  showFeedbackModal = false;
  hoveredStar = 0;

  // ─── Notifications ─────────────────────────────────────
  notifications: Notification[] = [];

  // ─── Delegation ─────────────────────────────────────────
  delegations: Delegation[] = [];
  newDelegation = { delegateUserId: '', startDate: '', endDate: '', reason: '' };
  showDelegationForm = false;

  // ─── Toast ──────────────────────────────────────────────
  toastMessage = '';
  toastType: 'success' | 'error' = 'success';
  showToastFlag = false;
  private toastTimeout: any;

  private readonly NAMESPACE = 'http://schemas.cordys.com/RMST1DatabaseMetadata';

  /** Shown in page header (live date) */
  todayLabel = '';

  constructor(private router: Router, private soap: SoapService, private ngZone: NgZone) {}

  ngOnInit(): void {
    this.todayLabel = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    // Date input constraint: allow only today and future.
    this.minSlotDate = this.toLocalISODate(new Date());

    // Time input constraint: fixed half-hour START times between 09:30 and 18:00.
    // END is derived as START + 30 minutes, so END <= 18:30.
    this.startTimeOptions = this.generateHalfHourStartTimes('09:30', '18:00');
    if (this.startTimeOptions.length > 0) {
      this.newSlot.startTime = this.startTimeOptions[0];
      this.newSlot.endTime = this.addMinutesToHHMM(this.newSlot.startTime, 30);
    }

    try {
      if (!sessionStorage.getItem('loggedInPortalLabel')) {
        sessionStorage.setItem('loggedInPortalLabel', 'Interviewer Portal');
      }
    } catch {
      /* ignore */
    }
    this.loggedInUser = sessionStorage.getItem('loggedInUser') || '';
    this.loggedInUserId = sessionStorage.getItem('loggedInUserId') || '';

    if (this.loggedInUserId) {
      this.loadAllData();
    } else {
      // Fallback: load without user_id filtering
      this.loadAllData();
    }
  }

  loadAllData(): void {
    this.loadSlots();
    this.loadInterviews();
    this.loadDelegations();
  }

  // ─── Navigation ─────────────────────────────────────────
  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  setView(viewId: string): void {
    this.activeView = viewId;
    this.mobileNavOpen = false;
  }

  logout(): void {
    try {
      ThemeService.preserveTheme(() => {
        sessionStorage.clear();
        localStorage.clear();
      });
      this.clearAllCookies();
      if (typeof $ !== 'undefined' && $?.cordys?.authentication?.sso) {
        $.cordys.authentication.sso.logout();
      }
      window.location.href = '/login';
    } catch (e) {
      console.error('Logout error:', e);
      window.location.href = '/login';
    }
  }

  private clearAllCookies(): void {
    const cookies = document.cookie.split(';');
    const hostname = window.location.hostname;
    const domains = [hostname, '.' + hostname, hostname.split('.').slice(-2).join('.'), ''];
    const paths = ['/', '', '/login', '/interviewer'];
    for (const cookie of cookies) {
      const eqPos = cookie.indexOf('=');
      const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();
      if (name) {
        for (const domain of domains) {
          for (const path of paths) {
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path || '/'}`;
            if (domain) {
              document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path || '/'};domain=${domain}`;
            }
          }
        }
      }
    }
    const cordysCookies = ['defaultinst_AuthContext', 'defaultinst_ct', 'defaultinst_SAMLart', 'JSESSIONID', 'SAMLart'];
    for (const cookieName of cordysCookies) {
      for (const domain of domains) {
        for (const path of paths) {
          document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path || '/'}`;
          if (domain) {
            document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path || '/'};domain=${domain}`;
          }
        }
      }
    }
  }

  // ════════════════════════════════════════════════════════
  //  LOAD SLOTS — GetTs_interview_slotsObjectsForcreated_by_user
  //  or GetAvailableSlots (custom query, param: interviewerId)
  // ════════════════════════════════════════════════════════
  loadSlots(): void {
    if (this.loggedInUserId) {
      $.cordys.ajax({
        method: 'GetTs_interview_slotsObjectsForcreated_by_user',
        namespace: this.NAMESPACE,
        parameters: {
          Created_by_user: this.loggedInUserId
        },
        dataType: 'xml'
      })
      .done((xml: any) => {
        this.parseSlots(xml);
      })
      .fail((err: any) => {
        console.error('Slots fetch error:', err);
      });
    } else {
      // Fallback: get all slots
      $.cordys.ajax({
        method: 'GetTs_interview_slotsObjects',
        namespace: this.NAMESPACE,
        parameters: { fromSlot_id: '', toSlot_id: '' },
        dataType: 'xml'
      })
      .done((xml: any) => {
        this.parseSlots(xml);
      })
      .fail((err: any) => {
        console.error('Slots fetch error:', err);
      });
    }
  }

  parseSlots(xml: any): void {
    const rows = xml.getElementsByTagName('tuple');
    const list: InterviewSlot[] = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      list.push({
        slot_id: r.getElementsByTagName('slot_id')[0]?.textContent || '',
        slot_date: r.getElementsByTagName('slot_date')[0]?.textContent || '',
        start_time: r.getElementsByTagName('start_time')[0]?.textContent || '',
        end_time: r.getElementsByTagName('end_time')[0]?.textContent || '',
        created_by_user: r.getElementsByTagName('created_by_user')[0]?.textContent || '',
        temp1: r.getElementsByTagName('temp1')[0]?.textContent || '0',
      });
    }
    this.slots = list;
    this.calculateStats();
  }

  // ════════════════════════════════════════════════════════
  //  LOAD INTERVIEWS — GetTs_interviewersObjectsForuser_id
  //  then for each interview_id → GetTs_interviewsObject
  // ════════════════════════════════════════════════════════
  loadInterviews(): void {
    if (this.loggedInUserId) {
      this.interviews = [];
      // Step 1: Get interview_ids assigned to this user from ts_interviewers
      $.cordys.ajax({
        method: 'GetTs_interviewersObjectsForuser_id',
        namespace: this.NAMESPACE,
        parameters: { User_id: this.loggedInUserId },
        dataType: 'xml'
      })
      .done((xml: any) => {
        const rows = xml.getElementsByTagName('tuple');
        const interviewIds: string[] = [];
        for (let i = 0; i < rows.length; i++) {
          const id = rows[i].getElementsByTagName('interview_id')[0]?.textContent || '';
          if (id) interviewIds.push(id);
        }

        // Step 2: For each interview_id, get interview details
        interviewIds.forEach(intId => {
          $.cordys.ajax({
            method: 'GetTs_interviewsObject',
            namespace: this.NAMESPACE,
            parameters: { Interview_id: intId },
            dataType: 'xml'
          })
          .done((xml2: any) => {
            const r = xml2.getElementsByTagName('tuple')[0];
            if (r) {
              const interview: Interview = {
                interview_id: r.getElementsByTagName('interview_id')[0]?.textContent || '',
                application_id: r.getElementsByTagName('application_id')[0]?.textContent || '',
                interview_type: r.getElementsByTagName('interview_type')[0]?.textContent || '',
                round_number: r.getElementsByTagName('round_number')[0]?.textContent || '1',
                slot_id: r.getElementsByTagName('slot_id')[0]?.textContent || '',
                meeting_link: r.getElementsByTagName('meeting_link')[0]?.textContent || '',
                status: r.getElementsByTagName('status')[0]?.textContent || 'SCHEDULED',
                created_by_user: r.getElementsByTagName('created_by_user')[0]?.textContent || '',
              };
              // Enrich with slot date/time
              this.enrichInterviewWithSlot(interview);
              this.enrichInterviewFeedbackFlag(interview);
              this.interviews.push(interview);
              this.calculateStats();
            }
          });
        });
      })
      .fail((err: any) => {
        console.error('Interviewers fetch error:', err);
      });
    } else {
      this.interviews = [];
      // Fallback: get all interviews
      $.cordys.ajax({
        method: 'GetTs_interviewsObjects',
        namespace: this.NAMESPACE,
        parameters: { fromInterview_id: '', toInterview_id: '' },
        dataType: 'xml'
      })
      .done((xml: any) => {
        const rows = xml.getElementsByTagName('tuple');
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          const interview: Interview = {
            interview_id: r.getElementsByTagName('interview_id')[0]?.textContent || '',
            application_id: r.getElementsByTagName('application_id')[0]?.textContent || '',
            interview_type: r.getElementsByTagName('interview_type')[0]?.textContent || '',
            round_number: r.getElementsByTagName('round_number')[0]?.textContent || '1',
            slot_id: r.getElementsByTagName('slot_id')[0]?.textContent || '',
            meeting_link: r.getElementsByTagName('meeting_link')[0]?.textContent || '',
            status: r.getElementsByTagName('status')[0]?.textContent || 'SCHEDULED',
            created_by_user: r.getElementsByTagName('created_by_user')[0]?.textContent || '',
          };
          this.enrichInterviewFeedbackFlag(interview);
          this.interviews.push(interview);
        }
        this.calculateStats();
      })
      .fail((err: any) => {
        console.error('Interviews fetch error:', err);
      });
    }
  }

  // Enrich interview with slot date/time info
  enrichInterviewWithSlot(interview: Interview): void {
    const slot = this.slots.find(s => s.slot_id === interview.slot_id);
    if (slot) {
      interview.slot_date = slot.slot_date;
      interview.start_time = slot.start_time;
      interview.end_time = slot.end_time;
    } else if (interview.slot_id) {
      // Fetch slot data
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
  }

  /** Load whether the logged-in interviewer already submitted feedback (hides duplicate actions). */
  private enrichInterviewFeedbackFlag(interview: Interview): void {
    if (!interview.interview_id || !this.loggedInUserId) return;
    this.soap
      .getInterviewFeedbackForInterview(interview.interview_id)
      .then(rows => {
        const mine = (rows || []).some(
          r => String(r['interviewer_id'] || r['Interviewer_id'] || '').trim() === this.loggedInUserId
        );
        this.ngZone.run(() => {
          interview.feedbackSubmitted = mine;
          this.calculateStats();
        });
      })
      .catch(() => {});
  }

  // ════════════════════════════════════════════════════════
  //  LOAD DELEGATIONS — GetTs_delegationsObjectsFordelegator_user_id
  // ════════════════════════════════════════════════════════
  loadDelegations(): void {
    if (this.loggedInUserId) {
      $.cordys.ajax({
        method: 'GetTs_delegationsObjectsFordelegator_user_id',
        namespace: this.NAMESPACE,
        parameters: { Delegator_user_id: this.loggedInUserId },
        dataType: 'xml'
      })
      .done((xml: any) => {
        this.parseDelegations(xml);
      })
      .fail((err: any) => {
        console.error('Delegations fetch error:', err);
      });
    }
  }

  parseDelegations(xml: any): void {
    const rows = xml.getElementsByTagName('tuple');
    const list: Delegation[] = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      list.push({
        delegation_id: r.getElementsByTagName('delegation_id')[0]?.textContent || '',
        delegator_user_id: r.getElementsByTagName('delegator_user_id')[0]?.textContent || '',
        delegate_user_id: r.getElementsByTagName('delegate_user_id')[0]?.textContent || '',
        start_date: r.getElementsByTagName('start_date')[0]?.textContent || '',
        end_date: r.getElementsByTagName('end_date')[0]?.textContent || '',
        status: r.getElementsByTagName('status')[0]?.textContent || 'ACTIVE',
        reason: r.getElementsByTagName('reason')[0]?.textContent || '',
      });
    }
    this.delegations = list;
  }

  // ════════════════════════════════════════════════════════
  //  CALCULATE STATS
  // ════════════════════════════════════════════════════════
  calculateStats(): void {
    this.stats.upcoming = this.interviews.filter(i => i.status === 'SCHEDULED').length;
    this.stats.completed = this.interviews.filter(i => i.status === 'COMPLETED').length;
    this.stats.pendingFeedback = this.interviews.filter(
      i => i.status === 'COMPLETED' && !i.feedbackSubmitted
    ).length;
    this.stats.slotsThisWeek = this.slots.filter(s => s.temp1 === '0').length;
  }

  // ─── Dashboard helpers ──────────────────────────────────
  get upcomingInterviews(): Interview[] {
    return this.interviews
      .filter(i => i.status === 'SCHEDULED')
      .sort((a, b) => (a.slot_date || '').localeCompare(b.slot_date || ''));
  }

  get recentActivity(): { icon: string; text: string; time: string; color: string }[] {
    const activities: { icon: string; text: string; time: string; color: string }[] = [];
    this.interviews.filter(i => i.status === 'COMPLETED').slice(0, 2).forEach(iv => {
      activities.push({
        icon: 'fas fa-check-circle',
        text: `Interview completed — ${iv.interview_type} (${iv.interview_id})`,
        time: iv.slot_date || '',
        color: '#16a34a'
      });
    });
    this.interviews.filter(i => i.status === 'SCHEDULED').slice(0, 2).forEach(iv => {
      activities.push({
        icon: 'fas fa-calendar-plus',
        text: `Upcoming — ${iv.interview_type} (${iv.interview_id})`,
        time: iv.slot_date || '',
        color: '#2563eb'
      });
    });
    return activities;
  }

  // ─── Interviews ─────────────────────────────────────────
  get filteredInterviews(): Interview[] {
    if (this.interviewFilter === 'ALL') return this.interviews;
    return this.interviews.filter(i => i.status === this.interviewFilter);
  }

  setInterviewFilter(filter: 'ALL' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED'): void {
    this.interviewFilter = filter;
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'SCHEDULED': return 'status-scheduled';
      case 'COMPLETED': return 'status-completed';
      case 'CANCELLED': return 'status-cancelled';
      default: return '';
    }
  }

  joinMeeting(link: string): void {
    if (link) window.open(link, '_blank');
  }

  // ─── Availability ───────────────────────────────────────
  toggleSlotForm(): void {
    this.showSlotForm = !this.showSlotForm;
    if (!this.showSlotForm) {
      this.newSlot = {
        date: '',
        startTime: this.startTimeOptions[0] || '',
        endTime: this.startTimeOptions[0] ? this.addMinutesToHHMM(this.startTimeOptions[0], 30) : ''
      };
    }
  }

  onStartTimeChange(): void {
    if (!this.newSlot.startTime) {
      this.newSlot.endTime = '';
      return;
    }
    this.newSlot.endTime = this.addMinutesToHHMM(this.newSlot.startTime, 30);
  }

  // ADD SLOT — uses UpdateTs_interview_slots (INSERT with new only)
  addSlot(): void {
    if (!this.newSlot.date || !this.newSlot.startTime || !this.newSlot.endTime) {
      this.showToast('Please fill in all slot fields.', 'error');
      return;
    }

    // Allow only today and future dates.
    if (this.minSlotDate && this.newSlot.date < this.minSlotDate) {
      this.showToast('Slot date must be today or a future date.', 'error');
      return;
    }

    // Enforce fixed half-hour increments:
    // - startTime must be one of the allowed START options
    // - endTime must be exactly startTime + 30 minutes
    if (!this.startTimeOptions.includes(this.newSlot.startTime)) {
      this.showToast('Start time must be in fixed half-hour slots (09:30–18:00).', 'error');
      return;
    }
    const expectedEnd = this.addMinutesToHHMM(this.newSlot.startTime, 30);
    if (this.newSlot.endTime !== expectedEnd) {
      this.showToast('End time must be exactly 30 minutes after start time.', 'error');
      return;
    }

    // Important: `slot_id` is the primary key and should be auto-generated by DB trigger.
    // We omit `slot_id` completely so DB trigger can generate it.
    const tsPayload: Record<string, any> = {
      slot_date: this.newSlot.date,
      start_time: this.normalizeTimeForDb(this.newSlot.startTime),
      end_time: this.normalizeTimeForDb(this.newSlot.endTime),
      created_by_user: this.loggedInUserId,
      temp1: '0',
      temp2: '',
      temp3: '',
      temp4: '',
      temp5: ''
    };

    $.cordys.ajax({
      method: 'UpdateTs_interview_slots',
      namespace: this.NAMESPACE,
      parameters: {
        tuple: {
          'new': {
            ts_interview_slots: {
              ...tsPayload
            }
          }
        }
      },
      dataType: 'xml'
    })
    .done(() => {
      this.showToast('Availability slot added!', 'success');
      this.toggleSlotForm();
      this.loadSlots();
    })
    .fail((err: any) => {
      console.error('Add slot error:', err);
      this.showToast('Failed to add slot.', 'error');
    });
  }

  // REMOVE SLOT — uses UpdateTs_interview_slots (DELETE with old only)
  removeSlot(slotId: string): void {
    const slot = this.slots.find(s => s.slot_id === slotId);
    if (!slot) return;

    $.cordys.ajax({
      method: 'UpdateTs_interview_slots',
      namespace: this.NAMESPACE,
      parameters: {
        tuple: {
          old: {
            ts_interview_slots: {
              slot_id: slot.slot_id,
              slot_date: slot.slot_date,
              start_time: slot.start_time,
              end_time: slot.end_time,
              created_by_user: slot.created_by_user,
              temp1: slot.temp1, temp2: '', temp3: '', temp4: '', temp5: ''
            }
          }
        }
      },
      dataType: 'xml'
    })
    .done(() => {
      this.showToast('Slot removed.', 'success');
      this.loadSlots();
    })
    .fail((err: any) => {
      console.error('Remove slot error:', err);
      this.showToast('Failed to remove slot.', 'error');
    });
  }

  // ─── Feedback ───────────────────────────────────────────
  // Interviewers must "Mark Complete" first, then submit feedback.
  markInterviewCompleted(interview: Interview): void {
    const interviewId = interview?.interview_id;
    if (!interviewId) {
      this.showToast('Interview ID missing.', 'error');
      return;
    }

    $.cordys.ajax({
      method: 'UpdateTs_interviews',
      namespace: this.NAMESPACE,
      parameters: {
        tuple: {
          old: {
            ts_interviews: { interview_id: interviewId }
          },
          'new': {
            ts_interviews: {
              interview_id: interviewId,
              status: 'COMPLETED'
            }
          }
        }
      },
      dataType: 'xml'
    })
    .done(() => {
      this.showToast('Interview marked as completed.', 'success');
      // Refresh UI so Feedback button becomes visible; reload slots (booking state may change elsewhere).
      this.interviews = [];
      this.loadInterviews();
      this.loadSlots();
      this.calculateStats();
    })
    .fail((err: any) => {
      console.error('Mark complete failed:', err);
      this.showToast('Failed to mark interview completed.', 'error');
    });
  }

  // Uses UpdateTs_interview_feedback (INSERT)
  openFeedback(interview: Interview): void {
    this.feedbackInterview = interview;
    this.feedbackForm = {
      interview_id: interview.interview_id,
      rating: 0,
      recommendation: '',
      comments: '',
    };
    this.hoveredStar = 0;
    this.showFeedbackModal = true;
  }

  closeFeedbackModal(): void {
    this.showFeedbackModal = false;
    this.feedbackInterview = null;
  }

  setRating(value: number): void {
    this.feedbackForm.rating = value;
  }

  submitFeedback(): void {
    if (!this.feedbackForm.rating) {
      this.showToast('Please provide a rating.', 'error');
      return;
    }
    if (!this.feedbackForm.recommendation) {
      this.showToast('Please select a recommendation.', 'error');
      return;
    }

    $.cordys.ajax({
      method: 'UpdateTs_interview_feedback',
      namespace: this.NAMESPACE,
      parameters: {
        tuple: {
          'new': {
            ts_interview_feedback: {
              interview_id: this.feedbackForm.interview_id,
              interviewer_id: this.loggedInUserId,
              rating: this.feedbackForm.rating.toString(),
              recommendation: this.feedbackForm.recommendation,
              comments: this.feedbackForm.comments,
              submitted_at: new Date().toISOString(),
              temp1: '', temp2: '', temp3: '', temp4: '', temp5: ''
            }
          }
        }
      },
      dataType: 'xml'
    })
    .done(() => {
      // After successful feedback submission, mark the interview as completed.
      // (Round-level gating should still be based on feedback rows, but this status helps UI/reporting.)
      $.cordys.ajax({
        method: 'UpdateTs_interviews',
        namespace: this.NAMESPACE,
        parameters: {
          tuple: {
            old: {
              ts_interviews: {
                interview_id: this.feedbackForm.interview_id
              }
            },
            'new': {
              ts_interviews: {
                interview_id: this.feedbackForm.interview_id,
                status: 'COMPLETED'
              }
            }
          }
        },
        dataType: 'xml'
      })
      .done(() => {
        const iv = this.interviews.find(x => x.interview_id === this.feedbackForm.interview_id);
        if (iv) iv.feedbackSubmitted = true;
        this.showToast('Feedback submitted!', 'success');
        this.closeFeedbackModal();
        this.loadSlots();
        this.calculateStats();
      })
      .fail((statusErr: any) => {
        console.warn('Failed to update interview status to COMPLETED:', statusErr);
        const iv = this.interviews.find(x => x.interview_id === this.feedbackForm.interview_id);
        if (iv) iv.feedbackSubmitted = true;
        this.showToast('Feedback submitted (status update failed).', 'success');
        this.closeFeedbackModal();
        this.loadSlots();
        this.calculateStats();
      });
    })
    .fail((err: any) => {
      console.error('Feedback error:', err);
      this.showToast('Failed to submit feedback.', 'error');
    });
  }

  // ─── Delegation ─────────────────────────────────────────
  // Uses UpdateTs_delegations (INSERT)
  toggleDelegationForm(): void {
    this.showDelegationForm = !this.showDelegationForm;
    if (!this.showDelegationForm) {
      this.newDelegation = { delegateUserId: '', startDate: '', endDate: '', reason: '' };
    }
  }

  addDelegation(): void {
    if (!this.newDelegation.delegateUserId || !this.newDelegation.startDate || !this.newDelegation.endDate) {
      this.showToast('Please fill in all delegation fields.', 'error');
      return;
    }

    $.cordys.ajax({
      method: 'UpdateTs_delegations',
      namespace: this.NAMESPACE,
      parameters: {
        tuple: {
          'new': {
            ts_delegations: {
              delegation_id: '',
              delegator_user_id: this.loggedInUserId,
              delegate_user_id: this.newDelegation.delegateUserId,
              start_date: this.newDelegation.startDate,
              end_date: this.newDelegation.endDate,
              status: 'ACTIVE',
              reason: this.newDelegation.reason,
              temp1: '', temp2: '', temp3: '', temp4: '', temp5: ''
            }
          }
        }
      },
      dataType: 'xml'
    })
    .done(() => {
      this.showToast('Delegation created!', 'success');
      this.toggleDelegationForm();
      this.loadDelegations();
    })
    .fail((err: any) => {
      console.error('Delegation error:', err);
      this.showToast('Failed to create delegation.', 'error');
    });
  }

  revokeDelegation(delegation: Delegation): void {
    $.cordys.ajax({
      method: 'UpdateTs_delegations',
      namespace: this.NAMESPACE,
      parameters: {
        tuple: {
          old: {
            ts_delegations: {
              delegation_id: delegation.delegation_id,
              delegator_user_id: delegation.delegator_user_id,
              delegate_user_id: delegation.delegate_user_id,
              start_date: delegation.start_date,
              end_date: delegation.end_date,
              status: delegation.status,
              reason: delegation.reason,
              temp1: '', temp2: '', temp3: '', temp4: '', temp5: ''
            }
          },
          'new': {
            ts_delegations: {
              delegation_id: delegation.delegation_id,
              delegator_user_id: delegation.delegator_user_id,
              delegate_user_id: delegation.delegate_user_id,
              start_date: delegation.start_date,
              end_date: delegation.end_date,
              status: 'REVOKED',
              reason: delegation.reason,
              temp1: '', temp2: '', temp3: '', temp4: '', temp5: ''
            }
          }
        }
      },
      dataType: 'xml'
    })
    .done(() => {
      this.showToast('Delegation revoked.', 'success');
      this.loadDelegations();
    })
    .fail((err: any) => {
      console.error('Revoke error:', err);
      this.showToast('Failed to revoke delegation.', 'error');
    });
  }

  // ─── Helpers ────────────────────────────────────────────
  private toLocalISODate(d: Date): string {
    // Avoid timezone-shift issues from `toISOString()` by building date from local fields.
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  private minutesToHHMM(totalMinutes: number): string {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${String(h).padStart(2, '0')}:${pad(m)}`;
  }

  private hhmmToMinutes(hhmm: string): number {
    const parts = (hhmm || '').split(':');
    const h = Number(parts[0] || '0');
    const m = Number(parts[1] || '0');
    return h * 60 + m;
  }

  private addMinutesToHHMM(hhmm: string, deltaMinutes: number): string {
    const base = this.hhmmToMinutes(hhmm);
    return this.minutesToHHMM(base + deltaMinutes);
  }

  private generateHalfHourStartTimes(startHHMM: string, endHHMM: string): string[] {
    // Includes both ends. Caller should choose end so END=start+30 stays within desired range.
    const startMin = this.hhmmToMinutes(startHHMM);
    const endMin = this.hhmmToMinutes(endHHMM);
    const out: string[] = [];
    for (let t = startMin; t <= endMin; t += 30) {
      out.push(this.minutesToHHMM(t));
    }
    return out;
  }

  private normalizeTimeForDb(hhmm: string): string {
    // DB column type: time without time zone.
    // Send a consistent representation: HH:mm:00.
    const v = (hhmm || '').trim();
    if (!v) return '';
    const parts = v.split(':');
    if (parts.length === 2) return `${parts[0]}:${parts[1]}:00`;
    if (parts.length >= 3) {
      const h = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      const s = parts[2].padStart(2, '0');
      return `${h}:${m}:${s}`;
    }
    return v;
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  formatTime(timeStr: string): string {
    const [h, m] = timeStr.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
  }

  formatDateTime(dtStr: string): string {
    const d = new Date(dtStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) +
      ', ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  }

  get unreadNotifications(): number {
    return this.notifications.filter(n => n.status === 'UNSENT').length;
  }

  isSlotBooked(slot: InterviewSlot): boolean {
    return slot.temp1 === '1';
  }

  // ─── Toast ──────────────────────────────────────────────
  showToast(message: string, type: 'success' | 'error'): void {
    this.toastMessage = message;
    this.toastType = type;
    this.showToastFlag = true;
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => this.showToastFlag = false, 3000);
  }
}