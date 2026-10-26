import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MapStore, VERTICAL_SLICE_PRESETS } from '../../core/state/map.store';
import { WorldLoaderService } from '../../core/services/world-loader.service';
import { WorkerPoolService } from '../../core/services/worker-pool.service';
import { PwaStorageService } from '../../core/services/pwa-storage.service';
import { VerticalSlicePresetId } from '../../core/models/world.model';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import { copyWithSignalFeedback, formatDurationSeconds } from '../../core/utils/format.utils';
import {
  LucideFolderOpen,
  LucideDatabase,
  LucideSparkles,
  LucideLayers,
  LucideMountain,
  LucideSliders,
  LucideUpload,
  LucideCompass,
  LucideCopy,
  LucideCheck,
  LucideX,
  LucideHardDrive,
  LucideTrash2,
  LucideRotateCcw,
  LucideTrees,
  LucideEye,
  LucideEyeOff
} from '@lucide/angular';

@Component({
  selector: 'app-world-panel',
  standalone: true,
  host: {
    class: 'flex flex-col flex-1 min-h-0 h-full overflow-hidden'
  },
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    TooltipDirective,
    LucideFolderOpen,
    LucideDatabase,
    LucideSparkles,
    LucideLayers,
    LucideMountain,
    LucideSliders,
    LucideUpload,
    LucideCompass,
    LucideCopy,
    LucideCheck,
    LucideX,
    LucideHardDrive,
    LucideTrash2,
    LucideRotateCcw,
    LucideTrees,
    LucideEye,
    LucideEyeOff
  ],
  template: `
    <div class="h-full min-h-0 flex flex-col bg-slate-900 text-xs text-slate-200 select-none overflow-hidden">
      <!-- Panel Header -->
      <div class="h-9 px-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
        <div class="flex items-center gap-2 font-semibold text-slate-200">
          <svg lucideCompass class="w-4 h-4 text-sky-400"></svg>
          <span>{{ 'worldPanel.title' | translate }}</span>
        </div>
        <span class="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-sky-400">
          {{ workerPool.workerCount() || 1 }} {{ 'worldPanel.coresUnit' | translate }}
        </span>
      </div>

      <!-- Scrollable Controls Body -->
      <div class="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-3 space-y-4">
        <!-- 1. World SQLite / Files Ingestion & Drag-and-Drop Zone -->
        <section
          (dragover)="onDragOver($event)"
          (dragleave)="onDragLeave($event)"
          (drop)="onDrop($event)"
          [class.border-emerald-400]="isDragOver()"
          [class.bg-emerald-950]="isDragOver()"
          class="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2.5 transition">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <svg lucideDatabase class="w-3.5 h-3.5 text-emerald-400"></svg>
              <span>{{ 'worldPanel.worldSource' | translate }}</span>
            </span>
            <button
              type="button"
              (click)="copyMacWorldsPath()"
              [appTooltip]="'Copy ~/Library/Application Support/minetest/worlds (Press Cmd+Shift+G in File Dialog)'"
              class="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700/70 text-[10px] text-slate-300 flex items-center gap-1 transition">
              @if (copiedPath()) {
                <svg lucideCheck class="w-3 h-3 text-emerald-400"></svg>
                <span class="text-emerald-400 font-semibold">{{ 'worldPanel.copiedMacPath' | translate }}</span>
              } @else {
                <svg lucideCopy class="w-3 h-3 text-sky-400"></svg>
                <span>{{ 'worldPanel.copyMacPath' | translate }}</span>
              }
            </button>
          </div>

          @if (worldLoader.canResumeFileHandle(); as resume) {
            <div class="p-2.5 rounded-xl bg-amber-950/70 border border-amber-500/70 text-amber-200 space-y-1.5 shadow-lg animate-pulse">
              <div class="flex items-center justify-between gap-1.5">
                <span class="font-semibold text-[11px] text-amber-300 flex items-center gap-1.5">
                  <svg lucideRotateCcw class="w-3.5 h-3.5 text-amber-400"></svg>
                  <span>{{ 'worldPanel.resumeLiveStream' | translate }}</span>
                </span>
                <span class="text-[9px] px-1.5 py-0.2 rounded bg-amber-900/80 border border-amber-600/60 text-amber-200 font-mono">
                  1-Click
                </span>
              </div>
              <div class="text-[10px] text-amber-200/90 leading-tight">
                Re-connect <strong>{{ resume.name }}</strong> to stream deep MapBlocks without picking files again.
              </div>
              <button
                type="button"
                (click)="worldLoader.openWorldFromFileHandle(resume.handle)"
                class="w-full py-1.5 px-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] flex items-center justify-center gap-1.5 transition active:scale-[0.99] cursor-pointer">
                <svg lucideRotateCcw class="w-3.5 h-3.5"></svg>
                <span>{{ resume.name }}</span>
              </button>
            </div>
          } @else if (worldLoader.isOfflineCachedWorld()) {
            <div class="p-2.5 rounded-xl bg-sky-950/70 border border-sky-600/70 text-sky-200 space-y-2 shadow-inner">
              <div class="flex items-center justify-between gap-1.5">
                <span class="flex items-center gap-1.5 font-bold text-xs text-sky-300">
                  <svg lucideHardDrive class="w-3.5 h-3.5 text-sky-400 flex-shrink-0"></svg>
                  <span>{{ 'worldPanel.offlineCachedPreview' | translate }}</span>
                </span>
                <span class="text-[9px] px-1.5 py-0.5 rounded bg-sky-900/80 border border-sky-700/70 text-sky-300 font-mono">
                  Cached
                </span>
              </div>
              <p class="text-[10px] text-slate-300 leading-snug">
                Overview map restored from browser cache. Connect your local <code class="text-sky-300 bg-sky-900/60 px-1 py-0.5 rounded">map.sqlite</code> or <code class="text-sky-300 bg-sky-900/60 px-1 py-0.5 rounded">map.sql</code> to stream high-resolution 3D blocks and cave slices.
              </p>
              <button
                type="button"
                (click)="onOpenWorldClicked()"
                [appTooltip]="'Attach your local map.sqlite or map.sql file to stream high-resolution 3D blocks, inspect nodes, and explore underground cave layers'"
                class="w-full py-1.5 px-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-[11px] flex items-center justify-center gap-1.5 transition active:scale-[0.99] cursor-pointer">
                <svg lucideDatabase class="w-3.5 h-3.5"></svg>
                <span>{{ 'worldPanel.openFileSqliteBtn' | translate }}</span>
              </button>
            </div>
          } @else if (pwaStorage.recentWorld(); as recent) {
            <div class="p-2 rounded-lg bg-sky-950/40 border border-sky-800/60 flex items-center justify-between gap-2">
              <div class="flex items-center gap-2 min-w-0">
                <svg lucideRotateCcw class="w-3.5 h-3.5 text-sky-400 flex-shrink-0"></svg>
                <div class="truncate text-[11px]">
                  <span class="text-slate-400">Recent:</span>
                  <strong class="text-sky-300 ml-1 truncate">{{ recent.name }}</strong>
                </div>
              </div>
              <button
                type="button"
                (click)="worldLoader.openWorldFromFileHandle(recent.handle)"
                [appTooltip]="'Instant one-click reopen from browser handle'"
                class="px-2 py-0.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-medium text-[10px] flex-shrink-0 transition">
                {{ 'worldPanel.reopenRecentWorld' | translate }}
              </button>
            </div>
          }

          @if (mapStore.isLoadingWorld() || worldLoader.streamProgress()) {
            @let progress = mapStore.loadProgress() || worldLoader.streamProgress();
            <div
              role="status"
              aria-live="polite"
              class="p-2.5 rounded-xl bg-sky-950/75 border border-sky-700/80 text-sky-200 space-y-2 shadow-inner">
              <!-- Top Row: Spinner + Phase Label + Step Badge + Percentage + Stop/Skip Button -->
              <div class="flex items-center justify-between gap-1.5">
                <div class="flex items-center gap-2 min-w-0">
                  <div class="w-3.5 h-3.5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
                  <span class="text-[11px] font-medium text-sky-200 truncate">
                    {{ progress?.label || mapStore.loadStatusMessage() || ('common.loading' | translate) }}
                  </span>
                </div>

                <div class="flex items-center gap-1.5 flex-shrink-0">
                  @if (progress && progress.totalSteps > 1) {
                    <span class="px-1.5 py-0.5 rounded bg-sky-900/80 border border-sky-700/70 text-[9px] font-mono text-sky-300">
                      Step {{ progress.stepIndex }}/{{ progress.totalSteps }}
                    </span>
                  }
                  @if (progress) {
                    <span class="text-xs font-mono font-bold text-emerald-400">
                      {{ progress.percent }}%
                    </span>
                  }
                  <button
                    type="button"
                    (click)="worldLoader.cancelActiveStreaming()"
                    [appTooltip]="'Skip remaining sector scans and explore already-decoded map sectors immediately'"
                    class="px-1.5 py-0.5 rounded bg-slate-900/90 hover:bg-rose-950/80 border border-slate-700 hover:border-rose-700 text-[9px] font-semibold text-slate-300 hover:text-rose-300 flex items-center gap-0.5 transition">
                    <svg lucideX class="w-2.5 h-2.5"></svg>
                    <span>{{ 'common.stop' | translate }}</span>
                  </button>
                </div>
              </div>

              <!-- Determinate Progress Bar Track -->
              @if (progress) {
                <div class="h-1.5 w-full rounded-full bg-slate-900/90 border border-slate-800 overflow-hidden">
                  <div
                    class="h-full rounded-full bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-400 transition-all duration-150 ease-out"
                    [style.width.%]="progress.percent"></div>
                </div>

                <!-- Telemetry Footer: Item Counter, Blocks Decoded, Elapsed & ETA -->
                <div class="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-0.5">
                  <span class="truncate">
                    <strong class="text-slate-200">{{ progress.current.toLocaleString() }}</strong> / {{ progress.total.toLocaleString() }} {{ progress.unit }}
                    @if (progress.blocksDecoded > 0) {
                      <span class="text-emerald-400"> • {{ progress.blocksDecoded.toLocaleString() }} blks</span>
                    }
                  </span>
                  <span class="flex-shrink-0 text-sky-300/90">
                    {{ formatDuration(progress.elapsedSeconds) }}
                    @if (progress.etaSeconds !== null && progress.etaSeconds > 0) {
                      <span class="text-amber-300"> • ~{{ formatDuration(progress.etaSeconds) }} left</span>
                    }
                  </span>
                </div>
              }
            </div>
          }

          @if (worldLoader.lastError()) {
            <div class="p-2 rounded-lg bg-rose-950/60 border border-rose-800/80 text-rose-300 text-[11px]">
              {{ worldLoader.lastError() }}
            </div>
          }

          @if (worldLoader.lastLoadedSummary()) {
            <div class="p-2 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-[10px] leading-snug">
              {{ worldLoader.lastLoadedSummary() }}
            </div>
          }

          <!-- Primary Action: Direct Database (+ optional map_meta.txt / world.mt) File Picker -->
          <button
            type="button"
            (click)="onOpenWorldClicked()"
            [appTooltip]="'worldPanel.openFileSqliteBtn' | translate"
            [appTooltipShortcutId]="'open_world'"
            class="w-full py-2 px-3 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-semibold flex items-center justify-center gap-2 transition active:scale-[0.99] cursor-pointer">
            <svg lucideUpload class="w-4 h-4 text-emerald-400"></svg>
            <span>{{ 'worldPanel.openFileSqliteBtn' | translate }}</span>
          </button>

          <!-- Drag & Drop & File Selection Hint Box -->
          <div
            (click)="onOpenWorldClicked()"
            class="p-2 rounded-lg border border-dashed border-slate-700/80 hover:border-sky-500/60 bg-slate-900/50 text-center cursor-pointer transition space-y-0.5">
            <div class="text-[10px] text-slate-300 font-medium">
              {{ 'worldPanel.dropzoneHint' | translate }}
            </div>
            <div class="text-[9px] text-slate-400 leading-tight">
              <code class="text-sky-300 font-mono">map.sqlite</code> · <code class="text-sky-300 font-mono">map.sql</code> · <code class="text-sky-300 font-mono">world.mt</code>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              (click)="onOpenDirectoryClicked()"
              [appTooltip]="'worldPanel.openDirectoryBtn' | translate"
              class="py-1.5 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/70 text-slate-300 font-medium flex items-center justify-center gap-1.5 text-[11px] transition">
              <svg lucideFolderOpen class="w-3.5 h-3.5 text-sky-400"></svg>
              <span class="truncate">{{ 'worldPanel.openFolderShort' | translate }}</span>
            </button>

            <button
              type="button"
              (click)="worldLoader.loadDemoWorld('sqlite3')"
              [appTooltip]="'worldPanel.loadSampleDbBtn' | translate"
              class="py-1.5 px-2 rounded-lg bg-purple-950/30 hover:bg-purple-900/40 border border-purple-800/50 text-purple-300 font-medium flex items-center justify-center gap-1.5 text-[11px] transition">
              <svg lucideDatabase class="w-3.5 h-3.5 text-purple-400"></svg>
              <span class="truncate">Demo (SQLite)</span>
            </button>
          </div>

          <div class="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              (click)="worldLoader.loadDemoWorld('postgresql')"
              [appTooltip]="'worldPanel.loadSamplePgBtn' | translate"
              class="py-1.5 px-2 rounded-lg bg-emerald-950/30 hover:bg-emerald-900/40 border border-emerald-800/50 text-emerald-300 font-medium flex items-center justify-center gap-1.5 text-[11px] transition">
              <svg lucideDatabase class="w-3.5 h-3.5 text-emerald-400"></svg>
              <span class="truncate">Demo (PGSQL)</span>
            </button>

            @if (mapStore.worldDatabase()) {
              <button
                type="button"
                (click)="worldLoader.exportCurrentWorldAsPostgresDump()"
                [appTooltip]="'worldPanel.exportPostgresBtn' | translate"
                class="py-1.5 px-2 rounded-lg bg-amber-950/30 hover:bg-amber-900/40 border border-amber-800/50 text-amber-300 font-medium flex items-center justify-center gap-1.5 text-[11px] transition">
                <svg lucideUpload class="w-3.5 h-3.5 text-amber-400 rotate-180"></svg>
                <span class="truncate">Export .sql</span>
              </button>
            }
          </div>

          <div class="pt-1 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/60">
            <div class="flex items-center gap-1.5 truncate">
              <span class="truncate">{{ mapStore.worldConfig().worldName }}</span>
              @if (mapStore.databaseBackend()) {
                <span
                  class="font-mono px-1 py-0.2 rounded text-[9px] font-bold border"
                  [class.bg-emerald-950]="mapStore.databaseBackend() === 'postgresql'"
                  [class.text-emerald-400]="mapStore.databaseBackend() === 'postgresql'"
                  [class.border-emerald-700]="mapStore.databaseBackend() === 'postgresql'"
                  [class.bg-cyan-950]="mapStore.databaseBackend() === 'sqlite3'"
                  [class.text-cyan-400]="mapStore.databaseBackend() === 'sqlite3'"
                  [class.border-cyan-700]="mapStore.databaseBackend() === 'sqlite3'">
                  {{ mapStore.databaseBackend() === 'postgresql' ? 'PGSQL' : 'SQLite' }}
                </span>
              }
            </div>
            <span class="font-mono text-emerald-400 font-semibold">~{{ mapStore.worldConfig().blockCount | number }} blocks</span>
          </div>

          <!-- Discovered World Regions & Island Hubs Quick-Jump List -->
          @if (mapStore.worldDatabase()?.discoveredRegions; as regions) {
            @if (regions.length > 0) {
              <div class="pt-2 border-t border-slate-800/80 space-y-1.5">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-1.5">
                    <span class="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                      {{ 'worldPanel.discoveredRegions' | translate }} ({{ regions.length }})
                    </span>
                    <button
                      type="button"
                      (click)="mapStore.toggleDiscoveredRegionsVisible()"
                      [appTooltip]="mapStore.discoveredRegionsVisible() ? 'Hide structure pins on map' : 'Show structure pins on map'"
                      tooltipPosition="top"
                      [class.text-sky-400]="mapStore.discoveredRegionsVisible()"
                      [class.text-slate-500]="!mapStore.discoveredRegionsVisible()"
                      class="p-0.5 rounded hover:bg-slate-800 transition">
                      @if (mapStore.discoveredRegionsVisible()) {
                        <svg lucideEye class="w-3 h-3"></svg>
                      } @else {
                        <svg lucideEyeOff class="w-3 h-3"></svg>
                      }
                    </button>
                  </div>
                  <button
                    type="button"
                    (click)="mapStore.fitWorldBounds()"
                    [appTooltip]="'worldPanel.fitWholeWorld' | translate"
                    [appTooltipShortcutId]="'view_fit_world'"
                    tooltipPosition="left"
                    class="px-1.5 py-0.5 rounded bg-sky-950/70 hover:bg-sky-900 border border-sky-700/60 text-[10px] text-sky-300 font-semibold transition cursor-pointer">
                    {{ 'worldPanel.fitWholeWorld' | translate }}
                  </button>
                </div>

                <div class="max-h-36 overflow-y-auto custom-scrollbar space-y-1 pr-1">
                  @for (region of regions; track region.id) {
                    <button
                      type="button"
                      (click)="mapStore.requestCameraJump(region.centerX, region.centerZ, 6.2)"
                      [appTooltip]="'Jump camera to ' + region.label + ' (' + region.kind + ' sector)'"
                      tooltipPosition="right"
                      class="w-full px-2 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 flex items-center justify-between text-left transition group cursor-pointer">
                      <span class="truncate font-medium text-slate-200 group-hover:text-emerald-300 text-[11px]">
                        {{ region.label }}
                      </span>
                      <span class="font-mono text-[10px] text-slate-400 flex-shrink-0 ml-1.5">
                        ~{{ region.blockCount | number }} blk
                      </span>
                    </button>
                  }
                </div>
              </div>
            }
          }
        </section>

        <!-- 2. Vertical Elevation / Depth Slicer (Sky Islands, Surface, Caves & Abyss) -->
        <section class="p-3 rounded-xl bg-slate-950/60 border border-sky-900/60 space-y-2.5">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-semibold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
              <svg lucideLayers class="w-3.5 h-3.5 text-sky-400"></svg>
              <span>{{ 'worldPanel.elevationSlicerTitle' | translate }}</span>
            </span>
            <span class="px-1.5 py-0.5 rounded bg-sky-950/80 border border-sky-800/70 font-mono text-[10px] text-sky-300">
              Y: {{ mapStore.verticalSlice().minY }}..{{ mapStore.verticalSlice().maxY }}
            </span>
          </div>

          <!-- Detected Vertical Layers or Standard Presets -->
          <div class="space-y-1">
            @for (layer of getDisplayVerticalLayers(); track layer.id) {
              <button
                type="button"
                (click)="onSelectVerticalLayer(layer.id)"
                [class.bg-sky-600/25]="mapStore.verticalSlice().presetId === layer.id"
                [class.border-sky-400]="mapStore.verticalSlice().presetId === layer.id"
                [class.border-slate-800]="mapStore.verticalSlice().presetId !== layer.id"
                class="w-full px-2.5 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800/90 border flex items-center justify-between text-left transition group">
                <div class="min-w-0 pr-2">
                  <div class="font-semibold text-[11px] text-slate-100 group-hover:text-sky-300 flex items-center gap-1.5">
                    <span class="truncate">{{ layer.label }}</span>
                    @if (layer.caveMode) {
                      <span class="px-1 py-0.2 rounded bg-amber-950/80 border border-amber-700/60 text-[9px] text-amber-300 font-mono">
                        X-Ray
                      </span>
                    }
                  </div>
                  <div class="text-[9px] text-slate-400 font-mono">
                    Y: {{ layer.minY }} to {{ layer.maxY }}
                    @if (layer.hotspotX !== 0 || layer.hotspotZ !== 0) {
                      <span class="text-emerald-400"> · Hub ({{ layer.hotspotX }}, {{ layer.hotspotZ }})</span>
                    }
                  </div>
                </div>
                <span class="font-mono text-[10px] text-sky-400 flex-shrink-0">
                  @if ((layer.estimatedBlocks ?? 0) > 0) {
                    ~{{ layer.estimatedBlocks | number }} blk
                  } @else {
                    Slice
                  }
                </span>
              </button>
            }
          </div>

          <!-- Custom Min Y / Max Y Range Inputs -->
          <div class="pt-1.5 border-t border-slate-800/80 space-y-2">
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="text-[10px] text-slate-400 block mb-1">{{ 'worldPanel.minYFloor' | translate }}</label>
                <input
                  type="number"
                  [ngModel]="mapStore.verticalSlice().minY"
                  (ngModelChange)="onCustomMinYChange(+$event)"
                  step="16"
                  min="-31000"
                  max="31000"
                  aria-label="Minimum Y Elevation"
                  class="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2 py-1 text-sky-300 font-mono text-xs focus:outline-none focus:border-sky-500" />
              </div>
              <div>
                <label class="text-[10px] text-slate-400 block mb-1">{{ 'worldPanel.maxYCeiling' | translate }}</label>
                <input
                  type="number"
                  [ngModel]="mapStore.verticalSlice().maxY"
                  (ngModelChange)="onCustomMaxYChange(+$event)"
                  step="16"
                  min="-31000"
                  max="31000"
                  aria-label="Maximum Y Elevation"
                  class="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2 py-1 text-emerald-300 font-mono text-xs focus:outline-none focus:border-sky-500" />
              </div>
            </div>

            <!-- Cave X-Ray Mode Toggle -->
            <label class="flex items-center justify-between p-2 rounded-lg bg-slate-900/90 hover:bg-slate-900 border border-slate-800 cursor-pointer transition">
              <div class="pr-2">
                <div class="font-semibold text-amber-300 text-[11px]">{{ 'worldPanel.caveXrayMode' | translate }}</div>
                <div class="text-[9px] text-slate-400">Hide solid stone ceiling to reveal underground caves &amp; lava</div>
              </div>
              <input
                type="checkbox"
                [checked]="mapStore.verticalSlice().caveMode"
                (change)="onToggleCaveMode()"
                class="w-4 h-4 accent-amber-500 rounded cursor-pointer flex-shrink-0" />
            </label>
          </div>
        </section>

        <!-- 3. View Mode Switcher (Visible on mobile < md; on desktop >= md this lives in the top Header bar) -->
        <section class="md:hidden p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
          <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <svg lucideLayers class="w-3.5 h-3.5 text-sky-400"></svg>
            <span>{{ 'worldPanel.viewModeSection' | translate }}</span>
          </span>

          <div class="grid grid-cols-3 gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
            <button
              type="button"
              (click)="mapStore.setViewMode('seed')"
              [class.bg-sky-600]="mapStore.viewMode() === 'seed'"
              [class.text-white]="mapStore.viewMode() === 'seed'"
              [class.text-slate-400]="mapStore.viewMode() !== 'seed'"
              class="py-1.5 px-1.5 rounded text-[11px] font-semibold transition text-center truncate">
              {{ 'worldPanel.modeSeed' | translate }}
            </button>
            <button
              type="button"
              (click)="mapStore.setViewMode('hybrid')"
              [class.bg-sky-600]="mapStore.viewMode() === 'hybrid'"
              [class.text-white]="mapStore.viewMode() === 'hybrid'"
              [class.text-slate-400]="mapStore.viewMode() !== 'hybrid'"
              class="py-1.5 px-1.5 rounded text-[11px] font-semibold transition text-center truncate">
              {{ 'header.modeHybridShort' | translate }}
            </button>
            <button
              type="button"
              (click)="mapStore.setViewMode('db')"
              [class.bg-sky-600]="mapStore.viewMode() === 'db'"
              [class.text-white]="mapStore.viewMode() === 'db'"
              [class.text-slate-400]="mapStore.viewMode() !== 'db'"
              class="py-1.5 px-1.5 rounded text-[11px] font-semibold transition text-center truncate">
              {{ 'header.modeDbShort' | translate }}
            </button>
          </div>
        </section>

        <!-- 4. Seed & Mapgen Parameters -->
        <section class="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2.5">
          <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <svg lucideSparkles class="w-3.5 h-3.5 text-amber-400"></svg>
            <span>{{ 'worldPanel.seedSection' | translate }}</span>
          </span>

          <div>
            <label class="text-[11px] text-slate-400 block mb-1">{{ 'header.worldName' | translate }}</label>
            <input
              type="text"
              [ngModel]="mapStore.worldConfig().worldName"
              (ngModelChange)="mapStore.setWorldName($event)"
              aria-label="World Name"
              class="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-slate-200 font-medium text-xs focus:outline-none focus:border-sky-500" />
          </div>

          <div>
            <label class="text-[11px] text-slate-400 block mb-1">{{ 'worldPanel.seedInput' | translate }}</label>
            <div class="flex items-center gap-1.5">
              <input
                type="text"
                [ngModel]="mapStore.worldConfig().seed"
                (ngModelChange)="mapStore.setSeed($event)"
                aria-label="World Seed"
                class="flex-1 min-w-0 bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-sky-400 font-mono font-semibold text-xs focus:outline-none focus:border-sky-500" />
              <button
                type="button"
                (click)="mapStore.randomizeSeed()"
                [appTooltip]="'worldPanel.randomize' | translate"
                [appTooltipShortcutId]="'seed_random'"
                aria-label="Randomize Seed"
                class="px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-semibold flex items-center gap-1 transition cursor-pointer">
                <svg lucideSparkles class="w-3.5 h-3.5"></svg>
              </button>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="text-[11px] text-slate-400 block mb-1">{{ 'worldPanel.mapgenType' | translate }}</label>
              <select
                [ngModel]="mapStore.worldConfig().mapgen"
                (ngModelChange)="mapStore.setMapgen($event)"
                aria-label="Mapgen Type"
                class="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2 py-1.5 text-slate-200 font-semibold text-xs uppercase focus:outline-none focus:border-sky-500">
                <option value="v7">Mapgen v7</option>
                <option value="valleys">Valleys</option>
                <option value="carpathian">Carpathian</option>
                <option value="flat">Flat</option>
              </select>
            </div>

            <div>
              <label class="text-[11px] text-slate-400 block mb-1">{{ 'worldPanel.waterLevel' | translate }}</label>
              <input
                type="number"
                [ngModel]="mapStore.worldConfig().waterLevel"
                (ngModelChange)="mapStore.setWaterLevel(+$event)"
                min="-32"
                max="64"
                aria-label="Water Level"
                class="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-slate-200 font-mono text-xs focus:outline-none focus:border-sky-500" />
            </div>
          </div>
        </section>

        <!-- 5. 3D Topography & Layer Overlays -->
        <section class="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2.5">
          <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <svg lucideMountain class="w-3.5 h-3.5 text-sky-400"></svg>
            <span>{{ 'worldPanel.layersSection' | translate }}</span>
          </span>

          <!-- Toggle Rows -->
          <div class="space-y-1.5">
            <label
              appTooltip="Enable WebGL Terrain-RGB 3D elevation mesh & camera pitch (Shortcut: 3)"
              tooltipPosition="right"
              class="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 hover:bg-slate-900 border border-slate-800/80 cursor-pointer transition">
              <span class="font-medium text-slate-200">{{ 'worldPanel.terrain3d' | translate }}</span>
              <input
                type="checkbox"
                [checked]="mapStore.terrain3dEnabled()"
                (change)="mapStore.toggleTerrain3D()"
                class="w-4 h-4 accent-sky-500 rounded cursor-pointer" />
            </label>

            @if (mapStore.terrain3dEnabled()) {
              <div class="px-2 py-1.5 bg-slate-900/50 rounded-lg border border-slate-800/60 space-y-1">
                <div class="flex justify-between text-[11px]">
                  <span class="text-slate-400">{{ 'worldPanel.exaggeration' | translate }}</span>
                  <span class="font-mono text-sky-400">{{ mapStore.terrainExaggeration().toFixed(1) }}×</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="3.0"
                  step="0.1"
                  aria-label="Vertical exaggeration"
                  [ngModel]="mapStore.terrainExaggeration()"
                  (ngModelChange)="mapStore.setTerrainExaggeration(+$event)"
                  class="w-full accent-sky-500 cursor-pointer" />

                <label
                  appTooltip="Extrude player buildings and structures into true 3D geometry with vertical walls"
                  tooltipPosition="right"
                  class="flex items-center justify-between pt-1 cursor-pointer">
                  <span class="text-[11px] text-slate-300">{{ 'worldPanel.buildingExtrusions' | translate }}</span>
                  <input
                    type="checkbox"
                    [checked]="mapStore.buildingExtrusions3dEnabled()"
                    (change)="mapStore.setBuildingExtrusions3dEnabled(!mapStore.buildingExtrusions3dEnabled())"
                    class="w-3.5 h-3.5 accent-emerald-500 rounded cursor-pointer" />
                </label>
              </div>
            }

            <label
              appTooltip="Render authentic 2.5D billboard tree & flora sapling sprites on the terrain (Shortcut: T)"
              tooltipPosition="right"
              class="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 hover:bg-slate-900 border border-slate-800/80 cursor-pointer transition">
              <span class="font-medium text-slate-200 flex items-center gap-1.5">
                <svg lucideTrees class="w-3.5 h-3.5 text-emerald-400"></svg>
                <span>{{ 'worldPanel.treeSprites' | translate }}</span>
              </span>
              <input
                type="checkbox"
                [checked]="mapStore.treeSpritesEnabled()"
                (change)="mapStore.toggleTreeSprites()"
                class="w-4 h-4 accent-emerald-500 rounded cursor-pointer" />
            </label>

            <label
              appTooltip="Color terrain using a topographic elevation color ramp instead of biome colors"
              tooltipPosition="right"
              class="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 hover:bg-slate-900 border border-slate-800/80 cursor-pointer transition">
              <span class="font-medium text-slate-200">{{ 'worldPanel.hypsometricColors' | translate }}</span>
              <input
                type="checkbox"
                [checked]="mapStore.hypsometricMode()"
                (change)="mapStore.toggleHypsometricMode()"
                class="w-4 h-4 accent-amber-500 rounded cursor-pointer" />
            </label>

            <label
              appTooltip="Apply NW-to-SE directional sunlight and ambient occlusion slope shading (Shortcut: L)"
              tooltipPosition="right"
              class="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 hover:bg-slate-900 border border-slate-800/80 cursor-pointer transition">
              <span class="font-medium text-slate-200">{{ 'worldPanel.hillshade' | translate }}</span>
              <input
                type="checkbox"
                [checked]="mapStore.hillshadeEnabled()"
                (change)="mapStore.toggleHillshade()"
                class="w-4 h-4 accent-sky-500 rounded cursor-pointer" />
            </label>

            <label
              appTooltip="Draw dark contour lines along Voronoi biome transition boundaries (Shortcut: V)"
              tooltipPosition="right"
              class="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 hover:bg-slate-900 border border-slate-800/80 cursor-pointer transition">
              <span class="font-medium text-slate-200">{{ 'worldPanel.voronoiContours' | translate }}</span>
              <input
                type="checkbox"
                [checked]="mapStore.voronoiContoursEnabled()"
                (change)="mapStore.toggleVoronoiContours()"
                class="w-4 h-4 accent-sky-500 rounded cursor-pointer" />
            </label>

            <label
              appTooltip="Overlay 16×16 MapBlock and 80×80 MapChunk coordinate grid lines (Shortcut: G)"
              tooltipPosition="right"
              class="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 hover:bg-slate-900 border border-slate-800/80 cursor-pointer transition">
              <span class="font-medium text-slate-200">{{ 'worldPanel.chunkGrid' | translate }}</span>
              <input
                type="checkbox"
                [checked]="mapStore.chunkGridEnabled()"
                (change)="mapStore.toggleChunkGrid()"
                class="w-4 h-4 accent-sky-500 rounded cursor-pointer" />
            </label>

            <label
              appTooltip="Highlight the outer boundary between explored map.sqlite blocks and unexplored Seed biomes in Hybrid mode"
              tooltipPosition="right"
              class="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 hover:bg-slate-900 border border-slate-800/80 cursor-pointer transition">
              <span class="font-medium text-slate-200">{{ 'worldPanel.exploredBounds' | translate }}</span>
              <input
                type="checkbox"
                [checked]="mapStore.exploredBoundsEnabled()"
                (change)="mapStore.toggleExploredBounds()"
                class="w-4 h-4 accent-sky-500 rounded cursor-pointer" />
            </label>
          </div>
        </section>

        <!-- 6. Climate Noise Spread Tuning -->
        <section class="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2.5">
          <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <svg lucideSliders class="w-3.5 h-3.5 text-emerald-400"></svg>
            <span>{{ 'worldPanel.noiseParamsSection' | translate }}</span>
          </span>

          <div class="space-y-2">
            <div>
              <div class="flex justify-between text-[11px] mb-1">
                <span class="text-slate-400">{{ 'worldPanel.heatSpread' | translate }}</span>
                <span class="font-mono text-amber-400">{{ mapStore.worldConfig().heatNoise.spread[0] }}</span>
              </div>
              <input
                type="range"
                min="200"
                max="2000"
                step="50"
                [ngModel]="mapStore.worldConfig().heatNoise.spread[0]"
                (ngModelChange)="mapStore.setHeatSpread(+$event)"
                class="w-full accent-amber-500 cursor-pointer" />
            </div>

            <div>
              <div class="flex justify-between text-[11px] mb-1">
                <span class="text-slate-400">{{ 'worldPanel.humiditySpread' | translate }}</span>
                <span class="font-mono text-sky-400">{{ mapStore.worldConfig().humidityNoise.spread[0] }}</span>
              </div>
              <input
                type="range"
                min="200"
                max="2000"
                step="50"
                [ngModel]="mapStore.worldConfig().humidityNoise.spread[0]"
                (ngModelChange)="mapStore.setHumiditySpread(+$event)"
                class="w-full accent-sky-500 cursor-pointer" />
            </div>
          </div>
        </section>

        <!-- 7. Browser Storage & Tile Cache Section -->
        <section class="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2.5">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <svg lucideHardDrive class="w-3.5 h-3.5 text-cyan-400"></svg>
              <span>{{ 'worldPanel.storageSection' | translate }}</span>
            </span>
            @if (pwaStorage.isPersisted()) {
              <span class="px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-700/60 text-[9px] font-mono text-emerald-300 flex items-center gap-1">
                <svg lucideCheck class="w-2.5 h-2.5"></svg>
                <span>{{ 'worldPanel.persistedBadge' | translate }}</span>
              </span>
            } @else {
              <button
                type="button"
                (click)="requestPersistentStorage()"
                [appTooltip]="'Request persistent browser storage to avoid automatic eviction under disk pressure'"
                class="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[9px] text-slate-300 transition">
                {{ 'worldPanel.persistentStorage' | translate }}
              </button>
            }
          </div>

          <!-- Tile Cache Usage Meter -->
          @let quota = pwaStorage.quotaInfo();
          <div class="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/70 space-y-1.5">
            <div class="flex items-center justify-between text-[11px]">
              <span class="text-slate-300 font-medium">{{ 'worldPanel.tileCacheUsage' | translate }}</span>
              <span class="font-mono text-slate-400">
                <strong class="text-cyan-400">{{ quota?.tileCacheMb ?? 0 }} MB</strong> / 50 MB
              </span>
            </div>

            <!-- Progress bar -->
            <div class="h-1.5 w-full rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
              <div
                class="h-full rounded-full bg-gradient-to-r from-cyan-500 to-sky-400 transition-all duration-200"
                [style.width.%]="Math.min(100, (((quota?.tileCacheBytes ?? 0) / (50 * 1024 * 1024)) * 100))"></div>
            </div>

            <div class="flex items-center justify-between pt-1 text-[10px]">
              <span class="text-slate-400 truncate">
                {{ quota?.tileCacheCount ?? 0 }} {{ 'worldPanel.tilesCachedSuffix' | translate }}
              </span>
              <button
                type="button"
                (click)="clearTileCache()"
                [appTooltip]="'Clear all cached map tiles from IndexedDB to free space'"
                class="px-2 py-0.5 rounded bg-slate-800 hover:bg-rose-950/70 border border-slate-700 hover:border-rose-700 text-[10px] text-slate-300 hover:text-rose-300 flex items-center gap-1 transition">
                @if (cacheClearedFeedback()) {
                  <svg lucideCheck class="w-3 h-3 text-emerald-400"></svg>
                  <span class="text-emerald-400 font-semibold">{{ 'worldPanel.tileCacheCleared' | translate }}</span>
                } @else {
                  <svg lucideTrash2 class="w-3 h-3 text-slate-400"></svg>
                  <span>{{ 'worldPanel.clearTileCacheBtn' | translate }}</span>
                }
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  `
})
export class WorldPanelComponent {
  public readonly mapStore = inject(MapStore);
  public readonly worldLoader = inject(WorldLoaderService);
  public readonly workerPool = inject(WorkerPoolService);
  public readonly pwaStorage = inject(PwaStorageService);

