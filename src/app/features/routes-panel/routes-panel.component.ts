import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RoutePlannerService } from '../../core/services/route-planner.service';
import { MapStore } from '../../core/state/map.store';
import { TravelMode } from '../../core/models/route.model';
import { formatDurationSeconds } from '../../core/utils/format.utils';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import {
  LucideArrowUpDown,
  LucideCheck,
  LucideClock,
  LucideCompass,
  LucideCopy,
  LucideCornerUpLeft,
  LucideCornerUpRight,
  LucideCrosshair,
  LucideDroplet,
  LucideFlame,
  LucideFootprints,
  LucideLayers,
  LucideMapPin,
  LucideMountain,
  LucideNavigation,
  LucidePickaxe,
  LucideRoute,
  LucideRuler,
  LucideSailboat,
  LucideSliders,
  LucideTrash2,
  LucideTrendingDown,
  LucideTrendingUp,
  LucideTrainTrack
} from '@lucide/angular';

@Component({
  selector: 'app-routes-panel',
  standalone: true,
  host: {
    class: 'flex flex-col flex-1 min-h-0 h-full overflow-hidden'
  },
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    TooltipDirective,
    LucideRoute,
    LucideFootprints,
    LucideSailboat,
    LucidePickaxe,
    LucideTrainTrack,
    LucideCompass,
    LucideNavigation,
    LucideArrowUpDown,
    LucideMapPin,
    LucideCrosshair,
    LucideMountain,
    LucideTrendingUp,
    LucideTrendingDown,
    LucideClock,
    LucideRuler,
    LucideLayers,
    LucideDroplet,
    LucideFlame,
    LucideSliders,
    LucideTrash2,
    LucideCheck,
    LucideCopy,
    LucideCornerUpLeft,
    LucideCornerUpRight
  ],
  template: `
    <div
      role="region"
      aria-label="Route Planner Panel"
      class="flex-1 min-h-0 h-full flex flex-col bg-slate-900 text-xs text-slate-200 select-none overflow-y-auto custom-scrollbar p-3 space-y-3">

      <!-- Header & Travel Mode Selection -->
      <section class="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5 flex-shrink-0">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1.5 font-semibold text-slate-100">
            <svg lucideRoute class="w-4 h-4 text-emerald-400"></svg>
            <span>{{ 'routes.title' | translate }}</span>
          </div>
          @if (routePlanner.hasRoute()) {
            <button
              type="button"
              (click)="routePlanner.clearRoute()"
              [appTooltip]="'routes.clearRoute' | translate"
              class="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 transition"
              aria-label="Clear active route">
              <svg lucideTrash2 class="w-3.5 h-3.5"></svg>
            </button>
          }
        </div>

        <!-- Mode Buttons Grid -->
        <div class="grid grid-cols-5 gap-1 pt-1" role="radiogroup" aria-label="Travel Mode">
          <!-- Hiking -->
          <button
            type="button"
            role="radio"
            [attr.aria-checked]="routePlanner.travelMode() === 'hiking'"
            (click)="routePlanner.setTravelMode('hiking')"
            [class.bg-emerald-600]="routePlanner.travelMode() === 'hiking'"
            [class.text-white]="routePlanner.travelMode() === 'hiking'"
            [class.border-emerald-500]="routePlanner.travelMode() === 'hiking'"
            [class.bg-slate-900]="routePlanner.travelMode() !== 'hiking'"
            [class.text-slate-300]="routePlanner.travelMode() !== 'hiking'"
            [class.border-slate-800]="routePlanner.travelMode() !== 'hiking'"
            [appTooltip]="'Foot exploration avoiding sheer cliffs & deep water (Speed: ~4.3 m/s)'"
            class="py-1.5 px-1 rounded-lg border text-[10px] font-semibold flex flex-col items-center justify-center gap-1 transition active:scale-95 cursor-pointer">
            <svg lucideFootprints class="w-4 h-4"></svg>
            <span class="truncate">{{ 'routes.modeHiking' | translate }}</span>
          </button>

          <!-- Sailing -->
          <button
            type="button"
            role="radio"
            [attr.aria-checked]="routePlanner.travelMode() === 'sailing'"
            (click)="routePlanner.setTravelMode('sailing')"
            [class.bg-sky-600]="routePlanner.travelMode() === 'sailing'"
            [class.text-white]="routePlanner.travelMode() === 'sailing'"
            [class.border-sky-500]="routePlanner.travelMode() === 'sailing'"
            [class.bg-slate-900]="routePlanner.travelMode() !== 'sailing'"
            [class.text-slate-300]="routePlanner.travelMode() !== 'sailing'"
            [class.border-slate-800]="routePlanner.travelMode() !== 'sailing'"
            [appTooltip]="'Waterway navigation along rivers, coastlines & oceans (Speed: ~7.0 m/s)'"
            class="py-1.5 px-1 rounded-lg border text-[10px] font-semibold flex flex-col items-center justify-center gap-1 transition active:scale-95 cursor-pointer">
            <svg lucideSailboat class="w-4 h-4"></svg>
            <span class="truncate">{{ 'routes.modeSailing' | translate }}</span>
          </button>

          <!-- Mining -->
          <button
            type="button"
            role="radio"
            [attr.aria-checked]="routePlanner.travelMode() === 'mining'"
            (click)="routePlanner.setTravelMode('mining')"
            [class.bg-amber-600]="routePlanner.travelMode() === 'mining'"
            [class.text-white]="routePlanner.travelMode() === 'mining'"
            [class.border-amber-500]="routePlanner.travelMode() === 'mining'"
            [class.bg-slate-900]="routePlanner.travelMode() !== 'mining'"
            [class.text-slate-300]="routePlanner.travelMode() !== 'mining'"
            [class.border-slate-800]="routePlanner.travelMode() !== 'mining'"
            [appTooltip]="'Subterranean straight horizontal mining tunnel at target depth (Speed: ~1.3 m/s)'"
            class="py-1.5 px-1 rounded-lg border text-[10px] font-semibold flex flex-col items-center justify-center gap-1 transition active:scale-95 cursor-pointer">
            <svg lucidePickaxe class="w-4 h-4"></svg>
            <span class="truncate">{{ 'routes.modeMining' | translate }}</span>
          </button>

          <!-- Railway -->
          <button
            type="button"
            role="radio"
            [attr.aria-checked]="routePlanner.travelMode() === 'railway'"
            (click)="routePlanner.setTravelMode('railway')"
            [class.bg-indigo-600]="routePlanner.travelMode() === 'railway'"
            [class.text-white]="routePlanner.travelMode() === 'railway'"
            [class.border-indigo-500]="routePlanner.travelMode() === 'railway'"
            [class.bg-slate-900]="routePlanner.travelMode() !== 'railway'"
            [class.text-slate-300]="routePlanner.travelMode() !== 'railway'"
            [class.border-slate-800]="routePlanner.travelMode() !== 'railway'"
            [appTooltip]="'Follows discovered player rails, roads & paved paths (Speed: ~8.5 m/s)'"
            class="py-1.5 px-1 rounded-lg border text-[10px] font-semibold flex flex-col items-center justify-center gap-1 transition active:scale-95 cursor-pointer">
            <svg lucideTrainTrack class="w-4 h-4"></svg>
            <span class="truncate">{{ 'routes.modeRailway' | translate }}</span>
          </button>

          <!-- Direct / Fly -->
          <button
            type="button"
            role="radio"
            [attr.aria-checked]="routePlanner.travelMode() === 'direct'"
            (click)="routePlanner.setTravelMode('direct')"
            [class.bg-purple-600]="routePlanner.travelMode() === 'direct'"
            [class.text-white]="routePlanner.travelMode() === 'direct'"
            [class.border-purple-500]="routePlanner.travelMode() === 'direct'"
            [class.bg-slate-900]="routePlanner.travelMode() !== 'direct'"
            [class.text-slate-300]="routePlanner.travelMode() !== 'direct'"
            [class.border-slate-800]="routePlanner.travelMode() !== 'direct'"
            [appTooltip]="'Shortest 3D Euclidean line over all terrain / flight (Speed: ~12.0 m/s)'"
            class="py-1.5 px-1 rounded-lg border text-[10px] font-semibold flex flex-col items-center justify-center gap-1 transition active:scale-95 cursor-pointer">
            <svg lucideCompass class="w-4 h-4"></svg>
            <span class="truncate">{{ 'routes.modeDirect' | translate }}</span>
          </button>
        </div>
      </section>

      <!-- Waypoints Inputs (Start A & Destination B) -->
      <section class="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 flex-shrink-0">
        <!-- Point A (Start) -->
        <div class="space-y-1">
          <div class="flex items-center justify-between text-[11px]">
            <span class="flex items-center gap-1.5 font-semibold text-emerald-400">
              <svg lucideMapPin class="w-3.5 h-3.5"></svg>
              <span>{{ 'routes.startPoint' | translate }}</span>
            </span>
            <div class="flex items-center gap-1">
              <button
                type="button"
                (click)="setStartToSpawn()"
                class="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] transition">
                {{ 'routes.spawnBtn' | translate }}
              </button>
              <button
                type="button"
                (click)="togglePicking('start')"
                [class.bg-emerald-600]="routePlanner.pickingTarget() === 'start'"
                [class.text-white]="routePlanner.pickingTarget() === 'start'"
                [class.bg-slate-800]="routePlanner.pickingTarget() !== 'start'"
                [class.text-slate-300]="routePlanner.pickingTarget() !== 'start'"
                [appTooltip]="'routes.pickOnMapHint' | translate"
                class="px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 transition">
                <svg lucideCrosshair class="w-3 h-3"></svg>
                <span>{{ (routePlanner.pickingTarget() === 'start' ? 'routes.clickMapBtn' : 'routes.pickOnMap') | translate }}</span>
              </button>
            </div>
          </div>

          <div class="flex items-center gap-1.5">
            <div class="flex-1 flex items-center gap-1 bg-slate-900 border border-slate-700/80 rounded-lg px-2 py-1 focus-within:border-emerald-500 transition">
              <span class="text-slate-400 font-mono text-[10px]">X:</span>
              <input
                type="number"
                [ngModel]="routePlanner.startWaypoint()?.x ?? 0"
                (ngModelChange)="onStartXChanged($event)"
                class="w-full bg-transparent text-slate-100 font-mono text-xs focus:outline-none"
                placeholder="0" />
            </div>
            <div class="flex-1 flex items-center gap-1 bg-slate-900 border border-slate-700/80 rounded-lg px-2 py-1 focus-within:border-emerald-500 transition">
              <span class="text-slate-400 font-mono text-[10px]">Z:</span>
              <input
                type="number"
                [ngModel]="routePlanner.startWaypoint()?.z ?? 0"
                (ngModelChange)="onStartZChanged($event)"
                class="w-full bg-transparent text-slate-100 font-mono text-xs focus:outline-none"
                placeholder="0" />
            </div>
          </div>
        </div>

        <!-- Swap Button -->
        <div class="flex items-center justify-center -my-1">
          <button
            type="button"
            (click)="routePlanner.swapWaypoints()"
            [appTooltip]="'routes.swap' | translate"
            class="p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 shadow-sm transition active:scale-90 cursor-pointer"
            aria-label="Swap Start and Destination">
            <svg lucideArrowUpDown class="w-3.5 h-3.5"></svg>
          </button>
        </div>

        <!-- Point B (Destination) -->
        <div class="space-y-1">
          <div class="flex items-center justify-between text-[11px]">
            <span class="flex items-center gap-1.5 font-semibold text-rose-400">
              <svg lucideMapPin class="w-3.5 h-3.5"></svg>
              <span>{{ 'routes.destPoint' | translate }}</span>
            </span>
            <div class="flex items-center gap-1">
              <button
                type="button"
                (click)="setDestToCursor()"
                class="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] transition">
                {{ 'routes.cursorBtn' | translate }}
              </button>
              <button
                type="button"
                (click)="togglePicking('dest')"
                [class.bg-rose-600]="routePlanner.pickingTarget() === 'dest'"
                [class.text-white]="routePlanner.pickingTarget() === 'dest'"
                [class.bg-slate-800]="routePlanner.pickingTarget() !== 'dest'"
                [class.text-slate-300]="routePlanner.pickingTarget() !== 'dest'"
                [appTooltip]="'routes.pickOnMapHint' | translate"
                class="px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 transition">
                <svg lucideCrosshair class="w-3 h-3"></svg>
                <span>{{ (routePlanner.pickingTarget() === 'dest' ? 'routes.clickMapBtn' : 'routes.pickOnMap') | translate }}</span>
              </button>
            </div>
          </div>

          <div class="flex items-center gap-1.5">
            <div class="flex-1 flex items-center gap-1 bg-slate-900 border border-slate-700/80 rounded-lg px-2 py-1 focus-within:border-rose-500 transition">
              <span class="text-slate-400 font-mono text-[10px]">X:</span>
              <input
                type="number"
                [ngModel]="routePlanner.destWaypoint()?.x ?? 0"
                (ngModelChange)="onDestXChanged($event)"
                class="w-full bg-transparent text-slate-100 font-mono text-xs focus:outline-none"
                placeholder="0" />
            </div>
            <div class="flex-1 flex items-center gap-1 bg-slate-900 border border-slate-700/80 rounded-lg px-2 py-1 focus-within:border-rose-500 transition">
              <span class="text-slate-400 font-mono text-[10px]">Z:</span>
              <input
                type="number"
                [ngModel]="routePlanner.destWaypoint()?.z ?? 0"
                (ngModelChange)="onDestZChanged($event)"
                class="w-full bg-transparent text-slate-100 font-mono text-xs focus:outline-none"
                placeholder="0" />
            </div>
          </div>
        </div>
      </section>

      <!-- Routing Constraints & Preferences -->
      <section class="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 flex-shrink-0">
        <div class="flex items-center justify-between text-[11px] font-semibold text-slate-300">
          <span class="flex items-center gap-1.5">
            <svg lucideSliders class="w-3.5 h-3.5 text-sky-400"></svg>
            <span>{{ 'routes.constraintsTitle' | translate }}</span>
          </span>
        </div>

        <div class="space-y-1.5 pt-0.5">
          <!-- Avoid sheer cliffs -->
          @if (routePlanner.travelMode() === 'hiking') {
            <label
              [appTooltip]="'routes.avoidCliffsTooltip' | translate"
              class="flex items-center justify-between p-1.5 rounded-lg bg-slate-900 hover:bg-slate-850 cursor-pointer border border-slate-800 transition">
              <span class="flex items-center gap-1.5 text-slate-300">
                <svg lucideMountain class="w-3.5 h-3.5 text-amber-400"></svg>
                <span>{{ 'routes.avoidCliffs' | translate }}</span>
              </span>
              <input
                type="checkbox"
                [checked]="routePlanner.avoidCliffs()"
                (change)="routePlanner.toggleAvoidCliffs()"
                class="w-3.5 h-3.5 rounded accent-emerald-500 cursor-pointer" />
            </label>
          }

          <!-- Prefer roads & paths -->
          @if (routePlanner.travelMode() === 'hiking' || routePlanner.travelMode() === 'railway') {
            <label
              [appTooltip]="'routes.preferRoadsTooltip' | translate"
              class="flex items-center justify-between p-1.5 rounded-lg bg-slate-900 hover:bg-slate-850 cursor-pointer border border-slate-800 transition">
              <span class="flex items-center gap-1.5 text-slate-300">
                <svg lucideRoute class="w-3.5 h-3.5 text-indigo-400"></svg>
                <span>{{ 'routes.preferRoads' | translate }}</span>
              </span>
              <input
                type="checkbox"
                [checked]="routePlanner.preferRoads()"
                (change)="routePlanner.togglePreferRoads()"
                class="w-3.5 h-3.5 rounded accent-emerald-500 cursor-pointer" />
            </label>
          }

          <!-- Avoid deep water -->
          @if (routePlanner.travelMode() === 'hiking') {
            <label
              [appTooltip]="'routes.avoidWaterTooltip' | translate"
              class="flex items-center justify-between p-1.5 rounded-lg bg-slate-900 hover:bg-slate-850 cursor-pointer border border-slate-800 transition">
              <span class="flex items-center gap-1.5 text-slate-300">
                <svg lucideDroplet class="w-3.5 h-3.5 text-sky-400"></svg>
                <span>{{ 'routes.avoidWater' | translate }}</span>
              </span>
              <input
                type="checkbox"
                [checked]="routePlanner.avoidWater()"
                (change)="routePlanner.toggleAvoidWater()"
                class="w-3.5 h-3.5 rounded accent-emerald-500 cursor-pointer" />
            </label>
          }

          <!-- Avoid lava -->
          <label
            [appTooltip]="'routes.avoidLavaTooltip' | translate"
            class="flex items-center justify-between p-1.5 rounded-lg bg-slate-900 hover:bg-slate-850 cursor-pointer border border-slate-800 transition">
            <span class="flex items-center gap-1.5 text-slate-300">
              <svg lucideFlame class="w-3.5 h-3.5 text-rose-400"></svg>
              <span>{{ 'routes.avoidLava' | translate }}</span>
            </span>
            <input
              type="checkbox"
              [checked]="routePlanner.avoidLava()"
              (change)="routePlanner.toggleAvoidLava()"
              class="w-3.5 h-3.5 rounded accent-emerald-500 cursor-pointer" />
          </label>

          <!-- Mining Depth -->
          @if (routePlanner.travelMode() === 'mining') {
            <div class="p-2 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5">
              <div class="flex items-center justify-between text-[11px]">
                <span class="flex items-center gap-1.5 text-slate-300">
                  <svg lucidePickaxe class="w-3.5 h-3.5 text-amber-400"></svg>
                  <span>{{ 'routes.miningDepth' | translate }}</span>
                </span>
                <span class="font-mono text-amber-400 font-bold">Y={{ routePlanner.miningDepth() }}</span>
              </div>
              <div class="flex items-center gap-2">
                <input
                  type="range"
                  min="-250"
                  max="50"
                  step="1"
                  [ngModel]="routePlanner.miningDepth()"
                  (ngModelChange)="routePlanner.setMiningDepth(+$event)"
                  class="w-full accent-amber-500 cursor-pointer" />
              </div>
              <div class="flex gap-1 justify-between pt-0.5">
                <button
                  type="button"
                  (click)="routePlanner.setMiningDepth(-15)"
                  class="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[9px] text-slate-300">
                  {{ 'routes.depthShallow' | translate }}
                </button>
                <button
                  type="button"
                  (click)="routePlanner.setMiningDepth(-50)"
                  class="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[9px] text-slate-300">
                  {{ 'routes.depthDeepOre' | translate }}
                </button>
                <button
                  type="button"
                  (click)="routePlanner.setMiningDepth(-120)"
                  class="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[9px] text-slate-300">
                  {{ 'routes.depthAbyss' | translate }}
                </button>
              </div>
            </div>
          }
        </div>
      </section>

      <!-- Route Calculation In Progress -->
      @if (routePlanner.isCalculating()) {
        <div class="p-4 rounded-xl bg-sky-950/60 border border-sky-800/80 flex items-center justify-center gap-2 text-sky-300 text-xs">
          <div class="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin"></div>
          <span>{{ 'routes.calculating' | translate }}</span>
        </div>
      }

      <!-- Calculated Route Results -->
      @if (routePlanner.activeRoute(); as route) {
        <!-- Summary Stats Card -->
        <section class="p-3 rounded-xl bg-slate-950/90 border border-emerald-500/50 space-y-2.5 flex-shrink-0 shadow-lg">
          <div class="flex items-center justify-between">
            <span class="font-bold text-xs text-emerald-400 flex items-center gap-1.5">
              <svg lucideRoute class="w-4 h-4"></svg>
              <span>{{ 'routes.summaryTitle' | translate }}</span>
            </span>
            <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 capitalize">
              {{ route.mode }}
            </span>
          </div>

          <!-- Key Metrics Grid -->
          <div class="grid grid-cols-2 gap-2 text-[11px] font-mono">
            <div class="p-2 rounded-lg bg-slate-900/90 border border-slate-800 flex items-center gap-2">
              <svg lucideClock class="w-4 h-4 text-sky-400 flex-shrink-0"></svg>
              <div class="min-w-0">
                <div class="text-[9px] text-slate-400 font-sans uppercase">{{ 'routes.estTime' | translate }}</div>
                <div class="font-bold text-slate-100 truncate">{{ formatDuration(route.estimatedDurationSeconds) }}</div>
              </div>
            </div>

            <div class="p-2 rounded-lg bg-slate-900/90 border border-slate-800 flex items-center gap-2">
              <svg lucideRuler class="w-4 h-4 text-emerald-400 flex-shrink-0"></svg>
              <div class="min-w-0">
                <div class="text-[9px] text-slate-400 font-sans uppercase">{{ 'routes.distance' | translate }}</div>
                <div class="font-bold text-slate-100 truncate">
                  {{ route.totalDistanceNodes.toLocaleString() }}m
                  <span class="text-[9px] text-slate-400 font-normal">({{ Math.round(route.totalDistanceNodes / 16) }} blks)</span>
                </div>
              </div>
            </div>

            <div class="p-2 rounded-lg bg-slate-900/90 border border-slate-800 flex items-center gap-2">
              <svg lucideTrendingUp class="w-4 h-4 text-emerald-400 flex-shrink-0"></svg>
              <div class="min-w-0">
                <div class="text-[9px] text-slate-400 font-sans uppercase">{{ 'routes.climb' | translate }}</div>
                <div class="font-bold text-emerald-300">+{{ route.totalClimbY }}m</div>
              </div>
            </div>

            <div class="p-2 rounded-lg bg-slate-900/90 border border-slate-800 flex items-center gap-2">
              <svg lucideTrendingDown class="w-4 h-4 text-rose-400 flex-shrink-0"></svg>
              <div class="min-w-0">
                <div class="text-[9px] text-slate-400 font-sans uppercase">{{ 'routes.descent' | translate }}</div>
                <div class="font-bold text-rose-300">-{{ route.totalDescentY }}m</div>
              </div>
            </div>
          </div>

          <!-- Elevation Sparkline Cross-Section -->
          <div class="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
            <div class="flex items-center justify-between text-[10px]">
              <span class="text-slate-400 font-semibold flex items-center gap-1">
                <svg lucideMountain class="w-3 h-3 text-sky-400"></svg>
                <span>{{ 'routes.elevationProfile' | translate }}</span>
              </span>
              <span class="font-mono text-slate-400">
                Min: <strong class="text-slate-200">{{ route.minY }}m</strong> · Max: <strong class="text-emerald-300">{{ route.maxY }}m</strong>
              </span>
            </div>

            <!-- SVG Elevation Sparkline with Interactive Hover -->
            <div class="relative w-full h-16 bg-slate-950/80 rounded border border-slate-800/80 overflow-hidden cursor-crosshair">
              <svg
                class="w-full h-full"
                preserveAspectRatio="none"
                viewBox="0 0 100 50"
                (mousemove)="onElevationProfileMouseMove($event, route)"
                (mouseleave)="routePlanner.hoveredPoint.set(null)">
                <!-- Sea Level Horizon Line (Y = 1) -->
                <line
                  x1="0"
                  [attr.y1]="getElevationSvgY(1, route.minY, route.maxY)"
                  x2="100"
                  [attr.y2]="getElevationSvgY(1, route.minY, route.maxY)"
                  stroke="rgba(56, 189, 248, 0.3)"
                  stroke-dasharray="2,2"
                  stroke-width="0.75" />

                <!-- Filled Terrain Polygon -->
                <polygon
                  [attr.points]="getElevationProfilePolygonPoints(route)"
                  fill="url(#elevationGradient)"
                  opacity="0.35" />

                <!-- Crisp Terrain Path Stroke -->
                <polyline
                  [attr.points]="getElevationProfilePolylinePoints(route)"
                  fill="none"
                  stroke="#10b981"
                  stroke-width="1.8"
                  stroke-linejoin="round"
                  stroke-linecap="round" />

                <!-- Hovered Point Indicator Line & Dot -->
                @if (routePlanner.hoveredPoint(); as hp) {
                  @let hoverX = (hp.distanceFromStart / Math.max(1, route.totalDistanceNodes)) * 100;
                  <line
                    [attr.x1]="hoverX"
                    y1="0"
                    [attr.x2]="hoverX"
                    y2="50"
                    stroke="#f59e0b"
                    stroke-width="1.2"
                    stroke-dasharray="1,1" />
                  <circle
                    [attr.cx]="hoverX"
                    [attr.cy]="getElevationSvgY(hp.y, route.minY, route.maxY)"
                    r="2.5"
                    fill="#f59e0b"
                    stroke="#ffffff"
                    stroke-width="0.8" />
                }

                <defs>
                  <linearGradient id="elevationGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#10b981" />
                    <stop offset="100%" stop-color="#0284c7" stop-opacity="0.05" />
                  </linearGradient>
                </defs>
              </svg>

              <!-- Hover Telemetry Tooltip Badge -->
              @if (routePlanner.hoveredPoint(); as hp) {
                <div class="absolute top-1 right-1.5 px-1.5 py-0.5 rounded bg-slate-900/90 border border-amber-500/60 text-[9px] font-mono text-amber-300 pointer-events-none">
                  Y={{ hp.y }}m · {{ hp.distanceFromStart }}m ({{ hp.slopeDeg }}°)
                </div>
              }
            </div>
          </div>

          <!-- Biomes Traversed Pill Breakdown -->
          @if (route.biomesTraversed.length > 0) {
            <div class="space-y-1">
              <div class="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                <svg lucideLayers class="w-3 h-3 text-emerald-400"></svg>
                <span>{{ 'routes.biomesSection' | translate }}</span>
              </div>
              <div class="flex flex-wrap gap-1">
                @for (b of route.biomesTraversed; track b.biome) {
                  <span class="px-1.5 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-[10px] text-slate-300 flex items-center gap-1">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span>{{ b.biome }}</span>
                    <strong class="text-slate-400 font-mono">{{ b.percent }}%</strong>
                  </span>
                }
              </div>
            </div>
          }

          <!-- In-Game Export Actions -->
          <div class="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              (click)="copyTeleport()"
              [appTooltip]="'Copy in-game /teleport destination command to clipboard'"
              class="py-1.5 px-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-semibold text-[11px] flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer">
              @if (copiedTeleport()) {
                <svg lucideCheck class="w-3.5 h-3.5 text-emerald-400"></svg>
              } @else {
                <svg lucideCopy class="w-3.5 h-3.5"></svg>
              }
              <span>{{ copiedTeleport() ? ('routes.copyTeleportDone' | translate) : ('routes.copyTeleport' | translate) }}</span>
            </button>

            <button
              type="button"
              (click)="copyWaypoint()"
              [appTooltip]="'Copy /waypoint add console command for compass & navigation mods'"
              class="py-1.5 px-2 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/40 text-sky-300 font-semibold text-[11px] flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer">
              @if (copiedWaypoint()) {
                <svg lucideCheck class="w-3.5 h-3.5 text-emerald-400"></svg>
              } @else {
                <svg lucideCopy class="w-3.5 h-3.5"></svg>
              }
              <span>{{ copiedWaypoint() ? ('routes.copyWaypointDone' | translate) : ('routes.copyWaypoint' | translate) }}</span>
            </button>
          </div>
        </section>

        <!-- Turn-by-Turn Waypoint Directions -->
        @if (route.directions.length > 0) {
          <section class="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 flex-shrink-0">
            <div class="flex items-center justify-between text-[11px] font-semibold text-slate-300">
              <span class="flex items-center gap-1.5">
                <svg lucideNavigation class="w-3.5 h-3.5 text-sky-400"></svg>
                <span>{{ 'routes.directionsSection' | translate }}</span>
              </span>
              <span class="text-[10px] text-slate-400 font-mono">{{ route.directions.length }} steps</span>
            </div>

            <div class="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
              @for (step of route.directions; track step.id) {
                <div class="p-1.5 rounded-lg bg-slate-900 border border-slate-800/80 text-[10px] flex items-start gap-2">
                  <div class="mt-0.5 p-1 rounded bg-slate-800 text-sky-300 flex-shrink-0">
                    @if (step.icon === 'climb') {
                      <svg lucideTrendingUp class="w-3 h-3 text-emerald-400"></svg>
                    } @else if (step.icon === 'water') {
                      <svg lucideDroplet class="w-3 h-3 text-sky-400"></svg>
                    } @else if (step.icon === 'mine') {
                      <svg lucidePickaxe class="w-3 h-3 text-amber-400"></svg>
                    } @else if (step.icon === 'finish') {
                      <svg lucideMapPin class="w-3 h-3 text-rose-400"></svg>
                    } @else if (step.icon === 'turn-left') {
                      <svg lucideCornerUpLeft class="w-3 h-3 text-sky-400"></svg>
                    } @else if (step.icon === 'turn-right') {
                      <svg lucideCornerUpRight class="w-3 h-3 text-sky-400"></svg>
                    } @else {
                      <svg lucideNavigation class="w-3 h-3 text-sky-400"></svg>
                    }
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="text-slate-200 leading-tight">{{ step.text }}</div>
                    @if (step.distance > 0) {
                      <div class="text-[9px] font-mono text-slate-400 mt-0.5">{{ step.distance }}m · Y={{ step.y }}m</div>
                    }
                  </div>
                </div>
              }
            </div>
          </section>
        }
      } @else if (!routePlanner.isCalculating()) {
        <!-- Empty Prompt / Instructions -->
        <div class="p-6 rounded-2xl bg-slate-950/60 border border-slate-800 text-center space-y-3 flex-shrink-0">
          <div class="w-12 h-12 mx-auto rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400">
            <svg lucideCompass class="w-6 h-6 text-emerald-400"></svg>
          </div>
          <p class="text-xs text-slate-300 leading-relaxed max-w-xs mx-auto">
            {{ 'routes.emptyPrompt' | translate }}
          </p>
          <div class="flex items-center justify-center gap-2 pt-1">
            <button
              type="button"
              (click)="planDemoRoute()"
              class="py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md transition active:scale-95 cursor-pointer">
              {{ 'routes.trySampleRoute' | translate }}
            </button>
          </div>
        </div>
      }
    </div>
  `
})
export class RoutesPanelComponent {
  public readonly routePlanner = inject(RoutePlannerService);
  public readonly mapStore = inject(MapStore);

