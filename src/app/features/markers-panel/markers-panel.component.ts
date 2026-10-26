import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MARKER_CATEGORY_COLORS, MapStore } from '../../core/state/map.store';
import { MapMarker, MapMarkerCategory } from '../../core/models/world.model';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import {
  LucideCheck,
  LucideCopy,
  LucideCrosshair,
  LucideDownload,
  LucideEye,
  LucideEyeOff,
  LucideMapPin,
  LucidePlus,
  LucideSearch,
  LucideTrash2,
  LucideUpload,
  LucideX
} from '@lucide/angular';

@Component({
  selector: 'app-markers-panel',
  standalone: true,
  host: {
    class: 'flex flex-col flex-1 min-h-0 h-full overflow-hidden'
  },
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    TooltipDirective,
    LucideMapPin,
    LucidePlus,
    LucideTrash2,
    LucideDownload,
    LucideUpload,
    LucideCopy,
    LucideCheck,
    LucideCrosshair,
    LucideSearch,
    LucideEye,
    LucideEyeOff,
    LucideX
  ],
  template: `
    <div class="flex-1 min-h-0 h-full flex flex-col bg-slate-900 text-xs text-slate-200 select-none overflow-y-auto custom-scrollbar p-3 space-y-3">
      <!-- Quick Pin at Cursor + Visibility Toggle -->
      <div class="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5 flex-shrink-0">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-1.5 font-semibold text-slate-200">
            <svg lucideMapPin class="w-3.5 h-3.5 text-emerald-400"></svg>
            <span>{{ 'markers.subtitle' | translate }}</span>
          </div>
          <button
            type="button"
            (click)="mapStore.toggleMarkersVisible()"
            [appTooltip]="mapStore.markersVisible() ? 'Hide custom markers on the map canvas' : 'Show custom markers on the map canvas'"
            tooltipPosition="left"
            [class.text-emerald-400]="mapStore.markersVisible()"
            [class.text-slate-500]="!mapStore.markersVisible()"
            class="p-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 transition">
            @if (mapStore.markersVisible()) {
              <svg lucideEye class="w-3.5 h-3.5"></svg>
            } @else {
              <svg lucideEyeOff class="w-3.5 h-3.5"></svg>
            }
          </button>
        </div>

        <div class="flex gap-1.5">
          <button
            type="button"
            (click)="pinAtCursorQuick()"
            appTooltip="Drop a new waypoint marker at the current cursor coordinates (Shortcut: M or Right-Click on map)"
            tooltipPosition="bottom"
            class="flex-1 py-2 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center justify-center gap-1.5 shadow transition cursor-pointer">
            <svg lucideCrosshair class="w-3.5 h-3.5"></svg>
            <span>{{ 'markers.pinAtCursor' | translate }}</span>
            <span class="font-mono text-[10px] text-emerald-100">
              ({{ mapStore.cursorSample().x }}, {{ mapStore.cursorSample().z }})
            </span>
          </button>
          <button
            type="button"
            (click)="toggleCreateForm()"
            appTooltip="Open custom marker form to specify custom coordinates, category, color, and notes"
            tooltipPosition="bottom"
            [class.bg-sky-600]="showCreateForm()"
            [class.text-white]="showCreateForm()"
            class="px-2.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold flex items-center gap-1 transition cursor-pointer">
            <svg lucidePlus class="w-3.5 h-3.5"></svg>
            <span>Custom</span>
          </button>
        </div>

        <!-- Custom Marker Creation / Edit Form -->
        @if (showCreateForm()) {
          <div class="pt-2.5 border-t border-slate-800 space-y-2">
            <div class="flex items-center justify-between text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
              <span>{{ editingMarkerId() ? 'Edit Marker' : 'New Custom Marker' }}</span>
              <button
                type="button"
                (click)="fillFromCursor()"
                appTooltip="Copy current map cursor (X, Y, Z) into form fields"
                class="text-sky-400 hover:text-sky-300 font-mono lowercase">
                use cursor ({{ mapStore.cursorSample().x }}, {{ mapStore.cursorSample().y }}, {{ mapStore.cursorSample().z }})
              </button>
            </div>

            <div class="flex gap-1.5">
              <input
                type="text"
                [(ngModel)]="draftLabel"
                placeholder="Marker label (e.g. Nether Portal, Main Base)..."
                aria-label="Marker label"
                class="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-sky-500" />
              <input
                type="color"
                [(ngModel)]="draftColor"
                aria-label="Marker pin color"
                appTooltip="Pick custom marker pin color"
                class="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700 cursor-pointer p-0.5" />
            </div>

            <!-- Category Selector Pills -->
            <div class="grid grid-cols-5 gap-1">
              @for (cat of categories; track cat.id) {
                <button
                  type="button"
                  (click)="selectDraftCategory(cat.id)"
                  [class.bg-slate-800]="draftCategory === cat.id"
                  [class.border-sky-500]="draftCategory === cat.id"
                  [class.border-slate-800]="draftCategory !== cat.id"
                  class="py-1 px-1 rounded border text-[10px] font-semibold flex items-center justify-center gap-1 transition">
                  <span class="w-2 h-2 rounded-full" [style.background-color]="cat.color"></span>
                  <span class="truncate">{{ cat.label }}</span>
                </button>
              }
            </div>

            <!-- X, Y, Z Coordinates -->
            <div class="grid grid-cols-3 gap-1.5">
              <label class="space-y-0.5">
                <span class="text-[10px] text-slate-400 font-mono">X (E/W)</span>
                <input
                  type="number"
                  [(ngModel)]="draftX"
                  aria-label="Marker X coordinate"
                  class="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 font-mono text-xs text-slate-100" />
              </label>
              <label class="space-y-0.5">
                <span class="text-[10px] text-slate-400 font-mono">Y (Elev)</span>
                <input
                  type="number"
                  [(ngModel)]="draftY"
                  aria-label="Marker Y coordinate"
                  class="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 font-mono text-xs text-slate-100" />
              </label>
              <label class="space-y-0.5">
                <span class="text-[10px] text-slate-400 font-mono">Z (N/S)</span>
                <input
                  type="number"
                  [(ngModel)]="draftZ"
                  aria-label="Marker Z coordinate"
                  class="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 font-mono text-xs text-slate-100" />
              </label>
            </div>

            <input
              type="text"
              [(ngModel)]="draftNotes"
              placeholder="Optional notes (resources, biome, chest contents)..."
              aria-label="Marker notes"
              class="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-sky-500" />

            <div class="flex justify-end gap-1.5 pt-1">
              <button
                type="button"
                (click)="cancelForm()"
                class="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-[11px] font-medium">
                {{ 'common.cancel' | translate }}
              </button>
              <button
                type="button"
                (click)="saveDraftMarker()"
                class="px-3 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-semibold">
                {{ editingMarkerId() ? ('common.save' | translate) : ('markers.addMarker' | translate) }}
              </button>
            </div>
          </div>
        }
      </div>

      <!-- Search & Category Filter Bar -->
      <div class="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2 flex-shrink-0">
        <div class="relative">
          <svg lucideSearch class="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"></svg>
          <input
            type="text"
            [ngModel]="searchQuery()"
            (ngModelChange)="searchQuery.set($event)"
            placeholder="Filter markers by name, notes, or coords..."
            aria-label="Filter markers"
            class="w-full pl-8 pr-7 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-sky-500" />
          @if (searchQuery()) {
            <button
              type="button"
              (click)="searchQuery.set('')"
              aria-label="Clear marker search"
              class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
              <svg lucideX class="w-3.5 h-3.5"></svg>
            </button>
          }
        </div>

        <div class="flex flex-wrap gap-1">
          <button
            type="button"
            (click)="activeCategoryFilter.set('all')"
            [class.bg-sky-600]="activeCategoryFilter() === 'all'"
            [class.text-white]="activeCategoryFilter() === 'all'"
            [class.text-slate-400]="activeCategoryFilter() !== 'all'"
            class="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-900 border border-slate-800 transition">
            All ({{ mapStore.markers().length }})
          </button>
          @for (cat of categories; track cat.id) {
            <button
              type="button"
              (click)="activeCategoryFilter.set(cat.id)"
              [class.bg-sky-600]="activeCategoryFilter() === cat.id"
              [class.text-white]="activeCategoryFilter() === cat.id"
              [class.text-slate-400]="activeCategoryFilter() !== cat.id"
              class="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-900 border border-slate-800 flex items-center gap-1 transition">
              <span class="w-1.5 h-1.5 rounded-full" [style.background-color]="cat.color"></span>
              <span>{{ cat.label }}</span>
            </button>
          }
        </div>
      </div>

      <!-- Saved Markers List -->
      <div class="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2 flex-1 min-h-[160px]">
        <div class="flex items-center justify-between">
          <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Saved Waypoints ({{ filteredMarkers().length }})
          </span>
          @if (mapStore.markers().length > 0) {
            <button
              type="button"
              (click)="mapStore.clearAllMarkers()"
              appTooltip="Delete all saved markers from local storage"
              tooltipPosition="left"
              class="text-[10px] text-rose-400 hover:text-rose-300 font-medium">
              Clear All
            </button>
          }
        </div>

        @if (filteredMarkers().length === 0) {
          <div class="py-8 px-3 text-center text-slate-400 text-[11px] leading-relaxed border border-dashed border-slate-800 rounded-lg">
            {{ 'markers.emptyState' | translate }}
          </div>
        } @else {
          <div class="space-y-1.5">
            @for (m of filteredMarkers(); track m.id) {
              <div
                [class.border-sky-500]="mapStore.selectedMarkerId() === m.id"
                [class.bg-sky-950/30]="mapStore.selectedMarkerId() === m.id"
                [class.border-slate-800]="mapStore.selectedMarkerId() !== m.id"
                class="p-2 rounded-lg bg-slate-900/90 hover:bg-slate-800/80 border transition group">
                <div class="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    (click)="jumpToMarker(m)"
                    appTooltip="Center map camera on this marker"
                    tooltipPosition="top"
                    class="flex items-start gap-2 min-w-0 flex-1 text-left cursor-pointer">
                    <span
                      class="w-3 h-3 rounded-full mt-0.5 flex-shrink-0 border border-white/40 shadow"
                      [style.background-color]="m.color"></span>
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-1.5">
                        <span class="font-bold text-slate-100 truncate">{{ m.label }}</span>
                        <span class="px-1.5 py-0.2 rounded bg-slate-950 border border-slate-800 text-[9px] uppercase font-semibold text-slate-400">
                          {{ m.category }}
                        </span>
                      </div>
                      <div class="font-mono text-[10px] text-sky-400 mt-0.5">
                        X:{{ m.x }} · Y:{{ m.y }} · Z:{{ m.z }}
                      </div>
                      @if (m.notes) {
                        <div class="text-[10px] text-slate-400 mt-0.5 line-clamp-2">
                          {{ m.notes }}
                        </div>
                      }
                    </div>
                  </button>

                  <div class="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      (click)="copyTeleportCommand(m)"
                      [appTooltip]="copiedTeleportId() === m.id ? 'Copied /teleport command!' : 'Copy Luanti /teleport ' + m.x + ' ' + m.y + ' ' + m.z + ' command'"
                      tooltipPosition="left"
                      class="p-1 rounded bg-slate-950 hover:bg-slate-700 text-slate-300 transition">
                      @if (copiedTeleportId() === m.id) {
                        <svg lucideCheck class="w-3 h-3 text-emerald-400"></svg>
                      } @else {
                        <svg lucideCopy class="w-3 h-3"></svg>
                      }
                    </button>
                    <button
                      type="button"
                      (click)="startEditMarker(m)"
                      appTooltip="Edit marker label, coordinates, or category"
                      tooltipPosition="left"
                      class="px-1.5 py-0.5 rounded bg-slate-950 hover:bg-slate-700 text-[10px] text-slate-300 transition">
                      Edit
                    </button>
                    <button
                      type="button"
                      (click)="mapStore.removeMarker(m.id)"
                      appTooltip="Delete this marker"
                      tooltipPosition="left"
                      class="p-1 rounded bg-slate-950 hover:bg-rose-950/80 text-slate-400 hover:text-rose-300 transition">
                      <svg lucideTrash2 class="w-3 h-3"></svg>
                    </button>
                  </div>
                </div>
              </div>
            }
          </div>
        }
      </div>

      <!-- Export / Import JSON & Luanti Waypoints -->
      <div class="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 flex-shrink-0">
        <div class="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
           Portability (Markers + Custom Biomes JSON)
        </div>

        <div class="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            (click)="exportMarkersAndBiomesJson()"
            appTooltip="Download a JSON bundle containing your custom map markers and custom biome seed configurations"
            tooltipPosition="top"
            class="py-1.5 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer">
            <svg lucideDownload class="w-3.5 h-3.5 text-sky-400"></svg>
            <span>{{ 'markers.exportJson' | translate }}</span>
          </button>

          <button
            type="button"
            (click)="importFileInput.click()"
            appTooltip="Import a previously exported JSON bundle of markers and custom biome settings"
            tooltipPosition="top"
            class="py-1.5 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer">
            <svg lucideUpload class="w-3.5 h-3.5 text-emerald-400"></svg>
            <span>{{ 'markers.importJson' | translate }}</span>
          </button>
          <input
            #importFileInput
            type="file"
            accept=".json,application/json"
            class="hidden"
            (change)="onImportJsonFile($event)" />
        </div>

        <button
          type="button"
          (click)="copyAllWaypoints()"
          appTooltip="Copy all saved markers to clipboard as a formatted Luanti waypoint list"
          tooltipPosition="top"
          class="w-full py-1.5 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-medium flex items-center justify-center gap-1.5 transition cursor-pointer">
          @if (copiedWaypoints()) {
            <svg lucideCheck class="w-3.5 h-3.5 text-emerald-400"></svg>
            <span class="text-emerald-300">{{ 'common.copied' | translate }}</span>
          } @else {
            <svg lucideCopy class="w-3.5 h-3.5 text-amber-400"></svg>
            <span>{{ 'markers.copyWaypoints' | translate }}</span>
          }
        </button>

        @if (statusBanner()) {
          <div class="p-2 rounded-lg bg-emerald-950/70 border border-emerald-700/60 text-emerald-200 text-[11px] flex items-center justify-between">
            <span>{{ statusBanner() }}</span>
            <button type="button" (click)="statusBanner.set(null)" class="text-emerald-400 hover:text-white">
              <svg lucideX class="w-3 h-3"></svg>
            </button>
          </div>
        }
      </div>
    </div>
  `
})
export class MarkersPanelComponent {
  public readonly mapStore = inject(MapStore);

