import { Component, ElementRef, EventEmitter, HostListener, Output, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MapStore } from '../../core/state/map.store';
import { WorldLoaderService } from '../../core/services/world-loader.service';
import { KeyboardShortcutsService } from '../../core/services/keyboard-shortcuts.service';
import { ThemeService } from '../../core/services/theme.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { PwaStorageService } from '../../core/services/pwa-storage.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import { MapgenType, ViewMode } from '../../core/models/world.model';
import {
  LucideHelpCircle,
  LucideShare2,
  LucideKeyboard,
  LucideSun,
  LucideMoon,
  LucideSettings,
  LucideX,
  LucideMenu,
  LucideDownload,
  LucideFolderOpen,
  LucideSparkles,
  LucideDatabase,
  LucideChevronRight,
  LucideExternalLink
} from '@lucide/angular';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TooltipDirective,
    TranslatePipe,
    LucideHelpCircle,
    LucideShare2,
    LucideKeyboard,
    LucideSun,
    LucideMoon,
    LucideSettings,
    LucideX,
    LucideMenu,
    LucideDownload,
    LucideFolderOpen,
    LucideSparkles,
    LucideDatabase,
    LucideChevronRight,
    LucideExternalLink
  ],
  template: `
    <header class="h-12 bg-slate-950 border-b border-slate-800 px-3 flex items-center justify-between text-xs select-none z-20 relative">
      <!-- Hidden multi-file input (accepts map.sqlite, map_meta.txt, world.mt directly - never blocked by Chrome inside ~/Library!) -->
      <input
        #worldFilesInput
        type="file"
        multiple
        accept=".sqlite,.sqlite3,.mt,.txt"
        (change)="onDirectoryInputChange($event)"
        class="hidden" />

      <!-- ========================================== -->
      <!-- MOBILE HEADER BAR (< md)                   -->
      <!-- ========================================== -->
      <div class="flex md:hidden items-center justify-between w-full">
        <div class="flex items-center gap-2 min-w-0">
          <img
            src="logo.svg"
            alt="Luanti Map & Biome Explorer"
            width="28"
            height="28"
            class="w-7 h-7 rounded-md shadow-md flex-shrink-0" />
          <div class="truncate">
            <div class="font-bold text-slate-100 text-xs tracking-tight flex items-center gap-1.5">
              <span>Map Explorer</span>
              <span class="text-[9px] bg-sky-950 text-sky-400 border border-sky-800 px-1 py-0.2 rounded font-mono">PWA</span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-1">
          <!-- Open World Folder -->
          <button
            (click)="triggerOpenWorldFolder()"
            [attr.aria-label]="'header.openWorldFolder' | translate"
            class="w-8 h-8 rounded flex items-center justify-center text-emerald-400 hover:bg-slate-800 transition active:scale-95">
            <svg lucideFolderOpen class="w-4 h-4"></svg>
          </button>

          <!-- Random Seed -->
          <button
            (click)="mapStore.randomizeSeed()"
            [attr.aria-label]="'header.randomSeed' | translate"
            class="w-8 h-8 rounded flex items-center justify-center text-amber-400 hover:bg-slate-800 transition active:scale-95">
            <svg lucideSparkles class="w-4 h-4"></svg>
          </button>

          <!-- Quick Guide -->
          <button
            (click)="openHelp.emit()"
            [attr.aria-label]="'header.help' | translate"
            class="w-8 h-8 rounded flex items-center justify-center text-sky-400 hover:bg-slate-800 transition active:scale-95">
            <svg lucideHelpCircle class="w-4 h-4"></svg>
          </button>

          <!-- Share -->
          <button
            (click)="openShare.emit()"
            [attr.aria-label]="'header.share' | translate"
            class="w-8 h-8 rounded flex items-center justify-center text-purple-400 hover:bg-slate-800 transition active:scale-95">
            <svg lucideShare2 class="w-4 h-4"></svg>
          </button>

          <!-- Hamburger Overflow Menu Button -->
          <button
            (click)="toggleMobileMenu()"
            [attr.aria-expanded]="showMobileMenu()"
            [attr.aria-label]="'header.menu' | translate"
            class="w-8 h-8 rounded bg-slate-900 border border-slate-700/80 flex items-center justify-center text-slate-200 hover:bg-slate-800 transition active:scale-95 ml-1">
            <svg lucideMenu class="w-4 h-4"></svg>
          </button>
        </div>
      </div>

      <!-- ========================================== -->
      <!-- DESKTOP HEADER BAR (>= md)                 -->
      <!-- ========================================== -->
      <div class="hidden md:flex items-center justify-between w-full">
        <!-- Left: Logo, World Name & Seed Input -->
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2">
            <img
              src="logo.svg"
              alt="Luanti Map & Biome Explorer"
              width="30"
              height="30"
              class="w-7.5 h-7.5 rounded-md shadow-md flex-shrink-0" />
            <div>
              <h1 class="font-bold text-slate-100 text-xs tracking-tight flex items-center gap-1.5 m-0 p-0 font-sans">
                <span>{{ 'header.title' | translate }}</span>
                <span class="text-[9px] bg-sky-950 text-sky-400 border border-sky-800 px-1.5 py-0.2 rounded font-mono">{{ 'header.pwaBadge' | translate }}</span>
              </h1>
            </div>
          </div>

          <div class="h-5 w-px bg-slate-800 mx-1"></div>

          <!-- World Title & Quick Seed Input (Editable on tablet md..lg; compact summary badge on >= lg where Left Sidebar is visible) -->
          <div class="flex lg:hidden items-center gap-2">
            <input
              type="text"
              [ngModel]="mapStore.worldConfig().worldName"
              (ngModelChange)="mapStore.setWorldName($event)"
              [appTooltip]="'header.worldName' | translate"
              tooltipPosition="bottom"
              aria-label="World Name"
              class="bg-transparent hover:bg-slate-900 focus:bg-slate-900 border border-transparent hover:border-slate-800 focus:border-slate-700 rounded px-2 py-1 text-slate-200 font-medium focus:outline-none transition w-28" />
            <span class="text-slate-500 font-mono">#</span>
            <input
              type="text"
              [ngModel]="mapStore.worldConfig().seed"
              (ngModelChange)="mapStore.setSeed($event)"
              [appTooltip]="'header.seedLabel' | translate"
              tooltipPosition="bottom"
              aria-label="World Seed"
              class="bg-slate-900/90 hover:bg-slate-900 focus:bg-slate-900 border border-slate-800 focus:border-sky-500 rounded px-2 py-1 text-sky-400 font-mono font-semibold focus:outline-none transition w-24" />
            <button
              (click)="mapStore.randomizeSeed()"
              [appTooltip]="'header.randomSeed' | translate"
              [appTooltipShortcutId]="'seed_random'"
              aria-label="Randomize Seed"
              class="p-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-amber-400 hover:text-amber-300 transition">
              <svg lucideSparkles class="w-3.5 h-3.5"></svg>
            </button>
          </div>

          <!-- Compact World & Seed Summary Pill on Desktop (>= lg, where WorldPanel is open on the left) -->
          <div
            appTooltip="Configure World Name, Seed, Mapgen & Noise Spread in the Left Sidebar (Press R to randomize seed)"
            tooltipPosition="bottom"
            class="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-800 text-xs">
            <span class="font-medium text-slate-200 truncate max-w-[140px]">{{ mapStore.worldConfig().worldName }}</span>
            <span class="text-slate-600">·</span>
            <span class="font-mono text-sky-400 font-semibold">#{{ mapStore.worldConfig().seed }}</span>
            <span class="text-slate-600">·</span>
            <span class="font-mono text-emerald-400 uppercase text-[11px] font-semibold">{{ mapStore.worldConfig().mapgen }}</span>
          </div>
        </div>

        <!-- Center: Open World Folder, Demo DB & Mode Pill -->
        <div class="flex items-center gap-1.5">
          <button
            (click)="triggerOpenWorldFolder()"
            [appTooltip]="'Inside your world folder (e.g. SaKeL_Survival), click map.sqlite (+ ⌘-click map_meta.txt & world.mt) to enable Open'"
            class="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 font-semibold transition">
            <svg lucideFolderOpen class="w-3.5 h-3.5 text-emerald-400"></svg>
            <span>Open map.sqlite / Files</span>
          </button>

          <button
            (click)="mapStore.loadDemoDatabase()"
            [appTooltip]="'header.loadDemoWorld' | translate"
            class="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-slate-300 font-medium transition">
            <svg lucideDatabase class="w-3.5 h-3.5 text-purple-400"></svg>
            <span>{{ 'header.loadDemoWorld' | translate }}</span>
          </button>

          <div class="h-4 w-px bg-slate-800 mx-1"></div>

          <!-- View Mode Segmented Switcher -->
          <div class="flex items-center bg-slate-900 border border-slate-800 rounded p-0.5 text-[11px]">
            <button
              (click)="mapStore.setViewMode('seed')"
              [class.bg-sky-600]="mapStore.viewMode() === 'seed'"
              [class.text-white]="mapStore.viewMode() === 'seed'"
              [class.text-slate-400]="mapStore.viewMode() !== 'seed'"
              [appTooltip]="'Seed Biomes Mode|1'"
              class="px-2 py-0.5 rounded font-medium transition">
              Seed
            </button>
            <button
              (click)="mapStore.setViewMode('hybrid')"
              [class.bg-sky-600]="mapStore.viewMode() === 'hybrid'"
              [class.text-white]="mapStore.viewMode() === 'hybrid'"
              [class.text-slate-400]="mapStore.viewMode() !== 'hybrid'"
              [appTooltip]="'Hybrid (Seed + SQLite DB)|H'"
              class="px-2 py-0.5 rounded font-medium transition">
              Hybrid
            </button>
            <button
              (click)="mapStore.setViewMode('db')"
              [class.bg-sky-600]="mapStore.viewMode() === 'db'"
              [class.text-white]="mapStore.viewMode() === 'db'"
              [class.text-slate-400]="mapStore.viewMode() !== 'db'"
              [appTooltip]="'SQLite DB Blocks Only|2'"
              class="px-2 py-0.5 rounded font-medium transition">
              SQLite DB
            </button>
          </div>

          <!-- Keyboard Shortcuts Button -->
          <button
            (click)="shortcutsService.openShortcutsModal()"
            [appTooltip]="'header.shortcuts' | translate"
            [appTooltipShortcutId]="'help_shortcuts'"
            aria-label="Keyboard Shortcuts"
            class="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-slate-300 font-medium transition text-xs">
            <svg lucideKeyboard class="w-3.5 h-3.5 text-sky-400"></svg>
            <span class="hidden lg:inline">{{ 'header.shortcuts' | translate }}</span>
          </button>
        </div>

        <!-- Right: Language Switcher, Help, Share, GitHub, Theme -->
        <div class="flex items-center gap-1.5 lg:gap-2">
          <!-- Language Switcher Dropdown -->
          <div class="relative">
            <select
              [ngModel]="translationService.currentLocale()"
              (ngModelChange)="translationService.setLocale($event)"
              appTooltip="Switch UI Language"
              tooltipPosition="bottom"
              aria-label="Language"
              class="bg-slate-900 border border-slate-700/80 hover:border-slate-600 rounded px-1.5 py-1 text-slate-200 text-xs font-medium cursor-pointer focus:outline-none focus:border-sky-500">
              @for (loc of translationService.supportedLocales; track loc.id) {
                <option [value]="loc.id">{{ loc.flag }} {{ loc.nativeName }}</option>
              }
            </select>
          </div>

          <!-- Quick Guide / Help Button -->
          <button
            (click)="openHelp.emit()"
            [appTooltip]="'header.help' | translate"
            aria-label="Quick Guide"
            class="p-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-sky-400 hover:text-sky-300 transition">
            <svg lucideHelpCircle class="w-4 h-4"></svg>
          </button>

          <!-- Social Share Button -->
          <button
            (click)="openShare.emit()"
            [appTooltip]="'header.share' | translate"
            aria-label="Share Map"
            class="p-1.5 rounded bg-purple-950/40 hover:bg-purple-900/50 border border-purple-800/60 text-purple-300 hover:text-purple-200 transition">
            <svg lucideShare2 class="w-4 h-4 text-purple-400"></svg>
          </button>

          <!-- Dedicated GitHub Repository Link -->
          <a
            href="https://github.com/sakel-hub/luanti-map-explorer"
            target="_blank"
            rel="noopener noreferrer"
            [appTooltip]="'header.github' | translate"
            aria-label="GitHub Repository"
            class="p-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-slate-400 hover:text-slate-100 transition flex items-center justify-center">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
          </a>

          <!-- Theme Toggle (Dark / Light) -->
          <button
            (click)="themeService.toggleTheme()"
            [appTooltip]="themeService.theme() === 'dark' ? ('header.themeLight' | translate) : ('header.themeDark' | translate)"
            aria-label="Toggle color theme"
            class="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition">
            @if (themeService.theme() === 'dark') {
              <svg lucideSun class="w-4 h-4 text-amber-400"></svg>
            } @else {
              <svg lucideMoon class="w-4 h-4 text-sky-400"></svg>
            }
          </button>

          <!-- Install PWA App Button (if available) -->
          @if (canInstallPwa()) {
            <button
              (click)="installPwa()"
              class="flex items-center gap-1.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-medium px-2.5 py-1 rounded shadow transition">
              <svg lucideDownload class="w-3.5 h-3.5"></svg>
              {{ 'header.installApp' | translate }}
            </button>
          }
        </div>
      </div>
    </header>

    <!-- ========================================== -->
    <!-- MOBILE SETTINGS & OVERFLOW DRAWER          -->
    <!-- ========================================== -->
    @if (showMobileMenu()) {
      <div
        (click)="closeMobileMenu()"
        class="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 transition-opacity"></div>

      <div
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="'header.menu' | translate"
        class="fixed top-0 right-0 bottom-0 w-80 max-w-[85vw] bg-slate-900 border-l border-slate-800 shadow-2xl z-50 flex flex-col animate-menu-in">
        <!-- Drawer Header -->
        <div class="h-14 px-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div class="flex items-center gap-2">
            <div class="w-6 h-6 rounded bg-sky-500 flex items-center justify-center text-white">
              <svg lucideSettings class="w-3.5 h-3.5 text-white"></svg>
            </div>
            <span class="font-bold text-sm text-slate-100">{{ 'header.menu' | translate }}</span>
          </div>
          <button
            (click)="closeMobileMenu()"
            [attr.aria-label]="'common.close' | translate"
            class="w-9 h-9 rounded-lg hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition">
            <svg lucideX class="w-5 h-5"></svg>
          </button>
        </div>

        <!-- Drawer Body (Scrollable) -->
        <div class="flex-1 overflow-y-auto p-4 space-y-5 text-xs text-slate-200">
          <!-- Language Selection -->
          <div class="space-y-1.5">
            <label class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Language / Jazyk</label>
            <select
              [ngModel]="translationService.currentLocale()"
              (ngModelChange)="translationService.setLocale($event)"
              class="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-slate-100 text-xs font-medium">
              @for (loc of translationService.supportedLocales; track loc.id) {
                <option [value]="loc.id">{{ loc.flag }} {{ loc.nativeName }} ({{ loc.name }})</option>
              }
            </select>
          </div>

          <!-- World Folder & Seed -->
          <div class="space-y-2 pt-2 border-t border-slate-800">
            <label class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">{{ 'worldPanel.worldSource' | translate }}</label>
            <button
              (click)="triggerOpenWorldFolder(); closeMobileMenu()"
              class="w-full flex items-center justify-between p-2.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 transition font-medium">
              <span class="flex items-center gap-2">
                <svg lucideFolderOpen class="w-4 h-4 text-emerald-400"></svg>
                <span>{{ 'header.openWorldFolder' | translate }}</span>
              </span>
              <svg lucideChevronRight class="w-3.5 h-3.5 text-emerald-400"></svg>
            </button>

            <button
              (click)="mapStore.loadDemoDatabase(); closeMobileMenu()"
              class="w-full flex items-center justify-between p-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700/80 text-slate-200 transition font-medium">
              <span class="flex items-center gap-2">
                <svg lucideDatabase class="w-4 h-4 text-purple-400"></svg>
                <span>{{ 'header.loadDemoWorld' | translate }}</span>
              </span>
              <svg lucideChevronRight class="w-3.5 h-3.5 text-slate-500"></svg>
            </button>
          </div>

          <!-- Documentation & Sharing -->
          <div class="space-y-2 pt-2 border-t border-slate-800">
            <label class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Documentation &amp; Sharing</label>
            <div class="flex flex-col gap-2">
              <button
                (click)="openHelp.emit(); closeMobileMenu()"
                class="w-full flex items-center justify-between p-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700/80 text-sky-400 transition">
                <span class="flex items-center gap-2 font-medium">
                  <svg lucideHelpCircle class="w-4 h-4 text-sky-400"></svg>
                  <span>{{ 'header.help' | translate }}</span>
                </span>
                <svg lucideChevronRight class="w-3.5 h-3.5 text-sky-400"></svg>
              </button>

              <button
                (click)="openShare.emit(); closeMobileMenu()"
                class="w-full flex items-center justify-between p-2.5 rounded-lg bg-purple-950/30 hover:bg-purple-900/40 border border-purple-800/50 text-purple-300 transition">
                <span class="flex items-center gap-2 font-medium">
                  <svg lucideShare2 class="w-4 h-4 text-purple-400"></svg>
                  <span>{{ 'header.share' | translate }}</span>
                </span>
                <svg lucideChevronRight class="w-3.5 h-3.5 text-purple-400"></svg>
              </button>

              <a
                href="https://github.com/sakel-hub/luanti-map-explorer"
                target="_blank"
                rel="noopener noreferrer"
                class="w-full flex items-center justify-between p-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700/80 text-slate-300 transition">
                <span class="flex items-center gap-2 font-medium">
                  <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                  </svg>
                  <span>{{ 'header.github' | translate }}</span>
                </span>
                <svg lucideExternalLink class="w-3.5 h-3.5 text-slate-500"></svg>
              </a>
            </div>
          </div>

          <!-- Appearance & Shortcuts -->
          <div class="space-y-2 pt-2 border-t border-slate-800">
            <label class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Preferences</label>
            <div class="flex flex-col gap-2">
              <button
                (click)="themeService.toggleTheme()"
                class="w-full flex items-center justify-between p-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700/80 transition">
                <span class="flex items-center gap-2 font-medium">
                  @if (themeService.theme() === 'dark') {
                    <svg lucideSun class="w-4 h-4 text-amber-400"></svg>
                    <span>{{ 'header.themeLight' | translate }}</span>
                  } @else {
                    <svg lucideMoon class="w-4 h-4 text-sky-400"></svg>
                    <span>{{ 'header.themeDark' | translate }}</span>
                  }
                </span>
              </button>

              <button
                (click)="shortcutsService.openShortcutsModal(); closeMobileMenu()"
                class="w-full flex items-center justify-between p-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700/80 transition">
                <span class="flex items-center gap-2 font-medium">
                  <svg lucideKeyboard class="w-4 h-4 text-sky-400"></svg>
                  <span>{{ 'header.shortcuts' | translate }}</span>
                </span>
                <span class="text-slate-500 font-mono">?</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `
})
export class HeaderComponent {
  @Output() openHelp = new EventEmitter<void>();
  @Output() openShare = new EventEmitter<void>();

