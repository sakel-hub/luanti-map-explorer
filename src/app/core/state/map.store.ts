import { Injectable, computed, signal } from '@angular/core';
import {
  AltitudeBand,
  BiomePaletteMode,
  CustomBiomeSeedOverride,
  DecodedWorldDatabase,
  DiscoveredWorldRegion,
  ExplorerExportBundle,
  MapMarker,
  MapMarkerCategory,
  MapgenType,
  NoiseParams,
  VerticalSliceConfig,
  VerticalSlicePresetId,
  ViewMode,
  WorldConfig,
  WorldDatabaseBackend,
  WorldLoadProgress
} from '../models/world.model';
import { BiomeDefinition, ClimateSample } from '../models/biome.model';
import {
  DEFAULT_LUANTI_BIOMES,
  EVERNESS_MOD_BIOMES,
  ETHEREAL_MOD_BIOMES,
  MINECLONE_GAME_BIOMES,
  resolveBiomeForDbNode
} from '../data/default-biomes';
import { resolveNodeColor } from '../data/node-colors';
import {
  LuantiWorldSynthesizer,
  createDefaultNoiseParams,
  sampleMipmapClimateAnchor
} from '../utils/perlin-noise';
import { buildDemoWorldDatabase, lookupWorldColumn } from '../utils/mapblock-parser';
import { safeGetItem, safeSetItem } from '../utils/storage.utils';

const STORAGE_KEY_MARKERS = 'luanti_explorer_markers_v1';
const STORAGE_KEY_BIOME_OVERRIDES = 'luanti_explorer_biome_overrides_v1';
const STORAGE_KEY_CUSTOM_BIOMES = 'luanti_explorer_custom_biomes_v1';
const STORAGE_KEY_LAST_CONFIG = 'luanti_explorer_world_config_v1';
const STORAGE_KEY_LAST_CAMERA = 'luanti_explorer_camera_v1';
const STORAGE_KEY_LAST_VIEW_MODE = 'luanti_explorer_view_mode_v1';
const STORAGE_KEY_IS_DEMO = 'luanti_explorer_is_demo_v1';
export const STORAGE_KEY_USER_SETTINGS = 'luanti_explorer_user_settings_v1';

export interface PersistedUserSettings {
  terrain3dEnabled?: boolean;
  terrainExaggeration?: number;
  treeSpritesEnabled?: boolean;
  buildingExtrusions3dEnabled?: boolean;
  hypsometricMode?: boolean;
  hillshadeEnabled?: boolean;
  chunkGridEnabled?: boolean;
  exploredBoundsEnabled?: boolean;
  markersVisible?: boolean;
  discoveredRegionsVisible?: boolean;
}

export interface ActiveMarkerPopupInfo {
  marker?: MapMarker;
  region?: DiscoveredWorldRegion;
  title: string;
  x: number;
  z: number;
  y?: number;
  screenX: number;
  screenY: number;
  blockCount?: number;
  dominantNode?: string;
}

export const MARKER_CATEGORY_COLORS: Record<MapMarkerCategory, string> = {
  base: '#10b981',
  portal: '#a855f7',
  dungeon: '#ef4444',
  resource: '#f59e0b',
  poi: '#38bdf8'
};

export const VERTICAL_SLICE_PRESETS: Record<
  Exclude<VerticalSlicePresetId, 'custom'>,
  { label: string; shortLabel: string; minY: number; maxY: number; caveMode: boolean; badge: string }
> = {
  high_sky: {
    label: 'High Space / Stratosphere',
    shortLabel: 'High Space',
    minY: 3800,
    maxY: 10300,
    caveMode: false,
    badge: 'Y: +3,800 .. +10,300'
  },
  floatlands: {
    label: 'Sky Islands / Floatlands',
    shortLabel: 'Sky Islands',
    minY: 480,
    maxY: 1760,
    caveMode: false,
    badge: 'Y: +480 .. +1,760'
  },
  surface: {
    label: 'Surface, Islands & Ocean',
    shortLabel: 'Surface',
    minY: -16,
    maxY: 240,
    caveMode: false,
    badge: 'Y: -16 .. +240'
  },
  caves: {
    label: 'Underground Caves & Mines',
    shortLabel: 'Caves',
    minY: -1024,
    maxY: -17,
    caveMode: true,
    badge: 'Y: -1,024 .. -17'
  },
  deep_caverns: {
    label: 'Deep Caverns & Magma',
    shortLabel: 'Deep Caverns',
    minY: -10240,
    maxY: -1025,
    caveMode: true,
    badge: 'Y: -10,240 .. -1,025'
  },
  abyss: {
    label: 'Deep Abyss / Underworld',
    shortLabel: 'Deep Abyss',
    minY: -31000,
    maxY: -10241,
    caveMode: true,
    badge: 'Y: -31,000 .. -10,241'
  }
};

@Injectable({
  providedIn: 'root'
})
export class MapStore {
  private readonly defaultNoises = createDefaultNoiseParams();

  public readonly worldConfig = signal<WorldConfig>({
    worldName: 'New Luanti World',
    gameId: 'minetest_game',
    backend: 'sqlite3',
    seed: 74829104,
    mapgen: 'v7',
    waterLevel: 1,
    heatNoise: this.defaultNoises.heatNoise,
    humidityNoise: this.defaultNoises.humidityNoise,
    terrainNoise: this.defaultNoises.terrainNoise,
    hasSqliteDb: true,
    blockCount: 0
  });

  public readonly biomes = signal<BiomeDefinition[]>(DEFAULT_LUANTI_BIOMES);
  public readonly biomePaletteMode = signal<BiomePaletteMode>('auto');
  public readonly discoveredModBiomes = signal<BiomeDefinition[]>([]);
  public readonly biomeSeedOverrides = signal<Record<string, CustomBiomeSeedOverride>>({});
  public readonly userCustomBiomes = signal<BiomeDefinition[]>([]);

  public readonly hasCustomBiomeModifications = computed<boolean>(
    () =>
      Object.keys(this.biomeSeedOverrides()).length > 0 ||
      this.userCustomBiomes().length > 0
  );