  public readonly copiedTeleport = signal<boolean>(false);
  public readonly copiedWaypoint = signal<boolean>(false);
  public readonly Math = Math;
  public readonly formatDuration = formatDurationSeconds;

  public setStartToSpawn(): void {
    this.routePlanner.setStart(0, 0, 'Spawn (0, 0)');
  }

  public setDestToCursor(): void {
    const cur = this.mapStore.cursorPos();
    this.routePlanner.setDest(cur.x, cur.z, `Cursor (${cur.x}, ${cur.z})`);
  }

  public togglePicking(target: 'start' | 'dest'): void {
    const curr = this.routePlanner.pickingTarget();
    this.routePlanner.pickingTarget.set(curr === target ? null : target);
  }

  public onStartXChanged(x: number): void {
    const start = this.routePlanner.startWaypoint();
    this.routePlanner.setStart(x, start?.z ?? 0);
  }

  public onStartZChanged(z: number): void {
    const start = this.routePlanner.startWaypoint();
    this.routePlanner.setStart(start?.x ?? 0, z);
  }

  public onDestXChanged(x: number): void {
    const dest = this.routePlanner.destWaypoint();
    this.routePlanner.setDest(x, dest?.z ?? 0);
  }

  public onDestZChanged(z: number): void {
    const dest = this.routePlanner.destWaypoint();
    this.routePlanner.setDest(dest?.x ?? 0, z);
  }

