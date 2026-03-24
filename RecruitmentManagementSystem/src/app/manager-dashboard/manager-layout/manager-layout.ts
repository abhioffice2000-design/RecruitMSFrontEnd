import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { ManagerSidebar } from '../manager-sidebar/manager-sidebar';
import { HeaderComponent } from '../../layout/header/header.component';

@Component({
  selector: 'app-manager-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, ManagerSidebar, HeaderComponent],
  templateUrl: './manager-layout.html',
  styleUrls: ['./manager-layout.css', '../../hr-dashboard/hr-dashboard.scss'],
})
export class ManagerLayout implements OnInit, OnDestroy {
  sidebarCollapsed = false;
  mobileNavOpen = false;
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

  onSidebarToggle() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }
}
