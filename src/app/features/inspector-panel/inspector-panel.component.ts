import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MapStore } from '../../core/state/map.store';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import { resolveNodeColor } from '../../core/data/node-colors';
import { resolveBiomeForDbNode } from '../../core/data/default-biomes';
import {
  LucideCheck,
  LucideCompass,
  LucideCopy,
  LucideCrosshair,
  LucideDatabase,
  LucideMountain
} from '@lucide/angular';

@Component({
  selector: 'app-inspector-panel',
  standalone: true,
  host: {
    class: 'flex flex-col flex-1 min-h-0 h-full overflow-hidden'
  },
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    TooltipDirective,
    LucideCrosshair,
    LucideDatabase,
    LucideCompass,
    LucideMountain,
    LucideCopy,
    LucideCheck
  ],
  template: `
    <div class="flex-1 min-h-0 h-full flex flex-col bg-slate-900 text-xs text-slate-200 select-none overflow-y-auto custom-scrollbar p-3 space-y-3.5">
      @if (mapStore.cursorSample(); as sample) {
        <!-- 1. World, MapBlock & MapChunk Coordinate Telemetry -->
        <section class="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2.5">
          <div class="flex items-center justify-between gap-1">
            <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <svg lucideCrosshair class="w-3.5 h-3.5 text-sky-400"></svg>
              <span>{{ 'inspector.cursorCoordinates' | translate }}</span>
            </span>
            <div class="flex items-center gap-1">
              <button
                type="button"
                (click)="copyTeleportCommand(sample.x, sample.y, sample.z)"
                [appTooltip]="copiedTeleport() ? 'Copied /teleport command!' : 'Copy Luanti /teleport ' + sample.x + ' ' + sample.y + ' ' + sample.z + ' command'"
                tooltipPosition="bottom"
                class="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-emerald-400 text-[10px] font-mono flex items-center gap-1 transition cursor-pointer">
                @if (copiedTeleport()) {
                  <svg lucideCheck class="w-3 h-3"></svg>
                  <span>Copied</span>
                } @else {
                  <svg lucideCopy class="w-3 h-3"></svg>
                  <span>/teleport</span>
                }
              </button>
              <button
                type="button"
                (click)="mapStore.requestCameraJump(0, 0, 6.4)"
                appTooltip="Center map viewport on Spawn Origin (0, 0) (Shortcut: 0)"
                tooltipPosition="bottom"
                class="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-sky-400 text-[10px] font-medium transition cursor-pointer">
                {{ 'inspector.jumpToOrigin' | translate }}
              </button>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-2 text-center">
            <div
              appTooltip="East (+X) / West (-X) Luanti node coordinate"
              tooltipPosition="bottom"
              class="p-2 rounded-lg bg-slate-900 border border-slate-800">
              <div class="text-[10px] text-slate-500 uppercase font-mono">X (East)</div>
              <div class="font-mono font-bold text-sm text-rose-400">{{ sample.x }}</div>
            </div>
            <div
              appTooltip="Vertical elevation Y coordinate in Luanti nodes"
              tooltipPosition="bottom"
              class="p-2 rounded-lg bg-slate-900 border border-slate-800">
              <div class="text-[10px] text-slate-500 uppercase font-mono">Y (Elev)</div>
              <div class="font-mono font-bold text-sm text-emerald-400">{{ sample.y }}</div>
            </div>
            <div
              appTooltip="North (+Z) / South (-Z) Luanti node coordinate"
              tooltipPosition="bottom"
              class="p-2 rounded-lg bg-slate-900 border border-slate-800">
              <div class="text-[10px] text-slate-500 uppercase font-mono">Z (North)</div>
              <div class="font-mono font-bold text-sm text-sky-400">{{ sample.z }}</div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2 pt-1 text-[11px]">
            <div
              appTooltip="16×16×16 MapBlock index: floor(coord / 16)"
              tooltipPosition="bottom"
              class="p-2 rounded-lg bg-slate-900/60 border border-slate-800/70 flex items-center justify-between">
              <span class="text-slate-400">{{ 'inspector.blockCoords' | translate }}</span>
              <span class="font-mono text-slate-200">({{ sample.blockX }}, {{ sample.blockY }}, {{ sample.blockZ }})</span>
            </div>
            <div
              appTooltip="5×5×5 MapBlock (80×80×80 node) Mapgen Chunk index"
              tooltipPosition="bottom"
              class="p-2 rounded-lg bg-slate-900/60 border border-slate-800/70 flex items-center justify-between">
              <span class="text-slate-400">{{ 'inspector.chunkCoords' | translate }}</span>
              <span class="font-mono text-slate-200">({{ getChunkCoord(sample.x) }}, {{ getChunkCoord(sample.z) }})</span>
            </div>
          </div>

          <!-- Jump to Coordinate Bar -->
          <div class="flex items-center gap-1.5 pt-1">
            <input
              type="number"
              [ngModel]="jumpX()"
              (ngModelChange)="jumpX.set(+$event)"
              placeholder="X"
              aria-label="Jump X Coordinate"
              class="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2 py-1 text-slate-200 font-mono text-xs" />
            <input
              type="number"
              [ngModel]="jumpZ()"
              (ngModelChange)="jumpZ.set(+$event)"
              placeholder="Z"
              aria-label="Jump Z Coordinate"
              class="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2 py-1 text-slate-200 font-mono text-xs" />
            <button
              type="button"
              (click)="mapStore.requestCameraJump(jumpX(), jumpZ(), 6.5)"
              appTooltip="Fly camera to target (X, Z) coordinates"
              tooltipPosition="left"
              class="px-3 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs flex-shrink-0 transition cursor-pointer">
              {{ 'inspector.jumpToCoord' | translate }}
            </button>
          </div>
        </section>

        <!-- 1.5 Live Dynamic 3D Elevation Cross-Section Profile (E-W or N-S) -->
        <section class="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
          <div class="flex items-center justify-between gap-2">
            <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <svg lucideMountain class="w-3.5 h-3.5 text-emerald-400"></svg>
              <span>
                {{ mapStore.profileAxis() === 'x' ? 'E–W Profile (Z=' + sample.z + ')' : 'N–S Profile (X=' + sample.x + ')' }}
              </span>
            </span>
            <div class="flex items-center gap-1.5">
              <button
                type="button"
                (click)="mapStore.toggleProfileAxis()"
                appTooltip="Switch cross-section slice between East–West (X axis) and North–South (Z axis)"
                tooltipPosition="left"
                class="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] font-mono text-sky-300 transition cursor-pointer">
                {{ mapStore.profileAxis() === 'x' ? 'Axis: E–W (X)' : 'Axis: N–S (Z)' }}
              </button>
              <span class="font-mono text-[11px] text-emerald-400 font-bold">Y={{ sample.y }}m</span>
            </div>
          </div>

          <div class="relative w-full h-24 bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
            <svg viewBox="0 0 320 100" preserveAspectRatio="none" class="w-full h-full block">
              <!-- Water Level Fill -->
              <rect
                x="0"
                [attr.y]="elevationWaterLineY()"
                width="320"
                [attr.height]="100 - elevationWaterLineY()"
                fill="#0ea5e9"
                fill-opacity="0.22" />
              <line
                x1="0"
                [attr.y1]="elevationWaterLineY()"
                x2="320"
                [attr.y2]="elevationWaterLineY()"
                stroke="#38bdf8"
                stroke-width="0.8"
                stroke-dasharray="3,2" />

              <!-- Terrain Polygon Area -->
              <polygon
                [attr.points]="elevationAreaPoints()"
                fill="#10b981"
                fill-opacity="0.28" />

              <!-- Terrain Ridge Line -->
              <polyline
                [attr.points]="elevationPolylinePoints()"
                fill="none"
                stroke="#34d399"
                stroke-width="2" />

              <!-- Cursor Center Reticle Line (X = 160) -->
              <line x1="160" y1="0" x2="160" y2="100" stroke="#facc15" stroke-width="1" stroke-dasharray="2,2" />
            </svg>
            <div class="absolute top-1 left-1.5 text-[9px] font-mono text-slate-400">
              max Y:{{ profileBounds().rawMax }}
            </div>
            <div class="absolute top-1 right-1.5 text-[9px] font-mono text-slate-400">
              min Y:{{ profileBounds().rawMin }}
            </div>
            <div class="absolute bottom-1 left-1.5 text-[9px] font-mono text-slate-400">-160m</div>
            <div class="absolute bottom-1 right-1.5 text-[9px] font-mono text-slate-400">+160m</div>
          </div>
        </section>

        <!-- 2. Climate & Voronoi Telemetry -->
        <section class="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2.5">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <svg lucideCompass class="w-3.5 h-3.5 text-amber-400"></svg>
              <span>{{ 'inspector.climateSection' | translate }}</span>
            </span>
            <span class="font-mono text-[10px] text-slate-400">
              d₁={{ sample.voronoiDistance.toFixed(1) }}
              @if (sample.secondVoronoiDistance !== undefined) {
                · Δd={{ (sample.secondVoronoiDistance - sample.voronoiDistance).toFixed(1) }}
              }
            </span>
          </div>

          <!-- Heat Bar -->
          <div class="space-y-1">
            <div class="flex justify-between text-[11px]">
              <span class="text-slate-400">{{ 'inspector.heat' | translate }}</span>
              <span class="font-mono font-semibold text-amber-400">{{ sample.heat.toFixed(1) }}° / 100°</span>
            </div>
            <div class="w-full h-2 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
              <div
                class="h-full bg-gradient-to-r from-sky-400 via-emerald-400 to-amber-500 transition-all duration-75"
                [style.width.%]="sample.heat"></div>
            </div>
          </div>

          <!-- Humidity Bar -->
          <div class="space-y-1">
            <div class="flex justify-between text-[11px]">
              <span class="text-slate-400">{{ 'inspector.humidity' | translate }}</span>
              <span class="font-mono font-semibold text-sky-400">{{ sample.humidity.toFixed(1) }}% / 100%</span>
            </div>
            <div class="w-full h-2 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
              <div
                class="h-full bg-gradient-to-r from-amber-500 via-teal-400 to-blue-500 transition-all duration-75"
                [style.width.%]="sample.humidity"></div>
            </div>
          </div>

          <!-- Surface Nodes Breakdown with Swatches -->
          <div class="pt-2 border-t border-slate-800/80 space-y-1.5">
            <div class="flex items-center justify-between text-[10px]">
              <span class="font-semibold uppercase text-slate-400">{{ 'inspector.surfaceNodes' | translate }}</span>
              <span class="font-mono text-slate-400">Y: {{ sample.biome.yMin }} .. {{ sample.biome.yMax }}</span>
            </div>
            <div class="grid grid-cols-1 gap-1 font-mono text-[11px]">
              <div class="px-2 py-1 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
                <span class="text-slate-400">node_top:</span>
                <span class="flex items-center gap-1.5 text-emerald-400 truncate">
                  <span class="w-2.5 h-2.5 rounded-xs border border-white/30 flex-shrink-0" [style.background-color]="getNodeCssColor(sample.biome.topNode)"></span>
                  <span class="truncate">{{ sample.biome.topNode }}</span>
                </span>
              </div>
              <div class="px-2 py-1 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
                <span class="text-slate-400">node_filler:</span>
                <span class="flex items-center gap-1.5 text-amber-300 truncate">
                  <span class="w-2.5 h-2.5 rounded-xs border border-white/30 flex-shrink-0" [style.background-color]="getNodeCssColor(sample.biome.fillerNode)"></span>
                  <span class="truncate">{{ sample.biome.fillerNode }}</span>
                </span>
              </div>
              <div class="px-2 py-1 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
                <span class="text-slate-400">node_stone:</span>
                <span class="flex items-center gap-1.5 text-slate-300 truncate">
                  <span class="w-2.5 h-2.5 rounded-xs border border-white/30 flex-shrink-0" [style.background-color]="getNodeCssColor(sample.biome.stoneNode)"></span>
                  <span class="truncate">{{ sample.biome.stoneNode }}</span>
                </span>
              </div>
            </div>
          </div>
        </section>

        <!-- 3. SQLite World Database Telemetry -->
        <section class="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2.5">
          <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <svg lucideDatabase class="w-3.5 h-3.5 text-purple-400"></svg>
            <span>{{ 'inspector.databaseSection' | translate }}</span>
          </span>

          @if (mapStore.worldDatabase(); as db) {
            <div class="space-y-2">
              <div class="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                <span class="text-slate-400">Source:</span>
                <span class="font-mono text-purple-300 truncate max-w-[160px]">{{ db.fileName }}</span>
              </div>

              <div class="grid grid-cols-2 gap-2">
                <div
                  appTooltip="Total estimated 16×16×16 MapBlocks stored in map.sqlite"
                  tooltipPosition="bottom"
                  class="p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <div class="text-[10px] text-slate-500">{{ 'inspector.totalBlocks' | translate }}</div>
                  <div class="font-mono font-bold text-emerald-400 text-sm">{{ db.totalBlocks | number }}</div>
                </div>
                <div
                  appTooltip="Number of high-resolution 1×1 surface node columns currently decoded in RAM"
                  tooltipPosition="bottom"
                  class="p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <div class="text-[10px] text-slate-500">Surface Columns</div>
                  <div class="font-mono font-bold text-sky-400 text-sm">{{ loadedSurfaceColumnsCount() | number }}</div>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-2 text-[10px]">
                <div
                  appTooltip="Tier 1/2 LRU cache of full 16×16 MapBlock surface arrays"
                  tooltipPosition="bottom"
                  class="px-2 py-1 rounded bg-slate-900/70 border border-slate-800/80 flex items-center justify-between">
                  <span class="text-slate-400">16×16 Block Cache:</span>
                  <span class="font-mono text-emerald-300">{{ (db.blockSurfaces?.size || 0) | number }}</span>
                </div>
                <div
                  appTooltip="Tier 0 global overview mipmap cells retained in RAM"
                  tooltipPosition="bottom"
                  class="px-2 py-1 rounded bg-slate-900/70 border border-slate-800/80 flex items-center justify-between">
                  <span class="text-slate-400">Tier-0 Mipmap:</span>
                  <span class="font-mono text-amber-300">{{ (db.macroMipmap?.size || 0) | number }}</span>
                </div>
              </div>

              <!-- Current Cursor DB Node Status -->
              <div class="p-2 rounded-lg border"
                   [class.bg-emerald-950/30]="sample.isExploredInDb"
                   [class.border-emerald-800/60]="sample.isExploredInDb"
                   [class.bg-slate-900/50]="!sample.isExploredInDb"
                   [class.border-slate-800]="!sample.isExploredInDb">
                <div class="text-[10px] text-slate-400 mb-0.5">{{ 'inspector.exploredNode' | translate }}</div>
                @if (sample.isExploredInDb && sample.dbNodeName) {
                  <div class="flex items-center justify-between font-mono">
                    <span class="flex items-center gap-1.5 text-emerald-300 font-semibold truncate">
                      <span class="w-2.5 h-2.5 rounded-xs border border-white/30 flex-shrink-0" [style.background-color]="getNodeCssColor(sample.dbNodeName)"></span>
                      <span class="truncate">{{ sample.dbNodeName }}</span>
                    </span>
                    <span class="text-slate-400 flex-shrink-0">Y={{ sample.dbElevation }}</span>
                  </div>
                } @else {
                  <div class="text-slate-500 italic">Unexplored in SQLite (Showing Seed Biome)</div>
                }
              </div>

              <!-- Top Nodes Distribution in SQLite DB (Interactive + Percentage Bars) -->
              <div class="pt-1 space-y-1.5">
                <div class="text-[10px] font-semibold uppercase text-slate-400">Top Surface Nodes in DB</div>
                @for (item of topDbNodes(); track item.name) {
                  <button
                    type="button"
                    (click)="isolateNodeBiome(item.name)"
                    [appTooltip]="'Click to isolate biome matching ' + item.name + ' (' + item.percent.toFixed(1) + '% of decoded surface nodes)'"
                    tooltipPosition="top"
                    class="w-full text-left px-2 py-1.5 rounded bg-slate-900/80 hover:bg-slate-800 border border-slate-800/70 text-[11px] space-y-1 transition cursor-pointer">
                    <div class="flex items-center justify-between gap-2">
                      <div class="flex items-center gap-2 min-w-0">
                        <span
                          class="w-3 h-3 rounded-xs border border-white/20 flex-shrink-0"
                          [style.background-color]="item.rgbCss"></span>
                        <span class="font-mono text-slate-200 truncate">{{ item.name }}</span>
                      </div>
                      <span class="font-mono text-[10px] text-slate-400 flex-shrink-0">
                        {{ item.count | number }} ({{ item.percent.toFixed(1) }}%)
                      </span>
                    </div>
                    <div class="w-full h-1 rounded-full bg-slate-950 overflow-hidden">
                      <div
                        class="h-full rounded-full transition-all duration-150"
                        [style.width.%]="item.percent"
                        [style.background-color]="item.rgbCss"></div>
                    </div>
                  </button>
                }
              </div>
            </div>
          } @else {
            <div class="p-3 rounded-lg bg-slate-900 text-slate-400 text-center">
              {{ 'inspector.dbStatusEmpty' | translate }}
            </div>
          }
        </section>
      }
    </div>
  `
})
export class InspectorPanelComponent {
  public readonly mapStore = inject(MapStore);