  // Custom Map Markers State
  public readonly markers = signal<MapMarker[]>([]);
  public readonly selectedMarkerId = signal<string | null>(null);
  public readonly markersVisible = signal<boolean>(true);

  // Cross-Section Elevation Profile Axis ('x' = East-West, 'z' = North-South)
  public readonly profileAxis = signal<'x' | 'z'>('x');

  /**
   * Effective biome registry used by both the 2D Voronoi Tessellation and the Seed/Hybrid synthesizer.
   * Automatically merges discovered modded biomes (e.g. Everness across lowland, ocean & underground),
   * user-added custom biomes, and persisted Voronoi seed point overrides!
   */
  public readonly activeBiomes = computed<BiomeDefinition[]>(() => {
    const base = this.biomes();
    const mode = this.biomePaletteMode();
    const overrides = this.biomeSeedOverrides();
    const customList = this.userCustomBiomes();

    const applyOverrides = (list: BiomeDefinition[]): BiomeDefinition[] =>
      list.map(b => {
        const ov = overrides[b.id];
        return ov ? { ...b, heatPoint: ov.heatPoint, humidityPoint: ov.humidityPoint } : b;
      });

    if (mode === 'vanilla') {
      return applyOverrides([...base, ...customList]);
    }

    if (mode === 'everness') {
      const byId = new Map<string, BiomeDefinition>();
      for (const b of base) byId.set(b.id, b);
      for (const b of EVERNESS_MOD_BIOMES) byId.set(b.id, b);
      for (const b of customList) byId.set(b.id, b);
      return applyOverrides(Array.from(byId.values()));
    }

    if (mode === 'ethereal') {
      const byId = new Map<string, BiomeDefinition>();
      for (const b of base) byId.set(b.id, b);
      for (const b of ETHEREAL_MOD_BIOMES) byId.set(b.id, b);
      for (const b of customList) byId.set(b.id, b);
      return applyOverrides(Array.from(byId.values()));
    }

    if (mode === 'mineclone') {
      return applyOverrides([...MINECLONE_GAME_BIOMES, ...customList]);
    }

    if (mode === 'all') {
      const byId = new Map<string, BiomeDefinition>();
      for (const b of base) byId.set(b.id, b);
      for (const b of EVERNESS_MOD_BIOMES) byId.set(b.id, b);
      for (const b of ETHEREAL_MOD_BIOMES) byId.set(b.id, b);
      for (const b of MINECLONE_GAME_BIOMES) byId.set(b.id, b);
      for (const b of customList) byId.set(b.id, b);
      return applyOverrides(Array.from(byId.values()));
    }

    // mode === 'auto'
    const gameId = (this.worldConfig().gameId || '').toLowerCase();
    const activeMods = this.worldConfig().activeMods || [];
    const disc = this.discoveredModBiomes();

    if (
      gameId.includes('mineclone') ||
      gameId.includes('mineclonia') ||
      disc.some(d => d.id.startsWith('mcl_'))
    ) {
      return applyOverrides([...MINECLONE_GAME_BIOMES, ...customList]);
    }

    let modList: BiomeDefinition[] = [];
    const hasEverness =
      activeMods.includes('everness') || disc.some(d => d.id.startsWith('everness_'));
    const hasEthereal =
      activeMods.includes('ethereal') || disc.some(d => d.id.startsWith('ethereal_'));

    if (hasEverness) {
      modList = [...modList, ...EVERNESS_MOD_BIOMES];
    }
    if (hasEthereal) {
      modList = [...modList, ...ETHEREAL_MOD_BIOMES];
    }

    for (const d of disc) {
      if (!modList.some(m => m.id === d.id)) {
        modList.push(d);
      }
    }

    const combinedMods = [...modList, ...customList];
    if (combinedMods.length === 0) {
      return applyOverrides(base);
    }

    // Merge mod biomes with base biomes, replacing base biomes in the SAME altitudeBand whose seed is within 6 units
    const filteredBase = base.filter(
      b =>
        !combinedMods.some(
          m =>
            m.altitudeBand === b.altitudeBand &&
            Math.hypot(m.heatPoint - b.heatPoint, m.humidityPoint - b.humidityPoint) < 6
        )
    );

    return applyOverrides([...filteredBase, ...combinedMods]);
  });

  public readonly viewMode = signal<ViewMode>('hybrid');
  public readonly altitudeBand = signal<AltitudeBand>('lowland');
  public readonly isolatedBiomeId = signal<string | null>(null);

  // Vertical Elevation / Depth Slicer State (Sky Islands, Surface, Underground Caves, Deep Abyss)
  public readonly verticalSlice = signal<VerticalSliceConfig>({
    presetId: 'surface',
    minY: -16,
    maxY: 240,
    caveMode: false
  });

  public readonly terrain3dEnabled = signal<boolean>(false);
  public readonly terrainExaggeration = signal<number>(1.3);
  public readonly buildingExtrusions3dEnabled = signal<boolean>(false);
  public readonly hypsometricMode = signal<boolean>(false);
  public readonly hillshadeEnabled = signal<boolean>(true);
  public readonly voronoiContoursEnabled = signal<boolean>(false);
  public readonly treeSpritesEnabled = signal<boolean>(true);
  public readonly chunkGridEnabled = signal<boolean>(true);
  public readonly exploredBoundsEnabled = signal<boolean>(true);
  public readonly discoveredRegionsVisible = signal<boolean>(true);
  public readonly activeMarkerPopup = signal<ActiveMarkerPopupInfo | null>(null);

  // World Database State
  public readonly worldDatabase = signal<DecodedWorldDatabase | null>(null);
  public readonly databaseBackend = computed<WorldDatabaseBackend | null>(() => {
    const db = this.worldDatabase();
    if (db?.databaseBackend) return db.databaseBackend;
    const cfgBackend = this.worldConfig().backend?.toLowerCase();
    if (cfgBackend === 'postgresql' || cfgBackend === 'pgsql') return 'postgresql';
    if (cfgBackend === 'sqlite3' || cfgBackend === 'sqlite') return 'sqlite3';
    if (db) return 'sqlite3';
    return null;
  });
  public readonly isLoadingWorld = signal<boolean>(false);
  public readonly loadStatusMessage = signal<string>('');
  public readonly loadProgress = signal<WorldLoadProgress | null>(null);

