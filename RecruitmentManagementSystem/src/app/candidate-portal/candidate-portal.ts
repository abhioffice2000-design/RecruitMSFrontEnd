import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { ThemeToggleComponent } from '../shared/theme-toggle/theme-toggle.component';
import { ThemeService } from '../services/theme.service';
import { HeaderComponent } from '../layout/header/header.component';

declare var $: any;

@Component({
  selector: 'app-candidate-portal',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    ThemeToggleComponent,
    HeaderComponent,
  ],
  templateUrl: './candidate-portal.html',
  styleUrls: ['./candidate-portal.scss', '../hr-dashboard/hr-dashboard.scss'],
})
export class CandidatePortal implements OnInit, OnDestroy {
  sidebarCollapsed = false;
  /** Mobile overlay sidebar (narrow screens) */
  mobileNavOpen = false;
  showHeader = true;
  private routerEventsSub?: Subscription;

  navItems = [
    { route: 'dashboard', label: 'Dashboard', icon: 'fas fa-th-large' },
    { route: 'inbox', label: 'Inbox', icon: 'fas fa-envelope' },
    { route: 'jobs', label: 'Browse Jobs', icon: 'fas fa-search' },
    { route: 'applications', label: 'My Applications', icon: 'fas fa-file-alt' },
    { route: 'interviews', label: 'My Interviews', icon: 'fas fa-video' },
  ];

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.updateHeaderSearch(this.router.url);
    this.routerEventsSub = this.router.events.subscribe((ev) => {
      if (ev instanceof NavigationEnd) {
        this.mobileNavOpen = false;
        this.updateHeaderSearch(ev.urlAfterRedirects);
      }
    });
  }

  ngOnDestroy(): void {
    this.routerEventsSub?.unsubscribe();
  }

  private updateHeaderSearch(url: string): void {
    const clean = (url || '').split('#')[0].split('?')[0];
    const isBrowseJobs = /^\/candidate\/jobs\/?$/.test(clean);
    const isMyApplications = /^\/candidate\/applications\/?$/.test(clean);
    const hideHeader = isBrowseJobs || isMyApplications;
    this.showHeader = !hideHeader;
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
    const paths = ['/', '', '/login', '/candidate'];
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
}
