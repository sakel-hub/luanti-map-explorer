import { Injectable, signal, effect } from '@angular/core';
import { safeGetItem, safeSetItem, safeRemoveItem } from '../utils/storage.utils';

export type AppTheme = 'dark' | 'light';

const STORAGE_KEY = 'luanti_theme_v2';
const LEGACY_STORAGE_KEY = 'luanti_theme';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  public readonly theme = signal<AppTheme>(this.loadInitialTheme());

  constructor() {
    this.applyThemeToDOM(this.theme());

    try {
      effect(() => {
        const current = this.theme();
        this.applyThemeToDOM(current);
      });
    } catch {
      // Bypassed if outside injection context
    }
  }

  private loadInitialTheme(): AppTheme {
    // Clear legacy auto-saved theme from previous releases that was erroneously set by light media queries
    const legacy = safeGetItem(LEGACY_STORAGE_KEY);
    if (legacy !== null) {
      safeRemoveItem(LEGACY_STORAGE_KEY);
    }

    const saved = safeGetItem(STORAGE_KEY) as AppTheme | null;
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }

    // Default theme is ALWAYS dark across all platforms (Android, iOS, Desktop)
    return 'dark';
  }

  public toggleTheme(): void {
    this.theme.update(t => {
      const next: AppTheme = t === 'dark' ? 'light' : 'dark';
      this.applyThemeToDOM(next);
      safeSetItem(STORAGE_KEY, next);
      return next;
    });
  }

  public setTheme(theme: AppTheme): void {
    this.applyThemeToDOM(theme);
    safeSetItem(STORAGE_KEY, theme);
    this.theme.set(theme);
  }

  private applyThemeToDOM(theme: AppTheme): void {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }

    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
      themeColorMeta.setAttribute('content', theme === 'dark' ? '#0f172a' : '#f8fafc');
    }
  }
}
