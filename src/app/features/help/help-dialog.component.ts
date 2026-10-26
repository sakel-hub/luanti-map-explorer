import { Component, EventEmitter, HostListener, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import {
  LucideHelpCircle,
  LucideX,
  LucideLightbulb,
  LucideFolderOpen,
  LucideCompass,
  LucideDatabase
} from '@lucide/angular';

type HelpTab = 'worldFolder' | 'voronoi' | 'sqlite' | 'controls';

@Component({
  selector: 'app-help-dialog',
  standalone: true,
  imports: [
    CommonModule,
    TranslatePipe,
    LucideHelpCircle,
    LucideX,
    LucideLightbulb,
    LucideFolderOpen,
    LucideCompass,
    LucideDatabase
  ],
  template: `
    <div
      class="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-dialog-title"
      (click)="onBackdropClick($event)">
      <div
        class="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        <!-- Header -->
        <div class="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <svg lucideHelpCircle class="w-5 h-5"></svg>
            </div>
            <div>
              <h2 id="help-dialog-title" class="text-base font-bold text-slate-100">
                {{ 'help.title' | translate }}
              </h2>
              <p class="text-xs text-slate-400">{{ 'help.subtitle' | translate }}</p>
            </div>
          </div>
          <button
            type="button"
            (click)="close.emit()"
            class="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 transition"
            aria-label="Close dialog">
            <svg lucideX class="w-5 h-5"></svg>
          </button>
        </div>

        <!-- Navigation Tabs -->
        <div role="tablist" aria-label="Help Guide Sections" class="flex border-b border-slate-800 bg-slate-950/60 overflow-x-auto px-4 gap-1 text-xs font-medium">
          <button
            id="help-tab-worldFolder"
            type="button"
            role="tab"
            aria-controls="help-tabpanel"
            [attr.aria-selected]="activeTab() === 'worldFolder'"
            (click)="activeTab.set('worldFolder')"
            [class.text-sky-400]="activeTab() === 'worldFolder'"
            [class.border-sky-500]="activeTab() === 'worldFolder'"
            class="py-3 px-3.5 border-b-2 border-transparent text-slate-400 hover:text-slate-200 transition whitespace-nowrap">
            {{ 'help.tabWorldFolder' | translate }}
          </button>
          <button
            id="help-tab-voronoi"
            type="button"
            role="tab"
            aria-controls="help-tabpanel"
            [attr.aria-selected]="activeTab() === 'voronoi'"
            (click)="activeTab.set('voronoi')"
            [class.text-sky-400]="activeTab() === 'voronoi'"
            [class.border-sky-500]="activeTab() === 'voronoi'"
            class="py-3 px-3.5 border-b-2 border-transparent text-slate-400 hover:text-slate-200 transition whitespace-nowrap">
            {{ 'help.tabVoronoi' | translate }}
          </button>
          <button
            id="help-tab-sqlite"
            type="button"
            role="tab"
            aria-controls="help-tabpanel"
            [attr.aria-selected]="activeTab() === 'sqlite'"
            (click)="activeTab.set('sqlite')"
            [class.text-sky-400]="activeTab() === 'sqlite'"
            [class.border-sky-500]="activeTab() === 'sqlite'"
            class="py-3 px-3.5 border-b-2 border-transparent text-slate-400 hover:text-slate-200 transition whitespace-nowrap">
            {{ 'help.tabSqlite' | translate }}
          </button>
          <button
            id="help-tab-controls"
            type="button"
            role="tab"
            aria-controls="help-tabpanel"
            [attr.aria-selected]="activeTab() === 'controls'"
            (click)="activeTab.set('controls')"
            [class.text-sky-400]="activeTab() === 'controls'"
            [class.border-sky-500]="activeTab() === 'controls'"
            class="py-3 px-3.5 border-b-2 border-transparent text-slate-400 hover:text-slate-200 transition whitespace-nowrap">
            {{ 'help.tabControls' | translate }}
          </button>
        </div>

        <!-- Tab Content Body -->
        <div
          id="help-tabpanel"
          role="tabpanel"
          [attr.aria-labelledby]="'help-tab-' + activeTab()"
          class="p-5 overflow-y-auto space-y-4 text-xs text-slate-300 leading-relaxed max-h-[60vh]">
          <!-- Tab 1: World Folders -->
          @if (activeTab() === 'worldFolder') {
            <div class="space-y-4">
              <div class="bg-slate-950/70 p-4 rounded-xl border border-slate-800">
                <h3 class="text-sm font-semibold text-sky-400 mb-2 flex items-center gap-2">
                  <svg lucideFolderOpen class="w-4 h-4"></svg>
                  <span>Opening a Local Luanti World Directory</span>
                </h3>
                <p>
                  Click <strong>Open Luanti World Folder</strong> in the top header or left sidebar and select any world directory from your computer (e.g. <code>~/.minetest/worlds/my_world</code> or <code>~/Library/Application Support/minetest/worlds/</code> on macOS).
                </p>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div class="p-3.5 bg-slate-950/50 rounded-lg border border-slate-800/80">
                  <div class="font-semibold text-emerald-400 font-mono mb-1">world.mt</div>
                  <p class="text-slate-400 text-[11px]">
                    Extracts the <code>world_name</code>, <code>gameid</code> (e.g. <code>minetest_game</code>), and database <code>backend</code>.
                  </p>
                </div>
                <div class="p-3.5 bg-slate-950/50 rounded-lg border border-slate-800/80">
                  <div class="font-semibold text-amber-400 font-mono mb-1">map_meta.txt</div>
                  <p class="text-slate-400 text-[11px]">
                    Automatically extracts your exact <code>seed</code>, <code>mg_name</code> (v7, valleys, carpathian), and Heat/Humidity Perlin noise spreads.
                  </p>
                </div>
                <div class="p-3.5 bg-slate-950/50 rounded-lg border border-slate-800/80">
                  <div class="font-semibold text-purple-400 font-mono mb-1">map.sqlite / map.sql</div>
                  <p class="text-slate-400 text-[11px]">
                    Decodes saved 16×16×16 MapBlocks directly in the browser (SQLite B-Tree or PostgreSQL COPY dump) to overlay player buildings and explored terrain.
                  </p>
                </div>
              </div>
            </div>
          }

          <!-- Tab 2: Voronoi Biomes -->
          @if (activeTab() === 'voronoi') {
            <div class="space-y-4">
              <div class="bg-slate-950/70 p-4 rounded-xl border border-slate-800">
                <h3 class="text-sm font-semibold text-emerald-400 mb-2 flex items-center gap-2">
                  <svg lucideCompass class="w-4 h-4"></svg>
                  <span>How Luanti's Biome Voronoi Matrix Works</span>
                </h3>
                <p>
                  In Luanti's Biome API, every biome registers a characteristic climate point <code>(heat_point, humidity_point)</code> on a 0–100 scale, along with an elevation range <code>[y_min, y_max]</code>. For any coordinate <code>(X, Z)</code> on the map, Luanti evaluates two 2D Octave Perlin noise functions for Heat and Humidity and selects the biome with the closest Euclidean distance—forming a <strong>2D Voronoi diagram</strong>.
                </p>
              </div>

              <div class="p-3 bg-sky-500/10 border border-sky-500/20 rounded-lg text-[11px] text-sky-200 flex items-start gap-2">
                <svg lucideLightbulb class="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5"></svg>
                <div>
                  <strong>Interactive Crosshair &amp; Isolation:</strong> Move your cursor over the map to watch the live reticle glide across the Voronoi diagram in real time. Click any Voronoi cell to isolate that biome across the entire world map!
                </div>
              </div>
            </div>
          }

          <!-- Tab 3: SQLite & PostgreSQL Formats -->
          @if (activeTab() === 'sqlite') {
            <div class="space-y-3">
              <div class="bg-slate-950/70 p-4 rounded-xl border border-slate-800">
                <h3 class="text-sm font-semibold text-purple-400 mb-2 flex items-center gap-2">
                  <svg lucideDatabase class="w-4 h-4"></svg>
                  <span>Luanti 64-bit Block Packing &amp; MapBlock v28/v29</span>
                </h3>
                <p class="mb-2">
                  Luanti stores 16×16×16 node MapBlocks in both SQLite (<code>blocks(pos INT64 PRIMARY KEY, data BLOB)</code>) and PostgreSQL (<code>blocks(pos BIGINT PRIMARY KEY, data BYTEA)</code>). Each block position is packed using three 12-bit signed integers:
                </p>
                <div class="p-2.5 bg-slate-900 rounded font-mono text-[11px] text-amber-300 border border-slate-800">
                  pos = (z &lt;&lt; 24) | (y &lt;&lt; 12) | x
                </div>
                <p class="mt-2 text-slate-400 text-[11px]">
                  This explorer supports both modern Luanti MapBlock <strong>v29 (Zstandard / zstd)</strong> and legacy <strong>v24–v28 (zlib)</strong> payloads, extracting the <code>NameIdMapping</code> dictionary and scanning each column top-down for surface nodes.
                </p>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div class="p-3 bg-slate-950/50 rounded-lg border border-slate-800/80">
                  <div class="font-semibold text-sky-400 mb-1">SQLite Backend (map.sqlite)</div>
                  <p class="text-slate-400 text-[11px]">
                    Read directly in-browser using our zero-dependency streaming B-Tree reader. No wasm or SQL server required.
                  </p>
                </div>
                <div class="p-3 bg-slate-950/50 rounded-lg border border-slate-800/80">
                  <div class="font-semibold text-emerald-400 mb-1">PostgreSQL Backend (map.sql)</div>
                  <p class="text-slate-400 text-[11px]">
                    Supports dumps created via <code>pg_dump -t blocks -d luanti_world &gt; map.sql</code>. Streamed in 2MB chunks without running out of browser memory.
                  </p>
                </div>
              </div>
            </div>
          }

          <!-- Tab 4: Controls -->
          @if (activeTab() === 'controls') {
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div class="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800">
                <div class="font-semibold text-sky-400 mb-1.5">Map Navigation</div>
                <ul class="space-y-1.5 text-[11px] text-slate-300">
                  <li><strong>Left Drag / 1-Finger Touch:</strong> Pan across the Luanti world</li>
                  <li><strong>Scroll Wheel / Pinch:</strong> Continuous WebGL zoom</li>
                  <li><strong>Right Drag / Ctrl + Drag:</strong> Tilt &amp; rotate 3D terrain camera</li>
                  <li><strong>Press 3:</strong> Toggle 3D Terrain-RGB topographic relief</li>
                </ul>
              </div>
              <div class="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800">
                <div class="font-semibold text-emerald-400 mb-1.5">Viewing Modes (1 / 2 / H)</div>
                <ul class="space-y-1.5 text-[11px] text-slate-300">
                  <li><strong>Seed Mode (1):</strong> Pure procedural biomes &amp; elevation from seed</li>
                  <li><strong>Database Mode (2):</strong> Saved <code>map.sqlite</code> or <code>map.sql</code> blocks only</li>
                  <li><strong>Hybrid Mode (H):</strong> Saved player builds overlaid onto the procedural seed map</li>
                </ul>
              </div>
            </div>
          }
        </div>

        <!-- Footer -->
        <div class="px-5 py-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between">
          <span class="text-[11px] text-slate-500">Press <kbd class="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700 font-mono text-[10px]">Esc</kbd> to close</span>
          <button
            type="button"
            (click)="close.emit()"
            class="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold shadow-sm transition">
            {{ 'common.close' | translate }}
          </button>
        </div>
      </div>
    </div>
  `
})
export class HelpDialogComponent {
  @Output() close = new EventEmitter<void>();

  readonly activeTab = signal<HelpTab>('voronoi');

  @HostListener('window:keydown.escape')
  onEscape(): void {
    this.close.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close.emit();
    }
  }
}
