import { BiomeDefinition } from './biome.model';

export type MapgenType = 'v7' | 'valleys' | 'carpathian' | 'flat';
export type ViewMode = 'seed' | 'db' | 'hybrid';
export type AltitudeBand = 'all' | 'ocean' | 'lowland' | 'highland' | 'underground';
export type BiomePaletteMode = 'auto' | 'all' | 'vanilla' | 'everness' | 'ethereal' | 'mineclone';
export type MapMarkerCategory = 'base' | 'portal' | 'dungeon' | 'resource' | 'poi';
export type ExtrusionFilterMode = 'all' | 'pillars' | 'structures' | 'off';

export interface MapMarker {
  id: string;
  label: string;
  x: number;
  y: number;
  z: number;
  category: MapMarkerCategory;
  color: string;
  notes?: string;
  createdAt: number;
}

export interface CustomBiomeSeedOverride {
  heatPoint: number;
  humidityPoint: number;
}

export interface ExplorerExportBundle {
  version: 1;
  exportedAt: string;
  worldSeed: number;
  mapgen: MapgenType;
  markers: MapMarker[];
  customBiomes?: BiomeDefinition[];
  biomeSeedOverrides?: Record<string, CustomBiomeSeedOverride>;
}

export type VerticalSlicePresetId =
  | 'surface'
  | 'floatlands'
  | 'high_sky'
  | 'caves'
  | 'deep_caverns'
  | 'abyss'
  | 'custom';

export interface VerticalSliceConfig {
  presetId: VerticalSlicePresetId;
  minY: number;
  maxY: number;
  /**
   * When true (default for Underground Caves / Deep Caverns / Abyss),
   * solid unexcavated stone columns with no air cavity are ignored so
   * underground cave networks, caverns, lava lakes, and player tunnels stand out!
   */
  caveMode: boolean;
}

export interface VerticalLayerSummary {
  id: VerticalSlicePresetId;
  label: string;
  shortLabel?: string;
  badge?: string;
  description?: string;
  minY: number;
  maxY: number;
  estimatedBlocks?: number;
  hotspotX?: number;
  hotspotZ?: number;
  caveMode: boolean;
}

export interface NoiseParams {
  offset: number;
  scale: number;
  spread: [number, number, number];
  seed: number;
  octaves: number;
  persist: number;
  lacunarity: number;
}

export interface WorldConfig {
  worldName: string;
  gameId: string;
  activeMods?: string[];
  backend: string;
  seed: number;
  mapgen: MapgenType;
  waterLevel: number;
  heatNoise: NoiseParams;
  humidityNoise: NoiseParams;
  terrainNoise: NoiseParams;
  hasSqliteDb: boolean;
  hasDatabase?: boolean;
  databaseBackend?: WorldDatabaseBackend;
  blockCount: number;
}

export interface ParsedColumnSurface {
  x: number;
  z: number;
  topY: number;
  nodeName: string;
  color: [number, number, number];
  waterDepth: number;
}

/**
 * Tier 1 & 2 LOD: Compact 16x16 MapBlock surface representation.
 * Uses flat TypedArrays (~1.5 KB per 16x16 block instead of 256 separate JS objects costing 60 KB).
 */
export interface CompactBlockSurface {
  bx: number;
  bz: number;
  /** 256 * 3 bytes: RGB per (lz * 16 + lx) */
  rgb: Uint8Array;
  /** 256 Int16 values: topY per (lz * 16 + lx), -32768 = empty */
  topY: Int16Array;
  /** 256 Int16 values: bare ground or structural floor level (excluding tree/bamboo canopy spikes) for terrain-dem */
  groundY?: Int16Array;
  /** 256 Uint8 values: waterDepth per (lz * 16 + lx) */
  waterDepth: Uint8Array;
  /** Representative / dominant node name in this 16x16 block */
  dominantNode: string;
  /** Precomputed average color & elevation for fast zoomed-out LOD rendering */
  avgColor: [number, number, number];
  avgY: number;
  /** Number of surface columns containing player-crafted, structural, or vertical pillar nodes */
  playerNodeCount?: number;
  /** 256 Uint8 values: 0 = None, 1 = Structure, 2 = Bamboo/Cactus, 3 = Crystal Pillar */
  extrusionKind?: Uint8Array;
  /** Detected tree / flora anchor points */
  treeAnchors?: TreeAnchorPoint[];
}

export interface TreeAnchorPoint {
  lx: number;
  lz: number;
  y: number;
  saplingKey: string;
  scale?: number;
}

/**
 * Tier 0 LOD (Google Maps Mipmap Pyramid):
 * Coarse 2x2 MapBlock (32x32 node) and 1x1 MapBlock (`b:${bx},${bz}`) overview cell used when zoomed out.
 * Permanently retains downsampled averages of all visited/sampled regions in < 4 MB RAM.
 */