  public readonly isDragOver = signal<boolean>(false);
  public readonly copiedPath = signal<boolean>(false);
  public readonly cacheClearedFeedback = signal<boolean>(false);
  public readonly Math = Math;
  public readonly formatDuration = formatDurationSeconds;

  public async onOpenWorldClicked(): Promise<void> {
    await this.worldLoader.openFilePicker();
  }

  public async onOpenDirectoryClicked(): Promise<void> {
    await this.worldLoader.openFilePicker({ directory: true });
  }

  public async clearTileCache(): Promise<void> {
    await this.pwaStorage.clearTileCache();
    this.workerPool.clearMemoryCache();
    this.cacheClearedFeedback.set(true);
    setTimeout(() => this.cacheClearedFeedback.set(false), 2500);
  }

  public async requestPersistentStorage(): Promise<void> {
    await this.pwaStorage.requestPersistentStorage();
  }

  public getDisplayVerticalLayers() {
    const dbLayers = this.mapStore.worldDatabase()?.verticalLayers;
    if (dbLayers && dbLayers.length > 0) {
      return dbLayers;
    }
    return (Object.keys(VERTICAL_SLICE_PRESETS) as Array<Exclude<VerticalSlicePresetId, 'custom'>>).map(
      id => ({
        id,
        label: VERTICAL_SLICE_PRESETS[id].label,
        description: VERTICAL_SLICE_PRESETS[id].badge,
        minY: VERTICAL_SLICE_PRESETS[id].minY,
        maxY: VERTICAL_SLICE_PRESETS[id].maxY,
        estimatedBlocks: 0,
        hotspotX: 0,
        hotspotZ: 0,
        caveMode: VERTICAL_SLICE_PRESETS[id].caveMode
      })
    );
  }

