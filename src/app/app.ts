import { Component, HostListener, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from './features/header/header.component';
import { WorldPanelComponent } from './features/world-panel/world-panel.component';
import { MapViewportComponent } from './features/map-viewport/map-viewport.component';
import { VoronoiPanelComponent } from './features/voronoi-panel/voronoi-panel.component';
import { InspectorPanelComponent } from './features/inspector-panel/inspector-panel.component';
import { MarkersPanelComponent } from './features/markers-panel/markers-panel.component';
import { RoutesPanelComponent } from './features/routes-panel/routes-panel.component';
import { ShortcutsDialogComponent } from './features/shortcuts/shortcuts-dialog.component';
import { HelpDialogComponent } from './features/help/help-dialog.component';
import { ShareDialogComponent } from './features/share/share-dialog.component';
import { MapStore } from './core/state/map.store';
import { WorldLoaderService } from './core/services/world-loader.service';
import { RoutePlannerService } from './core/services/route-planner.service';
import { KeyboardShortcutsService } from './core/services/keyboard-shortcuts.service';
import { TranslationService } from './core/i18n/translation.service';
import { TranslatePipe } from './core/i18n/translate.pipe';
import { TooltipDirective } from './shared/directives/tooltip.directive';
import { safeGetItem, safeSetItem } from './core/utils/storage.utils';
import {
  LucideMap,
  LucideCompass,
  LucideCrosshair,
  LucideDatabase,
  LucideMapPin,
  LucideRoute,
  LucideX
} from '@lucide/angular';

export type RightTab = 'voronoi' | 'inspector' | 'markers' | 'routes';
export type DragTarget = 'left' | 'right' | null;
export type MobileTab = 'none' | 'world' | 'voronoi' | 'inspector' | 'markers' | 'routes';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    HeaderComponent,
    WorldPanelComponent,
    MapViewportComponent,
    VoronoiPanelComponent,
    InspectorPanelComponent,
    MarkersPanelComponent,
    RoutesPanelComponent,
    ShortcutsDialogComponent,
    HelpDialogComponent,
    ShareDialogComponent,
    TranslatePipe,
    TooltipDirective,
    LucideMap,
    LucideCompass,
    LucideCrosshair,
    LucideDatabase,
    LucideMapPin,
    LucideRoute,
    LucideX
  ],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class App {
  public readonly mapStore = inject(MapStore);
  public readonly worldLoader = inject(WorldLoaderService);
  public readonly routePlanner = inject(RoutePlannerService);
  public readonly keyboardShortcuts = inject(KeyboardShortcutsService);
  public readonly translation = inject(TranslationService);

  public readonly activeRightTab = signal<RightTab>('voronoi');
  public readonly showHelpModal = signal<boolean>(false);
  public readonly showShareModal = signal<boolean>(false);
  public readonly isWindowFileDragOver = signal<boolean>(false);

  // Mobile bottom navigation and slide-up sheet state
  public readonly mobileSheetTab = signal<MobileTab>('none');
  public readonly mobileSheetTitle = computed(() => {
    switch (this.mobileSheetTab()) {
      case 'world':
        return this.translation.t('worldPanel.title');
      case 'voronoi':
        return this.translation.t('voronoi.title');
      case 'inspector':
        return this.translation.t('inspector.title');
      case 'markers':
        return this.translation.t('markers.title');
      case 'routes':
        return this.translation.t('routes.title');
      default:
        return '';
    }
  });

  // Resizable panel dimensions (desktop)
  public readonly leftWidth = signal<number>(this.loadStoredSize('left', 300));
  public readonly rightWidth = signal<number>(this.loadStoredSize('right', 350));
  public readonly activeDrag = signal<DragTarget>(null);

  constructor() {
    try {
      effect(() => {
        const cfg = this.mapStore.worldConfig();
        const mode = this.mapStore.viewMode();
        const appTitle = this.translation.t('header.title');
        const metaDesc = this.translation.t('app.metaDescription');
        if (typeof document !== 'undefined') {
          const worldPrefix = cfg.worldName ? `${cfg.worldName} • ` : '';
          document.title = `${appTitle} — ${worldPrefix}Seed ${cfg.seed} (${cfg.mapgen.toUpperCase()} • ${mode.toUpperCase()})`;
          const descMeta = document.querySelector('meta[name="description"]');
          if (descMeta) {
            descMeta.setAttribute('content', metaDesc);
          }
        }
      });

      effect(() => {
        const action = this.keyboardShortcuts.lastTriggeredAction();
        if (!action) return;
        if (action.id === 'open_world') {
          this.worldLoader.openFilePicker();
        } else if (action.id === 'open_routes') {
          this.activeRightTab.set('routes');
          if (typeof window !== 'undefined' && window.innerWidth < 1024) {
            this.mobileSheetTab.set('routes');
          }
        } else if (action.id === 'open_share') {
          this.showShareModal.set(true);
        }
      });
    } catch {
      // Ignore outside injection context in unit tests
    }

    if (typeof window !== 'undefined') {
      setTimeout(() => {
        this.worldLoader.autoRestoreRecentWorld();
      }, 50);

      window.addEventListener('focus', () => {
        if (!this.mapStore.worldDatabase() || this.worldLoader.canResumeFileHandle()) {
          this.worldLoader.autoRestoreRecentWorld();
        }
      });
    }
  }

  private loadStoredSize(panel: 'left' | 'right', fallback: number): number {
    const stored = safeGetItem(`luanti_map_panel_${panel}`);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed) && parsed >= 220 && parsed <= 680) {
        return parsed;
      }
    }
    return fallback;
  }

  public openMobileTab(tab: MobileTab): void {
    if (this.mobileSheetTab() === tab) {
      this.mobileSheetTab.set('none');
      return;
    }
    if (tab === 'voronoi') {
      this.activeRightTab.set('voronoi');
    } else if (tab === 'inspector') {
      this.activeRightTab.set('inspector');
    } else if (tab === 'markers') {
      this.activeRightTab.set('markers');
    }
    this.mobileSheetTab.set(tab);
  }

  public closeMobileSheet(): void {
    this.mobileSheetTab.set('none');
  }

  public onResizeKeydown(side: 'left' | 'right', event: KeyboardEvent): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const step = event.shiftKey ? 40 : 16;
    if (side === 'left') {
      const delta = event.key === 'ArrowRight' ? step : -step;
      const newWidth = Math.max(220, Math.min(window.innerWidth * 0.42, this.leftWidth() + delta));
      this.leftWidth.set(newWidth);
      safeSetItem('luanti_map_panel_left', newWidth.toString());
    } else {
      const delta = event.key === 'ArrowLeft' ? step : -step;
      const newWidth = Math.max(260, Math.min(window.innerWidth * 0.45, this.rightWidth() + delta));
      this.rightWidth.set(newWidth);
      safeSetItem('luanti_map_panel_right', newWidth.toString());
    }
    window.dispatchEvent(new Event('resize'));
  }

  public resetPanelSize(side: 'left' | 'right'): void {
    if (side === 'left') {
      this.leftWidth.set(300);
      safeSetItem('luanti_map_panel_left', '300');
    } else {
      this.rightWidth.set(350);
      safeSetItem('luanti_map_panel_right', '350');
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('resize'));
    }
  }

  private startPanelResize(
    side: 'left' | 'right',
    startX: number,
    mode: 'mouse' | 'touch'
  ): void {
    this.activeDrag.set(side);
    const widthSignal = side === 'left' ? this.leftWidth : this.rightWidth;
    const minW = side === 'left' ? 220 : 260;
    const maxFraction = side === 'left' ? 0.42 : 0.45;
    const storageKey = `luanti_map_panel_${side}`;
    const startWidth = widthSignal();

    const applyClientX = (clientX: number) => {
      const deltaX = side === 'left' ? clientX - startX : startX - clientX;
      const newWidth = Math.max(minW, Math.min(window.innerWidth * maxFraction, startWidth + deltaX));
      widthSignal.set(newWidth);
    };

    if (mode === 'mouse') {
      const onMouseMove = (e: MouseEvent) => applyClientX(e.clientX);
      const onMouseUp = () => {
        this.activeDrag.set(null);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        window.dispatchEvent(new Event('resize'));
        safeSetItem(storageKey, widthSignal().toString());
      };
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    } else {
      const onTouchMove = (e: TouchEvent) => {
        if (e.touches.length === 1) {
          applyClientX(e.touches[0].clientX);
        }
      };
      const onTouchEnd = () => {
        this.activeDrag.set(null);
        window.removeEventListener('touchmove', onTouchMove);
        window.removeEventListener('touchend', onTouchEnd);
        window.dispatchEvent(new Event('resize'));
        safeSetItem(storageKey, widthSignal().toString());
      };
      window.addEventListener('touchmove', onTouchMove);
      window.addEventListener('touchend', onTouchEnd);
    }
  }

  public startLeftResize(event: MouseEvent): void {
    event.preventDefault();
    this.startPanelResize('left', event.clientX, 'mouse');
  }

  public startLeftResizeTouch(event: TouchEvent): void {
    if (event.touches.length === 1) {
      this.startPanelResize('left', event.touches[0].clientX, 'touch');
    }
  }

  public startRightResize(event: MouseEvent): void {
    event.preventDefault();
    this.startPanelResize('right', event.clientX, 'mouse');
  }

  public startRightResizeTouch(event: TouchEvent): void {
    if (event.touches.length === 1) {
      this.startPanelResize('right', event.touches[0].clientX, 'touch');
    }
  }

  @HostListener('window:keydown', ['$event'])
  handleGlobalShortcuts(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.mobileSheetTab() !== 'none') {
      this.closeMobileSheet();
      return;
    }
    this.keyboardShortcuts.handleKeyDown(event);
  }

  @HostListener('window:dragover', ['$event'])
  onWindowDragOver(event: DragEvent): void {
    if (event.dataTransfer?.types?.includes('Files')) {
      event.preventDefault();
      this.isWindowFileDragOver.set(true);
    }
  }

  @HostListener('window:dragleave', ['$event'])
  onWindowDragLeave(event: DragEvent): void {
    if (event.relatedTarget === null) {
      this.isWindowFileDragOver.set(false);
    }
  }

  @HostListener('window:drop', ['$event'])
  async onWindowDrop(event: DragEvent): Promise<void> {
    if (event.dataTransfer?.types?.includes('Files')) {
      event.preventDefault();
      this.isWindowFileDragOver.set(false);
      await this.worldLoader.handleDataTransferDrop(event.dataTransfer);
    }
  }
}
