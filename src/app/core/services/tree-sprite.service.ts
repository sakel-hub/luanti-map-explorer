import { Injectable, inject } from '@angular/core';
import type maplibregl from 'maplibre-gl';
import { MapStore } from '../state/map.store';
import { CoordProjectionService } from './coord-projection.service';
import { loadAndRegisterSaplingTextures } from '../data/sapling-registry';

export const TREE_SPRITES_SOURCE_ID = 'luanti-trees';
export const TREE_SPRITES_LAYER_ID = 'luanti-trees-layer';

@Injectable({
  providedIn: 'root'
})
export class TreeSpriteService {
  constructor(
    private readonly mapStore: MapStore = inject(MapStore),
    private readonly projection: CoordProjectionService = inject(CoordProjectionService)
  ) {}

  private map: maplibregl.Map | null = null;
  private texturesLoaded = false;
  private layerAdded = false;
  private hasActiveFeatures = false;

  /**
   * Initializes the tree sprites layer and registers authentic voxel tree textures into MapLibre.
   */
  public async initialize(map: maplibregl.Map): Promise<void> {
    this.map = map;
    this.layerAdded = false;

    // 1. Ensure GeoJSON source exists
    if (!map.getSource(TREE_SPRITES_SOURCE_ID)) {
      map.addSource(TREE_SPRITES_SOURCE_ID, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      });
    }

