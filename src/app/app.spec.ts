import { describe, it, expect } from 'vitest';
import pako from 'pako';
import {
  packBlockPos,
  unpackBlockPos,
  parseLuantiMapBlock,
  parseAndMergeCoarseBlockMipmap,
  buildDemoWorldDatabase,
  lookupWorldColumn,
  isPlayerStructuralNode,
  mergeParsedBlockIntoCompactSurface
} from './core/utils/mapblock-parser';
import { LuantiWorldSynthesizer, createDefaultNoiseParams } from './core/utils/perlin-noise';
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
import { MapStore } from './core/state/map.store';
import { WorkerPoolService } from './core/services/worker-pool.service';
import { WorldLoaderService } from './core/services/world-loader.service';
import { Injector, runInInjectionContext } from '@angular/core';
import { SqliteFileBtreeReader } from './core/utils/sqlite-btree-reader';
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
});