  // Tile cache busting counter whenever rendering parameters change
  public readonly renderRevision = signal<number>(1);

  // Camera state & jump requests
  public readonly cameraState = signal<{ x: number; z: number; zoom: number; pitch: number; bearing: number }>({
    x: 0,
    z: 0,
    zoom: 6.4,
    pitch: 0,
    bearing: 0
  });
  public readonly cameraJumpRequest = signal<{ x: number; z: number; zoom?: number; seq: number } | null>(null);
  public readonly cameraOrientationRequest = signal<{ pitch: number; bearing: number; seq: number } | null>(null);

  // Live Synthesizer for instant cursor telemetry (< 0.05ms per mousemove)
  public readonly synthesizer = computed(() => {
    const cfg = this.worldConfig();
    return new LuantiWorldSynthesizer(
      cfg.seed,
      cfg.mapgen,
      cfg.waterLevel,
      cfg.heatNoise,
      cfg.humidityNoise,
      cfg.terrainNoise,
      this.activeBiomes()
    );
  });

  // Live Cursor Coordinate & Climate Telemetry
  public readonly cursorPos = signal<{ x: number; z: number }>({ x: 0, z: 0 });

  public readonly cursorSample = computed<ClimateSample>(() => {
    const pos = this.cursorPos();
    const synth = this.synthesizer();
    const db = this.worldDatabase();
    const mode = this.viewMode();
    const biomes = this.activeBiomes();
    const dbCol = mode !== 'seed' ? lookupWorldColumn(pos.x, pos.z, db) : undefined;

    const slice = this.verticalSlice();
    const refSliceY = !dbCol && slice.maxY < -200 ? slice.maxY : undefined;

    let evalPt = synth.evaluatePoint(pos.x, pos.z, refSliceY);
    if (mode !== 'seed' && db?.macroMipmap) {
      const anchor = sampleMipmapClimateAnchor(pos.x, pos.z, db.macroMipmap, biomes);
      if (anchor) {
        evalPt = synth.evaluatePointWithClimateAnchor(
          pos.x,
          pos.z,
          anchor.heat,
          anchor.humidity,
          anchor.blend,
          refSliceY
        );
      }
    }

    let biome = evalPt.biome;
    let heat = evalPt.heat;
    let humidity = evalPt.humidity;
    let voronoiDistance = evalPt.voronoiDist;

    if (dbCol) {
      biome = resolveBiomeForDbNode(
        dbCol.nodeName,
        dbCol.topY,
        dbCol.waterDepth,
        biomes,
        evalPt.biome
      );
      if (dbCol.waterDepth === 0 && !dbCol.nodeName.includes('water')) {
        const dHeat = (evalPt.heat - 50) * 0.14;
        const dHum = (evalPt.humidity - 50) * 0.14;
        heat = Math.max(0, Math.min(100, biome.heatPoint + dHeat));
        humidity = Math.max(0, Math.min(100, biome.humidityPoint + dHum));
        voronoiDistance = Math.hypot(heat - biome.heatPoint, humidity - biome.humidityPoint);
      }
    }

    const effectiveY = dbCol ? dbCol.topY : evalPt.elevation;
    const blockX = Math.floor(pos.x / 16);
    const blockY = Math.floor(effectiveY / 16);
    const blockZ = Math.floor(pos.z / 16);

    return {
      x: pos.x,
      z: pos.z,
      y: effectiveY,
      blockX,
      blockY,
      blockZ,
      heat,
      humidity,
      biome,
      voronoiDistance,
      secondBiome: evalPt.secondBiome,
      secondVoronoiDistance: evalPt.secondVoronoiDist,
      dbNodeName: dbCol?.nodeName,
      dbElevation: dbCol?.topY,
      isExploredInDb: !!dbCol
    };
  });

  /**
   * Computes a live East-West ('x') or North-South ('z') (-160..+160 nodes) terrain elevation
   * cross-section profile passing through the current cursor coordinate.
   */
  public readonly elevationProfile = computed(() => {
    const pos = this.cursorPos();
    const axis = this.profileAxis();
    const synth = this.synthesizer();
    const db = this.worldDatabase();
    const mode = this.viewMode();
    const samples: Array<{ offset: number; x: number; z: number; y: number }> = [];

    for (let d = -160; d <= 160; d += 8) {
      const wx = axis === 'x' ? pos.x + d : pos.x;
      const wz = axis === 'z' ? pos.z + d : pos.z;
      const dbCol = lookupWorldColumn(wx, wz, db);
      const y =
        dbCol && (mode === 'db' || mode === 'hybrid')
          ? dbCol.topY
          : synth.evaluateElevation(wx, wz);
      samples.push({ offset: d, x: wx, z: wz, y });
    }
    return samples;
  });

  public readonly isolatedBiome = computed<BiomeDefinition | null>(() => {
    const id = this.isolatedBiomeId();
    if (!id) return null;
    return this.activeBiomes().find(b => b.id === id) || null;
  });

  constructor() {
    this.loadPersistedState();
    this.parseUrlQueryParams();
    const isDemo = safeGetItem(STORAGE_KEY_IS_DEMO);
    // Only initialize demoDb if the user has not previously loaded a custom world
    if (isDemo !== 'false') {
      const demoDb = buildDemoWorldDatabase(this.worldConfig().seed, this.verticalSlice().presetId);
      this.worldDatabase.set(demoDb);
      this.worldConfig.update(c => ({ ...c, blockCount: demoDb.totalBlocks }));
    }
  }

