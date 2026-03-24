import { Component, Input, Output, EventEmitter } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ThemeToggleComponent } from '../../shared/theme-toggle/theme-toggle.component';
import { ThemeService } from '../../services/theme.service';

declare var $: any;

@Component({
  selector: 'app-manager-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule, ThemeToggleComponent],
  templateUrl: './manager-sidebar.html',
  styleUrls: ['../../hr-dashboard/hr-dashboard.scss', './manager-sidebar.css'],
})
export class ManagerSidebar {
  @Input() isCollapsed = false;
  @Output() toggle = new EventEmitter<void>();

  toggleCollapse() {
    this.toggle.emit();
  }
  trackByPath(index: number, item: any): string {
    return item.path;
  }
  navItems = [
    { label: 'Dashboard', path: '/manager/dashboard', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    { label: 'Job Requests', path: '/manager/requests', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
    { label: 'Manage Delegates', path: '/manager/delegates', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' }
  ];

  logout() {
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
    const paths = ['/', '', '/login', '/manager'];
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
