import { Injectable, inject, signal } from '@angular/core';
import { MapStore } from '../state/map.store';

export interface ShortcutDefinition {
  id: string;
  name: string;
  description: string;
  category: 'Map & Camera' | 'Modes & Layers' | 'World & Seed' | 'General';
  macKey: string;
  winKey: string;
  keyDisplay: string;
}

@Injectable({
  providedIn: 'root'
})
export class KeyboardShortcutsService {
  private readonly mapStore = inject(MapStore, { optional: true });

  public readonly isShortcutsModalOpen = signal<boolean>(false);
  public readonly isMac: boolean;

  public readonly shortcuts: ShortcutDefinition[] = [
    // Map & Camera
    {
      id: 'view_origin',
      name: 'Jump to Spawn (0, 0)',
      description: 'Center map viewport on Luanti world origin (0, 0)',
      category: 'Map & Camera',
      macKey: '0 or Home',
      winKey: '0 or Home',
      keyDisplay: '0'
    },
    {
      id: 'view_fit_world',
      name: 'Fit Whole World',
      description: 'Zoom out to fit the full bounding box of the loaded SQLite world',
      category: 'Map & Camera',
      macKey: 'F',
      winKey: 'F',
      keyDisplay: 'F'
    },
    {
      id: 'pin_marker',
      name: 'Pin Custom Marker at Cursor',
      description: 'Drop a custom waypoint marker at the current cursor coordinates',
      category: 'Map & Camera',
      macKey: 'M',
      winKey: 'M',
      keyDisplay: 'M'
    },
    {
      id: 'view_3d',
      name: 'Toggle 3D Terrain Relief',
      description: 'Tilt camera and activate Terrain-RGB 3D elevation mesh',
      category: 'Map & Camera',
      macKey: '3',
      winKey: '3',
      keyDisplay: '3'
    },
    {
      id: 'view_grid',
      name: 'Toggle MapBlock Grid',
      description: 'Show or hide 16×16 MapBlock & 80×80 MapChunk coordinate grid',
      category: 'Map & Camera',
      macKey: 'G',
      winKey: 'G',
      keyDisplay: 'G'
    },
    // Modes & Layers
    {
      id: 'mode_seed',
      name: 'Seed Biomes Mode',
      description: 'Switch to pure procedural seed & biome preview (Amidst style)',
      category: 'Modes & Layers',
      macKey: '1',
      winKey: '1',
      keyDisplay: '1'
    },
    {
      id: 'mode_db',
      name: 'SQLite DB Mode',
      description: 'Switch to saved map.sqlite blocks only (minetestmapper style)',
      category: 'Modes & Layers',
      macKey: '2',
      winKey: '2',
      keyDisplay: '2'
    },
    {
      id: 'mode_hybrid',
      name: 'Hybrid Mode (Seed + DB)',
      description: 'Composite saved SQLite blocks atop procedural seed biome map',
      category: 'Modes & Layers',
      macKey: 'H',
      winKey: 'H',
      keyDisplay: 'H'
    },
    {
      id: 'layer_voronoi',
      name: 'Toggle Voronoi Borders',
      description: 'Show or hide Voronoi biome transition contour lines on map',
      category: 'Modes & Layers',
      macKey: 'V',
      winKey: 'V',
      keyDisplay: 'V'
    },
    {
      id: 'layer_hillshade',
      name: 'Toggle Hillshading',
      description: 'Enable or disable directional topographic slope shading',
      category: 'Modes & Layers',
      macKey: 'L',
      winKey: 'L',
      keyDisplay: 'L'
    },
    // World & Seed
    {
      id: 'seed_random',
      name: 'Randomize World Seed',
      description: 'Generate a fresh random seed and re-evaluate biomes & Voronoi',
      category: 'World & Seed',
      macKey: 'R',
      winKey: 'R',
      keyDisplay: 'R'
    },
    {
      id: 'filter_clear',
      name: 'Clear Isolated Biome Filter',
      description: 'Reset any single-biome Voronoi cell isolation filter',
      category: 'World & Seed',
      macKey: 'Esc',
      winKey: 'Esc',
      keyDisplay: 'Esc'
    },
    // General
    {
      id: 'help_shortcuts',
      name: 'Keyboard Shortcuts Cheat Sheet',
      description: 'Open this keyboard shortcuts overview dialog',
      category: 'General',
      macKey: '?',
      winKey: '?',
      keyDisplay: '?'
    }
  ];

