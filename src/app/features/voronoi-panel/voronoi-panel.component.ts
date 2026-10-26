import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Delaunay } from 'd3-delaunay';
import { MapStore } from '../../core/state/map.store';
import { BiomeDefinition, VoronoiCellPolygon } from '../../core/models/biome.model';
import { AltitudeBand, BiomePaletteMode } from '../../core/models/world.model';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import {
  LucideChevronDown,
  LucideCrosshair,
  LucidePlus,
  LucideRotateCcw,
  LucideTrash2,
  LucideX
} from '@lucide/angular';

@Component({
  selector: 'app-voronoi-panel',
  standalone: true,
  host: {
    class: 'flex flex-col flex-1 min-h-0 h-full overflow-hidden'
  },
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    TooltipDirective,
    LucideChevronDown,
    LucideCrosshair,
    LucidePlus,
    LucideRotateCcw,
    LucideTrash2,
    LucideX
  ],
  template: `
    <div class="flex-1 min-h-0 h-full flex flex-col bg-slate-900 text-xs text-slate-200 select-none overflow-y-auto custom-scrollbar p-3 space-y-3">
      <!-- Dynamic Modded / Biome Palette Mode Switcher (Everness + Custom SQLite DB Auto-Sync) -->
      <div class="p-2 rounded-xl bg-slate-950/90 border border-slate-800 space-y-1.5 flex-shrink-0">
        <div class="flex items-center justify-between text-[10px]">
          <span class="font-semibold uppercase tracking-wider text-slate-400">{{ 'voronoi.biomePaletteLabel' | translate }}</span>
          <div class="flex items-center gap-1">
            @if (mapStore.discoveredModBiomes().length > 0) {
              <span
                appTooltip="Modded biomes automatically detected from surface blocks in the loaded map.sqlite database"
                tooltipPosition="left"
                class="px-1.5 py-0.5 rounded bg-emerald-950/90 border border-emerald-700/70 text-emerald-300 font-mono">
                +{{ mapStore.discoveredModBiomes().length }} DB Mod Biomes
              </span>
            }
            @if (mapStore.hasCustomBiomeModifications()) {
              <button
                type="button"
                (click)="mapStore.resetBiomesToDefault()"
                appTooltip="Reset all custom Voronoi seed point overrides and user-added biomes back to default"
                tooltipPosition="left"
                class="px-1.5 py-0.5 rounded bg-amber-950/80 hover:bg-amber-900 border border-amber-700/70 text-amber-300 font-semibold flex items-center gap-1 transition cursor-pointer">
                <svg lucideRotateCcw class="w-2.5 h-2.5"></svg>
                <span>{{ 'common.reset' | translate }}</span>
              </button>
            }
          </div>
        </div>
        <div class="relative">
          <select
            [ngModel]="mapStore.biomePaletteMode()"
            (ngModelChange)="mapStore.setBiomePaletteMode($event)"
            class="w-full bg-slate-900 border border-slate-700/80 hover:border-slate-600 focus:border-emerald-500 rounded-lg py-1.5 pl-2.5 pr-8 text-xs text-slate-200 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer appearance-none transition">
            @for (mode of paletteModes; track mode.id) {
              <option [value]="mode.id" class="bg-slate-900 text-slate-200 py-1">
                {{ mode.labelKey | translate }}
              </option>
            }
          </select>
          <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400">
            <svg lucideChevronDown class="w-3.5 h-3.5"></svg>
          </div>
        </div>
      </div>

      <!-- Altitude Band Filter Tabs (Lowland, Ocean, Highland, Underground, All) -->
      <div class="grid grid-cols-5 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 flex-shrink-0">
        @for (band of bands; track band.id) {
          <button
            type="button"
            (click)="mapStore.setAltitudeBand(band.id)"
            [appTooltip]="band.tooltip"
            tooltipPosition="bottom"
            [class.bg-sky-600]="mapStore.altitudeBand() === band.id"
            [class.text-white]="mapStore.altitudeBand() === band.id"
            [class.text-slate-400]="mapStore.altitudeBand() !== band.id"
            class="py-1 px-1 rounded text-[10px] font-semibold transition truncate cursor-pointer">
            {{ band.labelKey | translate }}
          </button>
        }
      </div>

      <!-- Active Biome Isolation Banner + Interactive Seed Point Fine-Tuning -->
      @if (mapStore.isolatedBiome(); as isolated) {
        <div class="p-2.5 rounded-xl bg-sky-950/80 border border-sky-700/80 space-y-2 flex-shrink-0">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <span
                class="w-3.5 h-3.5 rounded-sm border border-white/40 flex-shrink-0"
                [style.background-color]="isolated.hexColor"></span>
              <div class="truncate">
                <div class="text-[10px] text-sky-300 uppercase tracking-wider font-semibold">
                  {{ 'voronoi.isolatedBiome' | translate }}
                </div>
                <div class="font-bold text-white truncate">{{ isolated.name }}</div>
              </div>
            </div>
            <button
              type="button"
              (click)="mapStore.toggleIsolatedBiome(null)"
              appTooltip="Clear biome isolation filter (Shortcut: Esc)"
              tooltipPosition="left"
              class="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-200 text-[11px] font-medium flex items-center gap-1 flex-shrink-0 transition cursor-pointer">
              <svg lucideX class="w-3.5 h-3.5"></svg>
              <span>{{ 'common.clear' | translate }}</span>
            </button>
          </div>

          <!-- Interactive Voronoi Seed Point Sliders for Customizing Modded Biome Position -->
          <div class="pt-1.5 border-t border-sky-800/60 grid grid-cols-2 gap-2 text-[10px]">
            <label class="space-y-0.5">
              <div class="flex justify-between text-amber-300 font-mono">
                <span>{{ 'voronoi.heatPointLabel' | translate }}</span>
                <span>{{ isolated.heatPoint }}°</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                aria-label="Isolated biome heat seed point"
                [ngModel]="isolated.heatPoint"
                (ngModelChange)="mapStore.updateBiomeSeedPoint(isolated.id, +$event, isolated.humidityPoint)"
                class="w-full accent-amber-400 cursor-pointer" />
            </label>
            <label class="space-y-0.5">
              <div class="flex justify-between text-sky-300 font-mono">
                <span>{{ 'voronoi.humidityPointLabel' | translate }}</span>
                <span>{{ isolated.humidityPoint }}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                aria-label="Isolated biome humidity seed point"
                [ngModel]="isolated.humidityPoint"
                (ngModelChange)="mapStore.updateBiomeSeedPoint(isolated.id, isolated.heatPoint, +$event)"
                class="w-full accent-sky-400 cursor-pointer" />
            </label>
          </div>
        </div>
      }

      <!-- 2D Interactive Voronoi Diagram SVG (Heat 0..100 vs Humidity 0..100) -->
      <div class="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 flex-shrink-0">
        <div class="flex items-center justify-between text-[11px]">
          <span class="font-semibold text-slate-200 flex items-center gap-1.5">
            <svg lucideCrosshair class="w-3.5 h-3.5 text-sky-400"></svg>
            <span>{{ 'voronoi.subtitle' | translate }}</span>
          </span>
          <span class="font-mono text-[10px] text-slate-400">
            H:{{ mapStore.cursorSample().heat.toFixed(0) }}° U:{{ mapStore.cursorSample().humidity.toFixed(0) }}%
          </span>
        </div>

        <!-- SVG Voronoi Chart Container (Y inverted so 100% Humidity is at top, 0% at bottom) -->
        <div class="relative w-full aspect-square bg-slate-900 rounded-lg border border-slate-700/80 overflow-hidden shadow-inner">
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            class="w-full h-full block cursor-pointer"
            role="img"
            aria-label="Interactive 2D Heat and Humidity Biome Voronoi Diagram">
            <!-- Voronoi Polygons -->
            @for (cell of voronoiCells(); track cell.biome.id) {
              <g
                (click)="mapStore.toggleIsolatedBiome(cell.biome.id)"
                class="group transition-opacity">
                <title>{{ cell.biome.name }} — Heat: {{ cell.biome.heatPoint }}°, Humidity: {{ cell.biome.humidityPoint }}% ({{ cell.areaPercent }}% matrix area, Y: {{ cell.biome.yMin }}..{{ cell.biome.yMax }})</title>
                <path
                  [attr.d]="cell.svgPath"
                  [attr.fill]="cell.biome.hexColor"
                  [attr.fill-opacity]="getCellOpacity(cell.biome)"
                  stroke="#0f172a"
                  stroke-width="0.7"
                  stroke-linejoin="round"
                  class="transition-all duration-150 hover:brightness-115" />

                <!-- Biome Seed Point Dot -->
                <circle
                  [attr.cx]="cell.biome.heatPoint"
                  [attr.cy]="100 - cell.biome.humidityPoint"
                  r="1.3"
                  fill="#0f172a"
                  stroke="#ffffff"
                  stroke-width="0.5" />

                <!-- Cell Label at Centroid -->
                <text
                  [attr.x]="cell.centroid[0]"
                  [attr.y]="cell.centroid[1]"
                  text-anchor="middle"
                  dominant-baseline="middle"
                  fill="#ffffff"
                  stroke="#0f172a"
                  stroke-width="0.45"
                  paint-order="stroke"
                  font-size="3.4"
                  font-weight="700"
                  class="pointer-events-none select-none">
                  {{ getShortLabel(cell.biome.name) }}
                </text>
              </g>
            }

            <!-- Coordinate Grid Lines (25, 50, 75) -->
            <line x1="25" y1="0" x2="25" y2="100" stroke="#ffffff" stroke-opacity="0.12" stroke-width="0.3" stroke-dasharray="1.5,1.5" class="pointer-events-none" />
            <line x1="50" y1="0" x2="50" y2="100" stroke="#ffffff" stroke-opacity="0.2" stroke-width="0.35" stroke-dasharray="1.5,1.5" class="pointer-events-none" />
            <line x1="75" y1="0" x2="75" y2="100" stroke="#ffffff" stroke-opacity="0.12" stroke-width="0.3" stroke-dasharray="1.5,1.5" class="pointer-events-none" />
            <line x1="0" y1="25" x2="100" y2="25" stroke="#ffffff" stroke-opacity="0.12" stroke-width="0.3" stroke-dasharray="1.5,1.5" class="pointer-events-none" />
            <line x1="0" y1="50" x2="100" y2="50" stroke="#ffffff" stroke-opacity="0.2" stroke-width="0.35" stroke-dasharray="1.5,1.5" class="pointer-events-none" />
            <line x1="0" y1="75" x2="100" y2="75" stroke="#ffffff" stroke-opacity="0.12" stroke-width="0.3" stroke-dasharray="1.5,1.5" class="pointer-events-none" />

            <!-- LIVE SYNCHRONIZED CURSOR RETICLE CROSSHAIR -->
            @if (mapStore.cursorSample(); as sample) {
              <!-- Guide lines to axes -->
              <line
                [attr.x1]="sample.heat"
                y1="0"
                [attr.x2]="sample.heat"
                y2="100"
                stroke="#38bdf8"
                stroke-opacity="0.65"
                stroke-width="0.45"
                stroke-dasharray="1,1"
                class="pointer-events-none" />
              <line
                x1="0"
                [attr.y1]="100 - sample.humidity"
                x2="100"
                [attr.y2]="100 - sample.humidity"
                stroke="#38bdf8"
                stroke-opacity="0.65"
                stroke-width="0.45"
                stroke-dasharray="1,1"
                class="pointer-events-none" />

              <!-- Line connecting cursor climate point to active biome Voronoi seed point -->
              <line
                [attr.x1]="sample.heat"
                [attr.y1]="100 - sample.humidity"
                [attr.x2]="sample.biome.heatPoint"
                [attr.y2]="100 - sample.biome.humidityPoint"
                stroke="#facc15"
                stroke-width="0.7"
                class="pointer-events-none" />

              <!-- Outer Reticle Ring -->
              <circle
                [attr.cx]="sample.heat"
                [attr.cy]="100 - sample.humidity"
                r="3.6"
                fill="#0f172a"
                fill-opacity="0.55"
                stroke="#ffffff"
                stroke-width="0.9"
                class="pointer-events-none" />

              <!-- Inner Sky-400 Bullseye -->
              <circle
                [attr.cx]="sample.heat"
                [attr.cy]="100 - sample.humidity"
                r="1.4"
                fill="#38bdf8"
                class="pointer-events-none" />
            }
          </svg>

          <!-- Axis Labels Overlay -->
          <div class="absolute bottom-1 right-1.5 px-1.5 py-0.5 rounded bg-slate-950/80 text-[9px] font-mono text-amber-300 pointer-events-none">
            {{ 'voronoi.heatAxis' | translate }} →
          </div>
          <div class="absolute top-1 left-1.5 px-1.5 py-0.5 rounded bg-slate-950/80 text-[9px] font-mono text-sky-300 pointer-events-none">
            ↑ {{ 'voronoi.humidityAxis' | translate }}
          </div>
        </div>

        <p class="text-[11px] text-slate-400 text-center">
          {{ 'voronoi.clickToIsolateHint' | translate }}
        </p>
      </div>

      <!-- Live Cursor Biome Card -->
      @if (mapStore.cursorSample(); as sample) {
        <div class="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2 flex-shrink-0">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {{ 'voronoi.cursorTelemetry' | translate }}
            </span>
            <span class="font-mono text-[11px] text-slate-400">
              ({{ sample.x }}, {{ sample.y }}, {{ sample.z }})
            </span>
          </div>

          <div class="flex items-center gap-2.5">
            <div
              class="w-8 h-8 rounded-lg border border-white/30 shadow flex-shrink-0"
              [style.background-color]="sample.biome.hexColor"></div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5">
                <span class="font-bold text-slate-100 text-sm truncate">{{ sample.biome.name }}</span>
                <span class="px-1.5 py-0.2 rounded bg-slate-900 border border-slate-700 text-[9px] font-mono text-slate-300 flex-shrink-0">
                  Y:{{ sample.biome.yMin }}..{{ sample.biome.yMax }}
                </span>
              </div>
              <div class="text-[11px] text-slate-400 truncate font-mono">{{ sample.biome.topNode }}</div>
            </div>
          </div>

          @if (sample.secondBiome && sample.secondVoronoiDistance !== undefined) {
            <div class="flex items-center justify-between text-[10px] px-2 py-1 rounded bg-slate-900/90 border border-slate-800/80 text-slate-300">
              <span class="truncate">
                {{ 'voronoi.nextClosestLabel' | translate }} <strong class="text-slate-100">{{ sample.secondBiome.name }}</strong>
              </span>
              <span
                appTooltip="Climate distance margin (Δd = d₂ - d₁) to the nearest neighboring Voronoi biome border"
                tooltipPosition="left"
                class="font-mono text-sky-400 flex-shrink-0 ml-2">
                Δd={{ (sample.secondVoronoiDistance - sample.voronoiDistance).toFixed(1) }}
              </span>
            </div>
          }

          <p class="text-[11px] text-slate-400 leading-relaxed">
            {{ sample.biome.description }}
          </p>
        </div>
      }

      <!-- Interactive Biome Legend, Custom Biome Creator & Voronoi Centroids List -->
      <div class="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
        <div class="flex items-center justify-between">
          <div class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {{ 'voronoi.biomeSeedsList' | translate }} ({{ filteredBiomes().length }})
          </div>
          <button
            type="button"
            (click)="showCustomBiomeForm.set(!showCustomBiomeForm())"
            appTooltip="Add a custom modded biome seed point to the Voronoi diagram"
            tooltipPosition="left"
            class="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] font-semibold text-sky-300 flex items-center gap-1 transition cursor-pointer">
            <svg lucidePlus class="w-3 h-3"></svg>
            <span>{{ 'voronoi.customBiomeBtn' | translate }}</span>
          </button>
        </div>

        @if (showCustomBiomeForm()) {
          <div class="p-2.5 rounded-lg bg-slate-900 border border-slate-700 space-y-2">
            <div class="text-[10px] font-semibold uppercase tracking-wider text-sky-300">
              {{ 'voronoi.addCustomBiomeTitle' | translate }}
            </div>
            <div class="flex gap-1.5">
              <input
                type="text"
                [(ngModel)]="newBiomeName"
                placeholder="Biome name (e.g. Ethereal Bamboo)..."
                aria-label="Custom biome name"
                class="flex-1 px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs text-slate-100" />
              <input
                type="color"
                [(ngModel)]="newBiomeColor"
                aria-label="Custom biome color"
                class="w-7 h-7 rounded bg-slate-950 border border-slate-700 cursor-pointer p-0.5" />
            </div>
            <div class="grid grid-cols-3 gap-1.5 text-[10px]">
              <label class="space-y-0.5">
                <span class="text-amber-300 font-mono">Heat (0-100)</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  [(ngModel)]="newBiomeHeat"
                  class="w-full px-1.5 py-1 rounded bg-slate-950 border border-slate-700 font-mono text-slate-100" />
              </label>
              <label class="space-y-0.5">
                <span class="text-sky-300 font-mono">Humidity (0-100)</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  [(ngModel)]="newBiomeHumidity"
                  class="w-full px-1.5 py-1 rounded bg-slate-950 border border-slate-700 font-mono text-slate-100" />
              </label>
              <label class="space-y-0.5">
                <span class="text-slate-400 font-mono">Stratum</span>
                <select
                  [(ngModel)]="newBiomeBand"
                  aria-label="Custom biome altitude band"
                  class="w-full px-1 py-1 rounded bg-slate-950 border border-slate-700 text-slate-100">
                  <option value="lowland">{{ 'voronoi.bandLowland' | translate }}</option>
                  <option value="ocean">{{ 'voronoi.bandOcean' | translate }}</option>
                  <option value="highland">{{ 'voronoi.bandHighland' | translate }}</option>
                  <option value="underground">{{ 'voronoi.bandUnderground' | translate }}</option>
                </select>
              </label>
            </div>
            <input
              type="text"
              [(ngModel)]="newBiomeTopNode"
              placeholder="Top node (e.g. everness:dirt_with_crystal_grass)"
              aria-label="Custom biome top node"
              class="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 font-mono text-[11px] text-slate-200" />
            <div class="flex justify-end gap-1.5">
              <button
                type="button"
                (click)="showCustomBiomeForm.set(false)"
                class="px-2 py-1 rounded bg-slate-950 text-slate-400 text-[10px]">
                {{ 'common.cancel' | translate }}
              </button>
              <button
                type="button"
                (click)="createCustomBiome()"
                class="px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white font-semibold text-[10px]">
                {{ 'voronoi.addBiomeSubmit' | translate }}
              </button>
            </div>
          </div>
        }

        <div class="space-y-1">
          @for (cell of voronoiCells(); track cell.biome.id) {
            <div
              [class.bg-sky-950]="mapStore.isolatedBiomeId() === cell.biome.id"
              [class.border-sky-500]="mapStore.isolatedBiomeId() === cell.biome.id"
              [class.border-slate-800]="mapStore.isolatedBiomeId() !== cell.biome.id"
              class="w-full p-2 rounded-lg bg-slate-900/70 hover:bg-slate-800 border flex items-center justify-between text-left transition">
              <button
                type="button"
                (click)="mapStore.toggleIsolatedBiome(cell.biome.id)"
                [appTooltip]="'Click to isolate ' + cell.biome.name + ' on the map (Y: ' + cell.biome.yMin + '..' + cell.biome.yMax + ', Top: ' + cell.biome.topNode + ')'"
                tooltipPosition="top"
                class="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer">
                <span
                  class="w-3.5 h-3.5 rounded-sm border border-white/30 flex-shrink-0"
                  [style.background-color]="cell.biome.hexColor"></span>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5">
                    <span class="font-medium text-slate-200 truncate">{{ cell.biome.name }}</span>
                    @if (cell.biome.game === 'everness') {
                      <span class="px-1 py-0.1 rounded bg-purple-950/90 border border-purple-700/60 text-[8px] font-semibold text-purple-300 uppercase flex-shrink-0">
                        Everness
                      </span>
                    } @else if (cell.biome.game === 'custom') {
                      <span class="px-1 py-0.1 rounded bg-sky-950/90 border border-sky-700/60 text-[8px] font-semibold text-sky-300 uppercase flex-shrink-0">
                        Custom
                      </span>
                    }
                  </div>
                  <div class="text-[9px] font-mono text-slate-400 flex items-center gap-2 mt-0.5">
                    <span>Y:{{ cell.biome.yMin }}..{{ cell.biome.yMax }}</span>
                    <span class="text-emerald-400/90">{{ cell.areaPercent }}% area</span>
                  </div>
                </div>
              </button>
              <div class="flex items-center gap-1.5 font-mono text-[10px] text-slate-400 flex-shrink-0 ml-2">
                <span class="text-amber-400">H:{{ cell.biome.heatPoint }}</span>
                <span class="text-sky-400">U:{{ cell.biome.humidityPoint }}</span>
                @if (cell.biome.game === 'custom') {
                  <button
                    type="button"
                    (click)="mapStore.removeCustomBiome(cell.biome.id)"
                    appTooltip="Remove custom biome"
                    tooltipPosition="left"
                    class="p-1 rounded hover:bg-rose-950 text-slate-400 hover:text-rose-300">
                    <svg lucideTrash2 class="w-3 h-3"></svg>
                  </button>
                }
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `
})
export class VoronoiPanelComponent {
  public readonly mapStore = inject(MapStore);

