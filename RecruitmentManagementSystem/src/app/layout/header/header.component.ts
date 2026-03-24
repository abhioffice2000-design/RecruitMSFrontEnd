import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit {
  /** Adnate logo (same asset as home page), links to /home */
  @Input() showLogo: boolean = true;
  /** User avatar on the right */
  @Input() showUser: boolean = true;

  user = {
    name: 'User',
    role: '',
    avatar: ''
  };

  ngOnInit(): void {
    this.refreshUserFromSession();
  }

  /** Call after navigation if needed */
  refreshUserFromSession(): void {
    const email =
      (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('loggedInUser')) ||
      (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('loggedInUserEmail')) ||
      '';
    const local = (email.split('@')[0] || 'User').replace(/[._]+/g, ' ').trim();
    const name =
      local.length > 0
        ? local.replace(/\b\w/g, c => c.toUpperCase())
        : 'User';

    this.user = {
      name: email ? name : 'User',
      role: '',
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=2563eb&color=fff&size=128`
    };
  }
}