  private loadPersistedState(): void {
    try {
      const rawMarkers = safeGetItem(STORAGE_KEY_MARKERS);
      if (rawMarkers) {
        const parsed = JSON.parse(rawMarkers);
        if (Array.isArray(parsed)) {
          this.markers.set(parsed);
        }
      }
      const rawOverrides = safeGetItem(STORAGE_KEY_BIOME_OVERRIDES);
      if (rawOverrides) {
        const parsed = JSON.parse(rawOverrides);
        if (parsed && typeof parsed === 'object') {
          this.biomeSeedOverrides.set(parsed);
        }
      }
      const rawCustomBiomes = safeGetItem(STORAGE_KEY_CUSTOM_BIOMES);
      if (rawCustomBiomes) {
        const parsed = JSON.parse(rawCustomBiomes);
        if (Array.isArray(parsed)) {
          this.userCustomBiomes.set(parsed);
        }
      }

      // Restore camera state (clamp pitch & bearing to 0 when booting in 2D Flat mode)
      const rawCam = safeGetItem(STORAGE_KEY_LAST_CAMERA);
      if (rawCam) {
        const parsed = JSON.parse(rawCam);
        if (parsed && typeof parsed.x === 'number' && typeof parsed.z === 'number') {
          this.cameraState.set({
            x: parsed.x,
            z: parsed.z,
            zoom: typeof parsed.zoom === 'number' ? parsed.zoom : 6.4,
            pitch: this.terrain3dEnabled() && typeof parsed.pitch === 'number' ? parsed.pitch : 0,
            bearing: this.terrain3dEnabled() && typeof parsed.bearing === 'number' ? parsed.bearing : 0
          });
        }
      }

      // Restore view mode
      const rawViewMode = safeGetItem(STORAGE_KEY_LAST_VIEW_MODE) as ViewMode | null;
      if (rawViewMode && (rawViewMode === 'hybrid' || rawViewMode === 'db' || rawViewMode === 'seed')) {
        this.viewMode.set(rawViewMode);
      }

      // Restore previous world config parameters
      const rawConfig = safeGetItem(STORAGE_KEY_LAST_CONFIG);
      if (rawConfig) {
        const parsed = JSON.parse(rawConfig);
        if (parsed && typeof parsed.seed === 'number') {
          this.worldConfig.update(c => ({ ...c, ...parsed }));
        }
      }
      // Load persisted explorer settings (toggles, 3d relief, models, markers, etc.)
      this.loadUserSettingsFromStorage();
    } catch {
      // Ignore storage access errors
    }
  }

  public saveUserSettingsToStorage(): void {
    const settings: PersistedUserSettings = {
      terrain3dEnabled: this.terrain3dEnabled(),
      terrainExaggeration: this.terrainExaggeration(),
      treeSpritesEnabled: this.treeSpritesEnabled(),
      buildingExtrusions3dEnabled: this.buildingExtrusions3dEnabled(),
      hypsometricMode: this.hypsometricMode(),
      hillshadeEnabled: this.hillshadeEnabled(),
      chunkGridEnabled: this.chunkGridEnabled(),
      exploredBoundsEnabled: this.exploredBoundsEnabled(),
      markersVisible: this.markersVisible(),
      discoveredRegionsVisible: this.discoveredRegionsVisible()
    };
    safeSetItem(STORAGE_KEY_USER_SETTINGS, JSON.stringify(settings));
  }

  private loadUserSettingsFromStorage(): void {
    const rawSettings = safeGetItem(STORAGE_KEY_USER_SETTINGS);
    if (!rawSettings) return;
    try {
      const s: PersistedUserSettings = JSON.parse(rawSettings);
      if (typeof s.terrain3dEnabled === 'boolean') this.terrain3dEnabled.set(s.terrain3dEnabled);
      if (typeof s.terrainExaggeration === 'number') this.terrainExaggeration.set(s.terrainExaggeration);
      if (typeof s.treeSpritesEnabled === 'boolean') this.treeSpritesEnabled.set(s.treeSpritesEnabled);
      if (typeof s.buildingExtrusions3dEnabled === 'boolean') this.buildingExtrusions3dEnabled.set(s.buildingExtrusions3dEnabled);
      if (typeof s.hypsometricMode === 'boolean') this.hypsometricMode.set(s.hypsometricMode);
      if (typeof s.hillshadeEnabled === 'boolean') this.hillshadeEnabled.set(s.hillshadeEnabled);
      if (typeof s.chunkGridEnabled === 'boolean') this.chunkGridEnabled.set(s.chunkGridEnabled);
      if (typeof s.exploredBoundsEnabled === 'boolean') this.exploredBoundsEnabled.set(s.exploredBoundsEnabled);
      if (typeof s.markersVisible === 'boolean') this.markersVisible.set(s.markersVisible);
      if (typeof s.discoveredRegionsVisible === 'boolean') this.discoveredRegionsVisible.set(s.discoveredRegionsVisible);
    } catch {
      // Ignore JSON parse errors
    }
  }

  public saveCameraStateToStorage(): void {
    safeSetItem(STORAGE_KEY_LAST_CAMERA, JSON.stringify(this.cameraState()));
  }

  private saveMarkersToStorage(): void {
    safeSetItem(STORAGE_KEY_MARKERS, JSON.stringify(this.markers()));
  }

  private saveBiomesToStorage(): void {
    safeSetItem(STORAGE_KEY_BIOME_OVERRIDES, JSON.stringify(this.biomeSeedOverrides()));
    safeSetItem(STORAGE_KEY_CUSTOM_BIOMES, JSON.stringify(this.userCustomBiomes()));
  }