  @ViewChild('worldFilesInput') dirInputRef?: ElementRef<HTMLInputElement>;

  public readonly mapStore = inject(MapStore);
  public readonly worldLoader = inject(WorldLoaderService);
  public readonly shortcutsService = inject(KeyboardShortcutsService);
  public readonly themeService = inject(ThemeService);
  public readonly translationService = inject(TranslationService);
  public readonly pwaStorage = inject(PwaStorageService);

  public readonly canInstallPwa = signal<boolean>(false);
  public readonly showMobileMenu = signal<boolean>(false);
  private deferredPrompt: any = null;

  @HostListener('window:beforeinstallprompt', ['$event'])
  onBeforeInstallPrompt(event: any): void {
    event.preventDefault();
    this.deferredPrompt = event;
    this.canInstallPwa.set(true);
  }

  @HostListener('window:keydown.escape')
  onEscape(): void {
    if (this.showMobileMenu()) {
      this.closeMobileMenu();
    }
  }

  public toggleMobileMenu(): void {
    this.showMobileMenu.update(v => !v);
  }

  public closeMobileMenu(): void {
    this.showMobileMenu.set(false);
  }

  public onMapgenChange(mg: MapgenType): void {
    this.mapStore.setMapgen(mg);
  }

  public async triggerOpenWorldFolder(): Promise<void> {
    if (this.pwaStorage.hasFileSystemAccess) {
      await this.worldLoader.pickWorldFileViaFileSystemApi();
    } else {
      this.dirInputRef?.nativeElement?.click();
    }
  }

  public async onDirectoryInputChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      await this.worldLoader.handleFileListInput(input.files);
      input.value = '';
    }
  }

  public installPwa(): void {
    if (!this.deferredPrompt) return;
    this.deferredPrompt.prompt();
    this.deferredPrompt.userChoice.then(() => {
      this.deferredPrompt = null;
      this.canInstallPwa.set(false);
    });
  }
}
