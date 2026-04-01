export type MailEvent =
  | 'JOB_CREATED_FOR_APPROVAL'
  | 'JOB_APPROVED'
  | 'JOB_REJECTED'
  | 'JOB_REQUISITION_CLOSED'
  | 'REFERRAL_JOB_OPEN'
  | 'JOB_DELEGATED'
  | 'CANDIDATE_APPLIED'
  | 'HR_CANDIDATE_REGISTERED'
  | 'CANDIDATE_SHORTLISTED'
  | 'CANDIDATE_REJECTED'
  | 'INTERVIEW_SCHEDULED'
  | 'NEXT_INTERVIEW_SCHEDULED'
  | 'OFFER_SENT'
  | 'OFFER_ACCEPTED'
  | 'OFFER_REJECTED'
  | 'OFFER_ARGUED'
  | 'OFFER_NEGOTIATED'
  | 'MANDATORY_DOCUMENTS_REQUESTED';

export type MailTemplateData = Record<string, any>;

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function baseEmailHtml(
  title: string,
  contentHtml: string,
  subtitle: string = 'Recruitment Management System'
): string {
  return (
    `<html><body style='font-family:Arial, sans-serif; background-color:#F0F4FA;'>` +
    `<table width='100%' cellpadding='0' cellspacing='0' style='padding:30px 0;'>` +
    `<tr><td align='center'>` +
    `<table width='600' cellpadding='0' cellspacing='0' style='background-color:#FFFFFF; border-radius:10px; border:1px solid #DDD;'>` +
    `<tr>` +
    `<td style='background-color:#0B3D91; padding:24px; color:#FFFFFF; text-align:center;'>` +
    `<h2>${escapeHtml(title)}</h2>` +
    `<p>${escapeHtml(subtitle)}</p>` +
    `</td>` +
    `</tr>` +
    `<tr>` +
    `<td style='padding:25px; color:#333;'>` +
    `${contentHtml}` +
    `</td>` +
    `</tr>` +
    `<tr>` +
    `<td style='background-color:#E6ECF5; padding:15px; text-align:center; font-size:12px;'>` +
    `© ${new Date().getFullYear()} Adnate IT Solutions. All rights reserved.<br>` +
    `This is an automated message. Please do not reply.` +
    `</td>` +
    `</tr>` +
    `</table>` +
    `</td></tr>` +
    `</table>` +
    `</body></html>`
  );
}

function row(label: string, value: unknown): string {
  const v = escapeHtml(value);
  return (
    `<tr>` +
    `<td style="padding:8px 10px; color:#6B7280; font-size:13px; width:45%;">${escapeHtml(label)}</td>` +
    `<td style="padding:8px 10px; color:#111827; font-size:13px; font-weight:600;">${v || '-'}</td>` +
    `</tr>`
  );
}

function standardMailContent(opts: {
  name?: unknown;
  introLines: string[];
  detailsTableHtml?: string;
  ctaUrl?: unknown;
  ctaText?: unknown;
  noteLine?: string;
}): string {
  const name = escapeHtml(opts.name || 'User');
  const intro = (opts.introLines || [])
    .map(line => `<p>${line}</p>`)
    .join('');
  const cta =
    opts.ctaUrl && opts.ctaText
      ? `<p style='text-align:center; margin:25px 0;'><a href='${escapeHtml(
          opts.ctaUrl
        )}' style='background-color:#0B3D91; color:#FFFFFF; padding:12px 25px; text-decoration:none; border-radius:5px;'>${escapeHtml(
          opts.ctaText
        )}</a></p>`
      : '';
  const note = opts.noteLine ? `<p>${opts.noteLine}</p>` : '';
  return (
    `<p>Dear ${name},</p>` +
    intro +
    (opts.detailsTableHtml || '') +
    cta +
    note +
    `<p>Warm regards,<br>` +
    `<b style='color:#0B3D91;'>Support Team</b><br>` +
    `<span style='font-size:12px;'>support@yourcompany.com</span>` +
    `</p>`
  );
}

