import { describe, it, expect, beforeEach } from 'vitest';
import { TreeSpriteService, TREE_SPRITES_LAYER_ID, TREE_SPRITES_SOURCE_ID } from './tree-sprite.service';
import { MapStore } from '../state/map.store';
import { CoordProjectionService } from './coord-projection.service';
import { buildDemoWorldDatabase, mergeParsedBlockIntoCompactSurface } from '../utils/mapblock-parser';
import { safeClearStorage } from '../utils/storage.utils';

describe('TreeSpriteService', () => {
  let service: TreeSpriteService;
  let mapStore: MapStore;
  let projection: CoordProjectionService;

  let mockSources: Record<string, { type: string; data: any; setData: (d: any) => void }>;
  let mockLayers: Record<string, any>;
  let mockImages: Set<string>;
  let mockMap: any;

  beforeEach(() => {
    safeClearStorage();
    mockSources = {};
    mockLayers = {};
    mockImages = new Set();

    mockMap = {
      getSource: (id: string) => mockSources[id],
      addSource: (id: string, config: any) => {
        let currentData = config.data;
        mockSources[id] = {
          ...config,
          get data() {
            return currentData;
          },
          setData: (newData: any) => {
            currentData = newData;
          }
        };
      },
      getLayer: (id: string) => mockLayers[id],
      addLayer: (config: any, beforeId?: string) => {
        mockLayers[config.id] = { ...config, beforeId };
      },
      setLayoutProperty: (layerId: string, prop: string, value: any) => {
        if (mockLayers[layerId]) {
          mockLayers[layerId].layout = mockLayers[layerId].layout || {};
          mockLayers[layerId].layout[prop] = value;
        }
      },
      hasImage: (key: string) => mockImages.has(key),
      addImage: (key: string, _img: any) => {
        mockImages.add(key);
      },
      getZoom: () => 8.0,
      getCanvas: () => ({ width: 800, height: 600 }),
      unproject: ([px, py]: [number, number]) => ({
        lng: (px / 800 - 0.5) * 1.0,
        lat: (0.5 - py / 600) * 1.0
      }),
      getBounds: () => ({
        getWest: () => -0.5,
        getEast: () => 0.5,
        getSouth: () => -0.5,
        getNorth: () => 0.5
      })
    };

    mapStore = new MapStore();
    projection = new CoordProjectionService();
    service = new TreeSpriteService(mapStore, projection);
  });

  it('initializes GeoJSON source and symbol layer on MapLibre map (and orders below luanti-3d-buildings-layer)', async () => {
    mockLayers['luanti-3d-buildings-layer'] = { id: 'luanti-3d-buildings-layer', type: 'fill-extrusion' };
    await service.initialize(mockMap);

    expect(mockSources[TREE_SPRITES_SOURCE_ID]).toBeDefined();
    expect(mockLayers[TREE_SPRITES_LAYER_ID]).toBeDefined();
    expect(mockLayers[TREE_SPRITES_LAYER_ID].type).toBe('symbol');
    expect(mockLayers[TREE_SPRITES_LAYER_ID].beforeId).toBe('luanti-3d-buildings-layer');
    expect(mockLayers[TREE_SPRITES_LAYER_ID].layout['icon-anchor']).toBe('bottom');
    expect(mockLayers[TREE_SPRITES_LAYER_ID].layout['icon-pitch-alignment']).toBe('viewport');
  });

  it('shows tree sprites only in 3D mode and hides them in 2D mode', async () => {
    const demoDb = buildDemoWorldDatabase(424242, 'surface');
    mapStore.worldDatabase.set(demoDb);
    mapStore.setViewMode('db');

    // 1. In 2D mode (terrain3dEnabled = false), tree sprites must be hidden
    mapStore.terrain3dEnabled.set(false);
    await service.initialize(mockMap);

    const source = mockMap.getSource(TREE_SPRITES_SOURCE_ID);
    expect(source.data.features.length).toBe(0);
    expect(mockLayers[TREE_SPRITES_LAYER_ID].layout.visibility).toBe('none');

    // 2. Switch to 3D mode (terrain3dEnabled = true) -> tree sprites become active
    mapStore.terrain3dEnabled.set(true);
    service.updateTreeSprites();

    expect(source.data.features.length).toBeGreaterThan(0);
    expect(mockLayers[TREE_SPRITES_LAYER_ID].layout.visibility).toBe('visible');
  });

  it('does not generate tree sprites in Seed mode (trees only in real DB mode per user specification)', async () => {
    mapStore.terrain3dEnabled.set(true);
    mapStore.setViewMode('seed');
    await service.initialize(mockMap);

    const source = mockMap.getSource(TREE_SPRITES_SOURCE_ID);
    expect(source.data).toBeDefined();
    expect(source.data.features.length).toBe(0);
  });

  it('clears features when zoomed out below LOD threshold (zoom < 6.5)', async () => {
    mapStore.terrain3dEnabled.set(true);
    const demoDb = buildDemoWorldDatabase(424242, 'surface');
    mapStore.worldDatabase.set(demoDb);
    mapStore.setViewMode('db');

    await service.initialize(mockMap);

    mockMap.getZoom = () => 5.0; // Zoomed out to regional/macro tier
    service.updateTreeSprites();

    const source = mockMap.getSource(TREE_SPRITES_SOURCE_ID);
    expect(source.data.features.length).toBe(0);
    expect(mockLayers[TREE_SPRITES_LAYER_ID].layout.visibility).toBe('none');
  });

  it('hides and clears features when treeSpritesEnabled is toggled off', async () => {
    mapStore.terrain3dEnabled.set(true);
    const demoDb = buildDemoWorldDatabase(424242, 'surface');
    mapStore.worldDatabase.set(demoDb);
    mapStore.setViewMode('db');

    await service.initialize(mockMap);

    mapStore.setTreeSpritesEnabled(false);
    service.updateTreeSprites();

    const source = mockMap.getSource(TREE_SPRITES_SOURCE_ID);
    expect(source.data.features.length).toBe(0);
    expect(mockLayers[TREE_SPRITES_LAYER_ID].layout.visibility).toBe('none');
  });

  it('extracts and renders true tree anchors with scale in DB Mode', async () => {
    mapStore.terrain3dEnabled.set(true);
    const demoDb = buildDemoWorldDatabase(424242, 'surface');
    mapStore.worldDatabase.set(demoDb);
    mapStore.setViewMode('db');

    await service.initialize(mockMap);
    service.updateTreeSprites();
    const source = mockMap.getSource(TREE_SPRITES_SOURCE_ID);

    expect(source.data.features.length).toBeGreaterThan(0);
    const hasTree = source.data.features.some(
      (f: any) =>
        f.properties.saplingKey.includes('tree') ||
        f.properties.saplingKey.includes('cactus') ||
        f.properties.saplingKey.includes('coral_bones')
    );
    expect(hasTree).toBe(true);

    const firstFeature = source.data.features[0];
    expect(firstFeature.properties.scale).toBeGreaterThanOrEqual(1.0);
  });

  it('extracts and clusters surface decorations and farming crops with compact scale (0.5..0.75) under the Trees toggle', async () => {
    mapStore.terrain3dEnabled.set(true);
    const demoDb = buildDemoWorldDatabase(424242, 'surface');
    const blockSurfaces = demoDb.blockSurfaces!;
    const macroMipmap = demoDb.macroMipmap!;
    blockSurfaces.clear();

    // Create a MapBlock at (0,0,0) with:
    // - 1 isolated red rose at (2, 2)
    // - a 3x3 wheat patch around (8..10, 8..10) -> should cluster into 1 anchor with scale 0.75
    // - basic grass blades at (14, 14) -> should be ignored
    const columns = [
      {
        localX: 2,
        localZ: 2,
        topLocalY: 5,
        groundLocalY: 4,
        contiguousSpan: 1,
        hasAirGapBelow: false,
        nodeName: 'flowers:rose',
        waterCount: 0
      },
      {
        localX: 14,
        localZ: 14,
        topLocalY: 5,
        groundLocalY: 4,
        contiguousSpan: 1,
        hasAirGapBelow: false,
        nodeName: 'default:grass_3',
        waterCount: 0
      }
    ];
    for (let lz = 8; lz <= 10; lz++) {
      for (let lx = 8; lx <= 10; lx++) {
        columns.push({
          localX: lx,
          localZ: lz,
          topLocalY: 5,
          groundLocalY: 4,
          contiguousSpan: 1,
          hasAirGapBelow: false,
          nodeName: 'farming:wheat_8',
          waterCount: 0
        });
      }
    }

    mergeParsedBlockIntoCompactSurface(
      {
        posKey: '0,0,0',
        blockX: 0,
        blockY: 0,
        blockZ: 0,
        version: 29,
        nodeMapping: {},
        columns
      },
      -31000,
      31000,
      blockSurfaces,
      macroMipmap,
      demoDb.nodeCounts
    );

    const blk = blockSurfaces.get('0,0');
    expect(blk?.treeAnchors).toBeDefined();
    expect(blk?.treeAnchors?.length).toBe(2);

    const roseAnchor = blk?.treeAnchors?.find(a => a.saplingKey === 'flowers:rose');
    const wheatAnchor = blk?.treeAnchors?.find(a => a.saplingKey === 'farming:wheat');
    expect(roseAnchor?.scale).toBe(0.5);
    expect(wheatAnchor?.scale).toBe(0.75);

    mapStore.worldDatabase.set(demoDb);
    mapStore.setViewMode('db');

    await service.initialize(mockMap);
    service.updateTreeSprites();

    const source = mockMap.getSource(TREE_SPRITES_SOURCE_ID);
    expect(source.data.features.length).toBe(2);
    expect(source.data.features.some((f: any) => f.properties.saplingKey === 'flowers:rose')).toBe(true);
    expect(source.data.features.some((f: any) => f.properties.saplingKey === 'farming:wheat')).toBe(true);
  });

  it('renders large forests symmetrically across both sides of the camera without one-sided clipping', async () => {
    mapStore.terrain3dEnabled.set(true);
    const demoDb = buildDemoWorldDatabase(424242, 'surface');
    const blockSurfaces = demoDb.blockSurfaces!;
    blockSurfaces.clear();

    // Populate a forest spanning negative X (-5..-1) and positive X (1..5) around camera center (0, 0)
    for (let bx = -5; bx <= 5; bx++) {
      for (let bz = -5; bz <= 5; bz++) {
        const topY = new Int16Array(256).fill(10);
        blockSurfaces.set(`${bx},${bz}`, {
          bx,
          bz,
          avgY: 10,
          rgb: new Uint8Array(256 * 3),
          topY,
          waterDepth: new Uint8Array(256),
          treeAnchors: [
            { lx: 4, lz: 4, y: 10, saplingKey: 'default:tree', scale: 1.0 },
            { lx: 12, lz: 12, y: 10, saplingKey: 'default:pine_tree', scale: 1.2 }
          ]
        });
      }
    }

    mapStore.worldDatabase.set(demoDb);
    mapStore.setViewMode('db');

    await service.initialize(mockMap);
    service.updateTreeSprites();

    const source = mockMap.getSource(TREE_SPRITES_SOURCE_ID);
    expect(source.data.features.length).toBeGreaterThan(0);

    // Verify trees exist on both the negative X side (west) and positive X side (east)
    const westTrees = source.data.features.filter((f: any) => {
      const [lng] = f.geometry.coordinates;
      return lng < 0;
    });
    const eastTrees = source.data.features.filter((f: any) => {
      const [lng] = f.geometry.coordinates;
      return lng > 0;
    });

    // 5 negative blocks (-5..-1) * 11 bz rows * 2 trees = 110 west trees
    // 6 non-negative blocks (0..5) * 11 bz rows * 2 trees = 132 east trees
    expect(westTrees.length).toBe(110);
    expect(eastTrees.length).toBe(132);
  });

  it('supports high tree capacity exceeding the previous 3500 limit for dense forests (up to 14000)', async () => {
    mapStore.terrain3dEnabled.set(true);
    const demoDb = buildDemoWorldDatabase(424242, 'surface');
    const blockSurfaces = demoDb.blockSurfaces!;
    blockSurfaces.clear();

    // Populate a dense forest with 20x20 = 400 blocks, each having 12 trees = 4800 trees!
    for (let bx = -10; bx < 10; bx++) {
      for (let bz = -10; bz < 10; bz++) {
        const anchors: any[] = [];
        for (let t = 0; t < 12; t++) {
          anchors.push({
            lx: (t * 5) % 16,
            lz: Math.floor((t * 5) / 16) * 4 + 2,
            y: 10,
            saplingKey: 'default:tree',
            scale: 1.0
          });
        }
        blockSurfaces.set(`${bx},${bz}`, {
          bx,
          bz,
          avgY: 10,
          rgb: new Uint8Array(256 * 3),
          topY: new Int16Array(256).fill(10),
          waterDepth: new Uint8Array(256),
          treeAnchors: anchors
        });
      }
    }

    mapStore.worldDatabase.set(demoDb);
    mapStore.setViewMode('db');

    await service.initialize(mockMap);
    service.updateTreeSprites();

    const source = mockMap.getSource(TREE_SPRITES_SOURCE_ID);
    // Must render well beyond the old 3,500 limit!
    expect(source.data.features.length).toBeGreaterThan(3500);
    expect(source.data.features.length).toBeLessThanOrEqual(14000);
  });

  it('preserves tall surface trees (> 14 nodes tall) like pine trees and sequoias without culling', async () => {
    mapStore.terrain3dEnabled.set(true);
    const demoDb = buildDemoWorldDatabase(424242, 'surface');
    const blockSurfaces = demoDb.blockSurfaces!;
    blockSurfaces.clear();

    // Create a tall tree whose canopy top is 22 blocks above the base anchor
    const topY = new Int16Array(256).fill(10);
    topY[(8 << 4) | 8] = 32; // Canopy top is at Y = 32, trunk base is at Y = 10 (height = 22)

    blockSurfaces.set('0,0', {
      bx: 0,
      bz: 0,
      avgY: 12,
      rgb: new Uint8Array(256 * 3),
      topY,
      waterDepth: new Uint8Array(256),
      treeAnchors: [
        { lx: 8, lz: 8, y: 10, saplingKey: 'default:pine_tree', scale: 1.4 }
      ]
    });

    mapStore.worldDatabase.set(demoDb);
    mapStore.setViewMode('db');

    await service.initialize(mockMap);
    service.updateTreeSprites();

    const source = mockMap.getSource(TREE_SPRITES_SOURCE_ID);
    expect(source.data.features.length).toBe(1);
    expect(source.data.features[0].properties.saplingKey).toBe('default:pine_tree');
  });

  it('sorts candidate blocks radially so camera center is populated first', async () => {
    mapStore.terrain3dEnabled.set(true);
    const demoDb = buildDemoWorldDatabase(424242, 'surface');
    const blockSurfaces = demoDb.blockSurfaces!;
    blockSurfaces.clear();

    // Block at origin (close) and block at (3,3) (further away, but within mock viewport)
    blockSurfaces.set('0,0', {
      bx: 0,
      bz: 0,
      avgY: 10,
      rgb: new Uint8Array(256 * 3),
      topY: new Int16Array(256).fill(10),
      waterDepth: new Uint8Array(256),
      treeAnchors: [{ lx: 8, lz: 8, y: 10, saplingKey: 'default:tree', scale: 1.0 }]
    });

    blockSurfaces.set('3,3', {
      bx: 3,
      bz: 3,
      avgY: 10,
      rgb: new Uint8Array(256 * 3),
      topY: new Int16Array(256).fill(10),
      waterDepth: new Uint8Array(256),
      treeAnchors: [{ lx: 8, lz: 8, y: 10, saplingKey: 'default:pine_tree', scale: 1.0 }]
    });

    mapStore.worldDatabase.set(demoDb);
    mapStore.setViewMode('db');

    mockMap.getCenter = () => ({ lng: 0, lat: 0 });

    await service.initialize(mockMap);
    service.updateTreeSprites();

    const source = mockMap.getSource(TREE_SPRITES_SOURCE_ID);
    expect(source.data.features.length).toBe(2);
    // The closest block (0,0 with default:tree) must be processed first before (3,3 with default:pine_tree)
    expect(source.data.features[0].properties.saplingKey).toBe('default:tree');
    expect(source.data.features[1].properties.saplingKey).toBe('default:pine_tree');
  });
});

