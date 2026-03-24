import { Injectable } from '@angular/core';
import { UserProfile, Job, Application, Interview } from '../models/job.model';

@Injectable({
  providedIn: 'root'
})
export class MockDataService {
  private user: UserProfile = {
    id: 1,
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    role: 'candidate',
    profileImage: '',
    location: 'San Francisco, CA',
    about: 'Experienced software developer with 5+ years in web technologies.',
    skills: ['Angular', 'TypeScript', 'Node.js', 'React'],
    title: 'Senior Frontend Developer',
    profileCompletion: 85
  };

  private jobs: Job[] = [
    {
      id: 1,
      title: 'Senior Frontend Developer',
      company: 'Tech Corp',
      location: 'San Francisco, CA',
      type: 'Full-time',
      department: 'Engineering',
      experienceLevel: '5+ years',
      salary: '$120k - $150k',
      postedDate: '2026-03-10',
      description: 'We are looking for an experienced Frontend Developer to join our team and build modern web applications using Angular and TypeScript.',
      isSaved: false,
      applicants: 45,
      skills: ['Angular', 'TypeScript', 'RxJS', 'REST APIs', 'Material Design'],
      companyType: 'Public',
      companySize: '1000+',
      responsibilities: [
        'Design and develop user interfaces in Angular',
        'Collaborate with backend developers',
        'Optimize components for performance',
        'Write unit tests and maintain documentation'
      ],
      requirements: ['5+ years Angular', 'TypeScript', 'REST APIs'],
      benefits: ['Health Insurance', 'Remote Work Options', '401(k) Match', 'Professional Development']
    },
    {
      id: 2,
      title: 'Full Stack Developer',
      company: 'StartUp Inc',
      location: 'Remote',
      type: 'Full-time',
      department: 'Engineering',
      experienceLevel: '3-5 years',
      salary: '$80k - $110k',
      postedDate: '2026-03-12',
      description: 'Looking for a Full Stack Developer with Node.js and Angular experience to build scalable web applications.',
      isSaved: true,
      applicants: 62,
      skills: ['Angular', 'Node.js', 'MongoDB', 'AWS', 'Docker'],
      companyType: 'Private',
      companySize: '100-500',
      responsibilities: [
        'Build scalable web applications',
        'Develop both frontend and backend features',
        'Manage databases and APIs',
        'Deploy and maintain cloud infrastructure'
      ],
      requirements: ['Angular', 'Node.js', 'MongoDB', 'AWS'],
      benefits: ['Equity', 'Flexible Working Hours', 'Lunch & Learn Sessions', 'Stock Options']
    },
    {
      id: 3,
      title: 'UI/UX Designer',
      company: 'Design Studio',
      location: 'New York, NY',
      type: 'Contract',
      department: 'Design',
      experienceLevel: '3-5 years',
      salary: '$90k - $120k',
      postedDate: '2026-03-14',
      description: 'Seeking a creative UI/UX Designer to join our dynamic team. You will be responsible for creating intuitive and engaging user experiences.',
      isSaved: false,
      applicants: 28,
      skills: ['Figma', 'Prototyping', 'User Research', 'Wireframing', 'Design Systems'],
      companyType: 'Private',
      companySize: '50-100',
      responsibilities: [
        'Create user-centered design solutions',
        'Conduct user research and testing',
        'Develop prototypes and wireframes',
        'Collaborate with developers and stakeholders'
      ],
      requirements: ['Figma', 'User Research', 'Prototyping'],
      benefits: ['Creative Environment', 'Design Tools Budget', 'Health & Wellness', 'Conference Attendance']
    }
  ];

  private applications: Application[] = [
    {
      id: 1,
      jobId: 1,
      jobTitle: 'Senior Frontend Developer',
      company: 'Tech Corp',
      status: 'Interview',
      appliedDate: '2026-03-15',
      nextStep: 'Technical Interview',
      location: 'San Francisco, CA',
      type: 'Full-time'
    },
    {
      id: 2,
      jobId: 2,
      jobTitle: 'Full Stack Developer',
      company: 'StartUp Inc',
      status: 'Screening',
      appliedDate: '2026-03-12',
      location: 'Remote',
      type: 'Full-time'
    },
    {
      id: 3,
      jobId: 3,
      jobTitle: 'UI/UX Designer',
      company: 'Design Studio',
      status: 'Rejected',
      appliedDate: '2026-03-08',
      location: 'New York, NY',
      type: 'Contract'
    },
    {
      id: 4,
      jobId: 1,
      jobTitle: 'Senior Frontend Developer',
      company: 'Tech Corp',
      status: 'Offer',
      appliedDate: '2026-02-28',
      nextStep: 'Offer Review',
      location: 'San Francisco, CA',
      type: 'Full-time'
    }
  ];

  private interviews: Interview[] = [
    {
      id: 1,
      jobTitle: 'Senior Frontend Developer',
      company: 'Tech Corp',
      date: '2026-03-22',
      time: '10:00 AM',
      type: 'Technical',
      interviewer: 'Sarah Johnson',
      status: 'scheduled',
      meetingLink: 'https://meet.google.com/abc-defg-hij'
    },
    {
      id: 2,
      jobTitle: 'Senior Frontend Developer',
      company: 'Tech Corp',
      date: '2026-03-28',
      time: '2:00 PM',
      type: 'HR',
      interviewer: 'Emily Chen',
      status: 'scheduled',
      meetingLink: 'https://meet.google.com/klm-nopq-rst'
    }
  ];

  constructor() {}

  getUser(): UserProfile { return this.user; }

  getJobs(): Job[] { return this.jobs; }

  getJobById(id: number): Job | undefined {
    return this.jobs.find(job => job.id === id);
  }

  getApplications(): Application[] { return this.applications; }

  getInterviews(): Interview[] { return this.interviews; }

  getApplicationStats() {
    return {
      applied: this.applications.length,
      screening: this.applications.filter(a => a.status === 'Screening').length,
      interview: this.applications.filter(a => a.status === 'Interview').length,
      offer: this.applications.filter(a => a.status === 'Offer').length,
      rejected: this.applications.filter(a => a.status === 'Rejected').length
    };
  }

  searchJobs(filters: any): Job[] {
    return this.jobs.filter(job => {
      const queryMatch = !filters.query ||
        job.title.toLowerCase().includes(filters.query.toLowerCase()) ||
        job.company.toLowerCase().includes(filters.query.toLowerCase());
      const locationMatch = !filters.location ||
        job.location.toLowerCase().includes(filters.location.toLowerCase());
      const deptMatch = !filters.department || job.department === filters.department;
      const expMatch = !filters.experienceLevel || job.experienceLevel === filters.experienceLevel;
      const typeMatch = !filters.type || job.type === filters.type;
      return queryMatch && locationMatch && deptMatch && expMatch && typeMatch;
    });
  }

  toggleSaveJob(jobId: number): void {
    const job = this.jobs.find(j => j.id === jobId);
    if (job) job.isSaved = !job.isSaved;
  }

  getSavedJobs(): Job[] {
    return this.jobs.filter(j => j.isSaved);
  }

  applyToJob(jobId: number): boolean {
    const job = this.jobs.find(j => j.id === jobId);
    if (!job) return false;
    this.applications.push({
      id: Date.now(),
      jobId: jobId,
      jobTitle: job.title,
      company: job.company,
      status: 'Applied',
      appliedDate: new Date().toISOString().split('T')[0],
      location: job.location,
      type: job.type
    });
    return true;
  }
}
