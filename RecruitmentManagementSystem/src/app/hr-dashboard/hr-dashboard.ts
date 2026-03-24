import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  RouterOutlet,
  RouterLink,
  RouterLinkActive,
  Router,
  NavigationEnd,
} from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { ThemeToggleComponent } from '../shared/theme-toggle/theme-toggle.component';
import { ThemeService } from '../services/theme.service';
import { HeaderComponent } from '../layout/header/header.component';

declare var $: any;

@Component({
  selector: 'app-hr-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    ThemeToggleComponent,
    HeaderComponent,
  ],
  templateUrl: './hr-dashboard.html',
  styleUrls: ['./hr-dashboard.scss'],
})
export class HrDashboard implements OnInit, OnDestroy {
  /** Mobile overlay nav (viewport &lt; ~992px) */
  mobileNavOpen = false;
  sidebarCollapsed = false;
  private navSub?: Subscription;

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.navSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => {
        this.mobileNavOpen = false;
      });
  }

  ngOnDestroy(): void {
    this.navSub?.unsubscribe();
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  // ===========================
  // LOGOUT
  // ===========================
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
    const paths = ['/', '', '/login', '/hr'];

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
