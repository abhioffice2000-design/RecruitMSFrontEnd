import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { HeaderComponent } from '../../layout/header/header.component';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, HeaderComponent],
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.css'],
})
export class Admin_LayoutComponent implements OnInit, OnDestroy {
  sidebarCollapsed = false;
  /** Opens sidebar drawer on tablet/phone (see CSS .menu-open) */
  mobileMenuOpen = false;
  private navSub?: Subscription;

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.navSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => {
        this.mobileMenuOpen = false;
      });
  }

  ngOnDestroy(): void {
    this.navSub?.unsubscribe();
  }

  onSidebarToggle() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }
}