export interface MacroMipmapCell {
  /** Coarse cell coordinate (mcx = bx >> 1, mcz = bz >> 1) or exact block coordinate */
  mcx: number;
  mcz: number;
  r: number;
  g: number;
  b: number;
  y: number;
  waterDepth: number;
  nodeName: string;
}

export interface ParsedMapBlockSummary {
  posKey: string;
  blockX: number;
  blockY: number;
  blockZ: number;
  version: number;
  nodeMapping: Record<number, string>;
  /** 16x16 top-most opaque node (or cave floor node in caveMode) per (localX, localZ) inside this 16x16x16 block */
  columns: Array<{
    localX: number;
    localZ: number;
    topLocalY: number;
    groundLocalY?: number;
    contiguousSpan?: number;
    hasAirGapBelow?: boolean;
    nodeName: string;
    waterCount: number;
    trunkNodeName?: string;
    trunkLocalY?: number;
    hasFoliage?: boolean;
  }>;
}

export interface DiscoveredWorldRegion {
  id: string;
  label: string;
  centerX: number;
  centerZ: number;
  blockCount: number;
  kind: 'spawn' | 'hub' | 'base' | 'expedition';
  avgY?: number;
  dominantNode?: string;
}

export type WorldDatabaseBackend = 'sqlite3' | 'postgresql';

export interface RawMapBlockRow {
  x: number;
  y: number;
  z: number;
  rowid?: number;
  data: Uint8Array;
}

export interface DatabaseOverviewSummary {
  backendType?: WorldDatabaseBackend;
  hasXyzSchema: boolean;
  estimatedTotalBlocks: number;
  minBlockX: number;
  maxBlockX: number;
  minBlockZ: number;
  maxBlockZ: number;
  exploredBlockKeys: Set<string>;
  discoveredRegions: DiscoveredWorldRegion[];
  verticalLayers: VerticalLayerSummary[];
  exploredMacroSectors: Array<{ mx: number; mz: number }>;
  dividerSamples: Array<{ x: number; y: number; z: number; rowid: number }>;
}

export interface WorldDatabaseReader {
  readonly backendType: WorldDatabaseBackend;
  readonly fileName: string;
  init(): Promise<void>;
  scanOverviewAndVerticalLayers(
    onProgress?: (progressUnits: number, samplesFound: number) => void
  ): Promise<DatabaseOverviewSummary>;
  queryBlocksInBounds(
    minBx: number,
    maxBx: number,
    minBz: number,
    maxBz: number,
    minBy: number,
    maxBy: number,
    maxResults?: number,
    stride?: number
  ): Promise<RawMapBlockRow[]>;
  fetchBlocksForKeys(
    keys: Array<{ x: number; y: number; z: number; rowid?: number } | string>,
    onProgress?: (current: number, total: number) => void
  ): Promise<RawMapBlockRow[]>;
  close(): void;
}

export interface DecodedWorldDatabase {
  fileName: string;
  fileSizeBytes: number;
  totalBlocks: number;
  minBlockX: number;
  maxBlockX: number;
  minBlockZ: number;
  maxBlockZ: number;
  hasDatabase?: boolean;
  databaseBackend?: WorldDatabaseBackend;
  /** Legacy / Demo column lookup */
  surfaceColumns: Map<string, ParsedColumnSurface>;
  /** Tier 1 & 2 High-Res LRU Cache: keyed by `${blockX},${blockZ}` -> Compact 16x16 TypedArray block */
  blockSurfaces?: Map<string, CompactBlockSurface>;
  /** Tier 0 Global Mipmap Overview: keyed by `${bx >> 2},${bz >> 2}` (4x4 MapBlock cells) */
  macroMipmap?: Map<string, MacroMipmapCell>;
  exploredBlockCoords: Array<{ bx: number; by: number; bz: number }>;
  /** Set of decoded `${blockX},${blockZ}` MapBlock coordinates */
  exploredBlockKeys?: Set<string>;
  /** All non-empty 64x64 MapBlock macro sectors across the database */
  exploredMacroSectors?: Array<{ mx: number; mz: number }>;
  /** Top discovered explored sectors & island bases across the world */
  discoveredRegions?: DiscoveredWorldRegion[];
  /** Vertical elevation / depth layers detected in the database (Sky Islands, Surface, Caves, Abyss) */
  verticalLayers?: VerticalLayerSummary[];
  /** Dynamically discovered modded biomes (e.g. Everness) inferred from surface nodes & climate centroids */
  discoveredModBiomes?: BiomeDefinition[];
  nodeCounts: Record<string, number>;
}

export interface WorldLoadProgress {
  phase:
    | 'meta'
    | 'btree-scan'
    | 'pg-scan'
    | 'dump-scan'
    | 'global-overview'
    | 'spawn-sectors'
    | 'slice-reload'
    | 'viewport-stream';
  stepIndex: number;
  totalSteps: number;
  label: string;
  percent: number;
  current: number;
  total: number;
  unit: 'pages' | 'lines' | 'blocks' | 'sectors' | '%';
  blocksDecoded: number;
  elapsedSeconds: number;
  etaSeconds: number | null;
}
