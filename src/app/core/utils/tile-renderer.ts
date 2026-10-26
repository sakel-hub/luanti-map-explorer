import {
  CompactBlockSurface,
  MacroMipmapCell,
  MapgenType,
  NoiseParams,
  ParsedColumnSurface,
  ViewMode
} from '../models/world.model';
import { BiomeDefinition } from '../models/biome.model';
import { DEFAULT_LUANTI_BIOMES, resolveBiomeForDbNode } from '../data/default-biomes';
import { resolveNodeNameFromExactColor } from './mapblock-parser';
import { LuantiWorldSynthesizer, sampleMipmapClimateAnchor } from './perlin-noise';
import { encodeRgbaToPngBuffer } from './png-encoder';

export interface TileRenderJobPayload {
  jobId: number;
  zoom?: number;
  tileKind: 'color' | 'terrain-dem';
  tileSize: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  seed: number;
  mapgen: MapgenType;
  waterLevel: number;
  heatNoise: NoiseParams;
  humidityNoise: NoiseParams;
  terrainNoise: NoiseParams;
  viewMode: ViewMode;
  hypsometricMode: boolean;
  hillshadeEnabled: boolean;
  voronoiContoursEnabled: boolean;
  exploredBoundsEnabled: boolean;
  isolatedBiomeId: string | null;
  sliceMinY?: number;
  sliceMaxY?: number;
  caveMode?: boolean;
  customBiomes?: BiomeDefinition[];
}

/**
 * Maps a Luanti elevation Y (-32..140 or relative slice height) to a vivid topographic hypsometric RGB color ramp.
 */
function elevationToHypsometricRgb(elev: number, waterLevel: number): [number, number, number] {
  if (elev < waterLevel) {
    const depth = Math.min(40, waterLevel - elev);
    const t = depth / 40;
    return [
      Math.round(30 * (1 - t) + 8 * t),
      Math.round(130 * (1 - t) + 35 * t),
      Math.round(230 * (1 - t) + 110 * t)
    ];
  }

  const rel = elev - waterLevel;
  if (rel < 6) {
    const t = rel / 6;
    return [
      Math.round(230 * (1 - t) + 74 * t),
      Math.round(210 * (1 - t) + 185 * t),
      Math.round(135 * (1 - t) + 82 * t)
    ];
  }
  if (rel < 28) {
    const t = (rel - 6) / 22;
    return [
      Math.round(74 * (1 - t) + 195 * t),
      Math.round(185 * (1 - t) + 175 * t),
      Math.round(82 * (1 - t) + 68 * t)
    ];
  }
  if (rel < 58) {
    const t = (rel - 28) / 30;
    return [
      Math.round(195 * (1 - t) + 148 * t),
      Math.round(175 * (1 - t) + 102 * t),
      Math.round(68 * (1 - t) + 78 * t)
    ];
  }
  const t = Math.min(1, (rel - 58) / 35);
  return [
    Math.round(148 * (1 - t) + 245 * t),
    Math.round(102 * (1 - t) + 248 * t),
    Math.round(78 * (1 - t) + 255 * t)
  ];
}

interface SampledDbPixel {
  r: number;
  g: number;
  b: number;
  topY: number;
  waterDepth: number;
  nodeName: string;
}

/**
 * Multi-Resolution Google Maps-style lookup across Tier 1/2 (Compact 16x16 Block Cache)
 * and Tier 0 (Global 4x4 Block Mipmap Pyramid).
 */
