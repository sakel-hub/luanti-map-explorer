import '@angular/compiler';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createEnvironmentInjector, runInInjectionContext } from '@angular/core';
import { HeaderComponent } from './header.component';
import { MapStore } from '../../core/state/map.store';
import { WorldLoaderService } from '../../core/services/world-loader.service';
import { KeyboardShortcutsService } from '../../core/services/keyboard-shortcuts.service';
import { ThemeService } from '../../core/services/theme.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { PwaStorageService } from '../../core/services/pwa-storage.service';
import { PwaUpdateService } from '../../core/services/pwa-update.service';

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  const mockWorldLoader = {
    openFilePicker: vi.fn()
  };

  beforeEach(() => {
    const injector = createEnvironmentInjector([
      MapStore,
      { provide: WorldLoaderService, useValue: mockWorldLoader },
      KeyboardShortcutsService,
      ThemeService,
      TranslationService,
      PwaStorageService,
      PwaUpdateService
    ], null as any);
    component = runInInjectionContext(injector, () => new HeaderComponent());
  });

  it('should create and have default signals', () => {
    expect(component).toBeTruthy();
    expect(component.showMobileMenu()).toBe(false);
    expect(component.canInstallPwa()).toBe(false);
  });

  it('should toggle and close mobile menu', () => {
    component.toggleMobileMenu();
    expect(component.showMobileMenu()).toBe(true);

    component.closeMobileMenu();
    expect(component.showMobileMenu()).toBe(false);
  });

  it('should toggle and close desktop updates menu', () => {
    expect(component.showDesktopUpdatesMenu()).toBe(false);
    component.toggleDesktopUpdatesMenu();
    expect(component.showDesktopUpdatesMenu()).toBe(true);

    component.closeDesktopUpdatesMenu();
    expect(component.showDesktopUpdatesMenu()).toBe(false);
  });

  it('should close desktop updates menu on escape keydown', () => {
    component.toggleDesktopUpdatesMenu();
    expect(component.showDesktopUpdatesMenu()).toBe(true);

    component.onEscape();
    expect(component.showDesktopUpdatesMenu()).toBe(false);
  });

  it('should close mobile menu on escape keydown', () => {
    component.toggleMobileMenu();
    expect(component.showMobileMenu()).toBe(true);

    component.onEscape();
    expect(component.showMobileMenu()).toBe(false);
  });

  it('should emit openHelp and openShare events', () => {
    let helpEmitted = false;
    let shareEmitted = false;
    component.openHelp.subscribe(() => { helpEmitted = true; });
    component.openShare.subscribe(() => { shareEmitted = true; });

    component.openHelp.emit();
    component.openShare.emit();

    expect(helpEmitted).toBe(true);
    expect(shareEmitted).toBe(true);
  });

  it('should trigger openFilePicker on world loader', async () => {
    await component.triggerOpenWorldFolder();
    expect(mockWorldLoader.openFilePicker).toHaveBeenCalled();
  });

  it('should capture beforeinstallprompt and enable install button', () => {
    const mockPromptEvent = {
      preventDefault: vi.fn(),
      prompt: vi.fn(),
      userChoice: Promise.resolve({ outcome: 'accepted' })
    };

    component.onBeforeInstallPrompt(mockPromptEvent);

    expect(mockPromptEvent.preventDefault).toHaveBeenCalled();
    expect(component.canInstallPwa()).toBe(true);
  });

  it('should prompt install and reset canInstallPwa on userChoice resolution', async () => {
    let resolveChoice: (val: any) => void;
    const choicePromise = new Promise((resolve) => {
      resolveChoice = resolve;
    });

    const mockPromptEvent = {
      preventDefault: vi.fn(),
      prompt: vi.fn(),
      userChoice: choicePromise
    };

    component.onBeforeInstallPrompt(mockPromptEvent);
    expect(component.canInstallPwa()).toBe(true);

    component.installPwa();
    expect(mockPromptEvent.prompt).toHaveBeenCalled();

    resolveChoice!({ outcome: 'accepted' });
    await choicePromise;

    expect(component.canInstallPwa()).toBe(false);
  });
});
