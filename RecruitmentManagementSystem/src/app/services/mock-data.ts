export const MOCK_DEPARTMENTS = [
  { department_id: 'D01', department_name: 'Engineering', manager_id: 'U01' },
  { department_id: 'D02', department_name: 'Human Resources', manager_id: 'U02' },
  { department_id: 'D03', department_name: 'Marketing', manager_id: 'U03' },
  { department_id: 'D04', department_name: 'Sales', manager_id: 'U04' },
];

export const MOCK_DELEGATES = [
  { manager_id: 'U01', delegate_ids: ['U02'] }
];

export const MOCK_PIPELINE_STAGES = [
  { stage_id: 'S1', stage_name: 'Applied', stage_order: '1' },
  { stage_id: 'S2', stage_name: 'Screening', stage_order: '2' },
  { stage_id: 'S3', stage_name: 'Interview', stage_order: '3' },
  { stage_id: 'S4', stage_name: 'Offer', stage_order: '4' },
  { stage_id: 'S5', stage_name: 'Hired', stage_order: '5' },
];

export const MOCK_SKILLS = [
  { skill_id: 'SK1', skill_name: 'Angular', description: 'Angular Framework' },
  { skill_id: 'SK2', skill_name: 'TypeScript', description: 'TypeScript Language' },
  { skill_id: 'SK3', skill_name: 'Node.js', description: 'Node.js Backend' },
  { skill_id: 'SK4', skill_name: 'UI/UX Design', description: 'Figma, Sketch' },
  { skill_id: 'SK5', skill_name: 'Salesforce', description: 'Salesforce CRM' },
  { skill_id: 'SK6', skill_name: 'Python', description: 'Python Language' },
  { skill_id: 'SK7', skill_name: 'React', description: 'React Framework' },
];

export const MOCK_JOB_REQUISITIONS = [
  {
    requisition_id: 'REQ-101', title: 'Senior Frontend Developer', department_id: 'D01',
    description: 'Looking for an experienced Angular developer to lead our frontend team with high performance and scalable architectural patterns.',
    experience_min: '5', experience_max: '8', salary_min: '18', salary_max: '25', salary_currency: 'LPA',
    open_positions: '2', status: 'APPROVED', posting_source: 'LinkedIn, Internal', created_by_user: 'U01',
    created_at: new Date(Date.now() - 3 * 86400000).toISOString()
  },
  {
    requisition_id: 'REQ-102', title: 'HR Manager', department_id: 'D02',
    description: 'Seeking an HR Manager to handle employee relations, recruitment strategies, and compliance.',
    experience_min: '4', experience_max: '7', salary_min: '12', salary_max: '18', salary_currency: 'LPA',
    open_positions: '1', status: 'APPROVED', posting_source: 'Indeed', created_by_user: 'U02',
    created_at: new Date(Date.now() - 5 * 86400000).toISOString()
  },
  {
    requisition_id: 'REQ-103', title: 'Product Marketing Specialist', department_id: 'D03',
    description: 'We need a creative marketer to drive product campaigns and go-to-market strategies.',
    experience_min: '2', experience_max: '5', salary_min: '8', salary_max: '14', salary_currency: 'LPA',
    open_positions: '3', status: 'PENDING', posting_source: 'Internal', created_by_user: 'U03',
    created_at: new Date(Date.now() - 1 * 86400000).toISOString()
  },
  {
    requisition_id: 'REQ-104', title: 'Backend Node.js Engineer', department_id: 'D01',
    description: 'Join our backend team to build scalable microservices using Node.js and Express.',
    experience_min: '3', experience_max: '6', salary_min: '15', salary_max: '22', salary_currency: 'LPA',
    open_positions: '4', status: 'APPROVED', posting_source: 'Career Portal', created_by_user: 'U01',
    created_at: new Date(Date.now() - 10 * 86400000).toISOString()
  }
];