  public readonly jumpX = signal<number>(0);
  public readonly jumpZ = signal<number>(0);
  public readonly copiedTeleport = signal<boolean>(false);

  public readonly loadedSurfaceColumnsCount = computed(() => {
    const db = this.mapStore.worldDatabase();
    if (!db) return 0;
    if (db.blockSurfaces && db.blockSurfaces.size > 0) {
      return db.blockSurfaces.size * 256;
    }
    return db.surfaceColumns.size;
  });

  /**
   * Dynamically auto-scales the Elevation Profile Y bounds so Sky Islands (+980),
   * Surface (-25..120), and Caves (-140..-20,100) all render with full vertical fidelity!
   */
  public readonly profileBounds = computed(() => {
    const prof = this.mapStore.elevationProfile();
    const waterY = this.mapStore.worldConfig().waterLevel;
    if (prof.length === 0) {
      return { minY: -25, maxY: 95, rawMin: 0, rawMax: 0 };
    }
    let rawMin = prof[0].y;
    let rawMax = prof[0].y;
    for (let i = 1; i < prof.length; i++) {
      if (prof[i].y < rawMin) rawMin = prof[i].y;
      if (prof[i].y > rawMax) rawMax = prof[i].y;
    }
    const pad = Math.max(12, Math.round((rawMax - rawMin) * 0.2));
    const minY = Math.min(rawMin - pad, rawMax >= -40 && rawMin <= 120 ? waterY - 12 : rawMin - pad);
    const maxY = Math.max(rawMax + pad, minY + 30);
    return { minY, maxY, rawMin, rawMax };
  });