  private parseUrlQueryParams(): void {
    try {
      if (typeof window === 'undefined' || !window.location.search) return;
      const params = new URLSearchParams(window.location.search);

      const seedParam = params.get('seed');
      const mgParam = params.get('mg') as MapgenType | null;
      const modeParam = params.get('mode') as ViewMode | null;
      const xParam = params.get('x');
      const zParam = params.get('z');
      const zoomParam = params.get('zoom');
      const pitchParam = params.get('pitch');
      const r3dParam = params.get('r3d');
      const yMinParam = params.get('yMin');
      const yMaxParam = params.get('yMax');

      if (seedParam && !isNaN(Number(seedParam))) {
        this.worldConfig.update(c => ({ ...c, seed: Number(seedParam) }));
      }
      if (mgParam && ['v7', 'valleys', 'carpathian', 'flat'].includes(mgParam)) {
        this.worldConfig.update(c => ({ ...c, mapgen: mgParam }));
      }
      if (modeParam && ['seed', 'db', 'hybrid'].includes(modeParam)) {
        this.viewMode.set(modeParam);
      }
      if (yMinParam !== null && yMaxParam !== null && !isNaN(Number(yMinParam)) && !isNaN(Number(yMaxParam))) {
        this.setCustomVerticalSlice(Number(yMinParam), Number(yMaxParam));
      }
      if (xParam !== null || zParam !== null || zoomParam !== null || pitchParam !== null || r3dParam !== null) {
        const curr = this.cameraState();
        const x = xParam && !isNaN(Number(xParam)) ? Number(xParam) : curr.x;
        const z = zParam && !isNaN(Number(zParam)) ? Number(zParam) : curr.z;
        const zoom = zoomParam && !isNaN(Number(zoomParam)) ? Number(zoomParam) : curr.zoom;
        const is3d = r3dParam === '1' || (pitchParam !== null && Number(pitchParam) > 10);
        const pitch = pitchParam && !isNaN(Number(pitchParam)) ? Number(pitchParam) : is3d ? 52 : curr.pitch;

        this.cameraState.set({ x, z, zoom, pitch, bearing: is3d ? -28 : 0 });
        this.cursorPos.set({ x, z });
        this.terrain3dEnabled.set(is3d);
      }
    } catch {
      // Ignore malformed query params
    }
  }

  public bumpRevision(): void {
    this.renderRevision.update(r => r + 1);
  }

  public setWorldName(worldName: string): void {
    this.worldConfig.update(c => ({ ...c, worldName }));
  }

  public setBiomePaletteMode(mode: BiomePaletteMode): void {
    this.biomePaletteMode.set(mode);
    this.bumpRevision();
  }

  public setDiscoveredModBiomes(modBiomes: BiomeDefinition[]): void {
    this.discoveredModBiomes.set(modBiomes);
    if (this.biomePaletteMode() === 'auto') {
      this.bumpRevision();
    }
  }

  public updateBiomeSeedPoint(biomeId: string, heatPoint: number, humidityPoint: number): void {
    const clampedH = Math.max(0, Math.min(100, Math.round(heatPoint)));
    const clampedU = Math.max(0, Math.min(100, Math.round(humidityPoint)));

    this.biomeSeedOverrides.update(prev => ({
      ...prev,
      [biomeId]: { heatPoint: clampedH, humidityPoint: clampedU }
    }));
    this.biomes.update(list =>
      list.map(b => (b.id === biomeId ? { ...b, heatPoint: clampedH, humidityPoint: clampedU } : b))
    );
    this.discoveredModBiomes.update(list =>
      list.map(b => (b.id === biomeId ? { ...b, heatPoint: clampedH, humidityPoint: clampedU } : b))
    );
    this.userCustomBiomes.update(list =>
      list.map(b => (b.id === biomeId ? { ...b, heatPoint: clampedH, humidityPoint: clampedU } : b))
    );
    this.saveBiomesToStorage();
    this.bumpRevision();
  }

  public addCustomBiome(input: {
    name: string;
    heatPoint: number;
    humidityPoint: number;
    altitudeBand: Exclude<AltitudeBand, 'all'>;
    hexColor: string;
    topNode?: string;
  }): BiomeDefinition {
    const cleanName = input.name.trim() || 'Custom Biome';
    const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const id = `custom_${slug}_${Date.now().toString(36)}`;
    const hex = /^#[0-9a-fA-F]{6}$/.test(input.hexColor) ? input.hexColor : '#38bdf8';
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const band = input.altitudeBand || 'lowland';
    const yMin =
      band === 'underground' ? -31000 : band === 'ocean' ? -255 : band === 'highland' ? 48 : 4;
    const yMax =
      band === 'underground' ? -113 : band === 'ocean' ? 3 : band === 'highland' ? 31000 : 48;

    const newBiome: BiomeDefinition = {
      id,
      name: cleanName,
      game: 'custom',
      heatPoint: Math.max(0, Math.min(100, Math.round(input.heatPoint))),
      humidityPoint: Math.max(0, Math.min(100, Math.round(input.humidityPoint))),
      yMin,
      yMax,
      altitudeBand: band,
      color: [r, g, b],
      hexColor: hex,
      topNode: input.topNode?.trim() || 'default:dirt_with_grass',
      fillerNode: 'default:dirt',
      stoneNode: 'default:stone',
      description: `User-configured custom ${band} biome at Heat ${Math.round(input.heatPoint)}°, Humidity ${Math.round(input.humidityPoint)}%.`
    };

    this.userCustomBiomes.update(list => [...list, newBiome]);
    this.saveBiomesToStorage();
    this.bumpRevision();
    return newBiome;
  }

  public removeCustomBiome(biomeId: string): void {
    this.userCustomBiomes.update(list => list.filter(b => b.id !== biomeId));
    if (this.isolatedBiomeId() === biomeId) {
      this.isolatedBiomeId.set(null);
    }
    this.saveBiomesToStorage();
    this.bumpRevision();
  }

  public resetBiomesToDefault(): void {
    this.biomeSeedOverrides.set({});
    this.userCustomBiomes.set([]);
    this.biomes.set(DEFAULT_LUANTI_BIOMES);
    this.saveBiomesToStorage();
    this.bumpRevision();
  }

