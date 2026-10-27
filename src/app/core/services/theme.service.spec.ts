// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ThemeService } from './theme.service';
import { safeSetItem, safeClearStorage } from '../utils/storage.utils';

describe('ThemeService', () => {
  let themeMeta: HTMLMetaElement;

  beforeEach(() => {
    safeClearStorage();
    document.documentElement.className = '';
    themeMeta = document.createElement('meta');
    themeMeta.setAttribute('name', 'theme-color');
    themeMeta.setAttribute('content', '#0f172a');
    document.head.appendChild(themeMeta);
  });

  afterEach(() => {
    safeClearStorage();
    document.documentElement.className = '';
    themeMeta.remove();
  });

  it('defaults to dark theme on initial load without existing storage', () => {
    const service = new ThemeService();
    expect(service.theme()).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
    expect(themeMeta.getAttribute('content')).toBe('#0f172a');
  });

  it('ignores prefers-color-scheme: light and remains dark by default', () => {
    // Mock matchMedia returning light scheme
    window.matchMedia = ((query: string) => ({
      matches: query.includes('light'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false
    })) as any;

    const service = new ThemeService();
    expect(service.theme()).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('cleans up legacy auto-saved theme from previous release and defaults to dark', () => {
    safeSetItem('luanti_theme', 'light');
    const service = new ThemeService();
    expect(service.theme()).toBe('dark');
    expect(localStorage.getItem('luanti_theme')).toBeNull();
  });

  it('restores explicitly saved user theme from luanti_theme_v2', () => {
    safeSetItem('luanti_theme_v2', 'light');
    const service = new ThemeService();
    expect(service.theme()).toBe('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(themeMeta.getAttribute('content')).toBe('#f8fafc');
  });

  it('toggles theme between dark and light and persists to storage', () => {
    const service = new ThemeService();
    expect(service.theme()).toBe('dark');

    service.toggleTheme();
    expect(service.theme()).toBe('light');
    expect(localStorage.getItem('luanti_theme_v2')).toBe('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(themeMeta.getAttribute('content')).toBe('#f8fafc');

    service.toggleTheme();
    expect(service.theme()).toBe('dark');
    expect(localStorage.getItem('luanti_theme_v2')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(themeMeta.getAttribute('content')).toBe('#0f172a');
  });

  it('allows setting explicit theme using setTheme', () => {
    const service = new ThemeService();
    service.setTheme('light');
    expect(service.theme()).toBe('light');
    expect(localStorage.getItem('luanti_theme_v2')).toBe('light');

    service.setTheme('dark');
    expect(service.theme()).toBe('dark');
    expect(localStorage.getItem('luanti_theme_v2')).toBe('dark');
  });
});
