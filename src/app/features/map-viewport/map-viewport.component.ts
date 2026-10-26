import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  effect,
  inject,
  signal,
  untracked
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import maplibregl from 'maplibre-gl';
import { MapStore } from '../../core/state/map.store';
import { CoordProjectionService } from '../../core/services/coord-projection.service';
import { WorkerPoolService } from '../../core/services/worker-pool.service';
import { WorldLoaderService } from '../../core/services/world-loader.service';
import { RoutePlannerService } from '../../core/services/route-planner.service';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { formatDurationSeconds } from '../../core/utils/format.utils';
import {
  LucideCompass,
  LucideMountain,
  LucideGrid3x3,
  LucideZoomIn,
  LucideZoomOut,
  LucideCrosshair,
  LucideDownload,
  LucideLayers,
  LucideMapPin,
  LucideRoute,
  LucideCheck,
  LucideX
} from '@lucide/angular';

let protocolRegistered = false;

@Component({
  selector: 'app-map-viewport',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TooltipDirective,
    TranslatePipe,
    LucideCompass,
    LucideMountain,
    LucideGrid3x3,
    LucideZoomIn,
    LucideZoomOut,
    LucideCrosshair,
    LucideDownload,
    LucideLayers,
    LucideMapPin,
    LucideRoute,
    LucideCheck,
    LucideX
  ],
  template: `
    <div class="relative w-full h-full bg-slate-950 overflow-hidden select-none">
      <!-- MapLibre GL JS WebGL Viewport Container -->
      <div #mapContainer class="w-full h-full" [class.cursor-crosshair]="routePlanner.pickingTarget() !== null"></div>

      <!-- 2D Overlay Canvas for MapBlock (16x16), MapChunk (80x80) Grid & Spawn Marker -->
      <canvas
        #gridCanvas
        class="absolute inset-0 w-full h-full pointer-events-none z-10"></canvas>

      <!-- Top-Left Floating Telemetry Pill & Interactive 3D Elevation Controls -->
      <div class="absolute top-3 left-3 z-20 flex flex-col gap-2 max-w-[calc(100vw-4.5rem)]">
        <div class="flex flex-wrap items-center gap-2 pointer-events-none">
          <div class="px-3 py-1.5 rounded-xl bg-slate-950/90 border border-slate-800/90 backdrop-blur-md shadow-xl flex items-center gap-2.5 text-xs pointer-events-auto">
            <span class="flex items-center gap-1.5 font-semibold text-sky-400">
              <svg lucideLayers class="w-3.5 h-3.5"></svg>
              <span class="uppercase">{{ mapStore.viewMode() }}</span>
            </span>
            <span class="h-3.5 w-px bg-slate-800"></span>
            <span class="font-mono text-slate-300">
              Seed: <strong class="text-white">{{ mapStore.worldConfig().seed }}</strong>
            </span>
            <span class="hidden sm:inline h-3.5 w-px bg-slate-800"></span>
            <span class="hidden sm:inline font-mono text-emerald-400 uppercase">
              {{ mapStore.worldConfig().mapgen }}
            </span>
          </div>

          <!-- Quick 2D / 3D Elevation & Hypsometric Toggles -->
          <div class="px-2 py-1 rounded-xl bg-slate-950/90 border border-slate-800/90 backdrop-blur-md shadow-xl flex items-center gap-1.5 text-xs pointer-events-auto">
            <button
              type="button"
              (click)="mapStore.toggleTerrain3D()"
              [class.bg-sky-600]="mapStore.terrain3dEnabled()"
              [class.text-white]="mapStore.terrain3dEnabled()"
              [class.text-slate-300]="!mapStore.terrain3dEnabled()"
              [appTooltip]="'Toggle 3D WebGL terrain elevation relief and hillshading'"
              [appTooltipShortcutId]="'view_3d'"
              class="px-2 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition">
              <svg lucideMountain class="w-3.5 h-3.5"></svg>
              <span>{{ mapStore.terrain3dEnabled() ? '3D Relief ON' : '2D Flat' }}</span>
            </button>

            <button
              type="button"
              (click)="mapStore.toggleHypsometricMode()"
              [class.bg-amber-600]="mapStore.hypsometricMode()"
              [class.text-white]="mapStore.hypsometricMode()"
              [class.text-slate-300]="!mapStore.hypsometricMode()"
              [appTooltip]="'Color map by Elevation Height Ramp instead of Biome Colors'"
              class="px-2 py-1 rounded-lg font-semibold transition">
              {{ mapStore.hypsometricMode() ? 'Elev Colors' : 'Biome Colors' }}
            </button>
          </div>

          <!-- Quick Vertical Depth / Elevation Slicer Pills (Sky Islands / Surface / Caves / Abyss) -->
          <div class="px-1.5 py-1 rounded-xl bg-slate-950/90 border border-sky-900/70 backdrop-blur-md shadow-xl flex items-center gap-1 text-[11px] pointer-events-auto">
            <span class="px-1.5 font-mono text-[10px] text-sky-400 hidden md:inline">Y-Slice:</span>
            <button
              type="button"
              (click)="worldLoader.selectVerticalSlicePresetAndStream('floatlands', true)"
              [class.bg-sky-600]="mapStore.verticalSlice().presetId === 'floatlands'"
              [class.text-white]="mapStore.verticalSlice().presetId === 'floatlands'"
              [class.text-slate-300]="mapStore.verticalSlice().presetId !== 'floatlands'"
              [appTooltip]="'Sky Islands / Floatlands (Y: +480 to +1,760)'"
              class="px-2 py-0.5 rounded-lg font-semibold transition">
              Sky Islands
            </button>
            <button
              type="button"
              (click)="worldLoader.selectVerticalSlicePresetAndStream('surface', true)"
              [class.bg-emerald-600]="mapStore.verticalSlice().presetId === 'surface'"
              [class.text-white]="mapStore.verticalSlice().presetId === 'surface'"
              [class.text-slate-300]="mapStore.verticalSlice().presetId !== 'surface'"
              [appTooltip]="'Main World Surface & Ocean (Y: -16 to +240)'"
              class="px-2 py-0.5 rounded-lg font-semibold transition">
              Surface
            </button>
            <button
              type="button"
              (click)="worldLoader.selectVerticalSlicePresetAndStream('caves', true)"
              [class.bg-amber-600]="mapStore.verticalSlice().presetId === 'caves'"
              [class.text-white]="mapStore.verticalSlice().presetId === 'caves'"
              [class.text-slate-300]="mapStore.verticalSlice().presetId !== 'caves'"
              [appTooltip]="'Underground Caves & Mines X-Ray (Y: -1,024 to -17)'"
              class="px-2 py-0.5 rounded-lg font-semibold transition">
              Caves
            </button>
            <button
              type="button"
              (click)="worldLoader.selectVerticalSlicePresetAndStream('deep_caverns', true)"
              [class.bg-purple-600]="mapStore.verticalSlice().presetId === 'deep_caverns'"
              [class.text-white]="mapStore.verticalSlice().presetId === 'deep_caverns'"
              [class.text-slate-300]="mapStore.verticalSlice().presetId !== 'deep_caverns'"
              [appTooltip]="'Deep Caverns & Magma X-Ray (Y: -10,240 to -1,025)'"
              class="hidden sm:inline-block px-2 py-0.5 rounded-lg font-semibold transition">
              Deep Caverns
            </button>
            <button
              type="button"
              (click)="worldLoader.selectVerticalSlicePresetAndStream('abyss', true)"
              [class.bg-rose-600]="mapStore.verticalSlice().presetId === 'abyss'"
              [class.text-white]="mapStore.verticalSlice().presetId === 'abyss'"
              [class.text-slate-300]="mapStore.verticalSlice().presetId !== 'abyss'"
              [appTooltip]="'Deep Abyss / Underworld X-Ray (Y: -31,000 to -10,241)'"
              class="hidden lg:inline-block px-2 py-0.5 rounded-lg font-semibold transition">
              Abyss
            </button>
          </div>

          <!-- Zoom & Downsampling (LOD) Presets Bar -->
          <div
            class="px-2 py-1 rounded-xl bg-slate-950/90 border border-slate-800/90 backdrop-blur-md shadow-xl flex items-center gap-1 text-[11px] pointer-events-auto">
            <span
              [appTooltip]="'Current MapLibre camera zoom level and active downsampling / LOD tier'"
              class="text-sky-400 font-mono font-bold px-1.5 py-0.5 rounded bg-slate-900/90 border border-slate-800">
              Z:{{ mapStore.cameraState().zoom.toFixed(1) }}
            </span>

            @for (preset of zoomLodPresets; track preset.id) {
              <button
                type="button"
                (click)="selectZoomPreset(preset.zoom)"
                [class.bg-sky-600]="getActiveLodPreset().id === preset.id"
                [class.text-white]="getActiveLodPreset().id === preset.id"
                [class.text-slate-300]="getActiveLodPreset().id !== preset.id"
                [class.hover:bg-slate-800]="getActiveLodPreset().id !== preset.id"
                [appTooltip]="preset.tooltip"
                class="px-2 py-0.5 rounded-lg font-semibold transition flex items-center gap-1">
                <span>{{ preset.shortLabel }}</span>
                <span class="hidden xl:inline text-[10px] font-mono opacity-80">({{ preset.resBadge }})</span>
              </button>
            }
          </div>

          @if (mapStore.isLoadingWorld() || worldLoader.isStreamingRegion() || workerPool.activeTasksCount() > 0) {
            @let prog = mapStore.loadProgress() || worldLoader.streamProgress();
            <div
              role="status"
              aria-live="polite"
              class="relative overflow-hidden px-2.5 py-1 rounded-xl bg-sky-950/90 border border-sky-700/80 text-sky-200 text-[11px] font-mono flex items-center gap-2 shadow-lg pointer-events-auto">
              <div class="w-3 h-3 border-2 border-sky-400 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
              @if (prog) {
                <span class="truncate max-w-[260px] sm:max-w-[400px]">
                  <span class="text-sky-300">{{ prog.phase === 'viewport-stream' ? prog.label : 'Loading World:' }}</span>
                  <strong class="text-emerald-400 ml-1">{{ prog.percent }}%</strong>
                  <span class="text-slate-300 ml-1">({{ prog.current.toLocaleString() }}/{{ prog.total.toLocaleString() }} {{ prog.unit }})</span>
                  @if (prog.etaSeconds !== null && prog.etaSeconds > 0) {
                    <span class="text-amber-300 ml-1">• ~{{ formatDuration(prog.etaSeconds) }}</span>
                  }
                </span>
                <button
                  type="button"
                  (click)="worldLoader.cancelActiveStreaming()"
                  [appTooltip]="'Stop background sector streaming and explore decoded map immediately'"
                  aria-label="Stop streaming"
                  class="ml-0.5 p-0.5 rounded hover:bg-rose-900/70 text-slate-300 hover:text-rose-200 transition">
                  <svg lucideX class="w-3 h-3"></svg>
                </button>
                <!-- Embedded Bottom Progress Bar Track -->
                <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900/90">
                  <div
                    class="h-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-all duration-150 ease-out"
                    [style.width.%]="prog.percent"></div>
                </div>
              } @else {
                <span>
                  {{ worldLoader.isStreamingRegion() ? 'Streaming SQLite blocks...' : 'Baking 3D tiles (' + workerPool.activeTasksCount() + ')...' }}
                </span>
              }
            </div>
          }
        </div>

        <!-- Interactive 3D Camera Pitch, Orbit & Vertical Scale HUD Bar (Visible when 3D Relief is ON) -->
        @if (mapStore.terrain3dEnabled()) {
          <div class="hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-xl bg-slate-950/90 border border-sky-900/60 backdrop-blur-md shadow-xl text-[11px] text-slate-300 w-fit">
            <div class="flex items-center gap-1.5">
              <span class="text-slate-400 font-medium">Tilt:</span>
              <input
                type="range"
                min="0"
                max="72"
                step="1"
                [ngModel]="mapStore.cameraState().pitch"
                (ngModelChange)="setCameraPitch(+$event)"
                class="w-16 accent-sky-500 cursor-pointer" />
              <span class="font-mono text-sky-400 w-7">{{ mapStore.cameraState().pitch.toFixed(0) }}°</span>
            </div>

            <span class="h-3.5 w-px bg-slate-800"></span>

            <div class="flex items-center gap-1.5">
              <span class="text-slate-400 font-medium">Orbit:</span>
              <input
                type="range"
                min="-180"
                max="180"
                step="2"
                [ngModel]="mapStore.cameraState().bearing"
                (ngModelChange)="setCameraBearing(+$event)"
                class="w-16 accent-amber-500 cursor-pointer" />
              <span class="font-mono text-amber-400 w-9">{{ mapStore.cameraState().bearing.toFixed(0) }}°</span>
            </div>

            <span class="h-3.5 w-px bg-slate-800"></span>

            <div class="flex items-center gap-1.5">
              <span class="text-slate-400 font-medium">3D Scale:</span>
              <input
                type="range"
                min="0.4"
                max="3.0"
                step="0.1"
                [ngModel]="mapStore.terrainExaggeration()"
                (ngModelChange)="mapStore.setTerrainExaggeration(+$event)"
                class="w-16 accent-emerald-500 cursor-pointer" />
              <span class="font-mono text-emerald-400 w-8">{{ mapStore.terrainExaggeration().toFixed(1) }}×</span>
            </div>
          </div>
        }
      </div>

      <!-- Top-Right Floating Camera & Viewport Toolbar -->
      <div class="absolute top-3 right-3 z-20 flex flex-col gap-1.5 bg-slate-950/90 border border-slate-800/90 backdrop-blur-md p-1.5 rounded-xl shadow-xl">
        <button
          type="button"
          (click)="zoomIn()"
          [appTooltip]="'viewport.zoomIn' | translate"
          tooltipPosition="left"
          aria-label="Zoom In"
          class="w-8 h-8 rounded-lg hover:bg-slate-800 flex items-center justify-center text-slate-200 transition active:scale-95">
          <svg lucideZoomIn class="w-4 h-4"></svg>
        </button>

        <div
          [appTooltip]="'Current Zoom: Z ' + mapStore.cameraState().zoom.toFixed(1) + ' (' + getActiveLodPreset().shortLabel + ' • ' + getActiveLodPreset().resBadge + ')'"
          tooltipPosition="left"
          class="w-8 py-1 rounded bg-slate-900/90 border border-slate-800/80 text-center font-mono text-[10px] font-bold text-sky-400 select-none">
          {{ mapStore.cameraState().zoom.toFixed(1) }}
        </div>

        <button
          type="button"
          (click)="zoomOut()"
          [appTooltip]="'viewport.zoomOut' | translate"
          tooltipPosition="left"
          aria-label="Zoom Out"
          class="w-8 h-8 rounded-lg hover:bg-slate-800 flex items-center justify-center text-slate-200 transition active:scale-95">
          <svg lucideZoomOut class="w-4 h-4"></svg>
        </button>

        <div class="h-px w-full bg-slate-800"></div>

        <button
          type="button"
          (click)="mapStore.requestCameraJump(0, 0, 6.4)"
          [appTooltip]="'viewport.centerOrigin' | translate"
          [appTooltipShortcutId]="'view_origin'"
          tooltipPosition="left"
          aria-label="Jump to Spawn (0, 0)"
          class="w-8 h-8 rounded-lg hover:bg-slate-800 flex items-center justify-center text-sky-400 transition active:scale-95">
          <svg lucideCrosshair class="w-4 h-4"></svg>
        </button>

        <button
          type="button"
          (click)="mapStore.addMarkerAtCursor()"
          [appTooltip]="('markers.pinAtCursor' | translate) + ' — or right-click anywhere on the map'"
          [appTooltipShortcutId]="'pin_marker'"
          tooltipPosition="left"
          aria-label="Pin Custom Marker at Cursor"
          class="w-8 h-8 rounded-lg hover:bg-slate-800 flex items-center justify-center text-rose-400 transition active:scale-95">
          <svg lucideMapPin class="w-4 h-4"></svg>
        </button>

        <button
          type="button"
          (click)="mapStore.toggleChunkGrid()"
          [appTooltip]="'viewport.toggleGrid' | translate"
          [appTooltipShortcutId]="'view_grid'"
          tooltipPosition="left"
          [class.bg-sky-600]="mapStore.chunkGridEnabled()"
          [class.text-white]="mapStore.chunkGridEnabled()"
          [class.text-slate-300]="!mapStore.chunkGridEnabled()"
          aria-label="Toggle MapBlock Grid"
          class="w-8 h-8 rounded-lg hover:bg-slate-800 flex items-center justify-center transition active:scale-95">
          <svg lucideGrid3x3 class="w-4 h-4"></svg>
        </button>

        <button
          type="button"
          (click)="routePlanner.toggleRouteVisible()"
          [appTooltip]="routePlanner.routeVisible() ? 'Hide Route on Map' : 'Show Route on Map'"
          tooltipPosition="left"
          [class.bg-sky-600]="routePlanner.routeVisible() && routePlanner.activeRoute() !== null"
          [class.text-white]="routePlanner.routeVisible() && routePlanner.activeRoute() !== null"
          [class.text-slate-300]="!routePlanner.routeVisible() || routePlanner.activeRoute() === null"
          aria-label="Toggle Route Overlay"
          class="w-8 h-8 rounded-lg hover:bg-slate-800 flex items-center justify-center transition active:scale-95">
          <svg lucideRoute class="w-4 h-4"></svg>
        </button>

        <button
          type="button"
          (click)="resetCameraBearing()"
          [appTooltip]="'viewport.resetNorth' | translate"
          tooltipPosition="left"
          aria-label="Reset North"
          class="w-8 h-8 rounded-lg hover:bg-slate-800 flex items-center justify-center text-amber-400 transition active:scale-95">
          <svg lucideCompass class="w-4 h-4"></svg>
        </button>

        <div class="h-px w-full bg-slate-800"></div>

        <button
          type="button"
          (click)="exportMapScreenshot()"
          [appTooltip]="'viewport.exportPng' | translate"
          tooltipPosition="left"
          aria-label="Export Map Screenshot PNG"
          class="w-8 h-8 rounded-lg hover:bg-slate-800 flex items-center justify-center text-emerald-400 transition active:scale-95">
          <svg lucideDownload class="w-4 h-4"></svg>
        </button>
      </div>

      <!-- Top Interactive Picking Target Banner -->
      @if (routePlanner.pickingTarget(); as target) {
        <div
          role="alert"
          aria-live="assertive"
          class="absolute top-16 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-xl bg-slate-950/95 border border-sky-500/80 shadow-2xl backdrop-blur-md flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-150">
          <div class="relative flex items-center justify-center">
            <span class="w-2.5 h-2.5 rounded-full bg-sky-400 animate-ping absolute"></span>
            <span class="w-2.5 h-2.5 rounded-full bg-sky-400 relative"></span>
          </div>
          <span class="text-xs font-semibold text-sky-100">
            {{ target === 'start' ? ('routes.setAsStart' | translate) : ('routes.setAsDest' | translate) }} — {{ 'routes.pickOnMapHint' | translate }}
          </span>
          <button
            type="button"
            (click)="routePlanner.setPickingTarget(null)"
            class="px-2.5 py-0.5 rounded bg-sky-900/80 hover:bg-sky-800 text-[11px] font-medium text-sky-200 border border-sky-700/60 transition active:scale-95">
            {{ 'common.cancel' | translate }}
          </button>
        </div>
      }

      <!-- Copied Command Toast Feedback -->
      @if (copiedFeedback(); as feedback) {
        <div
          role="status"
          aria-live="polite"
          class="absolute bottom-14 left-1/2 -translate-x-1/2 z-30 px-3.5 py-1.5 rounded-xl bg-slate-900/95 border border-emerald-500/70 text-emerald-200 text-xs shadow-2xl backdrop-blur-md flex items-center gap-2 animate-in fade-in duration-150">
          <svg lucideCheck class="w-3.5 h-3.5 text-emerald-400"></svg>
          <span class="font-mono">{{ feedback }}</span>
        </div>
      }

      <!-- Right-Click Context Menu -->
      @if (contextMenu(); as menu) {
        <div
          class="fixed inset-0 z-40 bg-transparent"
          (click)="contextMenu.set(null)"
          (contextmenu)="$event.preventDefault(); contextMenu.set(null)"></div>

        <div
          class="absolute z-50 w-56 rounded-xl bg-slate-950/95 border border-slate-700/80 shadow-2xl backdrop-blur-md p-1.5 flex flex-col gap-0.5 text-xs text-slate-200 select-none animate-in fade-in zoom-in-95 duration-100"
          [style.left.px]="menu.screenX"
          [style.top.px]="menu.screenY">
          <div class="px-2.5 py-1.5 border-b border-slate-800/80 font-mono text-[11px] text-slate-400 flex items-center justify-between">
            <span class="text-sky-400 font-semibold">Pos: {{ menu.x }}, {{ menu.y }}, {{ menu.z }}</span>
            <span class="text-[10px] text-slate-500 uppercase">Luanti</span>
          </div>

          <button
            type="button"
            (click)="setRouteStartFromContext()"
            class="w-full px-2.5 py-1.5 rounded-lg hover:bg-emerald-950/70 hover:text-emerald-300 flex items-center gap-2 text-left transition font-medium">
            <svg lucideMapPin class="w-3.5 h-3.5 text-emerald-400"></svg>
            <span>{{ 'routes.setAsStart' | translate }}</span>
          </button>

          <button
            type="button"
            (click)="setRouteDestFromContext()"
            class="w-full px-2.5 py-1.5 rounded-lg hover:bg-rose-950/70 hover:text-rose-300 flex items-center gap-2 text-left transition font-medium">
            <svg lucideMapPin class="w-3.5 h-3.5 text-rose-400"></svg>
            <span>{{ 'routes.setAsDest' | translate }}</span>
          </button>

          <button
            type="button"
            (click)="addMarkerFromContext()"
            class="w-full px-2.5 py-1.5 rounded-lg hover:bg-amber-950/70 hover:text-amber-300 flex items-center gap-2 text-left transition font-medium">
            <svg lucideMapPin class="w-3.5 h-3.5 text-amber-400"></svg>
            <span>{{ 'markers.addMarker' | translate }}</span>
          </button>

          <div class="my-0.5 h-px bg-slate-800/80"></div>

          <button
            type="button"
            (click)="copyTeleportFromContext()"
            class="w-full px-2.5 py-1.5 rounded-lg hover:bg-sky-950/70 hover:text-sky-300 flex items-center gap-2 text-left transition font-medium">
            <svg lucideRoute class="w-3.5 h-3.5 text-sky-400"></svg>
            <span>{{ 'routes.copyTeleport' | translate }}</span>
          </button>
        </div>
      }

      <!-- Bottom Live Telemetry Status Bar Overlay -->
      @if (mapStore.cursorSample(); as sample) {
        <div class="absolute bottom-3 left-3 right-3 z-20 pointer-events-none flex items-center justify-between gap-2">
          <div class="px-3 py-1.5 rounded-xl bg-slate-950/90 border border-slate-800/90 backdrop-blur-md shadow-xl flex flex-wrap items-center gap-3 text-xs pointer-events-auto">
            <!-- Node Coordinates -->
            <div class="font-mono flex items-center gap-1.5">
              <span class="text-slate-400">Pos:</span>
              <span class="text-rose-400 font-semibold">X:{{ sample.x }}</span>
              <span class="text-emerald-400 font-semibold">Y:{{ sample.y }}</span>
              <span class="text-sky-400 font-semibold">Z:{{ sample.z }}</span>
            </div>

            <span class="hidden sm:inline h-3.5 w-px bg-slate-800"></span>

            <!-- MapBlock Coordinate -->
            <div class="hidden sm:flex font-mono items-center gap-1 text-[11px] text-slate-300">
              <span class="text-slate-500">Block:</span>
              <span>({{ sample.blockX }}, {{ sample.blockZ }})</span>
            </div>

            <span class="h-3.5 w-px bg-slate-800"></span>

            <!-- Active Zoom & Downsampling LOD Badge -->
            <div
              [appTooltip]="getActiveLodPreset().tooltip"
              class="font-mono flex items-center gap-1.5 text-[11px]">
              <span class="text-slate-400">Zoom:</span>
              <span class="text-sky-400 font-bold">{{ mapStore.cameraState().zoom.toFixed(1) }}</span>
              <span class="px-1.5 py-0.5 rounded bg-sky-950/90 border border-sky-800/80 text-sky-300 font-semibold text-[10px]">
                {{ getActiveLodPreset().shortLabel }} · {{ getActiveLodPreset().resBadge }}
              </span>
            </div>

            <span class="h-3.5 w-px bg-slate-800"></span>

            <!-- Active Biome Badge -->
            <div class="flex items-center gap-1.5">
              <span
                class="w-3 h-3 rounded-xs border border-white/40 flex-shrink-0"
                [style.background-color]="sample.biome.hexColor"></span>
              <span class="font-semibold text-slate-100">{{ sample.biome.name }}</span>
            </div>

            <span class="hidden md:inline h-3.5 w-px bg-slate-800"></span>

            <!-- Climate Values -->
            <div class="hidden md:flex items-center gap-2 font-mono text-[11px]">
              <span class="text-amber-400">Heat: {{ sample.heat.toFixed(1) }}°</span>
              <span class="text-sky-400">Hum: {{ sample.humidity.toFixed(1) }}%</span>
            </div>

            @if (sample.isExploredInDb && sample.dbNodeName) {
              <span class="hidden lg:inline h-3.5 w-px bg-slate-800"></span>
              <div class="hidden lg:flex items-center gap-1 font-mono text-[11px] text-purple-300">
                <span>DB:</span>
                <span class="font-semibold">{{ sample.dbNodeName }}</span>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `
})
export class MapViewportComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer') mapContainerRef?: ElementRef<HTMLDivElement>;
  @ViewChild('gridCanvas') gridCanvasRef?: ElementRef<HTMLCanvasElement>;

  public readonly mapStore = inject(MapStore);
  public readonly projection = inject(CoordProjectionService);
  public readonly workerPool = inject(WorkerPoolService);
  public readonly worldLoader = inject(WorldLoaderService);
  public readonly routePlanner = inject(RoutePlannerService);
  public readonly formatDuration = formatDurationSeconds;

  public readonly contextMenu = signal<{
    screenX: number;
    screenY: number;
    x: number;
    y: number;
    z: number;
  } | null>(null);

  public readonly copiedFeedback = signal<string | null>(null);

  public readonly zoomLodPresets: ReadonlyArray<{
    id: 'world_4x4' | 'region_2x2' | 'sector_1x1' | 'detail_1x1';
    shortLabel: string;
    resBadge: string;
    zoom: number;
    tooltip: string;
  }> = [
    {
      id: 'world_4x4',
      shortLabel: 'World 4×4',
      resBadge: '64n',
      zoom: 2.0,
      tooltip:
        'Zoom 2.0 — Whole-World 4×4 Macro Downsampling (1 sample per 4×4 MapBlocks = 64×64 nodes, 16× intra-block subsampling, B-Tree Z%4 skip-scan). Fastest whole-world streaming!'
    },
    {
      id: 'region_2x2',
      shortLabel: 'Region 2×2',
      resBadge: '32n',
      zoom: 3.0,
      tooltip:
        'Zoom 3.0 — Regional 2×2 Macro Downsampling (1 sample per 2×2 MapBlocks = 32×32 nodes, 4× intra-block subsampling) for the visible region around the camera.'
    },
    {
      id: 'sector_1x1',
      shortLabel: 'Sector 1×1',
      resBadge: '16n',
      zoom: 4.5,
      tooltip:
        'Zoom 4.5 — High-Res 1×1 MapBlock Sector Streaming (16×16 node blocks) with full block-level and sub-block detail.'
    },
    {
      id: 'detail_1x1',
      shortLabel: 'Detail 1:1',
      resBadge: '1n',
      zoom: 7.2,
      tooltip:
        'Zoom 7.2 — Full 1:1 Luanti Voxel Node Resolution (every single 1×1 node rendered with 4-tap hillshading).'
    }
  ];

  public getActiveLodPreset(): {
    id: 'world_4x4' | 'region_2x2' | 'sector_1x1' | 'detail_1x1';
    shortLabel: string;
    resBadge: string;
    zoom: number;
    tooltip: string;
  } {
    const z = this.mapStore.cameraState().zoom;
    if (z < 2.7) return this.zoomLodPresets[0];
    if (z < 3.8) return this.zoomLodPresets[1];
    if (z < 6.0) return this.zoomLodPresets[2];
    return this.zoomLodPresets[3];
  }

  public selectZoomPreset(targetZoom: number): void {
    this.mapStore.setCameraZoomPreset(targetZoom);
  }

  private map: maplibregl.Map | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    try {
      // React to seed / mode / layer changes by refreshing custom protocol source tiles
      effect(() => {
        const rev = this.mapStore.renderRevision();
        untracked(() => {
          this.refreshMapTiles(rev);
        });
      });

      // React to 3D Terrain toggle & exaggeration
      effect(() => {
        const enabled3d = this.mapStore.terrain3dEnabled();
        const exaggeration = this.mapStore.terrainExaggeration();
        untracked(() => {
          this.apply3DTerrainState(enabled3d, exaggeration);
        });
      });

      // React to grid toggle, markers, and discovered regions
      effect(() => {
        this.mapStore.chunkGridEnabled();
        this.mapStore.markers();
        this.mapStore.markersVisible();
        this.mapStore.selectedMarkerId();
        this.mapStore.worldDatabase();
        untracked(() => {
          this.drawCoordinateGridOverlay();
        });
      });

      // React to route planner changes
      effect(() => {
        this.routePlanner.activeRoute();
        this.routePlanner.routeVisible();
        this.routePlanner.hoveredPoint();
        this.routePlanner.startWaypoint();
        this.routePlanner.destinationWaypoint();
        untracked(() => {
          this.drawCoordinateGridOverlay();
        });
      });

      // React to camera jump requests
      effect(() => {
        const req = this.mapStore.cameraJumpRequest();
        if (req && this.map) {
          untracked(() => {
            const targetZoom = req.zoom ?? this.map!.getZoom();
            this.worldLoader.streamViewportBlocks(req.x, req.z, targetZoom);
            const [lng, lat] = this.projection.luantiToLngLat(req.x, req.z);
            this.map?.flyTo({
              center: [lng, lat],
              zoom: targetZoom,
              duration: 550
            });
          });
        }
      });
    } catch {
      // Ignore outside injection context in unit tests
    }
  }

  public ngAfterViewInit(): void {
    this.registerLuantiProtocolOnce();
    this.initMapLibre();
  }

  public ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.map?.remove();
    this.map = null;
  }

  private registerLuantiProtocolOnce(): void {
    if (protocolRegistered || typeof window === 'undefined') return;
    protocolRegistered = true;

    maplibregl.addProtocol('luanti', async params => {
      const match = params.url.match(/luanti:\/\/tiles\/(color|terrain-dem)\/(\d+)\/(\d+)\/(\d+)\/(\d+)/);
      if (!match) {
        return { data: new ArrayBuffer(0) };
      }

      const kind = match[1] as 'color' | 'terrain-dem';
      const rev = parseInt(match[2], 10);
      const z = parseInt(match[3], 10);
      const x = parseInt(match[4], 10);
      const y = parseInt(match[5], 10);

      const buffer = await this.workerPool.requestTile(kind, z, x, y, rev);
      return { data: buffer };
    });
  }

  private initMapLibre(): void {
    const container = this.mapContainerRef?.nativeElement;
    if (!container) return;

    try {
      const initialCam = this.mapStore.cameraState();
      const [initLng, initLat] = this.projection.luantiToLngLat(initialCam.x, initialCam.z);
      const rev = this.mapStore.renderRevision();

      this.map = new maplibregl.Map({
        container,
        style: {
          version: 8,
          sources: {
            'luanti-color': {
              type: 'raster',
              tiles: [`luanti://tiles/color/${rev}/{z}/{x}/{y}.png`],
              tileSize: 128,
              minzoom: 0,
              maxzoom: 14
            },
            'luanti-dem': {
              type: 'raster-dem',
              tiles: [`luanti://tiles/terrain-dem/${rev}/{z}/{x}/{y}.png`],
              tileSize: 128,
              minzoom: 0,
              maxzoom: 10,
              encoding: 'mapbox'
            }
          },
          layers: [
            {
              id: 'background',
              type: 'background',
              paint: {
                'background-color': '#090d16'
              }
            },
            {
              id: 'luanti-biome-layer',
              type: 'raster',
              source: 'luanti-color',
              paint: {
                'raster-resampling': 'nearest',
                'raster-fade-duration': 0
              }
            },
            {
              id: 'luanti-webgl-hillshade',
              type: 'hillshade',
              source: 'luanti-dem',
              maxzoom: 7,
              paint: {
                'hillshade-exaggeration': 0.28,
                'hillshade-shadow-color': '#020617',
                'hillshade-highlight-color': '#f8fafc',
                'hillshade-accent-color': '#0f172a'
              }
            }
          ]
        },
        center: [initLng, initLat],
        zoom: initialCam.zoom,
        pitch: initialCam.pitch,
        bearing: initialCam.bearing,
        maxPitch: 75,
        minZoom: 1,
        maxZoom: 14,
        maxTileCacheSize: 250,
        renderWorldCopies: false,
        attributionControl: false,
        canvasContextAttributes: {
          preserveDrawingBuffer: true,
          powerPreference: 'high-performance'
        }
      });

      this.map.on('style.load', () => {
        this.apply3DTerrainState(
          this.mapStore.terrain3dEnabled(),
          this.mapStore.terrainExaggeration()
        );
      });

      this.map.on('load', () => {
        this.apply3DTerrainState(
          this.mapStore.terrain3dEnabled(),
          this.mapStore.terrainExaggeration()
        );
        this.drawCoordinateGridOverlay();
      });

      this.map.on('click', e => {
        if (this.contextMenu()) {
          this.contextMenu.set(null);
          return;
        }

        const coords = this.projection.lngLatToLuanti(e.lngLat.lng, e.lngLat.lat);
        const picking = this.routePlanner.pickingTarget();
        if (picking) {
          this.routePlanner.setWaypointFromCoordinates(picking, coords.x, coords.z);
          this.routePlanner.calculateRoute();
          return;
        }
      });

      this.map.on('mousemove', e => {
        const coords = this.projection.lngLatToLuanti(e.lngLat.lng, e.lngLat.lat);
        this.mapStore.setCursorPos(coords.x, coords.z);
      });

      this.map.on('contextmenu', e => {
        e.preventDefault();
        const coords = this.projection.lngLatToLuanti(e.lngLat.lng, e.lngLat.lat);
        this.mapStore.setCursorPos(coords.x, coords.z);
        const sample = this.mapStore.cursorSample();
        const yVal = sample ? sample.y : 0;

        const container = this.mapContainerRef?.nativeElement;
        const width = container?.clientWidth || window.innerWidth;
        const height = container?.clientHeight || window.innerHeight;
        const popupW = 230;
        const popupH = 180;
        const posX = Math.min(e.point.x, width - popupW - 12);
        const posY = Math.min(e.point.y, height - popupH - 12);

        this.contextMenu.set({
          screenX: Math.max(12, posX),
          screenY: Math.max(12, posY),
          x: coords.x,
          y: yVal,
          z: coords.z
        });
      });

      this.map.on('move', () => {
        if (!this.map) return;
        const center = this.map.getCenter();
        const luantiCenter = this.projection.lngLatToLuanti(center.lng, center.lat);
        this.mapStore.cameraState.set({
          x: luantiCenter.x,
          z: luantiCenter.z,
          zoom: this.map.getZoom(),
          pitch: this.map.getPitch(),
          bearing: this.map.getBearing()
        });
        this.drawCoordinateGridOverlay();
      });

      this.map.on('moveend', () => {
        if (!this.map) return;
        const center = this.map.getCenter();
        const luantiCenter = this.projection.lngLatToLuanti(center.lng, center.lat);
        this.mapStore.saveCameraStateToStorage();
        this.worldLoader.streamViewportBlocks(luantiCenter.x, luantiCenter.z, this.map.getZoom());
      });

      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => {
          this.map?.resize();
          this.drawCoordinateGridOverlay();
        });
        this.resizeObserver.observe(container);
      }
    } catch {
      // Fallback in headless unit test environments without WebGL context
    }
  }

  private refreshMapTiles(rev: number): void {
    if (!this.map) return;

    try {
      const colorSource = this.map.getSource('luanti-color') as maplibregl.RasterTileSource | undefined;
      if (!colorSource) {
        this.map.once('style.load', () => this.refreshMapTiles(this.mapStore.renderRevision()));
        return;
      }
      if (typeof colorSource.setTiles === 'function') {
        colorSource.setTiles([`luanti://tiles/color/${rev}/{z}/{x}/{y}.png`]);
      }

      const demSource = this.map.getSource('luanti-dem') as maplibregl.RasterDEMTileSource | undefined;
      if (demSource && typeof demSource.setTiles === 'function') {
        demSource.setTiles([`luanti://tiles/terrain-dem/${rev}/{z}/{x}/{y}.png`]);
      }
    } catch {
      // Ignore if style is still initializing
    }
  }

  private apply3DTerrainState(enabled: boolean, exaggeration: number): void {
    if (!this.map) return;

    try {
      const demSource = this.map.getSource('luanti-dem');
      if (!demSource) {
        this.map.once('style.load', () =>
          this.apply3DTerrainState(
            this.mapStore.terrain3dEnabled(),
            this.mapStore.terrainExaggeration()
          )
        );
        return;
      }

      this.map.stop();

      if (enabled) {
        this.map.setMaxPitch(75);
        this.map.setTerrain({
          source: 'luanti-dem',
          exaggeration
        });
        if (this.map.getLayer('luanti-webgl-hillshade')) {
          this.map.setLayoutProperty('luanti-webgl-hillshade', 'visibility', 'visible');
        }
        if (this.map.getPitch() < 25) {
          this.map.easeTo({ pitch: 54, bearing: -18, duration: 450 });
        }
      } else {
        this.map.setTerrain(null);
        if (this.map.getLayer('luanti-webgl-hillshade')) {
          this.map.setLayoutProperty('luanti-webgl-hillshade', 'visibility', 'none');
        }
        this.map.easeTo({ pitch: 0, bearing: 0, duration: 300 });
      }

      this.map.triggerRepaint();
    } catch {
      // Retry once style finishes loading
    }
  }

  public setCameraPitch(pitch: number): void {
    this.map?.jumpTo({ pitch });
  }

  public setCameraBearing(bearing: number): void {
    this.map?.jumpTo({ bearing });
  }

  private drawCoordinateGridOverlay(): void {
    const canvas = this.gridCanvasRef?.nativeElement;
    if (!canvas || !this.map) return;

    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    if (this.mapStore.chunkGridEnabled()) {
      const zoom = this.map.getZoom();
      const step = zoom >= 8.2 ? 16 : zoom >= 6.0 ? 80 : zoom >= 3.8 ? 320 : 2048;

      // Use map.getBounds() (which clamps to the 3D horizon frustum) instead of unproject([0,0])
      // so sky pixels above the 3D horizon never invert behind the camera vanishing point!
      const mapBounds = this.map.getBounds();
      const sw = this.projection.lngLatToLuanti(mapBounds.getWest(), mapBounds.getSouth());
      const ne = this.projection.lngLatToLuanti(mapBounds.getEast(), mapBounds.getNorth());

      const rawMinX = Math.max(-32768, Math.min(sw.x, ne.x));
      const rawMaxX = Math.min(32768, Math.max(sw.x, ne.x));
      const rawMinZ = Math.max(-32768, Math.min(sw.z, ne.z));
      const rawMaxZ = Math.min(32768, Math.max(sw.z, ne.z));

      const minX = Math.ceil(rawMinX / step) * step;
      const maxX = Math.floor(rawMaxX / step) * step;
      const minZ = Math.ceil(rawMinZ / step) * step;
      const maxZ = Math.floor(rawMaxZ / step) * step;

      // Determine top-most ground Y on screen so grid lines never bleed into the 3D sky above the horizon
      const nwScreen = this.map.project([mapBounds.getWest(), mapBounds.getNorth()]);
      const neScreen = this.map.project([mapBounds.getEast(), mapBounds.getNorth()]);
      const swScreen = this.map.project([mapBounds.getWest(), mapBounds.getSouth()]);
      const seScreen = this.map.project([mapBounds.getEast(), mapBounds.getSouth()]);
      const horizonTopY = Math.max(
        0,
        Math.min(nwScreen.y, neScreen.y, swScreen.y, seScreen.y)
      );

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, horizonTopY, rect.width, Math.max(0, rect.height - horizonTopY));
      ctx.clip();
      ctx.lineWidth = 1;

      const maxLines = 160;
      const countX = Math.floor((maxX - minX) / step);
      if (countX >= 0 && countX <= maxLines) {
        for (let x = minX; x <= maxX; x += step) {
          const [lng1, lat1] = this.projection.luantiToLngLat(x, rawMinZ);
          const [lng2, lat2] = this.projection.luantiToLngLat(x, rawMaxZ);
          const p1 = this.map.project([lng1, lat1]);
          const p2 = this.map.project([lng2, lat2]);

          ctx.strokeStyle = x === 0 ? 'rgba(244, 63, 94, 0.55)' : 'rgba(148, 163, 184, 0.16)';
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }

      const countZ = Math.floor((maxZ - minZ) / step);
      if (countZ >= 0 && countZ <= maxLines) {
        for (let z = minZ; z <= maxZ; z += step) {
          const [lng1, lat1] = this.projection.luantiToLngLat(rawMinX, z);
          const [lng2, lat2] = this.projection.luantiToLngLat(rawMaxX, z);
          const p1 = this.map.project([lng1, lat1]);
          const p2 = this.map.project([lng2, lat2]);

          ctx.strokeStyle = z === 0 ? 'rgba(56, 189, 248, 0.55)' : 'rgba(148, 163, 184, 0.16)';
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }

      ctx.restore();
    }

    // Draw Origin (0, 0) Spawn Reticle Marker & Discovered Region Pins
    const regions = this.mapStore.worldDatabase()?.discoveredRegions || [];
    for (const region of regions) {
      if (region.kind === 'spawn') continue;
      const [rLng, rLat] = this.projection.luantiToLngLat(region.centerX, region.centerZ);
      const rPt = this.map.project([rLng, rLat]);
      if (rPt.x >= -40 && rPt.x <= rect.width + 40 && rPt.y >= -40 && rPt.y <= rect.height + 40) {
        ctx.save();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        ctx.strokeStyle =
          region.kind === 'base'
            ? '#38bdf8'
            : region.kind === 'expedition'
              ? '#f59e0b'
              : '#10b981';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(rPt.x, rPt.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle =
          region.kind === 'base'
            ? '#bae6fd'
            : region.kind === 'expedition'
              ? '#fde68a'
              : '#a7f3d0';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(region.label, rPt.x + 8, rPt.y + 3);
        ctx.restore();
      }
    }

    // Draw Custom User Map Markers
    if (this.mapStore.markersVisible()) {
      const markers = this.mapStore.markers();
      const selectedId = this.mapStore.selectedMarkerId();
      for (const marker of markers) {
        const [mLng, mLat] = this.projection.luantiToLngLat(marker.x, marker.z);
        const mPt = this.map.project([mLng, mLat]);
        if (mPt.x >= -60 && mPt.x <= rect.width + 60 && mPt.y >= -60 && mPt.y <= rect.height + 60) {
          const isSelected = marker.id === selectedId;
          ctx.save();

          if (isSelected) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(mPt.x, mPt.y, 9, 0, Math.PI * 2);
            ctx.stroke();
          }

          ctx.fillStyle = marker.color || '#f43f5e';
          ctx.strokeStyle = 'rgba(2, 6, 23, 0.92)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(mPt.x, mPt.y, isSelected ? 6.5 : 5.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.font = 'bold 10px monospace';
          const textMetrics = ctx.measureText(marker.label);
          const padX = 5;
          const boxX = mPt.x + 10;
          const boxY = mPt.y - 8;
          const boxW = textMetrics.width + padX * 2;
          const boxH = 16;

          ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
          ctx.strokeStyle = marker.color || '#f43f5e';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(boxX, boxY, boxW, boxH, 4);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#f8fafc';
          ctx.fillText(marker.label, boxX + padX, mPt.y + 3);
          ctx.restore();
        }
      }
    }

    const [originLng, originLat] = this.projection.luantiToLngLat(0, 0);
    const originPt = this.map.project([originLng, originLat]);
    if (
      originPt.x >= -20 &&
      originPt.x <= rect.width + 20 &&
      originPt.y >= -20 &&
      originPt.y <= rect.height + 20
    ) {
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(originPt.x, originPt.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('SPAWN (0,0)', originPt.x + 10, originPt.y + 3);
      ctx.restore();
    }

    // Draw Active Navigation Route Polyline, Beacons & Hover Reticle
    if (this.routePlanner.routeVisible()) {
      const plan = this.routePlanner.activeRoute();
      if (plan && plan.points.length > 1) {
        ctx.save();

        // 1. Outer glowing casing
        ctx.beginPath();
        let started = false;
        for (const pt of plan.points) {
          const [lng, lat] = this.projection.luantiToLngLat(pt.x, pt.z);
          const p = this.map.project([lng, lat]);
          if (!started) {
            ctx.moveTo(p.x, p.y);
            started = true;
          } else {
            ctx.lineTo(p.x, p.y);
          }
        }
        ctx.strokeStyle =
          plan.mode === 'sailing'
            ? 'rgba(56, 189, 248, 0.45)'
            : plan.mode === 'mining'
              ? 'rgba(245, 158, 11, 0.45)'
              : plan.mode === 'railway'
                ? 'rgba(168, 85, 247, 0.45)'
                : 'rgba(16, 185, 129, 0.45)';
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        // 2. Core crisp route stroke
        ctx.beginPath();
        started = false;
        for (const pt of plan.points) {
          const [lng, lat] = this.projection.luantiToLngLat(pt.x, pt.z);
          const p = this.map.project([lng, lat]);
          if (!started) {
            ctx.moveTo(p.x, p.y);
            started = true;
          } else {
            ctx.lineTo(p.x, p.y);
          }
        }
        if (plan.mode === 'direct') {
          ctx.setLineDash([8, 6]);
        }
        ctx.strokeStyle =
          plan.mode === 'sailing'
            ? '#38bdf8'
            : plan.mode === 'mining'
              ? '#fbbf24'
              : plan.mode === 'railway'
                ? '#c084fc'
                : '#10b981';
        ctx.lineWidth = 3.5;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // 3. Draw Start Waypoint (A) Beacon
      const startWp = this.routePlanner.startWaypoint();
      if (startWp) {
        const [aLng, aLat] = this.projection.luantiToLngLat(startWp.x, startWp.z);
        const aPt = this.map.project([aLng, aLat]);
        if (aPt.x >= -40 && aPt.x <= rect.width + 40 && aPt.y >= -40 && aPt.y <= rect.height + 40) {
          ctx.save();
          // Halo
          ctx.fillStyle = 'rgba(16, 185, 129, 0.35)';
          ctx.beginPath();
          ctx.arc(aPt.x, aPt.y, 14, 0, Math.PI * 2);
          ctx.fill();

          // Outer pin
          ctx.fillStyle = '#10b981';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(aPt.x, aPt.y, 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Letter A
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('A', aPt.x, aPt.y);

          // Label badge
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'left';
          ctx.fillStyle = 'rgba(2, 6, 23, 0.9)';
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 1;
          const aLabel = `A: (${startWp.x}, ${startWp.z})`;
          const aWidth = ctx.measureText(aLabel).width;
          ctx.beginPath();
          ctx.roundRect(aPt.x + 13, aPt.y - 8, aWidth + 8, 16, 4);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#a7f3d0';
          ctx.fillText(aLabel, aPt.x + 17, aPt.y + 3);
          ctx.restore();
        }
      }

      // 4. Draw Destination Waypoint (B) Beacon
      const destWp = this.routePlanner.destinationWaypoint();
      if (destWp) {
        const [bLng, bLat] = this.projection.luantiToLngLat(destWp.x, destWp.z);
        const bPt = this.map.project([bLng, bLat]);
        if (bPt.x >= -40 && bPt.x <= rect.width + 40 && bPt.y >= -40 && bPt.y <= rect.height + 40) {
          ctx.save();
          // Halo
          ctx.fillStyle = 'rgba(244, 63, 94, 0.35)';
          ctx.beginPath();
          ctx.arc(bPt.x, bPt.y, 14, 0, Math.PI * 2);
          ctx.fill();

          // Outer pin
          ctx.fillStyle = '#f43f5e';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(bPt.x, bPt.y, 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Letter B
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('B', bPt.x, bPt.y);

          // Label badge
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'left';
          ctx.fillStyle = 'rgba(2, 6, 23, 0.9)';
          ctx.strokeStyle = '#f43f5e';
          ctx.lineWidth = 1;
          const bLabel = `B: (${destWp.x}, ${destWp.z})`;
          const bWidth = ctx.measureText(bLabel).width;
          ctx.beginPath();
          ctx.roundRect(bPt.x + 13, bPt.y - 8, bWidth + 8, 16, 4);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#fecdd3';
          ctx.fillText(bLabel, bPt.x + 17, bPt.y + 3);
          ctx.restore();
        }
      }

      // 5. Draw Elevation Chart Hover Reticle
      const hovered = this.routePlanner.hoveredPoint();
      if (hovered) {
        const [hLng, hLat] = this.projection.luantiToLngLat(hovered.x, hovered.z);
        const hPt = this.map.project([hLng, hLat]);
        if (hPt.x >= -40 && hPt.x <= rect.width + 40 && hPt.y >= -40 && hPt.y <= rect.height + 40) {
          ctx.save();
          // Crosshair reticle
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.arc(hPt.x, hPt.y, 11, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.arc(hPt.x, hPt.y, 3.5, 0, Math.PI * 2);
          ctx.fill();

          // Pill
          ctx.setLineDash([]);
          ctx.font = 'bold 9px monospace';
          const hLabel = `Y:${hovered.y} (${hovered.nodeName})`;
          const hWidth = ctx.measureText(hLabel).width;
          ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(hPt.x - (hWidth + 8) / 2, hPt.y - 24, hWidth + 8, 16, 4);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#7dd3fc';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(hLabel, hPt.x, hPt.y - 16);
          ctx.restore();
        }
      }
    }
  }

  public setRouteStartFromContext(): void {
    const ctx = this.contextMenu();
    if (!ctx) return;
    this.routePlanner.setWaypointFromCoordinates('start', ctx.x, ctx.z);
    this.routePlanner.calculateRoute();
    this.contextMenu.set(null);
  }

  public setRouteDestFromContext(): void {
    const ctx = this.contextMenu();
    if (!ctx) return;
    this.routePlanner.setWaypointFromCoordinates('dest', ctx.x, ctx.z);
    this.routePlanner.calculateRoute();
    this.contextMenu.set(null);
  }

  public addMarkerFromContext(): void {
    const ctx = this.contextMenu();
    if (!ctx) return;
    this.mapStore.setCursorPos(ctx.x, ctx.z);
    this.mapStore.addMarkerAtCursor();
    this.contextMenu.set(null);
  }

  public async copyTeleportFromContext(): Promise<void> {
    const ctx = this.contextMenu();
    if (!ctx) return;
    const cmd = `/teleport ${ctx.x} ${ctx.y} ${ctx.z}`;
    try {
      await navigator.clipboard.writeText(cmd);
      this.copiedFeedback.set(cmd);
      setTimeout(() => this.copiedFeedback.set(null), 2000);
    } catch {
      // fallback
    }
    this.contextMenu.set(null);
  }

  public zoomIn(): void {
    this.map?.zoomIn({ duration: 220 });
  }

  public zoomOut(): void {
    this.map?.zoomOut({ duration: 220 });
  }

  public resetCameraBearing(): void {
    this.map?.easeTo({ bearing: 0, pitch: 0, duration: 350 });
    this.mapStore.toggleTerrain3D(false);
  }

  public exportMapScreenshot(): void {
    if (!this.map) return;
    const mapCanvas = this.map.getCanvas();
    const gridCanvas = this.gridCanvasRef?.nativeElement;

    let dataUrl = '';
    try {
      const composite = document.createElement('canvas');
      composite.width = mapCanvas.width;
      composite.height = mapCanvas.height;
      const ctx = composite.getContext('2d');
      if (ctx) {
        ctx.drawImage(mapCanvas, 0, 0);
        if (gridCanvas && gridCanvas.width > 0 && gridCanvas.height > 0) {
          ctx.drawImage(gridCanvas, 0, 0, composite.width, composite.height);
        }
        dataUrl = composite.toDataURL('image/png');
      } else {
        dataUrl = mapCanvas.toDataURL('image/png');
      }
    } catch {
      dataUrl = mapCanvas.toDataURL('image/png');
    }

    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `luanti_map_${this.mapStore.worldConfig().seed}.png`;
    a.click();
  }
}