  public readonly showCreateForm = signal<boolean>(false);
  public readonly editingMarkerId = signal<string | null>(null);
  public readonly searchQuery = signal<string>('');
  public readonly activeCategoryFilter = signal<'all' | MapMarkerCategory>('all');
  public readonly copiedTeleportId = signal<string | null>(null);
  public readonly copiedWaypoints = signal<boolean>(false);
  public readonly statusBanner = signal<string | null>(null);

  public draftLabel = '';
  public draftCategory: MapMarkerCategory = 'poi';
  public draftColor = MARKER_CATEGORY_COLORS.poi;
  public draftX = 0;
  public draftY = 12;
  public draftZ = 0;
  public draftNotes = '';

  public readonly categories: Array<{ id: MapMarkerCategory; label: string; color: string }> = [
    { id: 'base', label: 'Base', color: MARKER_CATEGORY_COLORS.base },
    { id: 'portal', label: 'Portal', color: MARKER_CATEGORY_COLORS.portal },
    { id: 'dungeon', label: 'Dungeon', color: MARKER_CATEGORY_COLORS.dungeon },
    { id: 'resource', label: 'Resource', color: MARKER_CATEGORY_COLORS.resource },
    { id: 'poi', label: 'POI', color: MARKER_CATEGORY_COLORS.poi }
  ];

