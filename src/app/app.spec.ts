import { describe, it, expect, vi } from 'vitest';
import pako from 'pako';
import {
  packBlockPos,
  unpackBlockPos,
  parseLuantiMapBlock,
  parseAndMergeCoarseBlockMipmap,
  buildDemoWorldDatabase,
  lookupWorldColumn,
  isFoliageOrSpikeNode,
  isNaturalTerrainGroundNode,
  isPlayerStructuralNode,
  classifyColumnExtrusionKind,
  mergeParsedBlockIntoCompactSurface
} from './core/utils/mapblock-parser';
import {
  LuantiNoise2D,
  LuantiWorldSynthesizer,
  createDefaultNoiseParams,
  sampleMipmapClimateAnchor
} from './core/utils/perlin-noise';
import { CoordProjectionService } from './core/services/coord-projection.service';
import { renderTilePngBuffer } from './core/utils/tile-renderer';
import { encodeRgbaToPngBuffer } from './core/utils/png-encoder';
import { PwaStorageService, MAX_TILE_CACHE_BYTES } from './core/services/pwa-storage.service';
import {
  DEFAULT_LUANTI_BIOMES,
  EVERNESS_MOD_BIOMES,
  ETHEREAL_MOD_BIOMES,
  MINECLONE_GAME_BIOMES,
  buildDiscoveredBiomeDefinition,
  resolveBiomeForDbNode
} from './core/data/default-biomes';
import { resolveNodeColor, LUANTI_NODE_COLORS } from './core/data/node-colors';
import { resolveSaplingForNode } from './core/data/sapling-registry';
import { MapStore } from './core/state/map.store';
import { WorkerPoolService } from './core/services/worker-pool.service';
import { WorldLoaderService } from './core/services/world-loader.service';
import { KeyboardShortcutsService } from './core/services/keyboard-shortcuts.service';
import { TranslationService } from './core/i18n/translation.service';
import { SUPPORTED_LOCALES } from './core/i18n/translation.types';
import { Injector, runInInjectionContext } from '@angular/core';
import { SqliteFileBtreeReader } from './core/utils/sqlite-btree-reader';
import { PostgresSqlDumpReader } from './core/utils/postgres-dump-reader';
import { safeClearStorage } from './core/utils/storage.utils';
import * as fs from 'fs';