export const MOCK_USERS = [
  { User_id: 'U01', First_name: 'Alice', Last_name: 'Engineer', Department_id: 'D01', Email: 'alice@example.com', Role: 'MANAGER' },
  { User_id: 'U02', First_name: 'Bob', Last_name: 'HR', Department_id: 'D02', Email: 'bob@example.com', Role: 'MANAGER' },
  { User_id: 'U03', First_name: 'Charlie', Last_name: 'Market', Department_id: 'D03', Email: 'charlie@example.com', Role: 'MANAGER' }
];

export const MOCK_APPROVALS = [
  {
    approval_id: 'APP-01', entity_type: 'Job Requisition', entity_id: 'REQ-103',
    status: 'PENDING', requested_by: 'U03', comments: 'Please approve this new marketing role.',
    requested_at: new Date().toISOString(), approved_at: '', approved_by: ''
  }
];

export const MOCK_JOB_SKILLS = [
  { requisition_id: 'REQ-101', skill_id: 'SK1', required_level: 'Expert', skill_name: 'Angular' },
  { requisition_id: 'REQ-101', skill_id: 'SK2', required_level: 'Advanced', skill_name: 'TypeScript' },
  { requisition_id: 'REQ-104', skill_id: 'SK3', required_level: 'Expert', skill_name: 'Node.js' },
  { requisition_id: 'REQ-102', skill_id: 'SK5', required_level: 'Intermediate', skill_name: 'Salesforce' },
];

export const MOCK_CANDIDATES = [
  { candidate_id: 'CAN-001', first_name: 'John', last_name: 'Doe', email: 'john.doe@example.com', phone: '+91 98765 43210', location: 'Mumbai', experience_years: '6', linkedin_url: '' },
  { candidate_id: 'CAN-002', first_name: 'Jane', last_name: 'Smith', email: 'jane.smith@example.com', phone: '+91 87654 32109', location: 'Bangalore', experience_years: '4', linkedin_url: '' },
  { candidate_id: 'CAN-003', first_name: 'Mike', last_name: 'Johnson', email: 'mike.j@example.com', phone: '+91 76543 21098', location: 'Delhi', experience_years: '2', linkedin_url: '' },
  { candidate_id: 'CAN-004', first_name: 'Sarah', last_name: 'Williams', email: 'sarah.w@example.com', phone: '+91 65432 10987', location: 'Hyderabad', experience_years: '5', linkedin_url: '' },
  { candidate_id: 'CAN-005', first_name: 'Rahul', last_name: 'Sharma', email: 'rahul.s@example.com', phone: '+91 54321 09876', location: 'Pune', experience_years: '7', linkedin_url: '' },
  { candidate_id: 'CAN-006', first_name: 'Priya', last_name: 'Patel', email: 'priya.p@example.com', phone: '+91 43210 98765', location: 'Chennai', experience_years: '3', linkedin_url: '' },
];

export const MOCK_CANDIDATE_SKILLS = [
  { candidate_id: 'CAN-001', skill_id: 'SK1', experience_years: '5' },
  { candidate_id: 'CAN-001', skill_id: 'SK2', experience_years: '6' },
  { candidate_id: 'CAN-002', skill_id: 'SK3', experience_years: '4' },
  { candidate_id: 'CAN-003', skill_id: 'SK7', experience_years: '2' },
  { candidate_id: 'CAN-004', skill_id: 'SK1', experience_years: '3' },
  { candidate_id: 'CAN-004', skill_id: 'SK6', experience_years: '4' },
  { candidate_id: 'CAN-005', skill_id: 'SK1', experience_years: '6' },
  { candidate_id: 'CAN-005', skill_id: 'SK2', experience_years: '7' },
  { candidate_id: 'CAN-005', skill_id: 'SK3', experience_years: '5' },
  { candidate_id: 'CAN-006', skill_id: 'SK5', experience_years: '3' },
];