  public readonly filteredMarkers = computed<MapMarker[]>(() => {
    const all = this.mapStore.markers();
    const cat = this.activeCategoryFilter();
    const q = this.searchQuery().trim().toLowerCase();

    return all.filter(m => {
      if (cat !== 'all' && m.category !== cat) return false;
      if (!q) return true;
      return (
        m.label.toLowerCase().includes(q) ||
        (m.notes && m.notes.toLowerCase().includes(q)) ||
        `${m.x},${m.z}`.includes(q) ||
        m.category.toLowerCase().includes(q)
      );
    });
  });

  public pinAtCursorQuick(): void {
    const marker = this.mapStore.addMarkerAtCursor();
    this.statusBanner.set(`Pinned "${marker.label}" at (${marker.x}, ${marker.y}, ${marker.z})`);
  }

  public toggleCreateForm(): void {
    if (this.showCreateForm()) {
      this.cancelForm();
    } else {
      this.editingMarkerId.set(null);
      this.fillFromCursor();
      this.draftLabel = '';
      this.draftNotes = '';
      this.showCreateForm.set(true);
    }
  }

  public fillFromCursor(): void {
    const s = this.mapStore.cursorSample();
    this.draftX = s.x;
    this.draftY = s.y;
    this.draftZ = s.z;
  }