  constructor() {
    this.isMac =
      typeof navigator !== 'undefined' &&
      /(Mac|iPhone|iPod|iPad)/i.test(navigator.platform || navigator.userAgent || '');

    for (const s of this.shortcuts) {
      if (!s.keyDisplay) {
        s.keyDisplay = this.isMac ? s.macKey : s.winKey;
      }
    }
  }

  public getShortcut(id: string): ShortcutDefinition | undefined {
    return this.shortcuts.find(s => s.id === id);
  }

  public getFormattedKey(id: string): string {
    const s = this.getShortcut(id);
    if (!s) return '';
    return this.isMac ? s.macKey : s.winKey;
  }

  public openShortcutsModal(): void {
    this.isShortcutsModalOpen.set(true);
  }

  public closeShortcutsModal(): void {
    this.isShortcutsModalOpen.set(false);
  }

  public toggleShortcutsModal(): void {
    this.isShortcutsModalOpen.update(v => !v);
  }

  public handleKeyDown(event: KeyboardEvent): boolean {
    const isModifier = event.ctrlKey || event.metaKey || event.altKey;
    const target = event.target as HTMLElement | null;
    const isInput = target
      ? ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable
      : false;

    if (isInput) {
      if (event.key === 'Escape') {
        target?.blur();
        return true;
      }
      return false;
    }

    if (this.isShortcutsModalOpen()) {
      if (event.key === 'Escape') {
        this.closeShortcutsModal();
        event.preventDefault();
        return true;
      }
      return false;
    }

    if (isModifier) return false;

    if (event.key === '?') {
      this.toggleShortcutsModal();
      event.preventDefault();
      return true;
    }

    if (event.key === 'Escape') {
      if (this.mapStore?.isolatedBiomeId()) {
        this.mapStore.toggleIsolatedBiome(null);
        event.preventDefault();
        return true;
      }
      return false;
    }

    const keyLower = event.key.toLowerCase();

    if (event.key === '0' || event.key === 'Home') {
      this.mapStore?.requestCameraJump(0, 0, 6.4);
      event.preventDefault();
      return true;
    }
    if (keyLower === 'f') {
      this.mapStore?.fitWorldBounds();
      event.preventDefault();
      return true;
    }
    if (keyLower === 'm') {
      this.mapStore?.addMarkerAtCursor();
      event.preventDefault();
      return true;
    }
    if (event.key === '1') {
      this.mapStore?.setViewMode('seed');
      event.preventDefault();
      return true;
    }
    if (event.key === '2') {
      this.mapStore?.setViewMode('db');
      event.preventDefault();
      return true;
    }
    if (event.key === '3') {
      this.mapStore?.toggleTerrain3D();
      event.preventDefault();
      return true;
    }
    if (keyLower === 'h') {
      this.mapStore?.setViewMode('hybrid');
      event.preventDefault();
      return true;
    }
    if (keyLower === 'g') {
      this.mapStore?.toggleChunkGrid();
      event.preventDefault();
      return true;
    }
    if (keyLower === 'v') {
      this.mapStore?.toggleVoronoiContours();
      event.preventDefault();
      return true;
    }
    if (keyLower === 'l') {
      this.mapStore?.toggleHillshade();
      event.preventDefault();
      return true;
    }
    if (keyLower === 'r') {
      this.mapStore?.randomizeSeed();
      event.preventDefault();
      return true;
    }

    return false;
  }
}