function sampleDbHierarchy(
  worldX: number,
  worldZ: number,
  stepX: number,
  blockSurfaces: Map<string, CompactBlockSurface> | null | undefined,
  macroMipmap: Map<string, MacroMipmapCell> | null | undefined,
  dbColumns: Map<string, ParsedColumnSurface> | null | undefined
): SampledDbPixel | null {
  const bx = worldX >> 4;
  const bz = worldZ >> 4;

  // 1. Check Tier 1 & 2 Compact 16x16 Block Surface Cache (O(1) TypedArray lookup)
  if (blockSurfaces && blockSurfaces.size > 0) {
    const blk = blockSurfaces.get(`${bx},${bz}`);
    if (blk) {
      // When viewing in World 4x4, Region 2x2, or Sector 1x1 (camera zoom < 6.0, tile z <= 7, stepX >= 4.0),
      // use precomputed 1x1 MapBlock average so the entire viewport renders at uniform block resolution!
      if (stepX >= 4.0 && blk.avgY > -32768) {
        const exactMip = macroMipmap?.get(`b:${bx},${bz}`);
        return {
          r: blk.avgColor[0],
          g: blk.avgColor[1],
          b: blk.avgColor[2],
          topY: blk.avgY,
          waterDepth: exactMip ? exactMip.waterDepth : blk.waterDepth[((worldZ & 15) << 4) | (worldX & 15)],
          nodeName: blk.dominantNode
        };
      }
      const lx = worldX & 15;
      const lz = worldZ & 15;
      const cellIdx = (lz << 4) | lx;
      const y = blk.topY[cellIdx];
      if (y > -32768) {
        const cOff = cellIdx * 3;
        return {
          r: blk.rgb[cOff],
          g: blk.rgb[cOff + 1],
          b: blk.rgb[cOff + 2],
          topY: y,
          waterDepth: blk.waterDepth[cellIdx],
          nodeName: blk.dominantNode
        };
      }
    }
  }

  // 2. Check Overview Mipmap Pyramid:
  // - `b:${bx},${bz}` is an exact 1x1 explored MapBlock (never bleeds into unexplored neighbors).
  // - `${bx >> 1},${bz >> 1}` is a 2x2 MapBlock coarse overview sample; only use it when the
  //   surrounding 2x2 group has NOT already been decoded into `blockSurfaces` (so 2x2 mipmaps
  //   never bleed into unexplored blocks along the border of an explored 5x5 MapChunk!).
  // - `m4:${bx >> 2},${bz >> 2}` is a 4x4 MapBlock (64x64 node) ultra-coarse overview sample
  //   used during stride=4 whole-world streaming.
  if (macroMipmap && macroMipmap.size > 0) {
    const exactMip = macroMipmap.get(`b:${bx},${bz}`);
    if (exactMip) {
      return {
        r: exactMip.r,
        g: exactMip.g,
        b: exactMip.b,
        topY: exactMip.y,
        waterDepth: exactMip.waterDepth,
        nodeName: exactMip.nodeName
      };
    }

    const siblingDecodedInHighRes =
      stepX < 2.0 &&
      (blockSurfaces?.has(`${bx ^ 1},${bz}`) ||
        blockSurfaces?.has(`${bx},${bz ^ 1}`) ||
        blockSurfaces?.has(`${bx ^ 1},${bz ^ 1}`));

    if (!siblingDecodedInHighRes) {
      const coarseMip = macroMipmap.get(`${bx >> 1},${bz >> 1}`);
      if (coarseMip) {
        return {
          r: coarseMip.r,
          g: coarseMip.g,
          b: coarseMip.b,
          topY: coarseMip.y,
          waterDepth: coarseMip.waterDepth,
          nodeName: coarseMip.nodeName
        };
      }

      // Fallback to 4x4 MapBlock (64x64 node) mipmap cell whenever the 2x2 quadrant is not yet decoded
      // (prevents 1-in-4 polka-dot checkerboard gaps when zooming in before stride=2/1 refinement completes!)
      const m4Mip = macroMipmap.get(`m4:${bx >> 2},${bz >> 2}`);
      if (m4Mip) {
        return {
          r: m4Mip.r,
          g: m4Mip.g,
          b: m4Mip.b,
          topY: m4Mip.y,
          waterDepth: m4Mip.waterDepth,
          nodeName: m4Mip.nodeName
        };
      }
    }
  }

  // 3. Fallback to direct column map (Demo DB / Unit Tests)
  if (dbColumns && dbColumns.size > 0) {
    const col = dbColumns.get(`${worldX},${worldZ}`);
    if (col) {
      return {
        r: col.color[0],
        g: col.color[1],
        b: col.color[2],
        topY: col.topY,
        waterDepth: col.waterDepth,
        nodeName: col.nodeName
      };
    }
  }

  return null;
}

let cachedSynthKey = '';
let cachedSynth: LuantiWorldSynthesizer | null = null;