    // 2. Ensure symbol layer exists with camera-facing viewport alignment and scaling
    if (!map.getLayer(TREE_SPRITES_LAYER_ID)) {
      map.addLayer({
        id: TREE_SPRITES_LAYER_ID,
        type: 'symbol',
        source: TREE_SPRITES_SOURCE_ID,
        minzoom: 6.5,
        layout: {
          'icon-image': ['get', 'saplingKey'],
          'icon-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            6.5,
            ['*', ['coalesce', ['get', 'scale'], 1.0], 0.4],
            8.0,
            ['*', ['coalesce', ['get', 'scale'], 1.0], 0.65],
            10.0,
            ['*', ['coalesce', ['get', 'scale'], 1.0], 1.0],
            12.0,
            ['*', ['coalesce', ['get', 'scale'], 1.0], 1.35],
            14.0,
            ['*', ['coalesce', ['get', 'scale'], 1.0], 1.75]
          ] as any,
          'icon-pitch-alignment': 'viewport',
          'icon-rotation-alignment': 'viewport',
          'icon-anchor': 'bottom',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true
        },
        paint: {
          'icon-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            6.5,
            0.0,
            7.0,
            1.0
          ]
        }
      });
      this.layerAdded = true;
    }

    // 3. Register tree textures and composite billboards
    await loadAndRegisterSaplingTextures(map);

    this.updateTreeSprites();
  }

  /**
   * Updates tree billboard sprites within the active 3D camera frustum.
   * Tree sprites are displayed ONLY in 3D perspective mode and ONLY for real SQLite DB map blocks.
   */
  public updateTreeSprites(): void {
    if (!this.map) return;
    const source = this.map.getSource(TREE_SPRITES_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    const zoom = this.map.getZoom();
    const is3d = this.mapStore.terrain3dEnabled();
    const enabled = this.mapStore.treeSpritesEnabled() && is3d && zoom >= 6.5;

    // Toggle layer visibility
    if (this.map.getLayer(TREE_SPRITES_LAYER_ID)) {
      this.map.setLayoutProperty(
        TREE_SPRITES_LAYER_ID,
        'visibility',
        enabled ? 'visible' : 'none'
      );
    }

    if (!enabled) {
      if (this.hasActiveFeatures) {
        this.hasActiveFeatures = false;
        source.setData({
          type: 'FeatureCollection',
          features: []
        });
      }
      return;
    }

    const canvas = this.map.getCanvas?.();
    const w = canvas?.width || 800;
    const h = canvas?.height || 600;

    const samplePoints: Array<[number, number]> = [
      [0, 0],
      [w, 0],
      [w, h],
      [0, h],
      [w / 2, 0],
      [w / 2, h / 2],
      [w / 2, h]
    ];

    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    for (const [px, py] of samplePoints) {
      try {
        const lngLat = this.map.unproject([px, py]);
        const pt = this.projection.lngLatToLuanti(lngLat.lng, lngLat.lat);
        if (Number.isFinite(pt.x) && Number.isFinite(pt.z)) {
          minX = Math.min(minX, pt.x);
          maxX = Math.max(maxX, pt.x);
          minZ = Math.min(minZ, pt.z);
          maxZ = Math.max(maxZ, pt.z);
        }
      } catch {
        // Fallback for extreme horizon projections
      }
    }

    if (!Number.isFinite(minX) || !Number.isFinite(maxX)) {
      const bounds = this.map.getBounds();
      const sw = this.projection.lngLatToLuanti(bounds.getWest(), bounds.getSouth());
      const ne = this.projection.lngLatToLuanti(bounds.getEast(), bounds.getNorth());
      minX = Math.floor(Math.min(sw.x, ne.x));
      maxX = Math.ceil(Math.max(sw.x, ne.x));
      minZ = Math.floor(Math.min(sw.z, ne.z));
      maxZ = Math.ceil(Math.max(sw.z, ne.z));
    }

    // Safety margin to guarantee smooth panning and prevent pop-in at viewport borders
    const MARGIN = 48; // 3 MapBlocks
    minX -= MARGIN;
    maxX += MARGIN;
    minZ -= MARGIN;
    maxZ += MARGIN;

    const minBx = Math.floor(minX / 16);
    const maxBx = Math.ceil(maxX / 16);
    const minBz = Math.floor(minZ / 16);
    const maxBz = Math.ceil(maxZ / 16);

    const maxFrustumSpan = 160;
    const clampedMaxBx = Math.min(maxBx, minBx + maxFrustumSpan);
    const clampedMaxBz = Math.min(maxBz, minBz + maxFrustumSpan);

    const maxCoordX = (clampedMaxBx + 1) * 16;
    const maxCoordZ = (clampedMaxBz + 1) * 16;

    const features: Array<{
      type: 'Feature';
      properties: {
        saplingKey: string;
        scale: number;
      };
      geometry: {
        type: 'Point';
        coordinates: [number, number];
      };
    }> = [];

    const MAX_VISIBLE_TREES = 3500;
    const viewMode = this.mapStore.viewMode();
    const db = this.mapStore.worldDatabase();
    const blockSurfaces = db?.blockSurfaces;

    // Only real DB map blocks have tree sprites; seed mode does not generate sprite trees
    if (viewMode !== 'seed' && blockSurfaces && blockSurfaces.size > 0) {
      // Spatial grid for deduplication across MapBlock borders
      // Cell size: 4 Luanti blocks
      const spatialGrid = new Map<string, { wx: number; wz: number; saplingKey: string; scale: number; featureIdx: number }>();
      const CELL_SIZE = 4;

      const isGiant = (key: string) =>
        key.includes('coral_bones') ||
        key.includes('sequoia') ||
        key.includes('baobab') ||
        key.includes('redwood') ||
        key.includes('emergent') ||
        key.includes('big_tree');

      for (let bz = minBz; bz <= clampedMaxBz; bz++) {
        for (let bx = minBx; bx <= clampedMaxBx; bx++) {
          if (features.length >= MAX_VISIBLE_TREES) break;

          const blk = blockSurfaces.get(`${bx},${bz}`);
          if (!blk || !blk.treeAnchors || blk.treeAnchors.length === 0) continue;

          for (let i = 0; i < blk.treeAnchors.length; i++) {
            if (features.length >= MAX_VISIBLE_TREES) break;

            const a = blk.treeAnchors[i];
            const wx = bx * 16 + a.lx;
            const wz = bz * 16 + a.lz;

            if (wx < minX || wx > maxCoordX || wz < minZ || wz > maxCoordZ) continue;

            const giant = isGiant(a.saplingKey);
            const mergeRadius = giant ? 5 : 3;

            // Check spatial grid in neighboring cells
            const cx = Math.floor(wx / CELL_SIZE);
            const cz = Math.floor(wz / CELL_SIZE);
            const searchCellRange = giant ? 2 : 1;
            let merged = false;

            for (let dcx = -searchCellRange; dcx <= searchCellRange && !merged; dcx++) {
              for (let dcz = -searchCellRange; dcz <= searchCellRange && !merged; dcz++) {
                const cellKey = `${cx + dcx},${cz + dcz}`;
                const neighbor = spatialGrid.get(cellKey);
                if (
                  neighbor &&
                  neighbor.saplingKey === a.saplingKey &&
                  Math.abs(neighbor.wx - wx) <= mergeRadius &&
                  Math.abs(neighbor.wz - wz) <= mergeRadius
                ) {
                  merged = true;
                  const newScale = Math.max(neighbor.scale, a.scale ?? 1.0);
                  neighbor.scale = newScale;
                  features[neighbor.featureIdx].properties.scale = newScale;
                }
              }
            }

            if (merged) continue;

            const [lng, lat] = this.projection.luantiToLngLat(wx, wz);
            const featureIdx = features.length;
            const scale = a.scale ?? 1.0;

            features.push({
              type: 'Feature',
              properties: {
                saplingKey: a.saplingKey,
                scale
              },
              geometry: {
                type: 'Point',
                coordinates: [lng, lat]
              }
            });

            spatialGrid.set(`${cx},${cz}`, {
              wx,
              wz,
              saplingKey: a.saplingKey,
              scale,
              featureIdx
            });
          }
        }
      }
    }

    this.hasActiveFeatures = features.length > 0;
    source.setData({
      type: 'FeatureCollection',
      features
    });
  }

  /**
   * Resets active features on map reload or style reset.
   */
  public reset(): void {
    this.hasActiveFeatures = false;
    this.layerAdded = false;
    this.texturesLoaded = false;
  }
}