  public setSeed(seedInput: number | string): void {
    let numericSeed = typeof seedInput === 'number' ? seedInput : parseInt(String(seedInput), 10);
    if (isNaN(numericSeed)) {
      numericSeed = 0;
      const str = String(seedInput);
      for (let i = 0; i < str.length; i++) {
        numericSeed = (Math.imul(31, numericSeed) + str.charCodeAt(i)) | 0;
      }
      numericSeed = Math.abs(numericSeed);
    }
    this.worldConfig.update(c => ({ ...c, seed: numericSeed }));
    if (this.worldDatabase()?.fileName === 'demo-world/map.sqlite') {
      const demoDb = buildDemoWorldDatabase(numericSeed, this.verticalSlice().presetId);
      this.worldDatabase.set(demoDb);
    }
    this.bumpRevision();
  }

  public randomizeSeed(): void {
    const randomSeed = Math.floor(10000000 + Math.random() * 899999999);
    this.setSeed(randomSeed);
  }

  public setMapgen(mapgen: MapgenType): void {
    this.worldConfig.update(c => ({ ...c, mapgen }));
    this.bumpRevision();
  }

  public setWaterLevel(waterLevel: number): void {
    this.worldConfig.update(c => ({ ...c, waterLevel }));
    this.bumpRevision();
  }

  public setHeatSpread(spread: number): void {
    const clamped = Math.max(100, Math.min(2500, spread));
    this.worldConfig.update(c => ({
      ...c,
      heatNoise: { ...c.heatNoise, spread: [clamped, clamped, clamped] }
    }));
    this.bumpRevision();
  }

  public setHumiditySpread(spread: number): void {
    const clamped = Math.max(100, Math.min(2500, spread));
    this.worldConfig.update(c => ({
      ...c,
      humidityNoise: { ...c.humidityNoise, spread: [clamped, clamped, clamped] }
    }));
    this.bumpRevision();
  }

  public setViewMode(mode: ViewMode): void {
    this.viewMode.set(mode);
    safeSetItem(STORAGE_KEY_LAST_VIEW_MODE, mode);
    this.bumpRevision();
  }

  public setAltitudeBand(band: AltitudeBand): void {
    this.altitudeBand.set(band);
  }

  public setVerticalSlicePreset(presetId: Exclude<VerticalSlicePresetId, 'custom'>): void {
    const preset = VERTICAL_SLICE_PRESETS[presetId];
    if (!preset) return;
    this.verticalSlice.set({
      presetId,
      minY: preset.minY,
      maxY: preset.maxY,
      caveMode: preset.caveMode
    });
    if (this.worldDatabase()?.fileName === 'demo-world/map.sqlite') {
      const demoDb = buildDemoWorldDatabase(this.worldConfig().seed, presetId);
      this.worldDatabase.set(demoDb);
    }
    this.bumpRevision();
  }

  public setCustomVerticalSlice(minY: number, maxY: number, caveMode?: boolean): void {
    const lo = Math.max(-31000, Math.min(31000, Math.min(minY, maxY)));
    const hi = Math.max(-31000, Math.min(31000, Math.max(minY, maxY)));
    const curr = this.verticalSlice();
    this.verticalSlice.set({
      presetId: 'custom',
      minY: lo,
      maxY: hi,
      caveMode: caveMode !== undefined ? caveMode : hi < 0 ? true : curr.caveMode
    });
    this.bumpRevision();
  }

  public toggleCaveMode(): void {
    this.verticalSlice.update(s => ({
      ...s,
      caveMode: !s.caveMode
    }));
    this.bumpRevision();
  }

  public toggleIsolatedBiome(biomeId: string | null): void {
    if (this.isolatedBiomeId() === biomeId) {
      this.isolatedBiomeId.set(null);
    } else {
      this.isolatedBiomeId.set(biomeId);
    }
    this.bumpRevision();
  }

  public toggleTerrain3D(force?: boolean): void {
    const next = force !== undefined ? force : !this.terrain3dEnabled();
    this.terrain3dEnabled.set(next);
    this.saveUserSettingsToStorage();
  }

  public setTerrainExaggeration(val: number): void {
    this.terrainExaggeration.set(val);
    this.saveUserSettingsToStorage();
  }

  public setExaggeration(val: number): void {
    this.setTerrainExaggeration(val);
  }

  public setPitch3D(pitch: number): void {
    this.cameraState.update(c => ({ ...c, pitch }));
    const curr = this.cameraState();
    this.cameraOrientationRequest.set({
      pitch: curr.pitch,
      bearing: curr.bearing,
      seq: Date.now() + Math.random()
    });
  }

  public setBearing3D(bearing: number): void {
    this.cameraState.update(c => ({ ...c, bearing }));
    const curr = this.cameraState();
    this.cameraOrientationRequest.set({
      pitch: curr.pitch,
      bearing: curr.bearing,
      seq: Date.now() + Math.random()
    });
  }

  public setBuildingExtrusions3dEnabled(val: boolean): void {
    this.buildingExtrusions3dEnabled.set(val);
    this.saveUserSettingsToStorage();
  }

  public toggleBuildingExtrusions3D(): void {
    this.buildingExtrusions3dEnabled.update(v => !v);
    this.saveUserSettingsToStorage();
  }

  public toggleTreeSprites(): void {
    this.treeSpritesEnabled.update(v => !v);
    this.saveUserSettingsToStorage();
  }

  public setTreeSpritesEnabled(val: boolean): void {
    this.treeSpritesEnabled.set(val);
    this.saveUserSettingsToStorage();
  }

  public toggleHypsometricMode(): void {
    this.hypsometricMode.update(v => !v);
    this.saveUserSettingsToStorage();
    this.bumpRevision();
  }

  public toggleHillshade(): void {
    this.hillshadeEnabled.update(v => !v);
    this.saveUserSettingsToStorage();
    this.bumpRevision();
  }

  public toggleVoronoiContours(): void {
    this.voronoiContoursEnabled.update(v => !v);
    this.bumpRevision();
  }

  public toggleChunkGrid(): void {
    this.chunkGridEnabled.update(v => !v);
    this.saveUserSettingsToStorage();
  }

  public toggleExploredBounds(): void {
    this.exploredBoundsEnabled.update(v => !v);
    this.saveUserSettingsToStorage();
    this.bumpRevision();
  }

