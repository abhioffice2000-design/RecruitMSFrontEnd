import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService, ThemeMode } from '../../services/theme.service';

/**
 * Segmented Light / Dark control. Uses global `.app-theme-toggle` styles in `styles.scss`.
 */
@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="app-theme-toggle"
      [class.app-theme-toggle--compact]="compact"
      role="group"
      aria-label="Color theme"
    >
      <button
        type="button"
        class="app-theme-toggle__btn"
        [class.is-active]="theme.mode() === 'light'"
        (click)="pick('light')"
        title="Light mode"
        [attr.aria-pressed]="theme.mode() === 'light'"
      >
        <i class="fas fa-sun" aria-hidden="true"></i>
        <span *ngIf="!compact" class="app-theme-toggle__label">Light</span>
      </button>
      <button
        type="button"
        class="app-theme-toggle__btn"
        [class.is-active]="theme.mode() === 'dark'"
        (click)="pick('dark')"
        title="Dark mode"
        [attr.aria-pressed]="theme.mode() === 'dark'"
      >
        <i class="fas fa-moon" aria-hidden="true"></i>
        <span *ngIf="!compact" class="app-theme-toggle__label">Dark</span>
      </button>
    </div>
  `
})
export class ThemeToggleComponent {
  @Input() compact = false;

  constructor(public theme: ThemeService) {}

  pick(mode: ThemeMode): void {
    this.theme.setTheme(mode);
  }
}