  public planDemoRoute(): void {
    this.routePlanner.setStart(0, 0, 'Spawn (0, 0)');
    this.routePlanner.setDest(650, -420, 'Exploration Outpost (650, -420)');
  }

  public copyTeleport(): void {
    this.routePlanner.copyTeleportCommand();
    this.copiedTeleport.set(true);
    setTimeout(() => this.copiedTeleport.set(false), 2000);
  }

  public copyWaypoint(): void {
    this.routePlanner.copyWaypointModCommand();
    this.copiedWaypoint.set(true);
    setTimeout(() => this.copiedWaypoint.set(false), 2000);
  }

  public getElevationSvgY(y: number, minY: number, maxY: number): number {
    const range = Math.max(1, maxY - minY);
    // Invert for SVG Y (0 is top, 50 is bottom)
    const norm = (y - minY) / range;
    return Math.round((1 - norm) * 44 + 3);
  }

  public getElevationProfilePolylinePoints(route: { points: Array<{ y: number; distanceFromStart: number }>; minY: number; maxY: number; totalDistanceNodes: number }): string {
    const totDist = Math.max(1, route.totalDistanceNodes);
    return route.points
      .map(p => {
        const x = (p.distanceFromStart / totDist) * 100;
        const y = this.getElevationSvgY(p.y, route.minY, route.maxY);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }

  public getElevationProfilePolygonPoints(route: { points: Array<{ y: number; distanceFromStart: number }>; minY: number; maxY: number; totalDistanceNodes: number }): string {
    const polyline = this.getElevationProfilePolylinePoints(route);
    return `0,50 ${polyline} 100,50`;
  }

  public onElevationProfileMouseMove(e: MouseEvent, route: { points: Array<{ distanceFromStart: number; y: number; x: number; z: number; slopeDeg: number; nodeName: string; biomeName: string; isWater: boolean; isLava: boolean; isRoad: boolean; isSteep: boolean }>; totalDistanceNodes: number }): void {
    const target = e.currentTarget as SVGElement | null;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    if (rect.width <= 0) return;

    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetDist = ratio * route.totalDistanceNodes;

    // Find closest point by distanceFromStart
    let closest = route.points[0];
    let minDiff = Infinity;
    for (const p of route.points) {
      const diff = Math.abs(p.distanceFromStart - targetDist);
      if (diff < minDiff) {
        minDiff = diff;
        closest = p;
      }
    }
    this.routePlanner.hoveredPoint.set(closest);
  }
}