  public toggleDiscoveredRegionsVisible(): void {
    this.discoveredRegionsVisible.update(v => !v);
    this.saveUserSettingsToStorage();
  }

  public setDiscoveredRegionsVisible(val: boolean): void {
    this.discoveredRegionsVisible.set(val);
    this.saveUserSettingsToStorage();
  }

  public openMarkerPopup(info: ActiveMarkerPopupInfo): void {
    this.activeMarkerPopup.set(info);
  }

  public closeMarkerPopup(): void {
    this.activeMarkerPopup.set(null);
  }

  public toggleProfileAxis(): void {
    this.profileAxis.update(a => (a === 'x' ? 'z' : 'x'));
  }

  public setCursorPos(x: number, z: number): void {
    const rx = Math.round(x);
    const rz = Math.round(z);
    const curr = this.cursorPos();
    if (curr.x === rx && curr.z === rz) return;
    this.cursorPos.set({ x: rx, z: rz });
  }

  public requestCameraJump(x: number, z: number, zoom?: number): void {
    const rx = Math.round(x);
    const rz = Math.round(z);
    this.cursorPos.set({ x: rx, z: rz });
    this.cameraState.update(c => ({
      ...c,
      x: rx,
      z: rz,
      zoom: zoom !== undefined ? zoom : c.zoom
    }));
    this.cameraJumpRequest.set({
      x,
      z,
      zoom,
      seq: Date.now() + Math.random()
    });
  }

  /**
   * Jumps the camera to a specific zoom / downsampling preset while preserving the current X/Z center.
   */
  public setCameraZoomPreset(zoom: number): void {
    const cam = this.cameraState();
    this.requestCameraJump(cam.x, cam.z, zoom);
  }

  /**
   * Dynamically centers and zooms the camera to fit the actual bounding box of the loaded SQLite world.
   * For large worlds (span >= 6144 nodes), guarantees landing in the World 4x4 downsampling tier (zoom <= 2.2).
   */
  public fitWorldBounds(): void {
    const db = this.worldDatabase();
    if (!db) {
      this.requestCameraJump(0, 0, 5.2);
      return;
    }
    const minX = db.minBlockX * 16;
    const maxX = (db.maxBlockX + 1) * 16;
    const minZ = db.minBlockZ * 16;
    const maxZ = (db.maxBlockZ + 1) * 16;
    const centerX = Math.round((minX + maxX) * 0.5);
    const centerZ = Math.round((minZ + maxZ) * 0.5);
    const spanNodes = Math.max(256, maxX - minX, maxZ - minZ);
    const rawZoom = Number((9.8 - Math.log2(spanNodes / 64)).toFixed(1));
    const computedZoom =
      spanNodes >= 6144
        ? Math.max(1.8, Math.min(2.2, rawZoom))
        : Math.max(1.8, Math.min(6.8, rawZoom));
    this.requestCameraJump(centerX, centerZ, computedZoom);
  }

  // ============================================
  // CUSTOM MAP MARKERS & EXPORT/IMPORT BUNDLE
  // ============================================

  public toggleMarkersVisible(): void {
    this.markersVisible.update(v => !v);
    this.saveUserSettingsToStorage();
  }

