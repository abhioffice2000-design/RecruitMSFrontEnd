import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { guestGuard } from './guards/guest.guard';
import { roleGuard } from './guards/role.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
  {
    path: 'home',
    loadComponent: () =>
      import('./home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./login/login.component').then((m) => m.LoginComponent),
    canActivate: [guestGuard],
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./register/register.component').then((m) => m.RegisterComponent),
    canActivate: [guestGuard],
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./forgot-password/forgot-password.component').then((m) => m.ForgotPasswordComponent),
    canActivate: [guestGuard],
  },
  {
    path: 'admin',
    loadComponent: () =>
      import('./admin-dashboard/admin-layout/admin-layout.component').then((m) => m.Admin_LayoutComponent),
    canActivate: [authGuard, roleGuard(['ADMIN_RMST1'])],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./admin-dashboard/admin-dashboard').then((m) => m.AdminDashboard),
      },
      {
        path: 'candidates',
        loadComponent: () =>
          import('./admin-dashboard/candidates/candidates.component').then((m) => m.CandidatesComponent),
      },
      {
        path: 'jobs',
        loadComponent: () =>
          import('./admin-dashboard/jobs/jobs.component').then((m) => m.JobsComponent),
      },
      {
        path: 'interviews',
        loadComponent: () =>
          import('./admin-dashboard/interviews/interviews.component').then((m) => m.InterviewsComponent),
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./admin-dashboard/user-management/user-management').then((m) => m.UserManagement),
      }
    ]
  },
  {
    path: 'candidate',
    loadComponent: () =>
      import('./candidate-portal/candidate-portal').then((m) => m.CandidatePortal),
    canActivate: [authGuard, roleGuard(['CANDIDATE_RMST1'])],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./candidate-portal/pages/candidate-dashboard/candidate-dashboard.component').then(m => m.CandidateDashboardComponent),
      },
      {
        path: 'inbox',
        loadComponent: () =>
          import('./candidate-portal/pages/candidate-inbox/candidate-inbox.component').then(m => m.CandidateInboxComponent),
      },
      {
        path: 'jobs',
        loadComponent: () =>
          import('./candidate-portal/pages/candidate-job-search/candidate-job-search.component').then(m => m.CandidateJobSearchComponent),
      },
      {
        path: 'jobs/:id/apply',
        loadComponent: () =>
          import('./candidate-portal/pages/candidate-apply-job/candidate-apply-job.component').then(m => m.CandidateApplyJobComponent),
      },
      {
        path: 'applications',
        loadComponent: () =>
          import('./candidate-portal/pages/candidate-applications/candidate-applications.component').then(m => m.CandidateApplicationsComponent),
      },
      {
        path: 'interviews',
        loadComponent: () =>
          import('./candidate-portal/pages/candidate-interviews/candidate-interviews.component').then(m => m.CandidateInterviewsComponent),
      },
    ]
  },
  {
    path: 'hr',
    loadComponent: () =>
      import('./hr-dashboard/hr-dashboard').then((m) => m.HrDashboard),
    canActivate: [authGuard, roleGuard(['HR_RMST1'])],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: () => import('./hr-dashboard/dashboard-tab/dashboard-tab').then(m => m.DashboardTab) },
      { path: 'inbox', loadComponent: () => import('./hr-dashboard/inbox/inbox').then(m => m.InboxTab) },
      { path: 'calendar', loadComponent: () => import('./hr-dashboard/calendar/calendar').then(m => m.CalendarTab) },
      { path: 'jobs', loadComponent: () => import('./hr-dashboard/jobs/jobs').then(m => m.JobsTab) },
      { path: 'candidates', loadComponent: () => import('./hr-dashboard/candidates/candidates').then(m => m.CandidatesTab) },
      { path: 'pipeline', loadComponent: () => import('./hr-dashboard/pipeline-board/pipeline-board').then(m => m.PipelineBoardComponent) },
      { path: 'offers', loadComponent: () => import('./hr-dashboard/offers/offers').then(m => m.OffersTab) },
      { path: 'referrals', loadComponent: () => import('./hr-dashboard/referrals/referrals').then(m => m.ReferralsTab) },
      { path: 'report', loadComponent: () => import('./hr-dashboard/report/report').then(m => m.ReportTab) },
      { path: 'settings', loadComponent: () => import('./hr-dashboard/settings/settings').then(m => m.SettingsTab) },
    ]
  },
  {
    path: 'interviewer',
    loadComponent: () =>
      import('./interviewer-portal/interviewer-portal').then((m) => m.InterviewerPortal),
    canActivate: [authGuard, roleGuard(['INTERVIEWER_RMST1'])],
  },
  {
    path: 'manager',
    loadComponent: () =>
      import('./manager-dashboard/manager-layout/manager-layout').then((m) => m.ManagerLayout),
    canActivate: [authGuard, roleGuard(['MANAGER_RMST1'])],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./manager-dashboard/manager-dashboard').then((m) => m.ManagerDashboard),
      },
      {
        path: 'team',
        loadComponent: () =>
          import('./manager-dashboard/manager-team/manager-team').then((m) => m.ManagerTeam),
      },
      {
        path: 'requests',
        loadComponent: () =>
          import('./manager-dashboard/manager-jobs/manager-jobs').then((m) => m.ManagerJobs),
      },
      {
        path: 'interviews',
        loadComponent: () =>
          import('./manager-dashboard/manager-interviews/manager-interviews').then((m) => m.ManagerInterviews),
      },
      {
        path: 'delegates',
        loadComponent: () =>
          import('./manager-dashboard/manager-delegates/manager-delegates').then((m) => m.ManagerDelegates),
      }
    ]
  },
];
