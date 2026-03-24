export interface Job {
  id: number;
  title: string;
  company: string;
  location: string;
  type: string;
  department: string;
  experienceLevel: string;
  salary: string;
  postedDate: string;
  description: string;
  isSaved: boolean;
  applicants: number;
  skills: string[];
  companyType: string;
  companySize: string;
  responsibilities: string[];
  requirements: string[];
  benefits: string[];
}

export interface Application {
  id: number;
  jobId: number;
  jobTitle: string;
  company: string;
  status: string;
  appliedDate: string;
  nextStep?: string;
  location: string;
  type: string;
}

export interface Interview {
  id: number;
  jobTitle: string;
  company: string;
  date: string;
  time: string;
  type: string;
  interviewer: string;
  status: string;
  meetingLink?: string;
}

export interface UserProfile {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  profileImage: string;
  location: string;
  about: string;
  skills: string[];
  title: string;
  profileCompletion: number;
}