  public selectDraftCategory(cat: MapMarkerCategory): void {
    this.draftCategory = cat;
    this.draftColor = MARKER_CATEGORY_COLORS[cat];
  }

  public startEditMarker(m: MapMarker): void {
    this.editingMarkerId.set(m.id);
    this.draftLabel = m.label;
    this.draftCategory = m.category;
    this.draftColor = m.color;
    this.draftX = m.x;
    this.draftY = m.y;
    this.draftZ = m.z;
    this.draftNotes = m.notes || '';
    this.showCreateForm.set(true);
  }

  public cancelForm(): void {
    this.showCreateForm.set(false);
    this.editingMarkerId.set(null);
  }

  public saveDraftMarker(): void {
    const editId = this.editingMarkerId();
    if (editId) {
      this.mapStore.updateMarker(editId, {
        label: this.draftLabel.trim() || `Marker (${this.draftX}, ${this.draftZ})`,
        category: this.draftCategory,
        color: this.draftColor,
        x: Math.round(Number(this.draftX) || 0),
        y: Math.round(Number(this.draftY) || 0),
        z: Math.round(Number(this.draftZ) || 0),
        notes: this.draftNotes.trim() || undefined
      });
    } else {
      this.mapStore.addMarker({
        label: this.draftLabel,
        category: this.draftCategory,
        color: this.draftColor,
        x: Number(this.draftX) || 0,
        y: Number(this.draftY) || 0,
        z: Number(this.draftZ) || 0,
        notes: this.draftNotes
      });
    }
    this.cancelForm();
  }

