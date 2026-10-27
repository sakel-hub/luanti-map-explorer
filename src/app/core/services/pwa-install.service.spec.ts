// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PwaInstallService } from './pwa-install.service';

describe('PwaInstallService', () => {
  let service: PwaInstallService;

  beforeEach(() => {
    (window as any).__pwaInstallPrompt = null;
    service = new PwaInstallService();
  });

  afterEach(() => {
    (window as any).__pwaInstallPrompt = null;
  });

  it('initializes with default non-installed states in non-standalone browser', () => {
    expect(service.canInstall()).toBe(false);
    expect(service.isInstalled()).toBe(false);
    expect(service.isStandalone()).toBe(false);
  });

  it('captures beforeinstallprompt event and updates canInstall signal', () => {
    const mockEvent = new Event('beforeinstallprompt') as any;
    mockEvent.prompt = vi.fn();
    mockEvent.userChoice = Promise.resolve({ outcome: 'accepted' });

    window.dispatchEvent(mockEvent);

    expect(service.canInstall()).toBe(true);
  });

  it('handles promptInstall when user accepts installation', async () => {
    const mockPrompt = vi.fn().mockResolvedValue(undefined);
    const mockEvent = {
      preventDefault: vi.fn(),
      prompt: mockPrompt,
      userChoice: Promise.resolve({ outcome: 'accepted' })
    };

    window.dispatchEvent(new CustomEvent('pwa-install-prompt-ready', { detail: mockEvent }));
    expect(service.canInstall()).toBe(true);

    const result = await service.promptInstall();
    expect(result).toBe('accepted');
    expect(service.canInstall()).toBe(false);
    expect(service.isInstalled()).toBe(true);
    expect(service.installOutcome()).toBe('accepted');
  });

  it('handles promptInstall when user dismisses installation', async () => {
    const mockPrompt = vi.fn().mockResolvedValue(undefined);
    const mockEvent = {
      preventDefault: vi.fn(),
      prompt: mockPrompt,
      userChoice: Promise.resolve({ outcome: 'dismissed' })
    };

    window.dispatchEvent(new CustomEvent('pwa-install-prompt-ready', { detail: mockEvent }));
    expect(service.canInstall()).toBe(true);

    const result = await service.promptInstall();
    expect(result).toBe('dismissed');
    expect(service.canInstall()).toBe(false);
    expect(service.installOutcome()).toBe('dismissed');
  });

  it('updates state when appinstalled event fires', () => {
    const mockEvent = new Event('beforeinstallprompt') as any;
    mockEvent.prompt = vi.fn();
    window.dispatchEvent(mockEvent);
    expect(service.canInstall()).toBe(true);

    window.dispatchEvent(new Event('appinstalled'));
    expect(service.canInstall()).toBe(false);
    expect(service.isInstalled()).toBe(true);
  });

  it('returns unsupported if promptInstall is called without a deferred prompt', async () => {
    const result = await service.promptInstall();
    expect(result).toBe('unsupported');
  });
});