export const MOCK_APPLICATIONS = [
  // REQ-101: Senior Frontend Developer (3 active candidates + 1 hired)
  { application_id: 'APP-1001', candidate_id: 'CAN-001', requisition_id: 'REQ-101', source: 'LinkedIn', current_stage_id: 'S3', status: 'ACTIVE', applied_at: new Date(Date.now() - 5 * 86400000).toISOString(), notes: '' },
  { application_id: 'APP-1003', candidate_id: 'CAN-003', requisition_id: 'REQ-101', source: 'Indeed', current_stage_id: 'S1', status: 'ACTIVE', applied_at: new Date(Date.now() - 2 * 86400000).toISOString(), notes: '' },
  { application_id: 'APP-1004', candidate_id: 'CAN-004', requisition_id: 'REQ-101', source: 'Referral', current_stage_id: 'S4', status: 'ACTIVE', applied_at: new Date(Date.now() - 10 * 86400000).toISOString(), notes: '' },
  { application_id: 'APP-1007', candidate_id: 'CAN-005', requisition_id: 'REQ-101', source: 'Internal', current_stage_id: 'S2', status: 'ACTIVE', applied_at: new Date(Date.now() - 7 * 86400000).toISOString(), notes: '' },

  // REQ-104: Backend Node.js Engineer (2 active + 1 hired)
  { application_id: 'APP-1002', candidate_id: 'CAN-002', requisition_id: 'REQ-104', source: 'Career Portal', current_stage_id: 'S2', status: 'ACTIVE', applied_at: new Date(Date.now() - 4 * 86400000).toISOString(), notes: '' },
  { application_id: 'APP-1005', candidate_id: 'CAN-001', requisition_id: 'REQ-104', source: 'LinkedIn', current_stage_id: 'S5', status: 'HIRED', applied_at: new Date(Date.now() - 20 * 86400000).toISOString(), notes: '' },
  { application_id: 'APP-1008', candidate_id: 'CAN-005', requisition_id: 'REQ-104', source: 'Referral', current_stage_id: 'S3', status: 'ACTIVE', applied_at: new Date(Date.now() - 6 * 86400000).toISOString(), notes: '' },

  // REQ-102: HR Manager (2 active)
  { application_id: 'APP-1006', candidate_id: 'CAN-006', requisition_id: 'REQ-102', source: 'Indeed', current_stage_id: 'S1', status: 'ACTIVE', applied_at: new Date(Date.now() - 3 * 86400000).toISOString(), notes: '' },
  { application_id: 'APP-1009', candidate_id: 'CAN-003', requisition_id: 'REQ-102', source: 'Career Portal', current_stage_id: 'S2', status: 'ACTIVE', applied_at: new Date(Date.now() - 8 * 86400000).toISOString(), notes: '' },
];

export const MOCK_OFFERS: Record<string, string>[] = [
  {
    offer_id: 'OFR-001', application_id: 'APP-1004', offered_salary: '22',
    salary_currency: 'LPA', joining_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    expiration_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    status: 'SENT', created_by_user: 'U02',
    created_at: new Date(Date.now() - 2 * 86400000).toISOString()
  },
  {
    offer_id: 'OFR-002', application_id: 'APP-1005', offered_salary: '20',
    salary_currency: 'LPA', joining_date: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
    expiration_date: new Date(Date.now() - 1 * 86400000).toISOString().split('T')[0],
    status: 'ACCEPTED', created_by_user: 'U02',
    created_at: new Date(Date.now() - 10 * 86400000).toISOString()
  },
  {
    offer_id: 'OFR-003', application_id: 'APP-1008', offered_salary: '18',
    salary_currency: 'LPA', joining_date: new Date(Date.now() + 45 * 86400000).toISOString().split('T')[0],
    expiration_date: new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0],
    status: 'DRAFT', created_by_user: 'U02',
    created_at: new Date(Date.now() - 1 * 86400000).toISOString()
  },
];