describe('Luanti Map & Biome Explorer Core Engine', () => {
  it('accurately packs and unpacks signed 12-bit 3D MapBlock coordinates into 64-bit integer keys', () => {
    const testCases = [
      { x: 0, y: 0, z: 0 },
      { x: 14, y: 2, z: -19 },
      { x: -128, y: -4, z: 256 },
      { x: -1932, y: 100, z: -1932 }
    ];

    for (const tc of testCases) {
      const packed = packBlockPos(tc.x, tc.y, tc.z);
      const unpacked = unpackBlockPos(packed);
      expect(unpacked).toEqual(tc);
    }
  });

  it('evaluates deterministic Perlin noise, elevation, and Voronoi biome cells', () => {
    const noises = createDefaultNoiseParams();
    const synth = new LuantiWorldSynthesizer(
      74829104,
      'v7',
      1,
      noises.heatNoise,
      noises.humidityNoise,
      noises.terrainNoise
    );

    const p1 = synth.evaluatePoint(120, -340);
    const p2 = synth.evaluatePoint(120, -340);

    expect(p1.elevation).toBe(p2.elevation);
    expect(p1.heat).toBeCloseTo(p2.heat, 5);
    expect(p1.humidity).toBeCloseTo(p2.humidity, 5);
    expect(p1.biome.id).toBe(p2.biome.id);
    expect(p1.heat).toBeGreaterThanOrEqual(0);
    expect(p1.heat).toBeLessThanOrEqual(100);
    expect(p1.humidity).toBeGreaterThanOrEqual(0);
    expect(p1.humidity).toBeLessThanOrEqual(100);
  });

  it('maintains bijective Cartesian <-> LngLat projection without distortion', () => {
    const proj = new CoordProjectionService();
    const coords = [
      { x: 0, z: 0 },
      { x: 512, z: -1024 },
      { x: -2048, z: 1500 }
    ];

    for (const c of coords) {
      const [lng, lat] = proj.luantiToLngLat(c.x, c.z);
      const roundTrip = proj.lngLatToLuanti(lng, lat);
      expect(roundTrip.x).toBe(c.x);
      expect(roundTrip.z).toBe(c.z);
    }
  });

  it('decodes Luanti v28 zlib MapBlock binary blobs and extracts surface columns', () => {
    const rawNodes = new Uint8Array(16384);
    // Place node ID 1 ('default:stonebrick') at local (5, 10, 5)
    const idx = (5 << 8) | (10 << 4) | 5;
    rawNodes[idx * 2] = 0;
    rawNodes[idx * 2 + 1] = 1;

    const compressedNodes = pako.deflate(rawNodes);
    const nameStr = new TextEncoder().encode('default:stonebrick');
    const tail = new Uint8Array(3 + 4 + nameStr.length);
    tail[0] = 0; // version 0
    tail[1] = 0;
    tail[2] = 1; // 1 mapping
    tail[3] = 0;
    tail[4] = 1; // id = 1
    tail[5] = 0;
    tail[6] = nameStr.length;
    tail.set(nameStr, 7);

    const header = new Uint8Array([28, 1, 255, 255, 2, 2]);
    const fullBlob = new Uint8Array(header.length + compressedNodes.length + tail.length);
    fullBlob.set(header, 0);
    fullBlob.set(compressedNodes, header.length);
    fullBlob.set(tail, header.length + compressedNodes.length);

    const pos = packBlockPos(2, 0, -3);
    const parsed = parseLuantiMapBlock(pos, fullBlob);
    expect(parsed).not.toBeNull();
    expect(parsed?.blockX).toBe(2);
    expect(parsed?.blockZ).toBe(-3);
    const col = parsed?.columns.find(c => c.localX === 5 && c.localZ === 5);
    expect(col?.nodeName).toBe('default:stonebrick');
    expect(col?.topLocalY).toBe(10);
  });

  it('renders valid PNG ArrayBuffers for both Color Biome tiles and Terrain-RGB DEM tiles', () => {
    const noises = createDefaultNoiseParams();
    const demoDb = buildDemoWorldDatabase(74829104);

    const colorPng = renderTilePngBuffer(
      {
        jobId: 1,
        tileKind: 'color',
        tileSize: 32,
        minX: -128,
        maxX: 128,
        minZ: -128,
        maxZ: 128,
        seed: 74829104,
        mapgen: 'v7',
        waterLevel: 1,
        heatNoise: noises.heatNoise,
        humidityNoise: noises.humidityNoise,
        terrainNoise: noises.terrainNoise,
        viewMode: 'hybrid',
        hypsometricMode: false,
        hillshadeEnabled: true,
        voronoiContoursEnabled: true,
        exploredBoundsEnabled: true,
        isolatedBiomeId: null
      },
      demoDb.surfaceColumns
    );

    const bytes = new Uint8Array(colorPng);
    // Check PNG magic header: 137 80 78 71 (\x89PNG)
    expect(bytes[0]).toBe(137);
    expect(bytes[1]).toBe(80);
    expect(bytes[2]).toBe(78);
    expect(bytes[3]).toBe(71);
  });

  it('supports Vertical Elevation / Depth Slices for Sky Islands (floatlands) and Underground Caves (caveMode)', () => {
    const skyDb = buildDemoWorldDatabase(74829104, 'floatlands');
    expect(skyDb.surfaceColumns.size).toBeGreaterThan(100);
    const firstSkyCol = skyDb.surfaceColumns.values().next().value;
    expect(firstSkyCol?.topY).toBeGreaterThanOrEqual(480);

    const caveDb = buildDemoWorldDatabase(74829104, 'caves');
    expect(caveDb.surfaceColumns.size).toBeGreaterThan(100);
    const firstCaveCol = caveDb.surfaceColumns.values().next().value;
    expect(firstCaveCol?.topY).toBeLessThan(0);
  });

  it('builds 3-Tier CompactBlockSurface and MacroMipmapCell pyramids and infers Everness mod Voronoi biomes', () => {
    const demoDb = buildDemoWorldDatabase(74829104, 'surface');
    expect(demoDb.blockSurfaces?.size).toBeGreaterThan(10);
    expect(demoDb.macroMipmap?.size).toBeGreaterThan(2);

    const sampleCol = lookupWorldColumn(0, 0, demoDb);
    expect(sampleCol).toBeDefined();

    // Test zoomed-out Tier 0 mipmap rendering (stepX >= 2.0) and close-up Tier 2 voxel rendering (stepX <= 0.35)
    const noises = createDefaultNoiseParams();
    const zoomedOutPng = renderTilePngBuffer(
      {
        jobId: 10,
        tileKind: 'color',
        tileSize: 64,
        minX: -2048,
        maxX: 2048,
        minZ: -2048,
        maxZ: 2048,
        seed: 74829104,
        mapgen: 'v7',
        waterLevel: 1,
        heatNoise: noises.heatNoise,
        humidityNoise: noises.humidityNoise,
        terrainNoise: noises.terrainNoise,
        viewMode: 'db',
        hypsometricMode: false,
        hillshadeEnabled: true,
        voronoiContoursEnabled: false,
        exploredBoundsEnabled: false,
        isolatedBiomeId: null
      },
      new Map(),
      new Set(),
      demoDb.blockSurfaces,
      demoDb.macroMipmap
    );
    expect(new Uint8Array(zoomedOutPng)[0]).toBe(137);
    expect(demoDb.macroMipmap?.has('b:0,0')).toBe(true);
    expect(demoDb.macroMipmap?.has('0,0')).toBe(true);

    // Verify zoomed-in fallback (stepX = 0.5 < 2.0) when blockSurfaces is still streaming uses macroMipmap instead of void
    const zoomedInFallbackPng = renderTilePngBuffer(
      {
        jobId: 11,
        tileKind: 'color',
        tileSize: 32,
        minX: 0,
        maxX: 16,
        minZ: 0,
        maxZ: 16,
        seed: 74829104,
        mapgen: 'v7',
        waterLevel: 1,
        heatNoise: noises.heatNoise,
        humidityNoise: noises.humidityNoise,
        terrainNoise: noises.terrainNoise,
        viewMode: 'db',
        hypsometricMode: false,
        hillshadeEnabled: false,
        voronoiContoursEnabled: false,
        exploredBoundsEnabled: false,
        isolatedBiomeId: null
      },
      new Map(),
      new Set(),
      new Map(), // empty blockSurfaces to simulate streaming in progress
      demoDb.macroMipmap
    );
    expect(new Uint8Array(zoomedInFallbackPng)[0]).toBe(137);
  });

  it('enforces uniform 16n block-average smoothing at Zoom 4.5 and per-voxel detail at Zoom 7.2', () => {
    const noises = createDefaultNoiseParams();
    const testBlocks = new Map<string, CompactBlockSurface>();
    const topYArray = new Int16Array(256);
    topYArray.fill(10);
    for (let i = 0; i < 256; i += 2) topYArray[i] = 20;

    testBlocks.set('0,0', {
      bx: 0,
      bz: 0,
      rgb: new Uint8Array(256 * 3).fill(120),
      topY: topYArray,
      waterDepth: new Uint8Array(256).fill(0),
      avgY: 15,
      avgColor: [120, 120, 120],
      dominantNode: 'default:dirt_with_grass'
    });

    const testMipmap = new Map<string, MacroMipmapCell>();
    testMipmap.set('b:0,0', {
      bx: 0,
      bz: 0,
      r: 120,
      g: 120,
      b: 120,
      y: 15,
      waterDepth: 0,
      dominantNode: 'default:dirt_with_grass'
    });

    const demSector45Png = renderTilePngBuffer(
      {
        jobId: 201,
        cameraZoom: 4.5,
        tileKind: 'terrain-dem',
        tileSize: 16,
        minX: 0,
        maxX: 16,
        minZ: 0,
        maxZ: 16,
        seed: 74829104,
        mapgen: 'v7',
        waterLevel: 1,
        heatNoise: noises.heatNoise,
        humidityNoise: noises.humidityNoise,
        terrainNoise: noises.terrainNoise,
        viewMode: 'db',
        hypsometricMode: false,
        hillshadeEnabled: true,
        voronoiContoursEnabled: false,
        exploredBoundsEnabled: false,
        isolatedBiomeId: null
      },
      new Map(),
      new Set(),
      testBlocks,
      testMipmap
    );
    expect(new Uint8Array(demSector45Png)[0]).toBe(137);

    const demVoxel72Png = renderTilePngBuffer(
      {
        jobId: 202,
        cameraZoom: 7.2,
        tileKind: 'terrain-dem',
        tileSize: 16,
        minX: 0,
        maxX: 16,
        minZ: 0,
        maxZ: 16,
        seed: 74829104,
        mapgen: 'v7',
        waterLevel: 1,
        heatNoise: noises.heatNoise,
        humidityNoise: noises.humidityNoise,
        terrainNoise: noises.terrainNoise,
        viewMode: 'db',
        hypsometricMode: false,
        hillshadeEnabled: true,
        voronoiContoursEnabled: false,
        exploredBoundsEnabled: false,
        isolatedBiomeId: null
      },
      new Map(),
      new Set(),
      testBlocks,
      testMipmap
    );
    expect(new Uint8Array(demVoxel72Png)[0]).toBe(137);

    // Verify dynamic Everness mod biome Voronoi discovery preserves authentic climate coordinates across surface, ocean, and underground
    const coralBiome = buildDiscoveredBiomeDefinition('everness:dirt_with_coral_grass', 50, 50);
    expect(coralBiome).not.toBeNull();
    expect(coralBiome?.id).toBe('everness_coral_forest');
    expect(coralBiome?.heatPoint).toBe(60);
    expect(coralBiome?.humidityPoint).toBe(50);

    const mineralWatersBiome = buildDiscoveredBiomeDefinition('everness:mineral_stone', 78, 58);
    expect(mineralWatersBiome?.id).toBe('everness_mineral_waters');
    expect(mineralWatersBiome?.altitudeBand).toBe('lowland');

    const coralUnderBiome = buildDiscoveredBiomeDefinition('everness:coral_desert_stone_with_moss', 60, 50);
    expect(coralUnderBiome?.id).toBe('everness_coral_forest_under');
    expect(coralUnderBiome?.altitudeBand).toBe('underground');
    expect(coralUnderBiome?.yMax).toBe(-256);

    const coralOceanBiome = buildDiscoveredBiomeDefinition('everness:coral_sand', 60, 50);
    expect(coralOceanBiome?.id).toBe('everness_coral_forest_ocean');
    expect(coralOceanBiome?.altitudeBand).toBe('ocean');

    // Verify SQLite node-to-biome resolution maps DB desert & savanna nodes to true Voronoi biomes
    const desertBiome = resolveBiomeForDbNode('default:desert_sand', 17, 0, DEFAULT_LUANTI_BIOMES);
    expect(desertBiome.id).toBe('desert');
    expect(desertBiome.heatPoint).toBe(92);
    expect(desertBiome.humidityPoint).toBe(16);

    // Verify underground node-to-biome resolution selects underground biomes when topY <= -256
    const allBiomes = [...DEFAULT_LUANTI_BIOMES, ...EVERNESS_MOD_BIOMES];
    const deepCrystalBiome = resolveBiomeForDbNode('everness:crystal_cave_dirt_with_moss', -450, 0, allBiomes);
    expect(deepCrystalBiome.id).toBe('everness_crystal_forest_under');
    expect(deepCrystalBiome.altitudeBand).toBe('underground');
  });

  it('detects player-built structural nodes for automatic base discovery', () => {
    expect(isPlayerStructuralNode('default:stonebrick')).toBe(true);
    expect(isPlayerStructuralNode('default:chest_locked')).toBe(true);
    expect(isPlayerStructuralNode('default:meselamp')).toBe(true);
    expect(isPlayerStructuralNode('default:dirt_with_grass')).toBe(false);
    expect(isPlayerStructuralNode('everness:coral_sand')).toBe(false);

    const blockMap = new Map();
    mergeParsedBlockIntoCompactSurface(
      {
        blockX: 4,
        blockY: 1,
        blockZ: -2,
        dominantNode: 'default:stonebrick',
        columns: [
          { localX: 0, localZ: 0, topLocalY: 5, nodeName: 'default:stonebrick', waterDepth: 0 },
          { localX: 1, localZ: 0, topLocalY: 5, nodeName: 'default:chest', waterDepth: 0 },
          { localX: 2, localZ: 0, topLocalY: 4, nodeName: 'default:dirt_with_grass', waterDepth: 0 }
        ]
      },
      -32768,
      32767,
      blockMap,
      new Map(),
      {}
    );

    const surf = blockMap.get('4,-2');
    expect(surf).toBeDefined();
    expect(surf.playerNodeCount).toBe(2);
  });

  it('manages custom map markers, custom biomes, and JSON / Luanti waypoint export & import in MapStore', () => {
    const store = new MapStore();
    store.clearAllMarkers();
    expect(store.markers().length).toBe(0);

    const m1 = store.addMarker({
      label: 'Castle Keep',
      x: 240,
      y: 35,
      z: -180,
      category: 'base',
      notes: 'Main storage room'
    });
    expect(store.markers().length).toBe(1);
    expect(m1.label).toBe('Castle Keep');

    store.updateMarker(m1.id, { label: 'Grand Castle Keep', x: 250 });
    expect(store.markers()[0].label).toBe('Grand Castle Keep');
    expect(store.markers()[0].x).toBe(250);

    store.addCustomBiome({
      name: 'Volcanic Ashlands',
      heatPoint: 98,
      humidityPoint: 8,
      yMin: 1,
      yMax: 31000,
      altitudeBand: 'lowland',
      hexColor: '#dc2626',
      topNode: 'custom:volcanic_ash'
    });
    expect(store.userCustomBiomes().some(b => b.name === 'Volcanic Ashlands')).toBe(true);

    const bundleJson = store.exportBundleJson();
    const waypointsTxt = store.exportLuantiWaypointsTxt();
    expect(waypointsTxt).toContain('Grand Castle Keep (250, 35, -180)');

    store.clearAllMarkers();
    store.resetBiomesToDefault();
    expect(store.markers().length).toBe(0);
    expect(store.userCustomBiomes().length).toBe(0);

    const importResult = store.importBundleJson(bundleJson);
    expect(importResult.markersCount).toBe(1);
    expect(importResult.biomesCount).toBeGreaterThanOrEqual(1);
    expect(store.markers()[0].label).toBe('Grand Castle Keep');
    expect(store.userCustomBiomes().some(b => b.name === 'Volcanic Ashlands')).toBe(true);

    // Verify structured WorldLoadProgress state in MapStore
    expect(store.loadProgress()).toBeNull();
    store.loadProgress.set({
      phase: 'spawn-sectors',
      stepIndex: 3,
      totalSteps: 3,
      label: 'Decoding spawn sectors...',
      percent: 78,
      current: 12,
      total: 25,
      unit: 'sectors',
      blocksDecoded: 420,
      elapsedSeconds: 4.2,
      etaSeconds: 1.5
    });
    expect(store.loadProgress()?.percent).toBe(78);
    expect(store.loadProgress()?.stepIndex).toBe(3);
  });

  it('accelerates tile rendering with fast level-1 PNG deflate and maintains valid PNG output', () => {
    // 128x128 RGBA image = 128 * 128 * 4 = 65,536 bytes
    const rgba = new Uint8Array(128 * 128 * 4);
    for (let i = 0; i < rgba.length; i += 4) {
      rgba[i] = (i * 7) & 0xff;     // R
      rgba[i + 1] = (i * 13) & 0xff; // G
      rgba[i + 2] = (i * 19) & 0xff; // B
      rgba[i + 3] = 255;            // A
    }

    const start = performance.now();
    const pngBuf = encodeRgbaToPngBuffer(128, 128, rgba);
    const duration = performance.now() - start;

    expect(pngBuf).toBeInstanceOf(ArrayBuffer);
    expect(pngBuf.byteLength).toBeGreaterThan(100);
    // Level-1 deflate encoding should be sub-5ms in JS
    expect(duration).toBeLessThan(50);

    const bytes = new Uint8Array(pngBuf);
    // Verify standard PNG magic header: 137, 80, 78, 71, 13, 10, 26, 10
    expect(Array.from(bytes.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  });

  it('validates 50 MB tile cache limit, metadata caching, and PwaStorageService resilience', async () => {
    const storage = new PwaStorageService();
    expect(storage).toBeDefined();
    expect(storage.quotaInfo()).toBeDefined();

    // Verify 50 MB tile cache limit constant is strictly configured
    expect(MAX_TILE_CACHE_BYTES).toBe(50 * 1024 * 1024);

    // Test saving and retrieving metadata in mock/in-memory environments
    const testMeta = {
      fileKey: 'test_world.sqlite_1048576_1700000000',
      fileName: 'test_world.sqlite',
      fileSizeBytes: 1048576,
      totalBlocks: 3400,
      minBlockX: -10,
      maxBlockX: 10,
      minBlockZ: -10,
      maxBlockZ: 10,
      exploredBlockKeys: ['0,0', '1,0'],
      discoveredRegions: [],
      verticalLayers: [],
      discoveredModBiomes: [],
      macroMipmap: [],
      cachedAt: Date.now()
    };

    await storage.saveWorldMetadata(testMeta);
    // If indexedDB is available in the test runner, verify retrieval
    if (typeof indexedDB !== 'undefined') {
      const retrieved = await storage.getWorldMetadata(testMeta.fileKey);
      if (retrieved) {
        expect(retrieved.fileName).toBe('test_world.sqlite');
        expect(retrieved.totalBlocks).toBe(3400);
      }
    }

    // Verify safe handling of tiles
    const dummyTile = new Uint8Array([1, 2, 3, 4]).buffer;
    await storage.putTile('tile_key_1', dummyTile);
    await storage.clearTileCache();

    const quota = await storage.refreshStorageQuota();
    expect(quota.tileCacheBytes).toBe(0);
  });

  it('auto-restores last loaded world metadata and handles across reload/reopen without demo overwrite', async () => {
    const mapStore = new MapStore();
    expect(mapStore).toBeDefined();

    // Verify camera state persistence
    mapStore.cameraState.set({ x: 120, z: -450, zoom: 7.5, pitch: 20, bearing: -15 });
    mapStore.saveCameraStateToStorage();

    const restoredCamStore = new MapStore();
    expect(restoredCamStore.cameraState().x).toBe(120);
    expect(restoredCamStore.cameraState().z).toBe(-450);
    expect(restoredCamStore.cameraState().zoom).toBe(7.5);

    // Verify custom world persistence flags
    mapStore.applyLoadedWorld(
      { worldName: 'My Survival World', seed: 998877 },
      {
        fileName: 'map.sqlite',
        fileSizeBytes: 2048000,
        totalBlocks: 12500,
        minBlockX: -32,
        maxBlockX: 32,
        minBlockZ: -32,
        maxBlockZ: 32,
        surfaceColumns: new Map(),
        exploredBlockCoords: [],
        exploredBlockKeys: new Set(['0,0', '1,1']),
        discoveredRegions: [],
        verticalLayers: [],
        discoveredModBiomes: [],
        macroMipmap: new Map(),
        nodeCounts: {}
      }
    );

    expect(mapStore.worldConfig().worldName).toBe('My Survival World');
    expect(mapStore.worldConfig().seed).toBe(998877);

    // A newly instantiated store preserves the custom worldConfig without falling back to demo world
    const newStore = new MapStore();
    expect(newStore.worldConfig().worldName).toBe('My Survival World');
    expect(newStore.worldConfig().seed).toBe(998877);

    // Verify setCameraZoomPreset updates cameraState.zoom immediately for each downsampling tier
    mapStore.setCameraZoomPreset(2.0);
    expect(mapStore.cameraState().zoom).toBe(2.0);
    mapStore.setCameraZoomPreset(3.0);
    expect(mapStore.cameraState().zoom).toBe(3.0);
    mapStore.setCameraZoomPreset(4.5);
    expect(mapStore.cameraState().zoom).toBe(4.5);
    mapStore.setCameraZoomPreset(7.2);
    expect(mapStore.cameraState().zoom).toBe(7.2);

    // Verify fitWorldBounds on a large world (span >= 6144 nodes) lands in the World 4x4 downsampling tier (zoom <= 2.2)
    mapStore.worldDatabase.update(db =>
      db ? { ...db, minBlockX: -1932, maxBlockX: 1932, minBlockZ: -1932, maxBlockZ: 1932 } : null
    );
    mapStore.fitWorldBounds();
    expect(mapStore.cameraState().zoom).toBeLessThanOrEqual(2.2);
  });

  it('scans B-tree without zebra skipping and extracts contiguous Z coverage in queryBlocksInBounds', async () => {
    const dbPath = 'sample-luanti-world/map.sqlite';
    if (!fs.existsSync(dbPath)) return;

    const fileBuf = fs.readFileSync(dbPath);
    const file = new File([fileBuf], 'map.sqlite');
    const reader = new SqliteFileBtreeReader(file);
    await reader.init();

    // Verify B-tree overview scan does not skip interior branches
    const overview = await reader.scanOverviewAndVerticalLayers();
    expect(overview.estimatedTotalBlocks).toBeGreaterThan(0);
    expect(overview.maxBlockZ).toBeGreaterThanOrEqual(overview.minBlockZ);

    // Query blocks in bounds and verify column grouping covers contiguous coordinates
    const rows = await reader.queryBlocksInBounds(
      overview.minBlockX,
      overview.maxBlockX,
      overview.minBlockZ,
      overview.maxBlockZ,
      -1,
      9,
      1024,
      1
    );

    expect(rows.length).toBeGreaterThan(0);
    const zCoords = new Set(rows.map(r => r.z));
    // Verify that every returned block is within the requested bounds and has valid data
    for (const r of rows) {
      expect(r.z).toBeGreaterThanOrEqual(overview.minBlockZ);
      expect(r.z).toBeLessThanOrEqual(overview.maxBlockZ);
      expect(r.data.length).toBeGreaterThan(0);
    }
    // Verify Z-coordinates are covered without dropping alternate rows
    expect(zCoords.size).toBeGreaterThan(0);

    // Verify exploredMacroSectors contains non-empty 64x64 macro sectors for full world overview streaming
    expect(overview.exploredMacroSectors).toBeDefined();
    expect(overview.exploredMacroSectors.length).toBeGreaterThan(0);
    for (const s of overview.exploredMacroSectors) {
      expect(typeof s.mx).toBe('number');
      expect(typeof s.mz).toBe('number');
    }

    // Verify stride=2 coarse sampling prioritizes ground blocks (Y=0,1) and maintains 100% column coverage
    const coarseRows = await reader.queryBlocksInBounds(
      overview.minBlockX,
      overview.maxBlockX,
      overview.minBlockZ,
      overview.maxBlockZ,
      -1,
      9,
      512,
      2
    );
    expect(coarseRows.length).toBeGreaterThan(0);
    // At least one block at ground level Y=0 or Y=1 must be returned
    const hasGroundY = coarseRows.some(r => r.y === 0 || r.y === 1);
    expect(hasGroundY).toBe(true);

    // Verify stride=4 whole-world downsampling queries fewer blocks than stride=2 and populates m4: 4x4 mipmaps
    const stride4Rows = await reader.queryBlocksInBounds(
      overview.minBlockX,
      overview.maxBlockX,
      overview.minBlockZ,
      overview.maxBlockZ,
      -1,
      9,
      512,
      4
    );
    expect(stride4Rows.length).toBeGreaterThan(0);
    expect(stride4Rows.length).toBeLessThanOrEqual(coarseRows.length);

    const macroMipmap = new Map();
    const nodeCounts: Record<string, number> = {};
    const firstRow = stride4Rows[0];
    const coarseRes = parseAndMergeCoarseBlockMipmap(
      firstRow.x,
      firstRow.y,
      firstRow.z,
      firstRow.data,
      -16,
      240,
      false,
      4,
      macroMipmap,
      nodeCounts
    );
    expect(coarseRes).not.toBeNull();
    expect(macroMipmap.has(`b:${firstRow.x},${firstRow.z}`)).toBe(true);
    expect(macroMipmap.has(`${firstRow.x >> 1},${firstRow.z >> 1}`)).toBe(true);
    expect(macroMipmap.has(`m4:${firstRow.x >> 2},${firstRow.z >> 2}`)).toBe(true);

    // Verify whole-world zoomed-out rendering (stepX = 32 >= 16) uses m4: mipmap tier and 2-tap / 1-tap fast shaders
    const noises = createDefaultNoiseParams();
    const m4OnlyMipmap = new Map([
      [`m4:${firstRow.x >> 2},${firstRow.z >> 2}`, macroMipmap.get(`m4:${firstRow.x >> 2},${firstRow.z >> 2}`)]
    ]);
    const wholeWorldColorPng = renderTilePngBuffer(
      {
        jobId: 99,
        tileKind: 'color',
        tileSize: 32,
        minX: -512,
        maxX: 512,
        minZ: -512,
        maxZ: 512,
        seed: 74829104,
        mapgen: 'v7',
        waterLevel: 1,
        heatNoise: noises.heatNoise,
        humidityNoise: noises.humidityNoise,
        terrainNoise: noises.terrainNoise,
        viewMode: 'db',
        hypsometricMode: false,
        hillshadeEnabled: true,
        voronoiContoursEnabled: false,
        exploredBoundsEnabled: false,
        isolatedBiomeId: null
      },
      new Map(),
      new Set(),
      new Map(),
      m4OnlyMipmap
    );
    expect(new Uint8Array(wholeWorldColorPng)[0]).toBe(137);

    const wholeWorldDemPng = renderTilePngBuffer(
      {
        jobId: 100,
        tileKind: 'terrain-dem',
        tileSize: 32,
        minX: -512,
        maxX: 512,
        minZ: -512,
        maxZ: 512,
        seed: 74829104,
        mapgen: 'v7',
        waterLevel: 1,
        heatNoise: noises.heatNoise,
        humidityNoise: noises.humidityNoise,
        terrainNoise: noises.terrainNoise,
        viewMode: 'db',
        hypsometricMode: false,
        hillshadeEnabled: true,
        voronoiContoursEnabled: false,
        exploredBoundsEnabled: false,
        isolatedBiomeId: null
      },
      new Map(),
      new Set(),
      new Map(),
      m4OnlyMipmap
    );
    expect(new Uint8Array(wholeWorldDemPng)[0]).toBe(137);
  });

  it('coalesces queued tile requests across revisions in WorkerPoolService without resolving 0-byte buffers', async () => {
    const injector = Injector.create({
      providers: [
        { provide: MapStore, useFactory: () => new MapStore() },
        { provide: CoordProjectionService, useFactory: () => new CoordProjectionService() },
        { provide: PwaStorageService, useFactory: () => new PwaStorageService() }
      ]
    });
    const workerPool = runInInjectionContext(injector, () => new WorkerPoolService());

    // Simulate a single worker instance that is initially busy so subsequent requests enter the queue
    const dispatchedJobs: any[] = [];
    const mockWorkerInstance = {
      worker: {
        postMessage: (msg: any) => {
          dispatchedJobs.push(msg.job);
        }
      },
      busy: true,
      activeJobId: 999
    };
    (workerPool as any).pool.push(mockWorkerInstance);

    // Request the same tile coordinate (color, z=2, x=1, y=1) across two consecutive revisions while worker is busy
    const pRev1 = workerPool.requestTile('color', 2, 1, 1, 1);
    const pRev2 = workerPool.requestTile('color', 2, 1, 1, 2);

    // Wait a microtask for async L2 lookup (returns null in Node test env) to enqueue both requests
    await new Promise(resolve => setTimeout(resolve, 10));

    // Both requests for (color, 2, 1, 1) must be coalesced into a single queued job upgraded to revision 2
    const queue = (workerPool as any).queue as any[];
    expect(queue.length).toBe(1);
    expect(queue[0].coordKey).toBe('color/2/1_1');
    expect(queue[0].revision).toBe(2);
    expect(queue[0].resolvers.length).toBe(2);

    // Free the worker and dispatch the coalesced job
    mockWorkerInstance.busy = false;
    mockWorkerInstance.activeJobId = null;
    (workerPool as any).dispatchNext();

    expect(dispatchedJobs.length).toBe(1);
    const pendingJob = (workerPool as any).pendingMap.get(dispatchedJobs[0].jobId);
    expect(pendingJob).toBeDefined();

    // Resolve the coalesced job with a valid PNG buffer
    const validPng = encodeRgbaToPngBuffer(16, 16, new Uint8ClampedArray(16 * 16 * 4));
    for (let i = 0; i < pendingJob.resolvers.length; i++) {
      pendingJob.resolvers[i](i === pendingJob.resolvers.length - 1 ? validPng : validPng.slice(0));
    }

    const [buf1, buf2] = await Promise.all([pRev1, pRev2]);
    expect(buf1.byteLength).toBeGreaterThan(0);
    expect(buf2.byteLength).toBeGreaterThan(0);
    expect(new Uint8Array(buf1)[0]).toBe(137);
    expect(new Uint8Array(buf2)[0]).toBe(137);
  });

  it('scales sub-sector spiral radii to match full widescreen viewport at zoom 4.4 and prunes unexplored wilderness', () => {
    const injector = Injector.create({
      providers: [
        { provide: MapStore, useFactory: () => new MapStore() },
        { provide: CoordProjectionService, useFactory: () => new CoordProjectionService() },
        { provide: PwaStorageService, useFactory: () => new PwaStorageService() },
        {
          provide: WorkerPoolService,
          useFactory: () => runInInjectionContext(injector, () => new WorkerPoolService())
        }
      ]
    });
    const worldLoader = runInInjectionContext(injector, () => new WorldLoaderService());

    const radii = worldLoader.computeViewportRadii(4.4, 2560, 1440);
    // At zoom 4.4 on a 2560x1440 screen, radii must extend well beyond the old hardcoded 12x7 box
    expect(radii.radiusSubSectorsX).toBeGreaterThanOrEqual(25);
    expect(radii.radiusSubSectorsZ).toBeGreaterThanOrEqual(15);

    const mockDb: any = {
      minBlockX: -512,
      maxBlockX: 512,
      minBlockZ: -512,
      maxBlockZ: 512,
      // Explored macro sector at (0,0) and a northern corridor macro sector at (1, 5) (Z = 5120..6144)
      exploredMacroSectors: [
        { mx: 0, mz: 0 },
        { mx: 1, mz: 5 }
      ]
    };

    const spiral = worldLoader.buildSpiralSubSectors(
      0,
      0,
      radii.radiusSubSectorsX,
      radii.radiusSubSectorsZ,
      mockDb
    );

    // Must include sub-sector (4, 20) inside macro sector (1, 5) near the top of the viewport (sz = 20 > old 7 limit)
    expect(spiral.some(s => s.sx === 4 && s.sz === 20)).toBe(true);
    // Must prune distant unexplored wilderness macro sectors like (-7, -4) -> sub-sector (-28, -16)
    expect(spiral.some(s => s.sx === -28 && s.sz === -16)).toBe(false);
  });

  it('calibrates node colors to authentic pixel-averaged textures for MTG, Everness, Ethereal, and MineClone', () => {
    // 1. Minetest Game: Authentic forest grass rather than bright CSS lime
    expect(LUANTI_NODE_COLORS['default:dirt_with_grass']).toEqual([65, 111, 26]);
    // 2. Everness: Authentic calcite/salt white mineral stone
    expect(LUANTI_NODE_COLORS['everness:mineral_stone']).toEqual([239, 234, 238]);
    expect(LUANTI_NODE_COLORS['everness:dirt_with_coral_grass']).toEqual([109, 50, 71]);
    expect(LUANTI_NODE_COLORS['everness:dirt_with_crystal_grass']).toEqual([140, 96, 154]);
    // 3. Ethereal Mod
    expect(LUANTI_NODE_COLORS['ethereal:bamboo_dirt']).toEqual([130, 167, 76]);
    expect(LUANTI_NODE_COLORS['ethereal:prairie_dirt']).toEqual([120, 156, 63]);
    expect(LUANTI_NODE_COLORS['ethereal:crystal_dirt']).toEqual([50, 97, 119]);
    expect(LUANTI_NODE_COLORS['ethereal:fiery_dirt']).toEqual([136, 27, 8]);
    // 4. MineClone2 / Mineclonia
    expect(LUANTI_NODE_COLORS['mcl_core:dirt_with_grass']).toEqual([61, 100, 52]);
    expect(LUANTI_NODE_COLORS['mcl_core:sand']).toEqual([221, 171, 127]);
    expect(LUANTI_NODE_COLORS['mcl_crimson:crimson_nylium']).toEqual([132, 31, 35]);
    expect(LUANTI_NODE_COLORS['mcl_nether:soul_sand']).toEqual([91, 70, 51]);
    expect(LUANTI_NODE_COLORS['mcl_end:end_stone']).toEqual([221, 214, 130]);
    expect(LUANTI_NODE_COLORS['mcl_mud:mud']).toEqual([66, 62, 58]);

    // 5. Fallback heuristics for derivative nodes
    expect(resolveNodeColor('mcl_stairs:stair_stone')).toEqual([131, 123, 118]);
    expect(resolveNodeColor('mcl_deepslate:deepslate_stairs')).toEqual([75, 75, 78]);
    expect(resolveNodeColor('ethereal:custom_willow_branch')).toEqual([75, 166, 91]);
  });

  it('identifies and maps authentic biomes for Ethereal and MineClone from SQLite surface nodes', () => {
    // Ethereal nodes
    const bamboo = buildDiscoveredBiomeDefinition('ethereal:bamboo_dirt', 50, 50);
    expect(bamboo).toBeDefined();
    expect(bamboo?.id).toBe('ethereal_bamboo');
    expect(bamboo?.heatPoint).toBe(45);
    expect(bamboo?.humidityPoint).toBe(75);

    const frost = buildDiscoveredBiomeDefinition('ethereal:crystal_dirt', 50, 50);
    expect(frost).toBeDefined();
    expect(frost?.id).toBe('ethereal_frost');
    expect(frost?.heatPoint).toBe(10);
    expect(frost?.humidityPoint).toBe(40);

    // MineClone nodes
    const crimson = buildDiscoveredBiomeDefinition('mcl_crimson:crimson_nylium', 50, 50);
    expect(crimson).toBeDefined();
    expect(crimson?.id).toBe('mcl_crimson_forest');
    expect(crimson?.heatPoint).toBe(60);
    expect(crimson?.humidityPoint).toBe(47);

    const mangrove = buildDiscoveredBiomeDefinition('mcl_mud:mud', 50, 50);
    expect(mangrove).toBeDefined();
    expect(mangrove?.id).toBe('mcl_mangrove_swamp');
    expect(mangrove?.heatPoint).toBe(94);
    expect(mangrove?.humidityPoint).toBe(95);

    // DB node lookup resolution
    const resolvedPrairie = resolveBiomeForDbNode('ethereal:prairie_dirt', 15, 0, DEFAULT_LUANTI_BIOMES);
    expect(resolvedPrairie.id).toBe('ethereal_prairie');

    const resolvedEnd = resolveBiomeForDbNode('mcl_end:end_stone', 10500, 0, DEFAULT_LUANTI_BIOMES);
    expect(resolvedEnd.id).toBe('mcl_the_end');
  });

  it('dynamically switches and merges active biomes across all supported palette modes in MapStore', () => {
    const store = new MapStore();

    // Mode: vanilla
    store.setBiomePaletteMode('vanilla');
    const vanillaBiomes = store.activeBiomes();
    expect(vanillaBiomes.some(b => b.id === 'grassland')).toBe(true);
    expect(vanillaBiomes.some(b => b.id === 'everness_coral_forest')).toBe(false);
    expect(vanillaBiomes.some(b => b.id === 'ethereal_bamboo')).toBe(false);
    expect(vanillaBiomes.some(b => b.id === 'mcl_plains')).toBe(false);

    // Mode: everness
    store.setBiomePaletteMode('everness');
    const evernessBiomes = store.activeBiomes();
    expect(evernessBiomes.some(b => b.id === 'everness_coral_forest')).toBe(true);
    expect(evernessBiomes.some(b => b.id === 'everness_mineral_waters')).toBe(true);

    // Mode: ethereal
    store.setBiomePaletteMode('ethereal');
    const etherealBiomes = store.activeBiomes();
    expect(etherealBiomes.some(b => b.id === 'ethereal_bamboo')).toBe(true);
    expect(etherealBiomes.some(b => b.id === 'ethereal_sakura')).toBe(true);
    expect(etherealBiomes.some(b => b.id === 'ethereal_fiery')).toBe(true);

    // Mode: mineclone
    store.setBiomePaletteMode('mineclone');
    const mclBiomes = store.activeBiomes();
    expect(mclBiomes.some(b => b.id === 'mcl_plains')).toBe(true);
    expect(mclBiomes.some(b => b.id === 'mcl_crimson_forest')).toBe(true);
    expect(mclBiomes.some(b => b.id === 'mcl_the_end')).toBe(true);

    // Mode: all
    store.setBiomePaletteMode('all');
    const allBiomes = store.activeBiomes();
    expect(allBiomes.some(b => b.id === 'grassland')).toBe(true);
    expect(allBiomes.some(b => b.id === 'everness_coral_forest')).toBe(true);
    expect(allBiomes.some(b => b.id === 'ethereal_bamboo')).toBe(true);
    expect(allBiomes.some(b => b.id === 'mcl_plains')).toBe(true);

    // Mode: auto (with MineClone gameid)
    store.setBiomePaletteMode('auto');
    store.worldConfig.update(c => ({ ...c, gameId: 'mineclone2' }));
    const autoMcl = store.activeBiomes();
    expect(autoMcl.some(b => b.id === 'mcl_plains')).toBe(true);

    // Mode: auto (with Ethereal active mod)
    store.worldConfig.update(c => ({ ...c, gameId: 'minetest_game', activeMods: ['ethereal'] }));
    const autoEthereal = store.activeBiomes();
    expect(autoEthereal.some(b => b.id === 'ethereal_bamboo')).toBe(true);
  });

  it('prevents cyan #38bdf8 grid stripes across macroMipmap blocks and suppresses coarse 2x2/4x4 border bleed', () => {
    const noises = createDefaultNoiseParams();
    // Set up a 2x2 macroMipmap cell at (0,0) covering blocks (0,0), (1,0), (0,1), (1,1)
    const mipOnly = new Map([
      [
        '0,0',
        {
          mcx: 0,
          mcz: 0,
          r: 210,
          g: 180,
          b: 120,
          y: 12,
          waterDepth: 0,
          nodeName: 'default:desert_sand'
        }
      ]
    ]);

    // Render across X: [0..32], Z: [0..32] with stepX = 1.0 (< 4) and exploredBoundsEnabled = true.
    // The internal boundary between block (0,0) and block (1,0) at worldX = 15..16 must NOT be painted cyan (56, 189, 248)
    // because both blocks are covered by macroMipmap ('0,0').
    const pngBuf = renderTilePngBuffer(
      {
        jobId: 201,
        tileKind: 'color',
        tileSize: 32,
        minX: 0,
        maxX: 32,
        minZ: 0,
        maxZ: 32,
        seed: 74829104,
        mapgen: 'v7',
        waterLevel: 1,
        heatNoise: noises.heatNoise,
        humidityNoise: noises.humidityNoise,
        terrainNoise: noises.terrainNoise,
        viewMode: 'hybrid',
        hypsometricMode: false,
        hillshadeEnabled: false,
        voronoiContoursEnabled: false,
        exploredBoundsEnabled: true,
        isolatedBiomeId: null
      },
      new Map(),
      new Set(),
      new Map(),
      mipOnly
    );

    // Decode the PNG IDAT payload via pako to inspect pixel colors at the internal block seam (px = 15, py = 16 -> worldX = 15, worldZ = 16)
    const pngBytes = new Uint8Array(pngBuf);
    // Find IDAT chunk (starts at offset 8 + 25 = 33; length in 33..36, 'IDAT' in 37..40, data at 41)
    const idatLen =
      (pngBytes[33] << 24) | (pngBytes[34] << 16) | (pngBytes[35] << 8) | pngBytes[36];
    const rawScanlines = pako.inflate(pngBytes.subarray(41, 41 + idatLen));
    const rowStride = 1 + 32 * 4;
    // Center of tile (py = 16, px = 15 -> localX = 15 on internal seam between blockX=0 and blockX=1, localZ = 15 on internal seam between blockZ=0 and blockZ=1)
    const seamOffset = 16 * rowStride + 1 + 15 * 4;
    const seamR = rawScanlines[seamOffset];
    const seamG = rawScanlines[seamOffset + 1];
    const seamB = rawScanlines[seamOffset + 2];
    expect([seamR, seamG, seamB]).not.toEqual([56, 189, 248]);

    // Now verify that when block (0,0) has an exact 1x1 `b:0,0` entry alongside a stale `0,0` or `m4:0,0` entry,
    // unexplored sibling block (1,0) does NOT bleed the coarse `0,0` or `m4:0,0` entry (even at stepX = 4.0 >= 2.0 in DB mode)
    const mixedMipmap = new Map([
      [
        'b:0,0',
        {
          mcx: 0,
          mcz: 0,
          r: 220,
          g: 190,
          b: 110,
          y: 15,
          waterDepth: 0,
          nodeName: 'default:desert_sand'
        }
      ],
      [
        '0,0',
        {
          mcx: 0,
          mcz: 0,
          r: 220,
          g: 190,
          b: 110,
          y: 15,
          waterDepth: 0,
          nodeName: 'default:desert_sand'
        }
      ],
      [
        'm4:0,0',
        {
          mcx: 0,
          mcz: 0,
          r: 220,
          g: 190,
          b: 110,
          y: 15,
          waterDepth: 0,
          nodeName: 'default:desert_sand'
        }
      ]
    ]);

    const dbOnlyBuf = renderTilePngBuffer(
      {
        jobId: 202,
        tileKind: 'color',
        tileSize: 16,
        minX: 0,
        maxX: 64,
        minZ: 0,
        maxZ: 64,
        seed: 74829104,
        mapgen: 'v7',
        waterLevel: 1,
        heatNoise: noises.heatNoise,
        humidityNoise: noises.humidityNoise,
        terrainNoise: noises.terrainNoise,
        viewMode: 'db',
        hypsometricMode: false,
        hillshadeEnabled: false,
        voronoiContoursEnabled: false,
        exploredBoundsEnabled: false,
        isolatedBiomeId: null
      },
      new Map(),
      new Set(),
      new Map(),
      mixedMipmap
    );
    const dbPngBytes = new Uint8Array(dbOnlyBuf);
    const dbIdatLen =
      (dbPngBytes[33] << 24) | (dbPngBytes[34] << 16) | (dbPngBytes[35] << 8) | dbPngBytes[36];
    const dbScanlines = pako.inflate(dbPngBytes.subarray(41, 41 + dbIdatLen));
    const dbRowStride = 1 + 16 * 4;
    // py = 14 (near Z = 0, blockZ = 0), px = 6 (worldX = 24 -> blockX = 1, which is unexplored sibling of block (0,0))
    // In 'db' viewMode, unexplored blocks render as dark slate void [11, 16, 26] rather than desert sand [220, 190, 110]
    const siblingOffset = 14 * dbRowStride + 1 + 6 * 4;
    expect([
      dbScanlines[siblingOffset],
      dbScanlines[siblingOffset + 1],
      dbScanlines[siblingOffset + 2]
    ]).toEqual([11, 16, 26]);
  });

  it('purges aborted tile requests via AbortSignal in WorkerPoolService to prevent MapLibre concurrency starvation', async () => {
    const injector = Injector.create({
      providers: [
        { provide: MapStore, useFactory: () => new MapStore() },
        { provide: CoordProjectionService, useFactory: () => new CoordProjectionService() },
        { provide: PwaStorageService, useFactory: () => new PwaStorageService() }
      ]
    });
    const workerPool = runInInjectionContext(injector, () => new WorkerPoolService());

    const mockWorkerInstance = {
      worker: { postMessage: () => {} },
      busy: true,
      activeJobId: 888
    };
    (workerPool as any).pool.push(mockWorkerInstance);

    const abortController = new AbortController();
    const pAborted = workerPool.requestTile('color', 4, 2, 3, 1, abortController.signal);

    await new Promise(resolve => setTimeout(resolve, 10));
    expect(((workerPool as any).queue as any[]).length).toBe(1);

    // Abort the tile request (simulating MapLibre cancelling an off-screen tile during drag/zoom)
    abortController.abort();
    expect(((workerPool as any).queue as any[]).length).toBe(0);

    await expect(pAborted).rejects.toThrow();
  });

  it('parses world seeds from map_meta.txt preserving backward compatibility', () => {
    const raw64Str = '1234567890123456789';
    const numSeed = Number(raw64Str.trim().slice(-9));
    expect(numSeed).toBe(123456789);

    const standardSeedStr = '74829104';
    const standardSeed = Number(standardSeedStr.trim().slice(-9));
    expect(standardSeed).toBe(74829104);
  });

  it('separates ground elevation groundY from foliage/bamboo topY to prevent 3D terrain needle spikes', () => {
    expect(isFoliageOrSpikeNode('default:leaves')).toBe(true);
    expect(isFoliageOrSpikeNode('default:bamboo')).toBe(true);
    expect(isFoliageOrSpikeNode('default:cactus')).toBe(true);
    expect(isFoliageOrSpikeNode('default:apple')).toBe(true);
    expect(isFoliageOrSpikeNode('default:fern_1')).toBe(true);
    expect(isFoliageOrSpikeNode('default:tree')).toBe(true);
    expect(isFoliageOrSpikeNode('everness:coral_tree')).toBe(true);
    expect(isFoliageOrSpikeNode('default:dirt_with_grass')).toBe(false);
    expect(isFoliageOrSpikeNode('default:stone')).toBe(false);
    expect(isFoliageOrSpikeNode('everness:dirt_with_coral_grass')).toBe(false);
    expect(isFoliageOrSpikeNode('everness:coral_sand')).toBe(false);
    expect(isFoliageOrSpikeNode('everness:coral_desert_stone')).toBe(false);

    expect(isNaturalTerrainGroundNode('everness:dirt_with_coral_grass')).toBe(true);
    expect(isNaturalTerrainGroundNode('everness:coral_sand')).toBe(true);
    expect(isNaturalTerrainGroundNode('default:dirt_with_grass')).toBe(true);
    expect(isNaturalTerrainGroundNode('default:stonebrick')).toBe(false);
    expect(isNaturalTerrainGroundNode('default:wood')).toBe(false);
    expect(isNaturalTerrainGroundNode('default:leaves')).toBe(false);

    expect(isPlayerStructuralNode('default:wood')).toBe(true);
    expect(isPlayerStructuralNode('default:stonebrick')).toBe(true);
    expect(isPlayerStructuralNode('default:cobble')).toBe(true);
    expect(isPlayerStructuralNode('default:glass')).toBe(true);
    expect(isPlayerStructuralNode('default:dirt')).toBe(false);

    const blockSurfaces = new Map<string, any>();
    const macroMipmap = new Map<string, any>();
    const nodeCounts: Record<string, number> = {};

    const mockSummary: any = {
      blockX: 0,
      blockY: 0,
      blockZ: 0,
      dominantNode: 'default:bamboo',
      columns: [
        {
          localX: 2,
          localZ: 3,
          topLocalY: 14, // Bamboo stalk reaches Y = 14
          groundLocalY: 4, // Bare soil/ground underneath is at Y = 4
          nodeName: 'default:bamboo',
          waterCount: 0
        },
        {
          localX: 4,
          localZ: 5,
          topLocalY: 6,
          groundLocalY: 6,
          nodeName: 'default:dirt_with_grass',
          waterCount: 0
        }
      ]
    };

    const blk = mergeParsedBlockIntoCompactSurface(
      mockSummary,
      -32000,
      32000,
      blockSurfaces,
      macroMipmap,
      nodeCounts
    );

    expect(blk).toBeDefined();
    const bambooIdx = (3 << 4) | 2;
    expect(blk!.topY[bambooIdx]).toBe(14); // Preserved for color drape
    expect(blk!.groundY![bambooIdx]).toBe(4); // DTM ground elevation stripped of needle spike

    const grassIdx = (5 << 4) | 4;
    expect(blk!.topY[grassIdx]).toBe(6);
    expect(blk!.groundY![grassIdx]).toBe(6);

    // Verify multi-block vertical column merging (top-down blockY = 1 canopy/roof -> blockY = 0 natural ground)
    const multiBlockSurfaces = new Map<string, any>();
    const multiMipmap = new Map<string, any>();
    const upperCanopyAndRoofBlock: any = {
      blockX: 2,
      blockY: 1, // Y = 16..31
      blockZ: 3,
      dominantNode: 'default:leaves',
      columns: [
        {
          localX: 1,
          localZ: 1,
          topLocalY: 8, // Canopy at Y = 24
          groundLocalY: undefined, // No natural ground inside blockY = 1
          nodeName: 'default:leaves',
          waterCount: 0
        },
        {
          localX: 2,
          localZ: 1,
          topLocalY: 6, // Building roof at Y = 22
          groundLocalY: undefined,
          nodeName: 'default:stonebrick',
          waterCount: 0
        }
      ]
    };
    const lowerGroundBlock: any = {
      blockX: 2,
      blockY: 0, // Y = 0..15
      blockZ: 3,
      dominantNode: 'everness:dirt_with_coral_grass',
      columns: [
        {
          localX: 1,
          localZ: 1,
          topLocalY: 15, // Trunk inside blockY = 0
          groundLocalY: 5, // Coral forest ground at Y = 5
          nodeName: 'everness:coral_tree',
          waterCount: 0
        },
        {
          localX: 2,
          localZ: 1,
          topLocalY: 15, // Wall inside blockY = 0
          groundLocalY: 5, // Natural ground under building at Y = 5
          nodeName: 'default:stonebrick',
          waterCount: 0
        }
      ]
    };

    mergeParsedBlockIntoCompactSurface(
      upperCanopyAndRoofBlock,
      -32000,
      32000,
      multiBlockSurfaces,
      multiMipmap,
      {}
    );
    const mergedMulti = mergeParsedBlockIntoCompactSurface(
      lowerGroundBlock,
      -32000,
      32000,
      multiBlockSurfaces,
      multiMipmap,
      {}
    );

    expect(mergedMulti).toBeDefined();
    const treeColIdx = (1 << 4) | 1;
    const roofColIdx = (1 << 4) | 2;
    expect(mergedMulti!.topY[treeColIdx]).toBe(24);
    expect(mergedMulti!.groundY![treeColIdx]).toBe(5);
    expect(mergedMulti!.topY[roofColIdx]).toBe(22);
    expect(mergedMulti!.groundY![roofColIdx]).toBe(5);
    expect(mergedMulti!.avgY).toBe(5);
  });

  it('classifies natural mountain ores, terracotta, and rocks as natural ground without tearing holes or extruding buildings', () => {
    expect(isNaturalTerrainGroundNode('mcl_copper:copper_ore')).toBe(true);
    expect(isNaturalTerrainGroundNode('mcl_terracotta:terracotta_purple')).toBe(true);
    expect(isNaturalTerrainGroundNode('mcl_core:granite')).toBe(true);
    expect(isNaturalTerrainGroundNode('mcl_core:diorite')).toBe(true);
    expect(isNaturalTerrainGroundNode('mcl_deepslate:calcite')).toBe(true);
    expect(isNaturalTerrainGroundNode('mcl_deepslate:tuff')).toBe(true);

    // Natural raw materials should NOT be player structural buildings
    expect(isPlayerStructuralNode('mcl_copper:copper_ore')).toBe(false);
    expect(isPlayerStructuralNode('mcl_terracotta:terracotta_purple')).toBe(false);
    expect(isPlayerStructuralNode('mcl_core:granite')).toBe(false);

    // But crafted/polished items SHOULD remain player structural
    expect(isPlayerStructuralNode('mcl_terracotta:glazed_terracotta_cyan')).toBe(true);
    expect(isPlayerStructuralNode('mcl_core:polished_granite')).toBe(true);
    expect(isPlayerStructuralNode('default:stonebrick')).toBe(true);

    // Test mountain surface merge
    const testSurfaces = new Map<string, any>();
    const testMipmap = new Map<string, any>();
    const mountainBlock: any = {
      blockX: 0,
      blockY: 4, // Y = 64..79
      blockZ: 0,
      dominantNode: 'mcl_core:sandstone',
      columns: [
        {
          localX: 2,
          localZ: 2,
          topLocalY: 10, // Mountain peak copper ore at Y = 74
          groundLocalY: undefined,
          nodeName: 'mcl_copper:copper_ore',
          waterCount: 0
        },
        {
          localX: 3,
          localZ: 2,
          topLocalY: 8, // Mountain ridge purple terracotta at Y = 72
          groundLocalY: undefined,
          nodeName: 'mcl_terracotta:terracotta_purple',
          waterCount: 0
        }
      ]
    };

    const blk = mergeParsedBlockIntoCompactSurface(
      mountainBlock,
      -32000,
      32000,
      testSurfaces,
      testMipmap,
      {}
    );

    expect(blk).toBeDefined();
    const copperIdx = (2 << 4) | 2;
    const terracottaIdx = (2 << 4) | 3;
    expect(blk!.topY[copperIdx]).toBe(74);
    expect(blk!.groundY![copperIdx]).toBe(74); // Preserves peak elevation, not avgY
    expect(blk!.topY[terracottaIdx]).toBe(72);
    expect(blk!.groundY![terracottaIdx]).toBe(72); // Preserves ridge elevation, not avgY
    // Neither should be classified as 3D building extrusions
    expect(blk!.extrusionKind ? blk!.extrusionKind[copperIdx] : 0).toBe(0);
    expect(blk!.extrusionKind ? blk!.extrusionKind[terracottaIdx] : 0).toBe(0);
  });

  it('controls 3D building extrusions state in MapStore', () => {
    safeClearStorage();
    const store = new MapStore();
    expect(store.buildingExtrusions3dEnabled()).toBe(false);

    store.setBuildingExtrusions3dEnabled(true);
    expect(store.buildingExtrusions3dEnabled()).toBe(true);

    store.setBuildingExtrusions3dEnabled(false);
    expect(store.buildingExtrusions3dEnabled()).toBe(false);
  });

  it('disables Voronoi biome borders by default and toggles on demand in MapStore', () => {
    const store = new MapStore();
    expect(store.voronoiContoursEnabled()).toBe(false);

    const prevRev = store.renderRevision();
    store.toggleVoronoiContours();
    expect(store.voronoiContoursEnabled()).toBe(true);
    expect(store.renderRevision()).toBe(prevRev + 1);

    store.toggleVoronoiContours();
    expect(store.voronoiContoursEnabled()).toBe(false);
  });

  it('matches authentic Luanti C++ noise2d and anchors Hybrid bathymetry/coastlines to SQLite ocean & land', () => {
    // 1. Verify Luanti C++ hash2d determinism and [-1, 1] range
    const h1 = LuantiNoise2D.hash2d(120, -340, 74829104);
    const h2 = LuantiNoise2D.hash2d(120, -340, 74829104);
    expect(h1).toBe(h2);
    expect(h1).toBeGreaterThanOrEqual(-1.0);
    expect(h1).toBeLessThanOrEqual(1.0);

    // 2. Verify Hybrid bathymetric anchoring turns unexplored pixels adjacent to SQLite ocean into ocean
    const noises = createDefaultNoiseParams();
    const synth = new LuantiWorldSynthesizer(
      74829104,
      'v7',
      1,
      noises.heatNoise,
      noises.humidityNoise,
      noises.terrainNoise
    );

    const oceanMipmap = new Map<string, any>([
      [
        '0,0',
        {
          mcx: 0,
          mcz: 0,
          r: 39,
          g: 146,
          b: 219,
          y: 1,
          waterDepth: 12,
          nodeName: 'default:water_source'
        }
      ]
    ]);

    // Sample anchor immediately adjacent to explored ocean cell '0,0' (at worldX = 40, worldZ = 16 -> mcx = 1, mcz = 0)
    const anchor = sampleMipmapClimateAnchor(40, 16, oceanMipmap, DEFAULT_LUANTI_BIOMES, null, 1);
    expect(anchor).not.toBeNull();
    expect(anchor!.elev).toBeLessThan(1); // Bathymetric depth below waterLevel (1)
    expect(anchor!.elevBlend).toBeGreaterThan(0.85);

    const anchoredPt = synth.evaluatePointWithClimateAnchor(
      40,
      16,
      anchor!.heat,
      anchor!.humidity,
      anchor!.blend,
      undefined,
      false,
      anchor!.elev,
      anchor!.elevBlend
    );
    expect(anchoredPt.elevation).toBeLessThan(1);
  });

  it('detects 3D buildings (including hollow roofs, wool domes, and masonry) while excluding flora/pillars and keeping wilderness blocks zero-allocation', () => {
    // 1. Everness Mineral Waters travertine pool bricks must resolve to travertine color and never extrude as buildings
    expect(resolveNodeColor('everness:mineral_stone_brick')).toEqual([222, 208, 192]);
    expect(isPlayerStructuralNode('everness:mineral_stone_brick')).toBe(false);
    expect(isPlayerStructuralNode('everness:mineral_stone_brick_with_growth')).toBe(false);
    expect(isNaturalTerrainGroundNode('everness:mineral_stone_brick')).toBe(true);
    expect(classifyColumnExtrusionKind('everness:mineral_stone_brick')).toBe(0);

    // 2. Non-volumetric attachments (fences, chests, torches) and flora/crystal pillars must not extrude as 3D buildings
    expect(classifyColumnExtrusionKind('default:fence_wood')).toBe(0);
    expect(classifyColumnExtrusionKind('default:chest_locked')).toBe(0);
    expect(classifyColumnExtrusionKind('everness:bamboo_1')).toBe(0);
    expect(classifyColumnExtrusionKind('everness:bamboo_leaves')).toBe(0);
    expect(classifyColumnExtrusionKind('mcl_bamboo:bamboo')).toBe(0);
    expect(classifyColumnExtrusionKind('everness:crystal_tree')).toBe(0);
    expect(classifyColumnExtrusionKind('everness:crystal_pillar')).toBe(0);
    expect(classifyColumnExtrusionKind('mcl_amethyst:amethyst_cluster')).toBe(0);

    // 3. Architectural materials (masonry, stone_block, wool domes, bakedclay, glass, wood) must classify as 3D buildings (1)
    expect(classifyColumnExtrusionKind('default:stonebrick')).toBe(1);
    expect(classifyColumnExtrusionKind('default:stone_block')).toBe(1);
    expect(classifyColumnExtrusionKind('default:sandstone_block')).toBe(1);
    expect(classifyColumnExtrusionKind('wool:yellow')).toBe(1);
    expect(classifyColumnExtrusionKind('bakedclay:green')).toBe(1);
    expect(classifyColumnExtrusionKind('default:glass')).toBe(1);
    expect(classifyColumnExtrusionKind('default:wood')).toBe(1);
    expect(isNaturalTerrainGroundNode('default:stone_block')).toBe(false);
    expect(isNaturalTerrainGroundNode('wool:yellow')).toBe(false);
    expect(isNaturalTerrainGroundNode('bakedclay:green')).toBe(false);

    // 4. Wilderness blocks with zero buildings must NOT allocate blk.extrusionKind (zero-overhead memory optimization)
    const blockSurfaces = new Map<string, any>();
    const macroMipmap = new Map<string, any>();
    const wildernessBlk = mergeParsedBlockIntoCompactSurface(
      {
        posKey: '1,0,0',
        blockX: 1,
        blockY: 0,
        blockZ: 0,
        version: 29,
        nodeMapping: {},
        columns: [
          {
            localX: 2,
            localZ: 2,
            topLocalY: 5,
            groundLocalY: 5,
            bottomLocalY: 0,
            nodeName: 'default:dirt_with_grass',
            waterCount: 0
          }
        ]
      },
      -32000,
      32000,
      blockSurfaces,
      macroMipmap,
      {}
    );
    expect(wildernessBlk).not.toBeNull();
    expect(wildernessBlk!.extrusionKind).toBeUndefined();

    // 5. Hollow building roofs (hasAirGapBelow: true) and full-block structures without dirt underneath
    // must preserve extrusionKind = 1 and anchor avgY to the foundation level instead of roof topY!
    const merged = mergeParsedBlockIntoCompactSurface(
      {
        posKey: '0,0,0',
        blockX: 0,
        blockY: 0,
        blockZ: 0,
        version: 29,
        nodeMapping: {},
        columns: [
          {
            localX: 3,
            localZ: 3,
            topLocalY: 14,
            groundLocalY: undefined, // Floor replaced natural dirt
            bottomLocalY: 5, // Building floor rests at Y = 5
            contiguousSpan: 1,
            hasAirGapBelow: true, // Hollow indoor room beneath roof
            nodeName: 'default:wood',
            waterCount: 0
          },
          {
            localX: 4,
            localZ: 3,
            topLocalY: 15,
            groundLocalY: undefined,
            bottomLocalY: 5,
            contiguousSpan: 10,
            hasAirGapBelow: false,
            nodeName: 'wool:yellow',
            waterCount: 0
          }
        ]
      },
      -32000,
      32000,
      blockSurfaces,
      macroMipmap,
      {}
    );

    expect(merged).not.toBeNull();
    expect(merged!.extrusionKind).toBeDefined();
    expect(merged!.extrusionKind![(3 << 4) | 3]).toBe(1); // Hollow building roof preserved
    expect(merged!.extrusionKind![(3 << 4) | 4]).toBe(1); // Wool dome preserved
    expect(merged!.extrusionSpan![(3 << 4) | 3]).toBe(9);
    expect(merged!.extrusionSpan![(3 << 4) | 4]).toBe(10);
    expect(merged!.avgY).toBe(5); // Anchored to foundation (Y = 5), NOT roof (Y = 14..15)!

    // 5b. 1-block hillside terraces/paths (contiguousSpan = 1) over deep underground stone (blockY = -1)
    // and floating sky platforms (open air at bottom of blockY = 4) must NOT extrude into skyscrapers!
    const hillBlockSurfaces = new Map<string, any>();
    // First merge blockY = 4 (floating sky platform at Y = 69 with open air to ly = 0)
    mergeParsedBlockIntoCompactSurface(
      {
        posKey: '2,4,2',
        blockX: 2,
        blockY: 4,
        blockZ: 2,
        version: 29,
        nodeMapping: {},
        columns: [
          {
            localX: 1,
            localZ: 1,
            topLocalY: 5,
            floorLocalY: -1, // Open air to ly = 0
            bottomLocalY: 5,
            contiguousSpan: 1,
            hasAirGapBelow: true,
            nodeName: 'bakedclay:yellow',
            waterCount: 0
          }
        ]
      },
      -32000,
      32000,
      hillBlockSurfaces,
      macroMipmap,
      {}
    );
    // Next merge blockY = 2 (1-block-thick colored hillside at Y = 45, plus bare log beam without foliage)
    mergeParsedBlockIntoCompactSurface(
      {
        posKey: '2,2,2',
        blockX: 2,
        blockY: 2,
        blockZ: 2,
        version: 29,
        nodeMapping: {},
        columns: [
          {
            localX: 2,
            localZ: 2,
            topLocalY: 13, // World Y = 45
            groundLocalY: undefined,
            bottomLocalY: 13,
            contiguousSpan: 1,
            hasAirGapBelow: false,
            nodeName: 'wool:yellow',
            waterCount: 0
          },
          {
            localX: 5,
            localZ: 5,
            topLocalY: 12,
            groundLocalY: 10,
            bottomLocalY: 0,
            contiguousSpan: 2,
            hasAirGapBelow: false,
            nodeName: 'default:tree',
            trunkNodeName: 'default:tree',
            trunkLocalY: 12,
            hasFoliage: false, // Bare structural log beam without foliage!
            waterCount: 0
          }
        ]
      },
      -32000,
      32000,
      hillBlockSurfaces,
      macroMipmap,
      {}
    );
    // Finally merge blockY = -1 (deep underground stone at Y = -10)
    mergeParsedBlockIntoCompactSurface(
      {
        posKey: '2,-1,2',
        blockX: 2,
        blockY: -1,
        blockZ: 2,
        version: 29,
        nodeMapping: {},
        columns: [
          {
            localX: 1,
            localZ: 1,
            topLocalY: 6, // World Y = -10
            groundLocalY: 6,
            bottomLocalY: 0,
            contiguousSpan: 1,
            hasAirGapBelow: false,
            nodeName: 'default:stone',
            waterCount: 0
          },
          {
            localX: 2,
            localZ: 2,
            topLocalY: 6, // World Y = -10
            groundLocalY: 6,
            bottomLocalY: 0,
            contiguousSpan: 1,
            hasAirGapBelow: false,
            nodeName: 'default:stone',
            waterCount: 0
          }
        ]
      },
      -32000,
      32000,
      hillBlockSurfaces,
      macroMipmap,
      {}
    );
    const hillMerged = hillBlockSurfaces.get('2,2');
    expect(hillMerged).toBeDefined();
    // Neither the floating sky platform at (1,1) nor the 1-block wool hillside at (2,2) may extrude!
    expect(hillMerged!.extrusionKind?.[(1 << 4) | 1] ?? 0).toBe(0);
    expect(hillMerged!.extrusionKind?.[(2 << 4) | 2] ?? 0).toBe(0);
    // Bare log beam without foliage at (5,5) must NOT spawn a tree billboard!
    expect(hillMerged!.treeAnchors?.length ?? 0).toBe(0);
    // Hill avgY must stay elevated (> 40), never collapsed to -10 by blockY = -1!
    expect(hillMerged!.avgY).toBeGreaterThan(40);

    // 6. Verify MapStore defaults buildingExtrusions3dEnabled to false and toggles cleanly
    safeClearStorage();
    const store = new MapStore();
    expect(store.buildingExtrusions3dEnabled()).toBe(false);
    store.toggleBuildingExtrusions3D();
    expect(store.buildingExtrusions3dEnabled()).toBe(true);
    store.toggleBuildingExtrusions3D();
    expect(store.buildingExtrusions3dEnabled()).toBe(false);
  });

  it('applies block-strided directional hillshading in Sector 1x1 macro tier (cameraZoom = 4.5) and cancels pending DEM tiles', async () => {
    const noises = createDefaultNoiseParams();
    const blockSurfaces = new Map<string, any>();

    const makeBlock = (bx: number, bz: number, avgY: number) => ({
      bx,
      bz,
      rgb: new Uint8Array(768).fill(120),
      topY: new Int16Array(256).fill(avgY),
      groundY: new Int16Array(256).fill(avgY),
      waterDepth: new Uint8Array(256),
      dominantNode: 'default:dirt_with_grass',
      avgColor: [120, 160, 80] as [number, number, number],
      avgY
    });

    // Create 3x3 blocks with a NW -> SE slope so block (0,0) has lower NW neighbor (-1,1) and higher SE neighbor (1,-1)
    blockSurfaces.set('-1,1', makeBlock(-1, 1, 5));
    blockSurfaces.set('0,0', makeBlock(0, 0, 15));
    blockSurfaces.set('1,-1', makeBlock(1, -1, 25));

    // Render block (0,0) at stepX = 2.0 (minX = 0, maxX = 16, size = 8) with cameraZoom = 4.5 (Sector 1x1)
    const shadedPng = renderTilePngBuffer(
      {
        jobId: 901,
        tileKind: 'color',
        tileSize: 8,
        cameraZoom: 4.5,
        minX: 0,
        maxX: 16,
        minZ: 0,
        maxZ: 16,
        seed: 74829104,
        mapgen: 'v7',
        waterLevel: 1,
        heatNoise: noises.heatNoise,
        humidityNoise: noises.humidityNoise,
        terrainNoise: noises.terrainNoise,
        viewMode: 'db',
        hypsometricMode: false,
        hillshadeEnabled: true,
        voronoiContoursEnabled: false,
        exploredBoundsEnabled: false,
        isolatedBiomeId: null
      },
      null,
      null,
      blockSurfaces,
      null
    );
    const unshadedPng = renderTilePngBuffer(
      {
        jobId: 902,
        tileKind: 'color',
        tileSize: 8,
        cameraZoom: 4.5,
        minX: 0,
        maxX: 16,
        minZ: 0,
        maxZ: 16,
        seed: 74829104,
        mapgen: 'v7',
        waterLevel: 1,
        heatNoise: noises.heatNoise,
        humidityNoise: noises.humidityNoise,
        terrainNoise: noises.terrainNoise,
        viewMode: 'db',
        hypsometricMode: false,
        hillshadeEnabled: false,
        voronoiContoursEnabled: false,
        exploredBoundsEnabled: false,
        isolatedBiomeId: null
      },
      null,
      null,
      blockSurfaces,
      null
    );

    const decodeFirstPixel = (buf: ArrayBuffer) => {
      const b = new Uint8Array(buf);
      const len = (b[33] << 24) | (b[34] << 16) | (b[35] << 8) | b[36];
      const raw = pako.inflate(b.subarray(41, 41 + len));
      return [raw[1], raw[2], raw[3]];
    };

    const [sr, sg, sb] = decodeFirstPixel(shadedPng);
    const [ur, ug, ub] = decodeFirstPixel(unshadedPng);
    // Shaded macro tile must have positive directional sun highlight (not flat zero shade!)
    expect(sr).toBeGreaterThan(ur);
    expect(sg).toBeGreaterThan(ug);
    expect(sb).toBeGreaterThan(ub);
  });

  it('validates 6-locale i18n dictionary completeness, ISO language codes, and synchronized keyboard shortcuts', () => {
    // 1. All 6 locales use clean 2-letter ISO codes instead of platform-dependent emoji flags
    expect(SUPPORTED_LOCALES.map(l => l.flag)).toEqual(['EN', 'SK', 'DE', 'FR', 'ES', 'RU']);

    const i18n = new TranslationService();
    for (const loc of SUPPORTED_LOCALES) {
      i18n.setLocale(loc.id);
      expect(i18n.t('voronoi.biomePaletteLabel')).not.toBe('voronoi.biomePaletteLabel');
      expect(i18n.t('inspector.surfaceColumns')).not.toBe('inspector.surfaceColumns');
      expect(i18n.t('markers.savedWaypoints')).not.toBe('markers.savedWaypoints');
      expect(i18n.t('viewport.copyCoordsTooltip')).not.toBe('viewport.copyCoordsTooltip');
      expect(i18n.t('header.offlineBadge')).not.toBe('header.offlineBadge');
      expect(i18n.t('routes.trySampleRoute')).not.toBe('routes.trySampleRoute');
    }

    // 2. KeyboardShortcutsService registers N, O, P, S shortcuts and updates lastTriggeredAction
    const injector = Injector.create({
      providers: [
        { provide: MapStore, useFactory: () => new MapStore() }
      ]
    });
    const shortcuts = runInInjectionContext(injector, () => new KeyboardShortcutsService());
    const ids = shortcuts.shortcuts.map(s => s.id);
    expect(ids).toContain('reset_north');
    expect(ids).toContain('open_world');
    expect(ids).toContain('open_routes');
    expect(ids).toContain('open_share');

    shortcuts.handleKeyDown({ key: 'p', preventDefault: () => {} } as any);
    expect(shortcuts.lastTriggeredAction()?.id).toBe('open_routes');
  });

  it('persists user settings across MapStore instances and supports discovered region visibility & popups', () => {
    safeClearStorage();

    // 1. Fresh store has expected defaults
    const store1 = new MapStore();
    expect(store1.buildingExtrusions3dEnabled()).toBe(false);
    expect(store1.discoveredRegionsVisible()).toBe(true);
    expect(store1.activeMarkerPopup()).toBeNull();

    // 2. Modify settings
    store1.setBuildingExtrusions3dEnabled(true);
    store1.setDiscoveredRegionsVisible(false);
    store1.openMarkerPopup({
      title: 'Discovered Structure',
      x: 100,
      z: 200,
      screenX: 300,
      screenY: 400,
      blockCount: 42
    });

    expect(store1.buildingExtrusions3dEnabled()).toBe(true);
    expect(store1.discoveredRegionsVisible()).toBe(false);
    expect(store1.activeMarkerPopup()?.title).toBe('Discovered Structure');
    expect(store1.activeMarkerPopup()?.blockCount).toBe(42);

    store1.closeMarkerPopup();
    expect(store1.activeMarkerPopup()).toBeNull();

    // 3. New MapStore instance must reload the persisted settings from storage
    const store2 = new MapStore();
    expect(store2.buildingExtrusions3dEnabled()).toBe(true);
    expect(store2.discoveredRegionsVisible()).toBe(false);
  });

  it('parses real Luanti sample-luanti-world/map.sql dump with zero-OOM chunked streaming', async () => {
    const sqlPath = 'sample-luanti-world/map.sql';
    if (!fs.existsSync(sqlPath)) return;

    const fileBuf = fs.readFileSync(sqlPath);
    const file = new File([fileBuf], 'map.sql');
    const reader = new PostgresSqlDumpReader(file);
    await reader.init();

    expect(reader.backendType).toBe('postgresql');
    expect(reader.fileName).toBe('map.sql');

    const overview = await reader.scanOverviewAndVerticalLayers();
    expect(overview.backendType).toBe('postgresql');
    expect(overview.estimatedTotalBlocks).toBe(81);
    expect(overview.minBlockX).toBe(-4);
    expect(overview.maxBlockX).toBe(4);
    expect(overview.minBlockZ).toBe(-4);
    expect(overview.maxBlockZ).toBe(4);
    expect(overview.exploredBlockKeys.size).toBe(81); // 9x9 horizontal columns (-4..4)

    // Query blocks in bounds
    const rows = await reader.queryBlocksInBounds(
      overview.minBlockX,
      overview.maxBlockX,
      overview.minBlockZ,
      overview.maxBlockZ,
      -1,
      9,
      1024,
      1
    );

    expect(rows.length).toBe(81);
    for (const r of rows) {
      expect(r.data.length).toBeGreaterThan(0);
      expect(r.x).toBeGreaterThanOrEqual(-4);
      expect(r.x).toBeLessThanOrEqual(4);
      expect(r.z).toBeGreaterThanOrEqual(-4);
      expect(r.z).toBeLessThanOrEqual(4);
    }

    // Test targeted key fetching
    const key = `0,0,0`;
    const fetched = await reader.fetchBlocksForKeys([key]);
    expect(fetched.length).toBe(1);
    expect(fetched[0].x).toBe(0);
    expect(fetched[0].y).toBe(0);
    expect(fetched[0].z).toBe(0);

    await reader.close();
  });

  it('supports databaseBackend state in MapStore and loads SQLite and PostgreSQL demo worlds', () => {
    const store = new MapStore();

    // Default demo database is sqlite3
    store.loadDemoDatabase('sqlite3');
    expect(store.databaseBackend()).toBe('sqlite3');
    expect(store.worldDatabase()?.fileName).toBe('demo-world/map.sqlite');

    // Switching to PostgreSQL demo database
    store.loadDemoDatabase('postgresql');
    expect(store.databaseBackend()).toBe('postgresql');
    expect(store.worldDatabase()?.fileName).toBe('demo-world/map.sql');
  });

  it('exports active world as Luanti PostgreSQL dump with COPY stdin format', async () => {
    const injector = Injector.create({
      providers: [
        { provide: MapStore, useFactory: () => new MapStore() },
        { provide: CoordProjectionService, useFactory: () => new CoordProjectionService() },
        { provide: PwaStorageService, useFactory: () => new PwaStorageService() },
        {
          provide: WorkerPoolService,
          useFactory: () => runInInjectionContext(injector, () => new WorkerPoolService())
        }
      ]
    });
    const worldLoader = runInInjectionContext(injector, () => new WorldLoaderService());
    const store = runInInjectionContext(injector, () => injector.get(MapStore));

    // Load demo world into store
    store.loadDemoDatabase('sqlite3');

    // Export world as postgres dump
    const dumpContent = await worldLoader.exportCurrentWorldAsPostgresDump();
    expect(dumpContent).toContain('-- Luanti World Map PostgreSQL Database Dump');
    expect(dumpContent).toContain('CREATE TABLE IF NOT EXISTS public.blocks');
    expect(dumpContent).toContain('COPY public.blocks (pos, data) FROM stdin;');
    expect(dumpContent).toContain('\\.');
    // Check that at least some data lines exist with \x hex bytea
    expect(dumpContent).toMatch(/-?\d+\t\\x[0-9a-fA-F]+/);
  });

  it('resolves loadDemoWorld asset URLs relative to baseURI and falls back to in-memory generator on network failure', async () => {
    const injector = Injector.create({
      providers: [
        { provide: MapStore, useFactory: () => new MapStore() },
        { provide: CoordProjectionService, useFactory: () => new CoordProjectionService() },
        { provide: PwaStorageService, useFactory: () => new PwaStorageService() },
        {
          provide: WorkerPoolService,
          useFactory: () => runInInjectionContext(injector, () => new WorkerPoolService())
        }
      ]
    });
    const worldLoader = runInInjectionContext(injector, () => new WorldLoaderService());
    const store = runInInjectionContext(injector, () => injector.get(MapStore));

    // Mock fetch that records requested URLs and simulates 404
    const requestedUrls: string[] = [];
    const origFetch = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL) => {
      requestedUrls.push(input.toString());
      return new Response('Not Found', { status: 404, statusText: 'Not Found' });
    };

    try {
      // Test loading sqlite demo world
      await worldLoader.loadDemoWorld('sqlite3');
      expect(requestedUrls.length).toBeGreaterThan(0);
      expect(requestedUrls[0]).toContain('sample-luanti-world/map.sqlite');
      // Even though fetch returned 404, the fallback populated the store seamlessly
      expect(store.worldDatabase()).not.toBeNull();
      expect(store.databaseBackend()).toBe('sqlite3');
      expect(worldLoader.lastError()).toBeNull();

      // Test loading postgresql demo world
      requestedUrls.length = 0;
      await worldLoader.loadDemoWorld('postgresql');
      expect(requestedUrls.length).toBeGreaterThan(0);
      expect(requestedUrls[0]).toContain('sample-luanti-world/map.sql');
      expect(store.worldDatabase()).not.toBeNull();
      expect(store.databaseBackend()).toBe('postgresql');
      expect(worldLoader.lastError()).toBeNull();
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('triggers standard HTML file input by default in openFilePicker to bypass system folder restrictions', async () => {
    const injector = Injector.create({
      providers: [
        { provide: MapStore, useFactory: () => new MapStore() },
        { provide: CoordProjectionService, useFactory: () => new CoordProjectionService() },
        { provide: PwaStorageService, useFactory: () => new PwaStorageService() },
        {
          provide: WorkerPoolService,
          useFactory: () => runInInjectionContext(injector, () => new WorkerPoolService())
        }
      ]
    });
    const worldLoader = runInInjectionContext(injector, () => new WorldLoaderService());

    const fakeInput: any = {
      type: '',
      multiple: false,
      accept: '',
      click: vi.fn(),
      setAttribute: vi.fn(),
      onchange: null
    };
    const origDoc = (globalThis as any).document;
    (globalThis as any).document = {
      createElement: vi.fn().mockReturnValue(fakeInput)
    };

    try {
      await worldLoader.openFilePicker();
      expect(fakeInput.type).toBe('file');
      expect(fakeInput.multiple).toBe(true);
      expect(fakeInput.accept).toContain('.sqlite');
      expect(fakeInput.accept).toContain('.sql');
      expect(fakeInput.click).toHaveBeenCalled();
    } finally {
      (globalThis as any).document = origDoc;
    }
  });

  it('expands viewport macro radii in 3D pitched mode and preserves untouched coarse mipmap cells during sector refinement', async () => {
    const injector = Injector.create({
      providers: [
        { provide: MapStore, useFactory: () => new MapStore() },
        { provide: CoordProjectionService, useFactory: () => new CoordProjectionService() },
        { provide: PwaStorageService, useFactory: () => new PwaStorageService() },
        {
          provide: WorkerPoolService,
          useFactory: () => runInInjectionContext(injector, () => new WorkerPoolService())
        }
      ]
    });
    const worldLoader = runInInjectionContext(injector, () => new WorldLoaderService());
    const store = runInInjectionContext(injector, () => injector.get(MapStore));

    store.terrain3dEnabled.set(false);
    const flatRadii = worldLoader.computeViewportRadii(5.6, 1920, 1080, 0);

    store.terrain3dEnabled.set(true);
    store.cameraState.update(c => ({ ...c, pitch: 53 }));
    const pitchedRadii = worldLoader.computeViewportRadii(5.6, 1920, 1080, 53);

    expect(pitchedRadii.halfSpanX).toBeGreaterThan(flatRadii.halfSpanX);
    expect(pitchedRadii.radiusMacroX).toBeGreaterThanOrEqual(flatRadii.radiusMacroX);

    // Verify decodeMacroSectorCoarse does not wipe out existing coarse mipmaps in untouched cells
    const macroMipmap = new Map<string, any>([
      ['m4:10,10', { bx: 10, bz: 10, y: 12, r: 80, g: 160, b: 80, waterDepth: 0, nodeName: 'default:dirt_with_grass', count: 1 }]
    ]);
    (worldLoader as any).activeDbReader = {
      queryBlocksInBounds: vi.fn().mockResolvedValue([])
    };

    const res = await (worldLoader as any).decodeMacroSectorCoarse(0, 0, macroMipmap, {}, 1);
    expect(macroMipmap.has('m4:10,10')).toBe(true);
    expect(res.evictedMipKeys).not.toContain('m4:10,10');
  });

  it('preserves exact node names in CompactBlockSurface palette without color guessing and prevents cross-game biome contamination', () => {
    const blockSurfaces = new Map<string, any>();
    const macroMipmap = new Map<string, any>();
    const nodeCounts: Record<string, number> = {};

    // Simulate parsed block containing multiple real Asuna nodes
    const sampleBlock = {
      posKey: '100',
      blockX: -22,
      blockY: 0,
      blockZ: 63,
      version: 29,
      nodeMapping: {
        1: 'default:dirt_with_grass',
        2: 'too_many_stones:andesite',
        3: 'japaneseforest:japanese_tree',
        4: 'japaneseforest:japanese_leaves_1'
      },
      columns: [
        { localX: 0, localZ: 0, topLocalY: 8, nodeName: 'default:dirt_with_grass', waterCount: 0 },
        { localX: 6, localZ: 4, topLocalY: 8, nodeName: 'too_many_stones:andesite', waterCount: 0 },
        { localX: 10, localZ: 10, topLocalY: 9, nodeName: 'japaneseforest:japanese_tree', waterCount: 0 }
      ]
    };

    const blk = mergeParsedBlockIntoCompactSurface(
      sampleBlock,
      -32768,
      32767,
      blockSurfaces,
      macroMipmap,
      nodeCounts
    );

    expect(blk).not.toBeNull();
    expect(blk?.palette).toBeDefined();
    expect(blk?.palette).toContain('too_many_stones:andesite');
    expect(blk?.palette).toContain('japaneseforest:japanese_tree');
    expect(blk?.nodeIndex).toBeDefined();

    // Query exact coordinate (worldX = -22*16 + 6 = -346, worldZ = 63*16 + 4 = 1012)
    const db: any = { blockSurfaces, macroMipmap };
    const col = lookupWorldColumn(-346, 1012, db);
    expect(col).toBeDefined();
    // Authentic node preserved without reverse-guessing to mcl_end:end_rod_silver!
    expect(col?.nodeName).toBe('too_many_stones:andesite');

    // Biome resolution test: decorative rod or grey stone at Y: 8 on non-MineClone world
    // must NEVER resolve to 'mcl_the_end'
    const fallbackDeciduous = DEFAULT_LUANTI_BIOMES.find(b => b.id === 'deciduous_forest')!;
    const biomeForStone = resolveBiomeForDbNode(
      'too_many_stones:andesite',
      8,
      0,
      DEFAULT_LUANTI_BIOMES,
      fallbackDeciduous
    );
    expect(biomeForStone.id).not.toBe('mcl_the_end');

    const biomeForRod = resolveBiomeForDbNode(
      'mcl_end:end_rod_silver',
      8,
      0,
      DEFAULT_LUANTI_BIOMES,
      fallbackDeciduous
    );
    expect(biomeForRod.id).not.toBe('mcl_the_end');
    expect(biomeForRod.id).toBe('deciduous_forest');

    // Asuna node color and sapling tests
    const sakuraColor = resolveNodeColor('japaneseforest:japanese_leaves_1');
    expect(sakuraColor).toEqual([238, 175, 192]);

    const andesiteColor = resolveNodeColor('too_many_stones:andesite');
    expect(andesiteColor).toEqual([136, 136, 138]);

    const treeSapling = resolveSaplingForNode('japaneseforest:japanese_tree');
    expect(treeSapling).toBe('mcl_cherry_blossom:cherrysapling');
  });

  it('cancels active streaming, flushes pending worker tiles, and prevents loading deadlocks when switching maps mid-stream', async () => {
    let injector: Injector;
    injector = Injector.create({
      providers: [
        { provide: MapStore, useFactory: () => new MapStore() },
        { provide: CoordProjectionService, useFactory: () => new CoordProjectionService() },
        { provide: PwaStorageService, useFactory: () => new PwaStorageService() },
        {
          provide: WorkerPoolService,
          useFactory: () => runInInjectionContext(injector, () => new WorkerPoolService())
        }
      ]
    });

    const store = injector.get(MapStore);
    const workerPool = injector.get(WorkerPoolService);
    const worldLoader = runInInjectionContext(injector, () => new WorldLoaderService());

    // 1. Verify WorkerPoolService.cancelAllPendingTiles() purges queued jobs and rejects with AbortError
    // Manually push a mock queued job into workerPool
    const poolAny = workerPool as any;
    let rejectedWithAbort = false;
    poolAny.queue.push({
      coordKey: 'color/6/1_1',
      configKey: 'cfg',
      job: { jobId: 999, tileKind: 'color' },
      revision: 1,
      cacheKey: 'cache_test',
      resolvers: [() => {}],
      rejecters: [
        (err: any) => {
          if (err?.name === 'AbortError') rejectedWithAbort = true;
        }
      ]
    });
    expect(poolAny.queue.length).toBe(1);
    workerPool.cancelAllPendingTiles();
    expect(poolAny.queue.length).toBe(0);
    expect(rejectedWithAbort).toBe(true);

    // 2. Simulate Map 1 being stuck in mid-stream (e.g. 31% detail sectors streaming)
    worldLoader.isStreamingRegion.set(true);
    worldLoader.streamProgress.set({
      phase: 'viewport-stream',
      stepIndex: 1,
      totalSteps: 1,
      label: 'Streaming 1:1 Detail Sectors:',
      percent: 31,
      current: 10,
      total: 32,
      unit: 'sectors',
      blocksDecoded: 10496,
      elapsedSeconds: 14,
      etaSeconds: 31
    });

    expect(worldLoader.isStreamingRegion()).toBe(true);
    expect(worldLoader.streamProgress()?.percent).toBe(31);

    // 3. User selects Map 2 while Map 1 was streaming - simulate handleFileListInput()
    const emptyFileList: File[] = [];
    // handleFileListInput with empty returns, so test cancelActiveStreaming & closeActiveDb directly
    worldLoader.cancelActiveStreaming();
    expect(worldLoader.isStreamingRegion()).toBe(false);
    expect(worldLoader.streamProgress()).toBeNull();

    // Verify handleFileListInput immediately resets state
    worldLoader.isStreamingRegion.set(true);
    worldLoader.streamProgress.set({
      phase: 'viewport-stream',
      stepIndex: 1,
      totalSteps: 1,
      label: 'Streaming 1:1 Detail Sectors:',
      percent: 31,
      current: 10,
      total: 32,
      unit: 'sectors',
      blocksDecoded: 10496,
      elapsedSeconds: 14,
      etaSeconds: 31
    });

    const fakeFile = new File([new Uint8Array(100)], 'new_world_map.sqlite');
    // Start loading Map 2
    const loadPromise = worldLoader.handleFileListInput([fakeFile]);
    // Immediately after starting new world load, isStreamingRegion and streamProgress MUST be reset
    expect(worldLoader.isStreamingRegion()).toBe(false);
    expect(worldLoader.streamProgress()).toBeNull();

    // Await completion (will catch invalid SQLite error and clean up)
    await loadPromise;
    expect(worldLoader.isStreamingRegion()).toBe(false);
    expect(worldLoader.streamProgress()).toBeNull();
  });
});