  private mapElevToSvgY(elev: number): number {
    const { minY, maxY } = this.profileBounds();
    const span = Math.max(1, maxY - minY);
    const clamped = Math.max(minY, Math.min(maxY, elev));
    return 92 - ((clamped - minY) / span) * 82;
  }

  public readonly elevationWaterLineY = computed(() => {
    return this.mapElevToSvgY(this.mapStore.worldConfig().waterLevel);
  });

  public readonly elevationPolylinePoints = computed(() => {
    const prof = this.mapStore.elevationProfile();
    return prof
      .map(pt => `${pt.offset + 160},${this.mapElevToSvgY(pt.y).toFixed(1)}`)
      .join(' ');
  });

  public readonly elevationAreaPoints = computed(() => {
    const poly = this.elevationPolylinePoints();
    return `0,100 ${poly} 320,100`;
  });

  public readonly topDbNodes = computed(() => {
    const db = this.mapStore.worldDatabase();
    if (!db) return [];
    const entries = Object.entries(db.nodeCounts);
    const totalCount = Math.max(
      1,
      entries.reduce((acc, [, c]) => acc + c, 0)
    );
    return entries
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => {
        const [r, g, b] = resolveNodeColor(name);
        return {
          name,
          count,
          percent: Math.min(100, (count / totalCount) * 100),
          rgbCss: `rgb(${r}, ${g}, ${b})`
        };
      });
  });

  public getNodeCssColor(nodeName: string): string {
    const [r, g, b] = resolveNodeColor(nodeName);
    return `rgb(${r}, ${g}, ${b})`;
  }

  public isolateNodeBiome(nodeName: string): void {
    const matched = resolveBiomeForDbNode(
      nodeName,
      this.mapStore.cursorSample().y,
      nodeName.includes('water') ? 1 : 0,
      this.mapStore.activeBiomes()
    );
    if (matched) {
      this.mapStore.toggleIsolatedBiome(matched.id);
    }
  }

  public copyTeleportCommand(x: number, y: number, z: number): void {
    navigator.clipboard?.writeText(`/teleport ${x} ${y} ${z}`);
    this.copiedTeleport.set(true);
    setTimeout(() => this.copiedTeleport.set(false), 1800);
  }

  public getChunkCoord(nodeCoord: number): number {
    return Math.floor((nodeCoord + 32) / 80);
  }
}