export function buildMailBody(event: MailEvent, data: MailTemplateData): { subject: string; body: string } {
  switch (event) {
    case 'JOB_CREATED_FOR_APPROVAL': {
      const subject = `Approval requested: ${data['jobTitle'] || 'Job Requisition'}`;
      const detailsTableHtml =
        `<table width='100%' cellpadding='0' cellspacing='0' style='border-collapse:collapse; border:1px solid #E5E7EB; border-radius:10px;'>` +
        row('Requisition ID', data['requisitionId']) +
        row('Job Title', data['jobTitle']) +
        row('Department', data['departmentName']) +
        row('Requested By', data['requestedBy']) +
        `</table>`;
      const contentHtml = standardMailContent({
        name: data['recipientName'] || 'Manager',
        introLines: ['A new job requisition has been created and is pending your approval.'],
        detailsTableHtml,
        noteLine: 'Please review in HR/Manager Dashboard and take the required action.'
      });
      return { subject, body: baseEmailHtml('Job Approval Request', contentHtml) };
    }

    case 'JOB_APPROVED': {
      const subject = `Job approved: ${data['jobTitle'] || 'Job Requisition'}`;
      const detailsTableHtml =
        `<table width='100%' cellpadding='0' cellspacing='0' style='border-collapse:collapse; border:1px solid #E5E7EB; border-radius:10px;'>` +
        row('Requisition ID', data['requisitionId']) +
        row('Job Title', data['jobTitle']) +
        row('Approved By', data['approvedBy']) +
        `</table>`;
      const contentHtml = standardMailContent({
        name: data['recipientName'] || 'User',
        introLines: ['Good news! Your job requisition has been <b>approved</b>.'],
        detailsTableHtml,
        noteLine: 'HR will proceed to the next steps and the job will be published for candidates.'
      });
      return { subject, body: baseEmailHtml('Job Approved', contentHtml) };
    }

    case 'JOB_REQUISITION_CLOSED': {
      const subject = `Job requisition closed: ${data['jobTitle'] || 'Job Requisition'}`;
      const detailsTableHtml =
        `<table width='100%' cellpadding='0' cellspacing='0' style='border-collapse:collapse; border:1px solid #E5E7EB; border-radius:10px;'>` +
        row('Requisition ID', data['requisitionId']) +
        row('Job Title', data['jobTitle']) +
        row('Department', data['departmentName']) +
        row('Closure reason', data['closureReason']) +
        row('Details', data['closureComment']) +
        row('Closed By', data['closedBy']) +
        `</table>`;
      const contentHtml = standardMailContent({
        name: data['recipientName'] || 'User',
        introLines: ['The following job requisition has been <b>closed</b> by HR.'],
        detailsTableHtml,
        noteLine: 'This recruitment cycle is complete for this requisition.'
      });
      return { subject, body: baseEmailHtml('Job Requisition Closed', contentHtml) };
    }

    case 'REFERRAL_JOB_OPEN': {
      const subject = `Referral opportunity: ${data['jobTitle'] || 'Open position'}`;
      const detailsTableHtml =
        `<table width='100%' cellpadding='0' cellspacing='0' style='border-collapse:collapse; border:1px solid #E5E7EB; border-radius:10px;'>` +
        row('Requisition ID', data['requisitionId']) +
        row('Job Title', data['jobTitle']) +
        row('Department', data['departmentName']) +
        `</table>`;
      const contentHtml = standardMailContent({
        name: data['recipientName'] || 'Colleague',
        introLines: [
          'A new position has been approved. If you know someone great, please refer them through the employee referral program.'
        ],
        detailsTableHtml,
        ctaUrl: data['applyUrl'],
        ctaText: 'View Job & Referral Options',
        noteLine: 'Thank you for helping us hire the best talent.'
      });
      return { subject, body: baseEmailHtml('Employee Referral — New Opening', contentHtml) };
    }

    case 'JOB_REJECTED': {
      const subject = `Job rejected: ${data['jobTitle'] || 'Job Requisition'}`;
      const detailsTableHtml =
        `<table width='100%' cellpadding='0' cellspacing='0' style='border-collapse:collapse; border:1px solid #E5E7EB; border-radius:10px;'>` +
        row('Requisition ID', data['requisitionId']) +
        row('Job Title', data['jobTitle']) +
        row('Rejected By', data['rejectedBy']) +
        row('Reason', data['rejectionReason']) +
        `</table>`;
      const contentHtml = standardMailContent({
        name: data['recipientName'] || 'User',
        introLines: ['We regret to inform you that your job requisition has been <b>rejected</b>.'],
        detailsTableHtml,
        noteLine: 'Please resubmit after updating the required details.'
      });
      return { subject, body: baseEmailHtml('Job Rejected', contentHtml) };
    }

    case 'JOB_DELEGATED': {
      const subject = `Approval delegated: ${data['jobTitle'] || 'Job Requisition'}`;
      const detailsTableHtml =
        `<table width='100%' cellpadding='0' cellspacing='0' style='border-collapse:collapse; border:1px solid #E5E7EB; border-radius:10px;'>` +
        row('Requisition ID', data['requisitionId']) +
        row('Job Title', data['jobTitle']) +
        row('Delegated By', data['delegatedBy']) +
        `</table>`;
      const contentHtml = standardMailContent({
        name: data['recipientName'] || 'Manager',
        introLines: ['A job requisition task has been delegated to you for review.'],
        detailsTableHtml,
        noteLine: 'Please take the required action in the Manager Dashboard.'
      });
      return { subject, body: baseEmailHtml('Task Delegated', contentHtml) };
    }

    case 'CANDIDATE_APPLIED': {
      const subject = `Application submitted: ${data['jobTitle'] || 'Job'}`;
      const detailsTableHtml =
        `<table width='100%' cellpadding='0' cellspacing='0' style='border-collapse:collapse; border:1px solid #E5E7EB; border-radius:10px;'>` +
        row('Requisition ID', data['requisitionId']) +
        row('Job Title', data['jobTitle']) +
        row('Applied On', data['appliedOn']) +
        `</table>`;
      const contentHtml = standardMailContent({
        name: data['candidateName'],
        introLines: ['Thanks for applying. We have received your application for the following role:'],
        detailsTableHtml,
        noteLine: 'You can track the status from My Applications in the portal.'
      });
      return { subject, body: baseEmailHtml('Application Received', contentHtml) };
    }

    case 'HR_CANDIDATE_REGISTERED': {
      const subject = `Your application & candidate portal access — ${data['jobTitle'] || 'Job'}`;
      const detailsTableHtml =
        `<table width='100%' cellpadding='0' cellspacing='0' style='border-collapse:collapse; border:1px solid #E5E7EB; border-radius:10px;'>` +
        row('Requisition ID', data['requisitionId']) +
        row('Job Title', data['jobTitle']) +
        row('Department', data['jobDepartment']) +
        row('Applied On', data['appliedOn']) +
        `</table>` +
        `<p style='margin-top:18px; font-weight:700; color:#111827;'>Candidate portal login</p>` +
        `<table width='100%' cellpadding='0' cellspacing='0' style='border-collapse:collapse; border:1px solid #BFDBFE; border-radius:10px; background:#EFF6FF;'>` +
        row('Login URL', data['loginUrl']) +
        row('Username (email)', data['portalEmail']) +
        row('Temporary password', data['portalPassword']) +
        `</table>`;
      const contentHtml = standardMailContent({
        name: data['candidateName'],
        introLines: [
          'Your profile has been registered and an application has been submitted on your behalf for the role below.',
          'Use the credentials below to sign in to the <b>Candidate Portal</b>. You can change your password after login.'
        ],
        detailsTableHtml,
        noteLine: 'Please change your password after your first login for security.'
      });
      return { subject, body: baseEmailHtml('Application & Portal Access', contentHtml) };
    }

    case 'CANDIDATE_SHORTLISTED': {
      const subject = `Shortlisted: ${data['jobTitle'] || 'Job'}`;
      const detailsTableHtml =
        `<table width='100%' cellpadding='0' cellspacing='0' style='border-collapse:collapse; border:1px solid #E5E7EB; border-radius:10px;'>` +
        row('Requisition ID', data['requisitionId']) +
        row('Job Title', data['jobTitle']) +
        `</table>`;
      const contentHtml = standardMailContent({
        name: data['candidateName'],
        introLines: ['Congratulations! You have been <b>shortlisted</b> for:'],
        detailsTableHtml,
        noteLine: 'Next steps will be shared shortly. Please keep an eye on your portal.'
      });
      return { subject, body: baseEmailHtml('Shortlisted', contentHtml) };
    }

    case 'CANDIDATE_REJECTED': {
      const subject = `Update: ${data['jobTitle'] || 'Job'} application`;
      const detailsTableHtml =
        `<table width='100%' cellpadding='0' cellspacing='0' style='border-collapse:collapse; border:1px solid #E5E7EB; border-radius:10px;'>` +
        row('Requisition ID', data['requisitionId']) +
        row('Job Title', data['jobTitle']) +
        row('Reason', data['rejectionReason']) +
        `</table>`;
      const contentHtml = standardMailContent({
        name: data['candidateName'],
        introLines: [
          'Thank you for your interest. We regret to inform you that we cannot proceed further with your application for:'
        ],
        detailsTableHtml,
        noteLine: 'We appreciate your effort and encourage you to apply for future openings.'
      });
      return { subject, body: baseEmailHtml('Application Update', contentHtml) };
    }

    case 'INTERVIEW_SCHEDULED':
    case 'NEXT_INTERVIEW_SCHEDULED': {
      const subject = `Interview scheduled: ${data['jobTitle'] || 'Job'}`;
      const whenLine = data['scheduledFor'] ? ` on <b>${escapeHtml(data['scheduledFor'])}</b>` : '';
      const recipientName = data['recipientName'] || data['candidateName'] || 'Candidate';
      const detailsTableHtml =
        `<table width='100%' cellpadding='0' cellspacing='0' style='border-collapse:collapse; border:1px solid #E5E7EB; border-radius:10px;'>` +
        row('Requisition ID', data['requisitionId']) +
        row('Job Title', data['jobTitle']) +
        row('Interview Round', data['roundNumber']) +
        row('Meeting Link', data['meetingLink']) +
        `</table>`;
      const contentHtml = standardMailContent({
        name: recipientName,
        introLines: [`Your <b>${escapeHtml(data['interviewType'])}</b> interview has been scheduled${whenLine}.`],
        detailsTableHtml,
        noteLine: 'Please check the portal for interview details and be available on time.'
      });
      return { subject, body: baseEmailHtml('Interview Scheduled', contentHtml) };
    }

    case 'OFFER_SENT': {
      const subject = `Offer letter available: ${data['jobTitle'] || 'Job'}`;
      const detailsTableHtml =
        `<table width='100%' cellpadding='0' cellspacing='0' style='border-collapse:collapse; border:1px solid #E5E7EB; border-radius:10px;'>` +
        row('Job Title', data['jobTitle']) +
        row('Offered Salary', data['offeredSalary']) +
        row('Currency', data['salaryCurrency']) +
        row('Joining Date', data['joiningDate']) +
        row('Offer Expiry', data['expirationDate']) +
        `</table>`;
      const contentHtml = standardMailContent({
        name: data['candidateName'],
        introLines: ['We are pleased to share your <b>offer letter</b> for:'],
        detailsTableHtml,
        noteLine: 'Please review and respond to the offer in the portal.'
      });
      return { subject, body: baseEmailHtml('Offer Letter Sent', contentHtml) };
    }

    case 'OFFER_ACCEPTED': {
      const subject = `Offer accepted: ${data['jobTitle'] || 'Job'}`;
      const detailsTableHtml =
        `<table width='100%' cellpadding='0' cellspacing='0' style='border-collapse:collapse; border:1px solid #E5E7EB; border-radius:10px;'>` +
        row('Candidate', data['candidateName']) +
        row('Job Title', data['jobTitle']) +
        row('Joining Date', data['joiningDate']) +
        `</table>`;
      const contentHtml = standardMailContent({
        name: data['recipientName'] || 'User',
        introLines: ['The candidate has <b>accepted</b> the offer for:'],
        detailsTableHtml
      });
      return { subject, body: baseEmailHtml('Offer Accepted', contentHtml) };
    }

    case 'OFFER_REJECTED': {
      const subject = `Offer rejected: ${data['jobTitle'] || 'Job'}`;
      const detailsTableHtml =
        `<table width='100%' cellpadding='0' cellspacing='0' style='border-collapse:collapse; border:1px solid #E5E7EB; border-radius:10px;'>` +
        row('Candidate', data['candidateName']) +
        row('Job Title', data['jobTitle']) +
        row('Rejection Reason', data['rejectionReason']) +
        `</table>`;
      const contentHtml = standardMailContent({
        name: data['recipientName'] || 'User',
        introLines: ['The candidate has <b>rejected</b> the offer for:'],
        detailsTableHtml
      });
      return { subject, body: baseEmailHtml('Offer Rejected', contentHtml) };
    }

    case 'OFFER_ARGUED':
    case 'OFFER_NEGOTIATED': {
      const subject = `Offer negotiated for review: ${data['jobTitle'] || 'Job'}`;
      const detailsTableHtml =
        `<table width='100%' cellpadding='0' cellspacing='0' style='border-collapse:collapse; border:1px solid #E5E7EB; border-radius:10px;'>` +
        row('Candidate', data['candidateName']) +
        row('Job Title', data['jobTitle']) +
        `</table>`;
      const contentHtml = standardMailContent({
        name: data['recipientName'] || 'User',
        introLines: ['The candidate has submitted an <b>offer negotiation request</b> for review.'],
        detailsTableHtml,
        noteLine: 'HR will review and provide the final outcome.'
      });
      return { subject, body: baseEmailHtml('Offer Negotiated', contentHtml) };
    }

    case 'MANDATORY_DOCUMENTS_REQUESTED': {
      const subject = `Action Required: Please upload mandatory documents — ${data['jobTitle'] || 'Job'}`;
      const contentHtml = standardMailContent({
        name: data['candidateName'],
        introLines: [
          'HR has requested you to upload the <b>mandatory documents</b> required for your onboarding process.',
          'Please log in to the <b>Candidate Portal</b> and visit the <b>Inbox</b> or <b>My Applications</b> section to upload the following:',
          '<ul><li>Offer Letter E-Sign</li><li>Aadhar Card</li><li>PAN Card</li><li>Last Salary Slip</li></ul>'
        ],
        ctaUrl: data['portalUrl'],
        ctaText: 'Go to Candidate Portal',
        noteLine: 'Completing this step promptly will help accelerate your onboarding.'
      });
      return { subject, body: baseEmailHtml('Document Upload Request', contentHtml) };
    }

    default: {
      const subject = 'Notification';
      const body = baseEmailHtml('Notification', '<p>Mail template not implemented for this event.</p>');
      return { subject, body };
    }
  }
}

