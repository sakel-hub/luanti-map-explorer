import { Injectable, signal } from '@angular/core';

export type InstallOutcome = 'accepted' | 'dismissed' | 'unsupported';

@Injectable({
  providedIn: 'root'
})
export class PwaInstallService {
  private deferredPrompt: any = null;

  public readonly canInstall = signal<boolean>(false);
  public readonly isInstalled = signal<boolean>(false);
  public readonly isStandalone = signal<boolean>(false);
  public readonly installOutcome = signal<'accepted' | 'dismissed' | null>(null);

  constructor() {
    this.initPwaListeners();
  }

  private initPwaListeners(): void {
    if (typeof window === 'undefined') return;

    // 1. Initial standalone / installed check
    this.updateStandaloneStatus();

    // 2. Listen for display-mode changes (e.g. launching in standalone or entering fullscreen PWA)
    try {
      const mediaQuery = window.matchMedia('(display-mode: standalone)');
      mediaQuery.addEventListener?.('change', () => this.updateStandaloneStatus());
    } catch {
      // Unsupported matchMedia listener on older platforms
    }

    // 3. Check early-captured install prompt from index.html
    const earlyPrompt = (window as any).__pwaInstallPrompt;
    if (earlyPrompt && !this.isStandalone()) {
      this.deferredPrompt = earlyPrompt;
      this.canInstall.set(true);
    }

    // 4. Custom event from index.html early capture
    window.addEventListener('pwa-install-prompt-ready', ((e: CustomEvent) => {
      if (this.isStandalone()) return;
      this.deferredPrompt = e.detail;
      this.canInstall.set(true);
    }) as EventListener);

    // 5. Standard beforeinstallprompt event fallback
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      if (this.isStandalone()) return;
      e.preventDefault();
      this.deferredPrompt = e;
      (window as any).__pwaInstallPrompt = e;
      this.canInstall.set(true);
    });

    // 6. Listen for app installation (from custom event or native browser menu install)
    const onInstalled = () => {
      this.deferredPrompt = null;
      (window as any).__pwaInstallPrompt = null;
      this.canInstall.set(false);
      this.isInstalled.set(true);
    };

    window.addEventListener('pwa-installed', onInstalled);
    window.addEventListener('appinstalled', onInstalled);
  }

  public updateStandaloneStatus(): boolean {
    if (typeof window === 'undefined') return false;

    const isMediaStandalone =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(display-mode: standalone)').matches;

    const isNavigatorStandalone = (window.navigator as any)?.standalone === true;

    const isTwa =
      typeof document !== 'undefined' &&
      document.referrer.startsWith('android-app://');

    const standalone = isMediaStandalone || isNavigatorStandalone || isTwa;

    this.isStandalone.set(standalone);
    if (standalone) {
      this.isInstalled.set(true);
      this.canInstall.set(false);
    }
    return standalone;
  }

  /**
   * Triggers the native browser install prompt if available.
   * Resolves to 'accepted', 'dismissed', or 'unsupported'.
   */
  public async promptInstall(): Promise<InstallOutcome> {
    if (!this.deferredPrompt) {
      return 'unsupported';
    }

    try {
      const promptEvent = this.deferredPrompt;
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;

      this.deferredPrompt = null;
      if (typeof window !== 'undefined') {
        (window as any).__pwaInstallPrompt = null;
      }
      this.canInstall.set(false);

      if (choice && choice.outcome === 'accepted') {
        this.installOutcome.set('accepted');
        this.isInstalled.set(true);
        return 'accepted';
      } else {
        this.installOutcome.set('dismissed');
        return 'dismissed';
      }
    } catch {
      this.deferredPrompt = null;
      this.canInstall.set(false);
      return 'unsupported';
    }
  }

  /**
   * Helper to detect client platform for custom browser installation hints
   */
  public getClientPlatform(): 'android' | 'ios' | 'desktop' {
    if (typeof navigator === 'undefined') return 'desktop';
    const ua = navigator.userAgent.toLowerCase();
    if (/android/i.test(ua)) return 'android';
    if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
    return 'desktop';
  }
}