  public readonly showCustomBiomeForm = signal<boolean>(false);
  public newBiomeName = '';
  public newBiomeColor = '#38bdf8';
  public newBiomeHeat = 50;
  public newBiomeHumidity = 50;
  public newBiomeBand: Exclude<AltitudeBand, 'all'> = 'lowland';
  public newBiomeTopNode = 'default:dirt_with_grass';

  public readonly paletteModes: Array<{ id: BiomePaletteMode; labelKey: string; tooltip: string }> = [
    {
      id: 'auto',
      labelKey: 'voronoi.modeAuto',
      tooltip: 'Automatically detects game and active mods from world.mt and map blocks'
    },
    {
      id: 'all',
      labelKey: 'voronoi.modeAll',
      tooltip: 'Combines all biomes from Minetest Game, Everness, Ethereal, and MineClone'
    },
    {
      id: 'vanilla',
      labelKey: 'voronoi.modeVanilla',
      tooltip: 'Standard Minetest Game (Vanilla) biomes'
    },
    {
      id: 'everness',
      labelKey: 'voronoi.modeEverness',
      tooltip: 'Includes authentic Everness Mod biomes across surface, ocean, and underground'
    },
    {
      id: 'ethereal',
      labelKey: 'voronoi.modeEthereal',
      tooltip: 'Authentic Ethereal Mod biomes (Bamboo, Sakura, Prairie, Crystal Frost, Fiery, Grove, etc.)'
    },
    {
      id: 'mineclone',
      labelKey: 'voronoi.modeMineclone',
      tooltip: 'Official MineClone2 / Mineclonia biomes (Overworld, Nether, and The End)'
    }
  ];