function getOrCreateSynthesizer(job: TileRenderJobPayload): LuantiWorldSynthesizer {
  const biomeSig = job.customBiomes
    ? job.customBiomes.map(b => `${b.id}:${b.heatPoint}:${b.humidityPoint}`).join('|')
    : 'default';
  const key = `${job.seed}:${job.mapgen}:${job.waterLevel}:${job.heatNoise.spread[0]}:${job.humidityNoise.spread[0]}:${biomeSig}`;
  if (cachedSynth && cachedSynthKey === key) {
    return cachedSynth;
  }
  cachedSynthKey = key;
  cachedSynth = new LuantiWorldSynthesizer(
    job.seed,
    job.mapgen,
    job.waterLevel,
    job.heatNoise,
    job.humidityNoise,
    job.terrainNoise,
    job.customBiomes
  );
  return cachedSynth;
}

/**
 * Pure tile synthesizer shared between Web Workers and fallback threads.
 */
export function renderTilePngBuffer(
  job: TileRenderJobPayload,
  dbColumns: Map<string, ParsedColumnSurface> | null,
  exploredBlocks?: Set<string> | null,
  blockSurfaces?: Map<string, CompactBlockSurface> | null,
  macroMipmap?: Map<string, MacroMipmapCell> | null
): ArrayBuffer {
  const size = job.tileSize;
  const rgba = new Uint8Array(size * size * 4);
  const synth = getOrCreateSynthesizer(job);

  const spanX = job.maxX - job.minX;
  const spanZ = job.maxZ - job.minZ;
  const stepX = spanX / size;
  const stepZ = spanZ / size;

  const sliceMinY = job.sliceMinY ?? -16;
  const sliceMaxY = job.sliceMaxY ?? 240;
  const isNonSurfaceSlice = sliceMinY >= 200 || sliceMaxY < 0 || !!job.caveMode;

  if (job.tileKind === 'terrain-dem') {
    const METERS_PER_NODE = 520;

    const sampleElev = (wx: number, wz: number): number => {
      const rx = Math.floor(wx);
      const rz = Math.floor(wz);
      const dbSample = sampleDbHierarchy(rx, rz, stepX, blockSurfaces, macroMipmap, dbColumns);

      if (isNonSurfaceSlice && job.viewMode !== 'seed') {
        if (dbSample) {
          return Math.max(0, Math.min(180, dbSample.topY - sliceMinY));
        }
        return 0;
      }
      if (dbSample && (job.viewMode === 'db' || job.viewMode === 'hybrid')) {
        return Math.max(job.waterLevel, dbSample.topY);
      }
      if (job.viewMode === 'db') {
        return job.waterLevel;
      }
      return Math.max(job.waterLevel, synth.evaluateElevation(rx, rz));
    };

    const baseLevel = isNonSurfaceSlice && job.viewMode !== 'seed' ? 0 : job.waterLevel;

    for (let py = 0; py < size; py++) {
      const wz = job.maxZ - (py + 0.5) * stepZ;
      for (let px = 0; px < size; px++) {
        const wx = job.minX + (px + 0.5) * stepX;

        // Avoid 5-tap cross filter when zoomed in close (stepX < 1) or zoomed out to pre-averaged mipmaps (stepX >= 16)
        let smoothElev: number;
        if (stepX < 1.0 || stepX >= 16.0) {
          smoothElev = sampleElev(wx, wz);
        } else {
          const c = sampleElev(wx, wz);
          const l = sampleElev(wx - stepX * 0.5, wz);
          const rgt = sampleElev(wx + stepX * 0.5, wz);
          const u = sampleElev(wx, wz + stepZ * 0.5);
          const d = sampleElev(wx, wz - stepZ * 0.5);
          smoothElev = c * 0.4 + (l + rgt + u + d) * 0.15;
        }

        const relativeHeight = Math.max(0, smoothElev - baseLevel);
        const mercatorMeters = relativeHeight * METERS_PER_NODE;

        const encoded = Math.max(0, Math.min(16777215, Math.round((mercatorMeters + 10000) * 10)));
        const r = (encoded >> 16) & 0xff;
        const g = (encoded >> 8) & 0xff;
        const b = encoded & 0xff;

        const idx = (py * size + px) * 4;
        rgba[idx] = r;
        rgba[idx + 1] = g;
        rgba[idx + 2] = b;
        rgba[idx + 3] = 255;
      }
    }
    return encodeRgbaToPngBuffer(size, size, rgba);
  }

  // Color Map Tile ('seed', 'db', or 'hybrid')
  const sampleStep = Math.max(1, Math.round(stepX));
  const macroStep = Math.max(3, Math.round(stepX * 3));
  const isCloseUpVoxelZoom = stepX <= 0.35; // 1 Luanti node >= 3 tile pixels wide

  // Precompute a 9x9 per-tile SQLite Climate Anchor Grid in Hybrid mode so unexplored background
  // biomes seamlessly match the adjacent explored SQLite terrain without per-pixel mipmap scans.
  const GRID_N = 9;
  const activeBiomes = job.customBiomes || DEFAULT_LUANTI_BIOMES;
  let anchorHeatGrid: Float32Array | null = null;
  let anchorHumGrid: Float32Array | null = null;
  let anchorBlendGrid: Float32Array | null = null;

  if (job.viewMode === 'hybrid' && !isNonSurfaceSlice && macroMipmap && macroMipmap.size > 0) {
    anchorHeatGrid = new Float32Array(GRID_N * GRID_N);
    anchorHumGrid = new Float32Array(GRID_N * GRID_N);
    anchorBlendGrid = new Float32Array(GRID_N * GRID_N);

    for (let gy = 0; gy < GRID_N; gy++) {
      const gz = Math.floor(job.maxZ - (gy / (GRID_N - 1)) * spanZ);
      for (let gx = 0; gx < GRID_N; gx++) {
        const gwX = Math.floor(job.minX + (gx / (GRID_N - 1)) * spanX);
        const gIdx = gy * GRID_N + gx;
        const anchor = sampleMipmapClimateAnchor(gwX, gz, macroMipmap, activeBiomes);
        if (anchor) {
          anchorHeatGrid[gIdx] = anchor.heat;
          anchorHumGrid[gIdx] = anchor.humidity;
          anchorBlendGrid[gIdx] = anchor.blend;
        } else {
          anchorHeatGrid[gIdx] = 50;
          anchorHumGrid[gIdx] = 50;
          anchorBlendGrid[gIdx] = 0;
        }
      }
    }
  }

  for (let py = 0; py < size; py++) {
    const exactZ = job.maxZ - (py + 0.5) * stepZ;
    const worldZ = Math.floor(exactZ);
    const blockZ = worldZ >> 4;
    const prevWorldZ = Math.floor(exactZ + stepZ);

    const gyFloat = (py / Math.max(1, size - 1)) * (GRID_N - 1);
    const gy0 = Math.min(GRID_N - 2, Math.floor(gyFloat));
    const ty = gyFloat - gy0;

    for (let px = 0; px < size; px++) {
      const exactX = job.minX + (px + 0.5) * stepX;
      const worldX = Math.floor(exactX);
      const blockX = worldX >> 4;
      const prevWorldX = Math.floor(exactX - stepX);
      const idx = (py * size + px) * 4;

      const dbSample = sampleDbHierarchy(
        worldX,
        worldZ,
        stepX,
        blockSurfaces,
        macroMipmap,
        dbColumns
      );

      // 1. Pure DB Mode when pixel is outside decoded SQLite blocks/mipmaps
      if (job.viewMode === 'db' && !dbSample) {
        const isGrid = (worldX & 15) === 0 || (worldZ & 15) === 0;
        rgba[idx] = isGrid ? 22 : 11;
        rgba[idx + 1] = isGrid ? 32 : 16;
        rgba[idx + 2] = isGrid ? 48 : 26;
        rgba[idx + 3] = 255;
        continue;
      }

      // 2. Render SQLite Database Sample (Tier 0 Mipmap or Tier 1/2 Compact Block)
      if (dbSample && (job.viewMode === 'db' || job.viewMode === 'hybrid')) {
        const refBaseY = isNonSurfaceSlice ? sliceMinY : job.waterLevel;
        let [r, g, b] = job.hypsometricMode
          ? elevationToHypsometricRgb(dbSample.topY, refBaseY)
          : [dbSample.r, dbSample.g, dbSample.b];

        // Coastal lagoon vs deep water shading
        if (!job.hypsometricMode && dbSample.waterDepth > 0) {
          if (dbSample.waterDepth <= 2) {
            r = Math.min(255, r + 22);
            g = Math.min(255, g + 48);
            b = Math.min(255, b + 18);
          } else if (dbSample.waterDepth <= 5) {
            r = Math.min(255, r + 10);
            g = Math.min(255, g + 22);
          } else if (dbSample.waterDepth >= 10) {
            r = Math.max(0, r - 12);
            g = Math.max(0, g - 24);
            b = Math.max(0, b - 20);
          }
        }

        // Subtle elevation-layer warmth, alternating terrace tone & organic voxel grain
        if (!job.hypsometricMode && dbSample.waterDepth === 0) {
          const relY = Math.max(0, dbSample.topY - refBaseY);
          const elevLift = Math.min(18, Math.round(relY * 0.42)) - 4;
          const terraceStep = (dbSample.topY & 1) === 0 ? 3 : -3;
          const voxelGrain = stepX <= 1.2 ? (((worldX * 73) ^ (worldZ * 151)) & 7) - 3 : 0;
          const delta = elevLift + terraceStep + voxelGrain;
          r = Math.max(0, Math.min(255, r + delta + (relY > 18 ? 3 : 0)));
          g = Math.max(0, Math.min(255, g + delta));
          b = Math.max(0, Math.min(255, b + delta - (relY > 18 ? 3 : 0)));
        }

        // Multi-Radius 3D Voxel Relief, Canopy AO & Warm/Cool Directional Sun Shading
        if (job.hillshadeEnabled && dbSample.waterDepth === 0) {
          const nw1 = sampleDbHierarchy(
            worldX - sampleStep,
            worldZ + sampleStep,
            stepX,
            blockSurfaces,
            macroMipmap,
            dbColumns
          );
          const se1 = sampleDbHierarchy(
            worldX + sampleStep,
            worldZ - sampleStep,
            stepX,
            blockSurfaces,
            macroMipmap,
            dbColumns
          );

          const yC = dbSample.topY;
          const yNW1 = nw1 ? nw1.topY : yC;
          const ySE1 = se1 ? se1.topY : yC;

          if (stepX >= 16.0) {
            // Fast 2-tap directional sun shading when zoomed out to whole-world / macro overview
            const coarseSlope = (yC - yNW1) * 0.65 + (ySE1 - yC) * 0.45;
            const shade = Math.max(-42, Math.min(40, Math.round(coarseSlope * 9.5)));
            if (shade >= 0) {
              r = Math.min(255, r + Math.round(shade * 1.1));
              g = Math.min(255, g + Math.round(shade * 1.02));
              b = Math.min(255, b + Math.round(shade * 0.84));
            } else {
              r = Math.max(0, r + Math.round(shade * 1.08));
              g = Math.max(0, g + Math.round(shade * 0.96));
              b = Math.max(0, b + Math.round(shade * 0.76));
            }
          } else {
            const ne1 = sampleDbHierarchy(
              worldX + sampleStep,
              worldZ + sampleStep,
              stepX,
              blockSurfaces,
              macroMipmap,
              dbColumns
            );
            const sw1 = sampleDbHierarchy(
              worldX - sampleStep,
              worldZ - sampleStep,
              stepX,
              blockSurfaces,
              macroMipmap,
              dbColumns
            );
            const nw2 = sampleDbHierarchy(
              worldX - macroStep,
              worldZ + macroStep,
              stepX,
              blockSurfaces,
              macroMipmap,
              dbColumns
            );
            const se2 = sampleDbHierarchy(
              worldX + macroStep,
              worldZ - macroStep,
              stepX,
              blockSurfaces,
              macroMipmap,
              dbColumns
            );

            const yNE1 = ne1 ? ne1.topY : yC;
            const ySW1 = sw1 ? sw1.topY : yC;
            const yNW2 = nw2 ? nw2.topY : yNW1;
            const ySE2 = se2 ? se2.topY : ySE1;

            // Central-difference NW->SE directional slope across both 1-voxel and 3-voxel radii
            const fineSlope = (yC - yNW1) * 0.65 + (ySE1 - yC) * 0.45;
            const macroSlope = ((yC - yNW2) * 0.6 + (ySE2 - yC) * 0.4) * 0.42;

            // Canopy / crevice Ambient Occlusion (valleys & cliff bases darker, crowns brighter)
            const avgNeighborY = (yNW1 + ySE1 + yNE1 + ySW1) * 0.25;
            const ao = Math.max(-22, Math.min(16, (yC - avgNeighborY) * 5.5));

            const shade = Math.max(-48, Math.min(46, Math.round((fineSlope + macroSlope) * 9.5 + ao)));
            if (shade >= 0) {
              // Warm golden sunlight on NW-facing slopes & tree crowns
              r = Math.min(255, r + Math.round(shade * 1.1));
              g = Math.min(255, g + Math.round(shade * 1.02));
              b = Math.min(255, b + Math.round(shade * 0.84));
            } else {
              // Cool slate-indigo shadow on SE-facing slopes & canopy undersides
              r = Math.max(0, r + Math.round(shade * 1.08));
              g = Math.max(0, g + Math.round(shade * 0.96));
              b = Math.max(0, b + Math.round(shade * 0.76));
            }

            // Crisp topographic contour accent along elevation drop edges at close/medium zoom
            if (stepX <= 1.5 && (yC < yNW1 || yC < yNE1 || yC > ySE1 + 1 || yC > ySW1 + 1)) {
              r = Math.round(r * 0.9);
              g = Math.round(g * 0.9);
              b = Math.round(b * 0.92);
            }
          }
        }

        // Crisp 1px Voxel Micro-Grid when zoomed in close (Screenshot 4 sharpness fix!)
        if (isCloseUpVoxelZoom && (worldX !== prevWorldX || worldZ !== prevWorldZ)) {
          r = Math.max(0, r - 15);
          g = Math.max(0, g - 15);
          b = Math.max(0, b - 15);
        }

        // Highlight / Isolate Selected Voronoi Biome on SQLite Terrain
        if (job.isolatedBiomeId) {
          const voxelNode = resolveNodeNameFromExactColor(
            dbSample.r,
            dbSample.g,
            dbSample.b,
            dbSample.waterDepth,
            dbSample.nodeName
          );
          const dbBiome = resolveBiomeForDbNode(
            voxelNode,
            dbSample.topY,
            dbSample.waterDepth,
            activeBiomes
          );
          if (dbBiome.id !== job.isolatedBiomeId) {
            const luma = Math.round((r * 0.299 + g * 0.587 + b * 0.114) * 0.24);
            r = luma;
            g = luma + 4;
            b = luma + 10;
          } else {
            r = Math.min(255, r + 16);
            g = Math.min(255, g + 16);
            b = Math.min(255, b + 16);
          }
        }

        // Highlight ONLY the outer perimeter edge facing unexplored MapBlocks in Hybrid Mode
        if (job.viewMode === 'hybrid' && job.exploredBoundsEnabled && !isNonSurfaceSlice && stepX < 4) {
          const localX = worldX & 15;
          const localZ = worldZ & 15;
          if (localX === 0 || localX === 15 || localZ === 0 || localZ === 15) {
            const hasBlk = (bxTest: number, bzTest: number) =>
              blockSurfaces?.has(`${bxTest},${bzTest}`) ||
              exploredBlocks?.has(`${bxTest},${bzTest}`);
            const isOuterEdge =
              (localX === 0 && !hasBlk(blockX - 1, blockZ)) ||
              (localX === 15 && !hasBlk(blockX + 1, blockZ)) ||
              (localZ === 0 && !hasBlk(blockX, blockZ - 1)) ||
              (localZ === 15 && !hasBlk(blockX, blockZ + 1));
            if (isOuterEdge) {
              r = 56;
              g = 189;
              b = 248;
            }
          }
        }

        rgba[idx] = r;
        rgba[idx + 1] = g;
        rgba[idx + 2] = b;
        rgba[idx + 3] = 255;
        continue;
      }

      // 3. Seed Biome Mode (or SQLite-anchored unexplored background in Hybrid Mode)
      const refSliceY = sliceMaxY < -200 ? sliceMaxY : undefined;
      let pt;
      if (anchorHeatGrid && anchorHumGrid && anchorBlendGrid) {
        const gxFloat = (px / Math.max(1, size - 1)) * (GRID_N - 1);
        const gx0 = Math.min(GRID_N - 2, Math.floor(gxFloat));
        const tx = gxFloat - gx0;

        const i00 = gy0 * GRID_N + gx0;
        const i10 = i00 + 1;
        const i01 = i00 + GRID_N;
        const i11 = i01 + 1;

        const w00 = (1 - tx) * (1 - ty);
        const w10 = tx * (1 - ty);
        const w01 = (1 - tx) * ty;
        const w11 = tx * ty;

        const rawBlend =
          anchorBlendGrid[i00] * w00 +
          anchorBlendGrid[i10] * w10 +
          anchorBlendGrid[i01] * w01 +
          anchorBlendGrid[i11] * w11;
        const aBlend = job.isolatedBiomeId ? rawBlend * 0.25 : rawBlend;

        if (aBlend > 0.01) {
          const aHeat =
            anchorHeatGrid[i00] * w00 +
            anchorHeatGrid[i10] * w10 +
            anchorHeatGrid[i01] * w01 +
            anchorHeatGrid[i11] * w11;
          const aHum =
            anchorHumGrid[i00] * w00 +
            anchorHumGrid[i10] * w10 +
            anchorHumGrid[i01] * w01 +
            anchorHumGrid[i11] * w11;
          pt = synth.evaluatePointWithClimateAnchor(worldX, worldZ, aHeat, aHum, aBlend, refSliceY);
        } else {
          pt = synth.evaluatePoint(worldX, worldZ, refSliceY);
        }
      } else {
        pt = synth.evaluatePoint(worldX, worldZ, refSliceY);
      }
      let [r, g, b] = job.hypsometricMode
        ? elevationToHypsometricRgb(pt.elevation, job.waterLevel)
        : pt.biome.color;

      if (pt.elevation < job.waterLevel) {
        const depth = Math.min(35, job.waterLevel - pt.elevation);
        const depthFactor = Math.max(0.5, 1 - depth * 0.015);
        r = Math.round(r * depthFactor);
        g = Math.round(g * depthFactor);
        b = Math.round(b * depthFactor);
      } else if (job.hillshadeEnabled) {
        const nwElev = synth.evaluateElevation(worldX - sampleStep, worldZ + sampleStep);
        const slope = (pt.elevation - nwElev) / Math.max(1, sampleStep * 0.42);
        const shade = Math.max(-42, Math.min(42, Math.round(slope * 16)));
        r = Math.max(0, Math.min(255, r + shade));
        g = Math.max(0, Math.min(255, g + shade));
        b = Math.max(0, Math.min(255, b + shade));

        if (pt.elevation > job.waterLevel) {
          if (pt.elevation % 20 === 0) {
            r = Math.round(r * 0.72);
            g = Math.round(g * 0.72);
            b = Math.round(b * 0.72);
          } else if (pt.elevation % 10 === 0) {
            r = Math.round(r * 0.86);
            g = Math.round(g * 0.86);
            b = Math.round(b * 0.86);
          }
        }
      }

      if (job.voronoiContoursEnabled && pt.isVoronoiBorder) {
        r = Math.round(r * 0.42 + 15);
        g = Math.round(g * 0.42 + 23);
        b = Math.round(b * 0.42 + 42);
      }

      if (job.isolatedBiomeId && pt.biome.id !== job.isolatedBiomeId) {
        const luma = Math.round((r * 0.299 + g * 0.587 + b * 0.114) * 0.28);
        r = luma;
        g = luma + 4;
        b = luma + 10;
      }

      if (isCloseUpVoxelZoom && (worldX !== prevWorldX || worldZ !== prevWorldZ)) {
        r = Math.max(0, r - 14);
        g = Math.max(0, g - 14);
        b = Math.max(0, b - 14);
      }

      if (job.viewMode === 'hybrid' && isNonSurfaceSlice) {
        const isGrid = (worldX & 15) === 0 || (worldZ & 15) === 0;
        r = Math.round(r * 0.18 + (isGrid ? 16 : 8));
        g = Math.round(g * 0.18 + (isGrid ? 24 : 12));
        b = Math.round(b * 0.22 + (isGrid ? 38 : 20));
      } else if (job.viewMode === 'hybrid' && job.exploredBoundsEnabled && !dbSample) {
        r = Math.round(r * 0.58);
        g = Math.round(g * 0.58);
        b = Math.round(b * 0.64);
      }

      rgba[idx] = r;
      rgba[idx + 1] = g;
      rgba[idx + 2] = b;
      rgba[idx + 3] = 255;
    }
  }

  return encodeRgbaToPngBuffer(size, size, rgba);
}
