import { Injectable, inject } from '@angular/core';
import type maplibregl from 'maplibre-gl';
import { MapStore } from '../state/map.store';
import { CoordProjectionService } from './coord-projection.service';
import { isDecorationOrCropKey, loadAndRegisterSaplingTextures } from '../data/sapling-registry';

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
    // Place below luanti-3d-buildings-layer so 3D building walls properly occlude billboard trees behind them
    if (!map.getLayer(TREE_SPRITES_LAYER_ID)) {
      const beforeId = map.getLayer('luanti-3d-buildings-layer')
        ? 'luanti-3d-buildings-layer'
        : undefined;
      map.addLayer(
        {
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
        },
        beforeId
      );
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

    // Use map.getBounds() which is natively clipped against the 3D horizon in MapLibre GL
    // so rays above the horizon never invert behind the camera.
    const bounds = this.map.getBounds();
    const sw = this.projection.lngLatToLuanti(bounds.getWest(), bounds.getSouth());
    const ne = this.projection.lngLatToLuanti(bounds.getEast(), bounds.getNorth());

    let rawMinX = Math.floor(Math.min(sw.x, ne.x));
    let rawMaxX = Math.ceil(Math.max(sw.x, ne.x));
    let rawMinZ = Math.floor(Math.min(sw.z, ne.z));
    let rawMaxZ = Math.ceil(Math.max(sw.z, ne.z));

    const center = this.map.getCenter ? this.map.getCenter() : { lng: 0, lat: 0 };
    const luantiCenter = this.projection.lngLatToLuanti(center.lng, center.lat);
    const centerBx = Math.floor(luantiCenter.x / 16);
    const centerBz = Math.floor(luantiCenter.z / 16);

    // Fallback if bounds are non-finite
    if (!Number.isFinite(rawMinX) || !Number.isFinite(rawMaxX) || !Number.isFinite(rawMinZ) || !Number.isFinite(rawMaxZ)) {
      rawMinX = luantiCenter.x - 1000;
      rawMaxX = luantiCenter.x + 1000;
      rawMinZ = luantiCenter.z - 1000;
      rawMaxZ = luantiCenter.z + 1000;
    }

    // Safety margin to guarantee smooth panning and prevent pop-in at viewport borders
    const MARGIN = 48; // 3 MapBlocks
    const minX = rawMinX - MARGIN;
    const maxX = rawMaxX + MARGIN;
    const minZ = rawMinZ - MARGIN;
    const maxZ = rawMaxZ + MARGIN;

    // Camera-centered symmetrical clamping prevents one-sided cutoffs when viewing wide/pitched horizons
    const MAX_RADIUS_BLOCKS = 140; // ~2240 Luanti nodes in all directions from camera center
    const minBx = Math.max(Math.floor(minX / 16), centerBx - MAX_RADIUS_BLOCKS);
    const maxBx = Math.min(Math.ceil(maxX / 16), centerBx + MAX_RADIUS_BLOCKS);
    const minBz = Math.max(Math.floor(minZ / 16), centerBz - MAX_RADIUS_BLOCKS);
    const maxBz = Math.min(Math.ceil(maxZ / 16), centerBz + MAX_RADIUS_BLOCKS);

    const minCoordX = minBx * 16;
    const maxCoordX = (maxBx + 1) * 16;
    const minCoordZ = minBz * 16;
    const maxCoordZ = (maxBz + 1) * 16;

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

    const MAX_VISIBLE_TREES = 14000;
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

      // Collect all MapBlocks inside bounds that have tree anchors
      const candidateBlocks: Array<{ bx: number; bz: number; distSq: number }> = [];
      for (let bz = minBz; bz <= maxBz; bz++) {
        for (let bx = minBx; bx <= maxBx; bx++) {
          const blk = blockSurfaces.get(`${bx},${bz}`);
          if (blk?.treeAnchors && blk.treeAnchors.length > 0) {
            const dx = bx - centerBx;
            const dz = bz - centerBz;
            candidateBlocks.push({ bx, bz, distSq: dx * dx + dz * dz });
          }
        }
      }

      // Sort candidate blocks radially outward from camera center so the center and foreground
      // are ALWAYS populated with 100% density, never cutting off asymmetrically!
      candidateBlocks.sort((a, b) => a.distSq - b.distSq);

      for (let cIdx = 0; cIdx < candidateBlocks.length; cIdx++) {
        if (features.length >= MAX_VISIBLE_TREES) break;

        const { bx, bz } = candidateBlocks[cIdx];
        const blk = blockSurfaces.get(`${bx},${bz}`);
        const anchors = blk?.treeAnchors;
        if (!blk || !anchors || anchors.length === 0) continue;

        for (let i = 0; i < anchors.length; i++) {
          if (features.length >= MAX_VISIBLE_TREES) break;

          const a = anchors[i];
          const cellIdx = (a.lz << 4) | a.lx;
          if (
            blk.extrusionKind &&
            blk.extrusionKind[cellIdx] === 1 &&
            (!blk.extrusionSpan || blk.extrusionSpan[cellIdx] >= 2)
          ) {
            continue;
          }
          // Tolerate tall tree canopies (up to 36 nodes above base) while culling underground cave trees
          if (blk.topY[cellIdx] > a.y + 36) {
            continue;
          }

          const wx = bx * 16 + a.lx;
          const wz = bz * 16 + a.lz;

          if (wx < minCoordX || wx > maxCoordX || wz < minCoordZ || wz > maxCoordZ) continue;

          const isDecoOrCrop = isDecorationOrCropKey(a.saplingKey);
          const giant = !isDecoOrCrop && isGiant(a.saplingKey);
          const mergeRadius = isDecoOrCrop ? 2 : giant ? 5 : 3;

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