  public readonly bands: Array<{ id: AltitudeBand; labelKey: string; tooltip: string }> = [
    {
      id: 'lowland',
      labelKey: 'voronoi.bandLowland',
      tooltip: 'Surface & Lowland biomes (Y: -8 to +48)'
    },
    {
      id: 'ocean',
      labelKey: 'voronoi.bandOcean',
      tooltip: 'Coastal Shore, Lagoon & Deep Ocean biomes (Y: -255 to +3)'
    },
    {
      id: 'highland',
      labelKey: 'voronoi.bandHighland',
      tooltip: 'Alpine Peaks, Mountain Crags & High Plateaus (Y: +48 to +31,000)'
    },
    {
      id: 'underground',
      labelKey: 'voronoi.bandUnderground',
      tooltip: 'Subterranean Caverns, Underworld & Everness _under biomes (Y: -31,000 to -113)'
    },
    {
      id: 'all',
      labelKey: 'voronoi.bandAll',
      tooltip: 'Show all distinct biome seed points across all elevation bands'
    }
  ];

  public readonly filteredBiomes = computed<BiomeDefinition[]>(() => {
    const band = this.mapStore.altitudeBand();
    const all = this.mapStore.activeBiomes();
    const byBand = band === 'all' ? all : all.filter(b => b.altitudeBand === band);
    // Deduplicate identical (heatPoint, humidityPoint) seeds so Voronoi cells remain distinct
    const seen = new Set<string>();
    return byBand.filter(b => {
      const key = `${b.heatPoint},${b.humidityPoint}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });

  /**
   * Computes exact 2D Voronoi polygons in [0, 100] x [0, 100] (Heat, 100 - Humidity) space using d3-delaunay,
   * including exact polygon area percentage (`areaPercent`).
   */
  public readonly voronoiCells = computed<VoronoiCellPolygon[]>(() => {
    const list = this.filteredBiomes();
    if (list.length === 0) return [];

    const points: [number, number][] = list.map(b => [b.heatPoint, 100 - b.humidityPoint]);
    const delaunay = Delaunay.from(points);
    const voronoi = delaunay.voronoi([0, 0, 100, 100]);

    const result: VoronoiCellPolygon[] = [];
    for (let i = 0; i < list.length; i++) {
      const poly = voronoi.cellPolygon(i);
      const svgPath = voronoi.renderCell(i);
      let cx = points[i][0];
      let cy = points[i][1];
      let areaPercent = 0;

      if (poly && poly.length > 1) {
        let sumX = 0;
        let sumY = 0;
        let twiceArea = 0;
        const n = poly.length - 1;
        for (let k = 0; k < n; k++) {
          const [x0, y0] = poly[k];
          const [x1, y1] = poly[k + 1];
          sumX += x0;
          sumY += y0;
          twiceArea += x0 * y1 - x1 * y0;
        }
        cx = sumX / n;
        cy = sumY / n;
        // Total area of 100x100 Voronoi domain is 10,000, so % = (abs(twiceArea) * 0.5) / 100
        areaPercent = Number((Math.abs(twiceArea) * 0.005).toFixed(1));
      }

      result.push({
        biome: list[i],
        svgPath,
        points: poly ? (poly as [number, number][]) : [],
        centroid: [Math.max(8, Math.min(92, cx)), Math.max(6, Math.min(94, cy))],
        areaPercent
      });
    }
    return result;
  });

  public createCustomBiome(): void {
    if (!this.newBiomeName.trim()) return;
    const created = this.mapStore.addCustomBiome({
      name: this.newBiomeName,
      heatPoint: Number(this.newBiomeHeat) || 50,
      humidityPoint: Number(this.newBiomeHumidity) || 50,
      altitudeBand: this.newBiomeBand,
      hexColor: this.newBiomeColor,
      topNode: this.newBiomeTopNode
    });
    this.mapStore.setAltitudeBand(created.altitudeBand);
    this.newBiomeName = '';
    this.showCustomBiomeForm.set(false);
  }

  public getCellOpacity(biome: BiomeDefinition): number {
    const isolated = this.mapStore.isolatedBiomeId();
    const currentCursorBiome = this.mapStore.cursorSample().biome.id;
    if (isolated) {
      return isolated === biome.id ? 0.95 : 0.22;
    }
    return currentCursorBiome === biome.id ? 0.95 : 0.76;
  }

  public getShortLabel(name: string): string {
    const clean = name.replace(/\s*\(Everness\)/i, '');
    if (clean.length <= 12) return clean;
    return clean
      .split(' ')
      .map(w => (w.length > 6 ? w.slice(0, 5) + '.' : w))
      .join(' ');
  }
}
