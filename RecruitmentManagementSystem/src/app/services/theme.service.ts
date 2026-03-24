import { Injectable, signal, computed } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

/**
 * Global light/dark theme persisted in localStorage (`rms_theme`).
 * Survives `localStorage.clear()` during logout via `preserveTheme()`.
 */
@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  static readonly STORAGE_KEY = 'rms_theme';

  /** Current UI mode (also mirrored on `document.documentElement[data-theme]`). */
  private readonly _mode = signal<ThemeMode>('light');

  /** Use in templates: `themeService.mode()` */
  readonly mode = this._mode.asReadonly();

  readonly isDark = computed(() => this._mode() === 'dark');

  constructor() {
    this.applyFromStorage();
  }

  /**
   * Idempotent init (e.g. APP_INITIALIZER).
   */
  init(): void {
    this.applyFromStorage();
  }

  private applyFromStorage(): void {
    let stored: ThemeMode = 'light';
    try {
      const raw = localStorage.getItem(ThemeService.STORAGE_KEY);
      if (raw === 'dark' || raw === 'light') {
        stored = raw;
      }
    } catch {
      /* private mode */
    }
    this._mode.set(stored);
    document.documentElement.setAttribute('data-theme', stored);
  }

  setTheme(mode: ThemeMode): void {
    this._mode.set(mode);
    document.documentElement.setAttribute('data-theme', mode);
    try {
      localStorage.setItem(ThemeService.STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  }

  toggle(): void {
    this.setTheme(this._mode() === 'dark' ? 'light' : 'dark');
  }

  /**
   * Wrap logout flows that call `localStorage.clear()` so theme choice is kept.
   */
  static preserveTheme(run: () => void): void {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(ThemeService.STORAGE_KEY);
    } catch {
      /* ignore */
    }
    try {
      run();
    } finally {
      if (saved === 'light' || saved === 'dark') {
        try {
          localStorage.setItem(ThemeService.STORAGE_KEY, saved);
        } catch {
          /* ignore */
        }
      }
    }
  }
}