  public async onSelectVerticalLayer(id: VerticalSlicePresetId): Promise<void> {
    if (id === 'custom') return;
    await this.worldLoader.selectVerticalSlicePresetAndStream(id, true);
  }

  public async onCustomMinYChange(minY: number): Promise<void> {
    if (isNaN(minY)) return;
    const curr = this.mapStore.verticalSlice();
    this.mapStore.setCustomVerticalSlice(minY, Math.max(minY + 15, curr.maxY));
    await this.worldLoader.reloadActiveVerticalSlice();
  }

  public async onCustomMaxYChange(maxY: number): Promise<void> {
    if (isNaN(maxY)) return;
    const curr = this.mapStore.verticalSlice();
    this.mapStore.setCustomVerticalSlice(Math.min(curr.minY, maxY - 15), maxY);
    await this.worldLoader.reloadActiveVerticalSlice();
  }

  public async onToggleCaveMode(): Promise<void> {
    this.mapStore.toggleCaveMode();
    await this.worldLoader.reloadActiveVerticalSlice();
  }

  public onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(true);
  }

  public onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
  }

  public async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
    await this.worldLoader.handleDataTransferDrop(event.dataTransfer);
  }

  public copyMacWorldsPath(): void {
    copyWithSignalFeedback('~/Library/Application Support/minetest/worlds', this.copiedPath, 2500);
  }
}