  public jumpToMarker(m: MapMarker): void {
    this.mapStore.selectedMarkerId.set(m.id);
    this.mapStore.requestCameraJump(m.x, m.z, 6.8);
  }

  public copyTeleportCommand(m: MapMarker): void {
    const cmd = `/teleport ${m.x} ${m.y} ${m.z}`;
    navigator.clipboard?.writeText(cmd);
    this.copiedTeleportId.set(m.id);
    setTimeout(() => {
      if (this.copiedTeleportId() === m.id) {
        this.copiedTeleportId.set(null);
      }
    }, 1800);
  }

  public exportMarkersAndBiomesJson(): void {
    const json = this.mapStore.exportBundleJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `luanti-explorer-bundle-${this.mapStore.worldConfig().seed}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.statusBanner.set('Exported markers & custom biome configuration JSON.');
  }

  public async onImportJsonFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const res = this.mapStore.importBundleJson(text);
      this.statusBanner.set(
        `Imported ${res.markersCount} markers & ${res.biomesCount} biome overrides.`
      );
    } catch {
      this.statusBanner.set('Invalid JSON bundle file.');
    } finally {
      input.value = '';
    }
  }

  public copyAllWaypoints(): void {
    const txt = this.mapStore.exportLuantiWaypointsTxt();
    if (!txt) return;
    navigator.clipboard?.writeText(txt);
    this.copiedWaypoints.set(true);
    setTimeout(() => this.copiedWaypoints.set(false), 1800);
  }
}