  public addMarker(input: {
    label: string;
    x: number;
    y: number;
    z: number;
    category?: MapMarkerCategory;
    color?: string;
    notes?: string;
  }): MapMarker {
    const cat: MapMarkerCategory = input.category || 'poi';
    const marker: MapMarker = {
      id: `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      label: input.label.trim() || `Marker (${Math.round(input.x)}, ${Math.round(input.z)})`,
      x: Math.round(input.x),
      y: Math.round(input.y),
      z: Math.round(input.z),
      category: cat,
      color: input.color || MARKER_CATEGORY_COLORS[cat],
      notes: input.notes?.trim() || undefined,
      createdAt: Date.now()
    };
    this.markers.update(list => [marker, ...list]);
    this.selectedMarkerId.set(marker.id);
    this.saveMarkersToStorage();
    return marker;
  }

  public addMarkerAtCursor(
    label?: string,
    category: MapMarkerCategory = 'poi',
    color?: string,
    notes?: string
  ): MapMarker {
    const sample = this.cursorSample();
    return this.addMarker({
      label: label?.trim() || `${sample.biome.name} (${sample.x}, ${sample.z})`,
      x: sample.x,
      y: sample.y,
      z: sample.z,
      category,
      color: color || MARKER_CATEGORY_COLORS[category],
      notes
    });
  }

  public updateMarker(
    id: string,
    patch: Partial<Omit<MapMarker, 'id' | 'createdAt'>>
  ): void {
    this.markers.update(list =>
      list.map(m => (m.id === id ? { ...m, ...patch } : m))
    );
    this.saveMarkersToStorage();
  }

  public removeMarker(id: string): void {
    this.markers.update(list => list.filter(m => m.id !== id));
    if (this.selectedMarkerId() === id) {
      this.selectedMarkerId.set(null);
    }
    this.saveMarkersToStorage();
  }

  public clearAllMarkers(): void {
    this.markers.set([]);
    this.selectedMarkerId.set(null);
    this.saveMarkersToStorage();
  }

  public exportBundleJson(): string {
    const cfg = this.worldConfig();
    const bundle: ExplorerExportBundle = {
      version: 1,
      exportedAt: new Date().toISOString(),
      worldSeed: cfg.seed,
      mapgen: cfg.mapgen,
      markers: this.markers(),
      customBiomes: this.userCustomBiomes(),
      biomeSeedOverrides: this.biomeSeedOverrides()
    };
    return JSON.stringify(bundle, null, 2);
  }

  public importBundleJson(jsonText: string): { markersCount: number; biomesCount: number } {
    const parsed = JSON.parse(jsonText);
    let markersCount = 0;
    let biomesCount = 0;

    const rawMarkers = Array.isArray(parsed) ? parsed : parsed?.markers;
    if (Array.isArray(rawMarkers)) {
      const validMarkers: MapMarker[] = [];
      for (const item of rawMarkers) {
        if (item && typeof item.x === 'number' && typeof item.z === 'number') {
          const cat: MapMarkerCategory = ['base', 'portal', 'dungeon', 'resource', 'poi'].includes(
            item.category
          )
            ? item.category
            : 'poi';
          validMarkers.push({
            id:
              typeof item.id === 'string' && item.id
                ? item.id
                : `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
            label: String(item.label || `Marker (${item.x}, ${item.z})`),
            x: Math.round(item.x),
            y: typeof item.y === 'number' ? Math.round(item.y) : 1,
            z: Math.round(item.z),
            category: cat,
            color:
              typeof item.color === 'string' && item.color.startsWith('#')
                ? item.color
                : MARKER_CATEGORY_COLORS[cat],
            notes: typeof item.notes === 'string' ? item.notes : undefined,
            createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now()
          });
        }
      }
      if (validMarkers.length > 0) {
        this.markers.update(existing => {
          const byId = new Map<string, MapMarker>();
          for (const m of existing) byId.set(m.id, m);
          for (const m of validMarkers) byId.set(m.id, m);
          return Array.from(byId.values());
        });
        this.saveMarkersToStorage();
        markersCount = validMarkers.length;
      }
    }

    if (parsed && Array.isArray(parsed.customBiomes)) {
      const validBiomes: BiomeDefinition[] = [];
      for (const b of parsed.customBiomes) {
        if (b && typeof b.id === 'string' && typeof b.name === 'string') {
          const color: [number, number, number] = Array.isArray(b.color) && b.color.length === 3
            ? [Number(b.color[0]), Number(b.color[1]), Number(b.color[2])]
            : resolveNodeColor(b.topNode || 'default:dirt_with_grass');
          validBiomes.push({
            id: b.id,
            name: b.name,
            game: b.game || 'custom',
            heatPoint: Math.max(0, Math.min(100, Number(b.heatPoint ?? 50))),
            humidityPoint: Math.max(0, Math.min(100, Number(b.humidityPoint ?? 50))),
            yMin: Number(b.yMin ?? 4),
            yMax: Number(b.yMax ?? 48),
            altitudeBand: b.altitudeBand || 'lowland',
            color,
            hexColor: b.hexColor || '#38bdf8',
            topNode: b.topNode || 'default:dirt_with_grass',
            fillerNode: b.fillerNode || 'default:dirt',
            stoneNode: b.stoneNode || 'default:stone',
            description: b.description || 'Imported custom biome.'
          });
        }
      }
      if (validBiomes.length > 0) {
        this.userCustomBiomes.update(existing => {
          const byId = new Map<string, BiomeDefinition>();
          for (const item of existing) byId.set(item.id, item);
          for (const item of validBiomes) byId.set(item.id, item);
          return Array.from(byId.values());
        });
        biomesCount += validBiomes.length;
      }
    }

    if (parsed && parsed.biomeSeedOverrides && typeof parsed.biomeSeedOverrides === 'object') {
      this.biomeSeedOverrides.update(prev => ({
        ...prev,
        ...parsed.biomeSeedOverrides
      }));
      biomesCount += Object.keys(parsed.biomeSeedOverrides).length;
    }

    if (biomesCount > 0) {
      this.saveBiomesToStorage();
      this.bumpRevision();
    }

    return { markersCount, biomesCount };
  }

  public exportLuantiWaypointsTxt(): string {
    return this.markers()
      .map(
        m =>
          `${m.label} (${m.x}, ${m.y}, ${m.z}) [${m.category.toUpperCase()} ${m.color}]${m.notes ? ` - ${m.notes}` : ''}`
      )
      .join('\n');
  }

  public loadDemoDatabase(backend: WorldDatabaseBackend = 'sqlite3'): void {
    safeSetItem(STORAGE_KEY_IS_DEMO, 'true');
    this.discoveredModBiomes.set([]);
    const demoDb = buildDemoWorldDatabase(this.worldConfig().seed, this.verticalSlice().presetId);
    demoDb.databaseBackend = backend;
    demoDb.fileName = backend === 'postgresql' ? 'demo-world/map.sql' : 'demo-world/map.sqlite';
    this.worldDatabase.set(demoDb);
    this.worldConfig.update(c => ({
      ...c,
      worldName: backend === 'postgresql' ? 'Demo Citadel World (PostgreSQL)' : 'Demo Citadel World (SQLite)',
      backend: backend === 'postgresql' ? 'postgresql' : 'sqlite3',
      hasSqliteDb: true,
      hasDatabase: true,
      databaseBackend: backend,
      blockCount: demoDb.totalBlocks
    }));
    if (this.viewMode() === 'seed') {
      this.viewMode.set('hybrid');
    }
    this.bumpRevision();
    this.requestCameraJump(0, 0, 6.8);
  }

  public applyLoadedWorld(
    partialConfig: Partial<WorldConfig>,
    db: DecodedWorldDatabase | null
  ): void {
    const isDemo = db?.fileName === 'demo-world/map.sqlite';
    safeSetItem(STORAGE_KEY_IS_DEMO, isDemo ? 'true' : 'false');

    this.worldConfig.update(curr => {
      const updated = {
        ...curr,
        ...partialConfig,
        hasSqliteDb: !!db,
        hasDatabase: !!db,
        databaseBackend: db?.databaseBackend,
        blockCount: db ? db.totalBlocks : 0
      };
      if (!isDemo && updated.worldName) {
        safeSetItem(
          STORAGE_KEY_LAST_CONFIG,
          JSON.stringify({
            worldName: updated.worldName,
            seed: updated.seed,
            mapgen: updated.mapgen,
            backend: updated.backend,
            gameId: updated.gameId,
            blockCount: updated.blockCount,
            fileSizeBytes: db ? db.fileSizeBytes : undefined
          })
        );
      }
      return updated;
    });

    if (db) {
      if (db.discoveredModBiomes) {
        this.discoveredModBiomes.set(db.discoveredModBiomes);
      }
      this.worldDatabase.set(db);
      this.viewMode.set('hybrid');
    }
    this.bumpRevision();
  }
}
