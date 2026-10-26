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
import {
  EvaluatedTerrainPoint,
  LuantiWorldSynthesizer,
  sampleMipmapClimateAnchor
} from './perlin-noise';
import { encodeRgbaToPngBuffer } from './png-encoder';
import { resolveNodeNameFromExactColor } from './mapblock-parser';

export interface TileRenderJobPayload {
  jobId: number;
  zoom?: number;
  cameraZoom?: number;
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
  groundY?: number;
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
  dbColumns: Map<string, ParsedColumnSurface> | null | undefined,
  cameraZoom?: number
): SampledDbPixel | null {
  const bx = worldX >> 4;
  const bz = worldZ >> 4;

  const isMacroTier = (cameraZoom !== undefined && cameraZoom < 6.0) || stepX >= 4.0;

  // 1. Check Tier 1 & 2 Compact 16x16 Block Surface Cache (O(1) TypedArray lookup)
  if (blockSurfaces && blockSurfaces.size > 0) {
    const blk = blockSurfaces.get(`${bx},${bz}`);
    if (blk) {
      // When viewing in World 4x4, Region 2x2, or Sector 1x1 (camera zoom < 6.0, or stepX >= 4.0),
      // use precomputed 1x1 MapBlock average so the entire viewport renders at uniform block resolution!
      if (isMacroTier && blk.avgY > -32768) {
        const exactMip = macroMipmap?.get(`b:${bx},${bz}`);
        return {
          r: blk.avgColor[0],
          g: blk.avgColor[1],
          b: blk.avgColor[2],
          topY: blk.avgY,
          groundY: blk.avgY,
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
        const groundY =
          blk.groundY && blk.groundY[cellIdx] > -32768 ? blk.groundY[cellIdx] : blk.avgY;
        return {
          r: blk.rgb[cOff],
          g: blk.rgb[cOff + 1],
          b: blk.rgb[cOff + 2],
          topY: y,
          groundY,
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

    const sibling1x1Decoded =
      blockSurfaces?.has(`${bx ^ 1},${bz}`) ||
      blockSurfaces?.has(`${bx},${bz ^ 1}`) ||
      blockSurfaces?.has(`${bx ^ 1},${bz ^ 1}`) ||
      macroMipmap.has(`b:${bx ^ 1},${bz}`) ||
      macroMipmap.has(`b:${bx},${bz ^ 1}`) ||
      macroMipmap.has(`b:${bx ^ 1},${bz ^ 1}`);

    if (!sibling1x1Decoded) {
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

      // Fallback to 4x4 MapBlock (64x64 node) mipmap cell only when no 2x2 or 1x1 block
      // inside this 4x4 group has already been decoded at a finer resolution
      const m4Mip = macroMipmap.get(`m4:${bx >> 2},${bz >> 2}`);
      if (m4Mip) {
        const mcx = bx >> 1;
        const mcz = bz >> 1;
        let finerIn4x4 =
          macroMipmap.has(`${mcx ^ 1},${mcz}`) ||
          macroMipmap.has(`${mcx},${mcz ^ 1}`) ||
          macroMipmap.has(`${mcx ^ 1},${mcz ^ 1}`);
        if (!finerIn4x4) {
          const base4x = bx & ~3;
          const base4z = bz & ~3;
          for (let dz = 0; dz < 4 && !finerIn4x4; dz++) {
            for (let dx = 0; dx < 4; dx++) {
              const sbx = base4x + dx;
              const sbz = base4z + dz;
              if (blockSurfaces?.has(`${sbx},${sbz}`) || macroMipmap.has(`b:${sbx},${sbz}`)) {
                finerIn4x4 = true;
                break;
              }
            }
          }
        }
        if (!finerIn4x4) {
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

  // Precompute a compact 5x5 per-tile SQLite Climate & Coastal Elevation Anchor Grid in Hybrid mode
  // so unexplored background biomes and 3D DEM terrain seamlessly match adjacent explored SQLite blocks.
  const GRID_N = 5;
  const activeBiomes = job.customBiomes || DEFAULT_LUANTI_BIOMES;
  let anchorHeatGrid: Float32Array | null = null;
  let anchorHumGrid: Float32Array | null = null;
  let anchorBlendGrid: Float32Array | null = null;
  let anchorElevGrid: Float32Array | null = null;
  let anchorElevBlendGrid: Float32Array | null = null;

  if (
    job.viewMode === 'hybrid' &&
    !isNonSurfaceSlice &&
    ((macroMipmap && macroMipmap.size > 0) || (blockSurfaces && blockSurfaces.size > 0))
  ) {
    anchorHeatGrid = new Float32Array(GRID_N * GRID_N);
    anchorHumGrid = new Float32Array(GRID_N * GRID_N);
    anchorBlendGrid = new Float32Array(GRID_N * GRID_N);
    anchorElevGrid = new Float32Array(GRID_N * GRID_N);
    anchorElevBlendGrid = new Float32Array(GRID_N * GRID_N);

    for (let gy = 0; gy < GRID_N; gy++) {
      const gz = Math.floor(job.maxZ - (gy / (GRID_N - 1)) * spanZ);
      for (let gx = 0; gx < GRID_N; gx++) {
        const gwX = Math.floor(job.minX + (gx / (GRID_N - 1)) * spanX);
        const gIdx = gy * GRID_N + gx;
        const anchor = sampleMipmapClimateAnchor(
          gwX,
          gz,
          macroMipmap,
          activeBiomes,
          blockSurfaces,
          job.waterLevel
        );
        if (anchor) {
          anchorHeatGrid[gIdx] = anchor.heat;
          anchorHumGrid[gIdx] = anchor.humidity;
          anchorBlendGrid[gIdx] = anchor.blend;
          anchorElevGrid[gIdx] = anchor.elev;
          anchorElevBlendGrid[gIdx] = anchor.elevBlend;
        } else {
          anchorHeatGrid[gIdx] = 50;
          anchorHumGrid[gIdx] = 50;
          anchorBlendGrid[gIdx] = 0;
          anchorElevGrid[gIdx] = job.waterLevel;
          anchorElevBlendGrid[gIdx] = 0;
        }
      }
    }
  }

  if (job.tileKind === 'terrain-dem') {
    const METERS_PER_NODE = 520;
    const baseLevel = isNonSurfaceSlice && job.viewMode !== 'seed' ? 0 : job.waterLevel;
    const rawElevGrid = new Float32Array(size * size);

    // 1. Single-pass elevation evaluation per pixel (with sub-voxel horizontal reuse when stepX < 1.0)
    for (let py = 0; py < size; py++) {
      const wz = job.maxZ - (py + 0.5) * stepZ;
      const rz = Math.floor(wz);
      const rowOffset = py * size;

      const gyFloat = (py / Math.max(1, size - 1)) * (GRID_N - 1);
      const gy0 = Math.min(GRID_N - 2, Math.floor(gyFloat));
      const ty = gyFloat - gy0;

      let prevRx = -9999999;
      let prevElev = baseLevel;

      for (let px = 0; px < size; px++) {
        const wx = job.minX + (px + 0.5) * stepX;
        const rx = Math.floor(wx);

        if (stepX < 1.0 && rx === prevRx) {
          rawElevGrid[rowOffset + px] = prevElev;
          continue;
        }
        prevRx = rx;

        const dbSample = sampleDbHierarchy(
          rx,
          rz,
          stepX,
          blockSurfaces,
          macroMipmap,
          dbColumns,
          job.cameraZoom
        );

        let elev: number;
        if (isNonSurfaceSlice && job.viewMode !== 'seed') {
          if (dbSample) {
            const rawDbElev = dbSample.groundY !== undefined ? dbSample.groundY : dbSample.topY;
            elev = Math.max(0, Math.min(180, rawDbElev - sliceMinY));
          } else {
            elev = 0;
          }
        } else if (dbSample && (job.viewMode === 'db' || job.viewMode === 'hybrid')) {
          const rawDbElev = dbSample.groundY !== undefined ? dbSample.groundY : dbSample.topY;
          elev = Math.max(job.waterLevel, rawDbElev);
        } else if (job.viewMode === 'db') {
          elev = job.waterLevel;
        } else {
          const rawSynthElev = Math.max(job.waterLevel, synth.evaluateElevation(rx, rz));
          if (anchorElevGrid && anchorElevBlendGrid) {
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

            const aElevBlend =
              anchorElevBlendGrid[i00] * w00 +
              anchorElevBlendGrid[i10] * w10 +
              anchorElevBlendGrid[i01] * w01 +
              anchorElevBlendGrid[i11] * w11;

            if (aElevBlend > 0.01) {
              const aElev =
                anchorElevGrid[i00] * w00 +
                anchorElevGrid[i10] * w10 +
                anchorElevGrid[i01] * w01 +
                anchorElevGrid[i11] * w11;
              elev = Math.max(job.waterLevel, aElev) * aElevBlend + rawSynthElev * (1 - aElevBlend);
            } else {
              elev = rawSynthElev;
            }
          } else {
            elev = rawSynthElev;
          }
        }

        prevElev = elev;
        rawElevGrid[rowOffset + px] = elev;
      }
    }

    // 2. Fast in-memory 5-tap cross smoothing and Terrain-RGB encoding (zero extra Perlin/DB evaluations)
    const isMacroDemTier = (job.cameraZoom !== undefined && job.cameraZoom < 6.0) || stepX >= 4.0;
    const isSmoothTier = isMacroDemTier || (stepX >= 1.0 && stepX < 32.0);
    const tapDist = isMacroDemTier
      ? Math.max(1, Math.min(8, Math.round(12 / Math.max(0.5, stepX))))
      : 1;

    for (let py = 0; py < size; py++) {
      const rowOffset = py * size;
      const upRowOffset = Math.max(0, py - tapDist) * size;
      const downRowOffset = Math.min(size - 1, py + tapDist) * size;

      for (let px = 0; px < size; px++) {
        const c = rawElevGrid[rowOffset + px];
        let smoothElev = c;
        if (isSmoothTier && (isMacroDemTier || stepX >= 1.0)) {
          const l = rawElevGrid[rowOffset + Math.max(0, px - tapDist)];
          const rgt = rawElevGrid[rowOffset + Math.min(size - 1, px + tapDist)];
          const u = rawElevGrid[upRowOffset + px];
          const d = rawElevGrid[downRowOffset + px];
          smoothElev = c * 0.36 + (l + rgt + u + d) * 0.16;
        }

        const relativeHeight = Math.max(0, smoothElev - baseLevel);
        const mercatorMeters = relativeHeight * METERS_PER_NODE;

        const encoded = Math.max(0, Math.min(16777215, Math.round((mercatorMeters + 10000) * 10)));
        const r = (encoded >> 16) & 0xff;
        const g = (encoded >> 8) & 0xff;
        const b = encoded & 0xff;

        const idx = (rowOffset + px) * 4;
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
  const isMacroColorTier = (job.cameraZoom !== undefined && job.cameraZoom < 6.0) || stepX >= 4.0;
  const dbSampleStep = isMacroColorTier ? Math.max(16, sampleStep) : sampleStep;
  const isCloseUpVoxelZoom = (job.cameraZoom === undefined || job.cameraZoom >= 6.0) && stepX <= 0.35; // 1 Luanti node >= 3 tile pixels wide

  let prevRowElev = new Int16Array(size);
  let currRowElev = new Int16Array(size);

  for (let py = 0; py < size; py++) {
    const exactZ = job.maxZ - (py + 0.5) * stepZ;
    const worldZ = Math.floor(exactZ);
    const blockZ = worldZ >> 4;
    const prevWorldZ = Math.floor(exactZ + stepZ);

    const gyFloat = (py / Math.max(1, size - 1)) * (GRID_N - 1);
    const gy0 = Math.min(GRID_N - 2, Math.floor(gyFloat));
    const ty = gyFloat - gy0;

    let prevEvalWorldX = -9999999;
    let prevEvalWorldZ = -9999999;
    let prevEvalPt: EvaluatedTerrainPoint | null = null;
    let prevEvalShade = 0;
    let prevWaterCellX = -9999999;
    let prevWaterCellZ = -9999999;
    let prevWaterPt: EvaluatedTerrainPoint | null = null;

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
        dbColumns,
        job.cameraZoom
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

        let trackedDbElev = dbSample.topY;

        // Rich Bathymetric Ocean Shading, Biome Tinting & Underwater Contours for SQLite Water
        if (!job.hypsometricMode && dbSample.waterDepth > 0) {
          let aHeat = 50;
          let aHum = 50;
          let aBlend = 0;
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
            aBlend = job.isolatedBiomeId ? rawBlend * 0.25 : rawBlend;
            if (aBlend > 0.01) {
              aHeat =
                anchorHeatGrid[i00] * w00 +
                anchorHeatGrid[i10] * w10 +
                anchorHeatGrid[i01] * w01 +
                anchorHeatGrid[i11] * w11;
              aHum =
                anchorHumGrid[i00] * w00 +
                anchorHumGrid[i10] * w10 +
                anchorHumGrid[i01] * w01 +
                anchorHumGrid[i11] * w11;
            }
          }

          const waterShift = isMacroColorTier ? 2 : 1;
          const wCellX = worldX >> waterShift;
          const wCellZ = worldZ >> waterShift;
          let oceanPt: EvaluatedTerrainPoint;
          if (prevWaterPt && wCellX === prevWaterCellX && wCellZ === prevWaterCellZ) {
            oceanPt = prevWaterPt;
          } else {
            oceanPt =
              aBlend > 0.01
                ? synth.evaluatePointWithClimateAnchor(
                    worldX,
                    worldZ,
                    aHeat,
                    aHum,
                    aBlend,
                    -8,
                    job.voronoiContoursEnabled
                  )
                : synth.evaluatePoint(worldX, worldZ, -8, job.voronoiContoursEnabled);
            prevWaterCellX = wCellX;
            prevWaterCellZ = wCellZ;
            prevWaterPt = oceanPt;
          }
          trackedDbElev = oceanPt.elevation;

          const sqlDepth =
            dbSample.groundY !== undefined && dbSample.groundY < dbSample.topY
              ? Math.max(dbSample.waterDepth, dbSample.topY - dbSample.groundY)
              : dbSample.waterDepth;
          const procDepth = Math.max(2, Math.min(35, Math.round(job.waterLevel - oceanPt.elevation + 8)));
          const effDepth =
            sqlDepth <= 1
              ? 1
              : sqlDepth > 2
                ? Math.round(sqlDepth * 0.55 + procDepth * 0.45)
                : procDepth;

          // Blend cerulean water base with local Voronoi ocean biome color
          const [br, bg, bb] = oceanPt.biome.color;
          r = Math.round(dbSample.r * 0.52 + br * 0.48);
          g = Math.round(dbSample.g * 0.52 + bg * 0.48);
          b = Math.round(dbSample.b * 0.52 + bb * 0.48);

          if (effDepth <= 1) {
            r = Math.min(255, r + 26);
            g = Math.min(255, g + 52);
            b = Math.min(255, b + 22);
          } else if (effDepth === 2) {
            r = Math.min(255, r + 12);
            g = Math.min(255, g + 26);
            b = Math.min(255, b + 10);
          } else {
            const band = Math.floor(effDepth / 3);
            const drop = Math.min(68, (effDepth - 2) * 2.5 + band * 4);
            r = Math.max(10, r - Math.round(drop * 0.68));
            g = Math.max(22, g - Math.round(drop * 0.88));
            b = Math.max(48, b - Math.round(drop * 0.6));
          }

          if (job.hillshadeEnabled && effDepth >= 2) {
            const nwElev =
              stepX >= 1.0 && py > 0 && px > 0
                ? prevRowElev[px - 1]
                : synth.evaluateElevation(worldX - sampleStep, worldZ + sampleStep);
            const bathySlope = (oceanPt.elevation - nwElev) / Math.max(1, sampleStep * 0.42);
            const bathyShade = Math.max(-24, Math.min(24, Math.round(bathySlope * 10)));
            r = Math.max(0, Math.min(255, r + bathyShade));
            g = Math.max(0, Math.min(255, g + bathyShade));
            b = Math.max(0, Math.min(255, b + Math.round(bathyShade * 0.88)));

            if (effDepth % 8 === 0) {
              r = Math.round(r * 0.82);
              g = Math.round(g * 0.82);
              b = Math.round(b * 0.84);
            } else if (effDepth % 4 === 0) {
              r = Math.round(r * 0.91);
              g = Math.round(g * 0.91);
              b = Math.round(b * 0.92);
            }
          }

          if (job.voronoiContoursEnabled && oceanPt.isVoronoiBorder) {
            r = Math.round(r * 0.58 + 15);
            g = Math.round(g * 0.58 + 23);
            b = Math.round(b * 0.58 + 42);
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
            worldX - dbSampleStep,
            worldZ + dbSampleStep,
            stepX,
            blockSurfaces,
            macroMipmap,
            dbColumns,
            job.cameraZoom
          );
          const se1 = sampleDbHierarchy(
            worldX + dbSampleStep,
            worldZ - dbSampleStep,
            stepX,
            blockSurfaces,
            macroMipmap,
            dbColumns,
            job.cameraZoom
          );

          const yC = dbSample.topY;
          const yNW1 = nw1 ? nw1.topY : yC;
          const ySE1 = se1 ? se1.topY : yC;

          if (isMacroColorTier || stepX >= 16.0) {
            // Fast 2-tap block-strided directional sun shading + gentle intra-block sub-node gradient
            // so Sector 1x1 / Region 2x2 / World 4x4 render with smooth 3D terrain shading across 16x16 blocks!
            const u = ((worldX & 15) - 7.5) / 16;
            const v = (7.5 - (worldZ & 15)) / 16;
            const subBlockGrad = (u + v) * (yNW1 - ySE1) * 0.1;
            const coarseSlope = (yC - yNW1) * 0.65 + (ySE1 - yC) * 0.45 + subBlockGrad;
            const shade = Math.max(-42, Math.min(40, Math.round(coarseSlope * 6.0)));
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
              dbColumns,
              job.cameraZoom
            );
            const sw1 = sampleDbHierarchy(
              worldX - sampleStep,
              worldZ - sampleStep,
              stepX,
              blockSurfaces,
              macroMipmap,
              dbColumns,
              job.cameraZoom
            );
            const nw2 = sampleDbHierarchy(
              worldX - macroStep,
              worldZ + macroStep,
              stepX,
              blockSurfaces,
              macroMipmap,
              dbColumns,
              job.cameraZoom
            );
            const se2 = sampleDbHierarchy(
              worldX + macroStep,
              worldZ - macroStep,
              stepX,
              blockSurfaces,
              macroMipmap,
              dbColumns,
              job.cameraZoom
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
              sampleDbHierarchy(
                bxTest << 4,
                bzTest << 4,
                stepX,
                blockSurfaces,
                macroMipmap,
                dbColumns,
                job.cameraZoom
              ) !== null || !!exploredBlocks?.has(`${bxTest},${bzTest}`);
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

        currRowElev[px] = trackedDbElev;
        rgba[idx] = r;
        rgba[idx + 1] = g;
        rgba[idx + 2] = b;
        rgba[idx + 3] = 255;
        continue;
      }

      // 3. Seed Biome Mode (or SQLite-anchored unexplored background in Hybrid Mode)
      const refSliceY = sliceMaxY < -200 ? sliceMaxY : undefined;
      let pt: EvaluatedTerrainPoint;
      const reusedSameWorldCoord =
        stepX < 1.0 && worldX === prevEvalWorldX && worldZ === prevEvalWorldZ && prevEvalPt !== null;

      if (reusedSameWorldCoord) {
        pt = prevEvalPt!;
      } else if (
        anchorHeatGrid &&
        anchorHumGrid &&
        anchorBlendGrid &&
        anchorElevGrid &&
        anchorElevBlendGrid
      ) {
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

        const aElevBlend =
          anchorElevBlendGrid[i00] * w00 +
          anchorElevBlendGrid[i10] * w10 +
          anchorElevBlendGrid[i01] * w01 +
          anchorElevBlendGrid[i11] * w11;

        if (aBlend > 0.01 || aElevBlend > 0.01) {
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
          const aElev =
            anchorElevGrid[i00] * w00 +
            anchorElevGrid[i10] * w10 +
            anchorElevGrid[i01] * w01 +
            anchorElevGrid[i11] * w11;
          pt = synth.evaluatePointWithClimateAnchor(
            worldX,
            worldZ,
            aHeat,
            aHum,
            aBlend,
            refSliceY,
            job.voronoiContoursEnabled,
            aElev,
            aElevBlend
          );
        } else {
          pt = synth.evaluatePoint(worldX, worldZ, refSliceY, job.voronoiContoursEnabled);
        }
      } else {
        pt = synth.evaluatePoint(worldX, worldZ, refSliceY, job.voronoiContoursEnabled);
      }

      currRowElev[px] = pt.elevation;
      let [r, g, b] = job.hypsometricMode
        ? elevationToHypsometricRgb(pt.elevation, job.waterLevel)
        : pt.biome.color;

      if (pt.elevation < job.waterLevel) {
        const depth = Math.max(1, Math.min(35, Math.round(job.waterLevel - pt.elevation)));
        if (!job.hypsometricMode) {
          // Match SQLite's bathymetric ocean shader (52% cerulean water + 48% Voronoi ocean biome)
          r = Math.round(39 * 0.52 + r * 0.48);
          g = Math.round(146 * 0.52 + g * 0.48);
          b = Math.round(219 * 0.52 + b * 0.48);
          if (depth <= 1) {
            r = Math.min(255, r + 26);
            g = Math.min(255, g + 52);
            b = Math.min(255, b + 22);
          } else if (depth === 2) {
            r = Math.min(255, r + 12);
            g = Math.min(255, g + 26);
            b = Math.min(255, b + 10);
          } else {
            const band = Math.floor(depth / 3);
            const drop = Math.min(68, (depth - 2) * 2.5 + band * 4);
            r = Math.max(10, r - Math.round(drop * 0.68));
            g = Math.max(22, g - Math.round(drop * 0.88));
            b = Math.max(48, b - Math.round(drop * 0.6));
          }

          if (job.hillshadeEnabled && depth >= 2) {
            const nwElev =
              stepX >= 1.0 && py > 0 && px > 0
                ? prevRowElev[px - 1]
                : synth.evaluateElevation(worldX - sampleStep, worldZ + sampleStep);
            const bathySlope = (pt.elevation - nwElev) / Math.max(1, sampleStep * 0.42);
            const bathyShade = Math.max(-24, Math.min(24, Math.round(bathySlope * 10)));
            r = Math.max(0, Math.min(255, r + bathyShade));
            g = Math.max(0, Math.min(255, g + bathyShade));
            b = Math.max(0, Math.min(255, b + Math.round(bathyShade * 0.88)));

            if (depth % 8 === 0) {
              r = Math.round(r * 0.82);
              g = Math.round(g * 0.82);
              b = Math.round(b * 0.84);
            } else if (depth % 4 === 0) {
              r = Math.round(r * 0.91);
              g = Math.round(g * 0.91);
              b = Math.round(b * 0.92);
            }
          }
        } else {
          const depthFactor = Math.max(0.5, 1 - depth * 0.015);
          r = Math.round(r * depthFactor);
          g = Math.round(g * depthFactor);
          b = Math.round(b * depthFactor);
        }
      } else {
        if (!job.hypsometricMode) {
          const relY = Math.max(0, pt.elevation - job.waterLevel);
          const elevLift = Math.min(18, Math.round(relY * 0.42)) - 4;
          const terraceStep = (pt.elevation & 1) === 0 ? 2 : -2;
          const delta = elevLift + terraceStep;
          r = Math.max(0, Math.min(255, r + delta + (relY > 18 ? 3 : 0)));
          g = Math.max(0, Math.min(255, g + delta));
          b = Math.max(0, Math.min(255, b + delta - (relY > 18 ? 3 : 0)));
        }

        if (job.hillshadeEnabled) {
          let shade: number;
          if (reusedSameWorldCoord) {
            shade = prevEvalShade;
          } else {
            const nwElev =
              stepX >= 1.0 && py > 0 && px > 0
                ? prevRowElev[px - 1]
                : synth.evaluateElevation(worldX - sampleStep, worldZ + sampleStep);
            const slope = (pt.elevation - nwElev) / Math.max(1, sampleStep * 0.42);
            shade = Math.max(-42, Math.min(42, Math.round(slope * 14)));
            prevEvalShade = shade;
          }
          if (shade >= 0) {
            r = Math.min(255, r + Math.round(shade * 1.1));
            g = Math.min(255, g + Math.round(shade * 1.02));
            b = Math.min(255, b + Math.round(shade * 0.84));
          } else {
            r = Math.max(0, r + Math.round(shade * 1.08));
            g = Math.max(0, g + Math.round(shade * 0.96));
            b = Math.max(0, b + Math.round(shade * 0.76));
          }

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
      }

      prevEvalWorldX = worldX;
      prevEvalWorldZ = worldZ;
      prevEvalPt = pt;

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

    const tmpRow = prevRowElev;
    prevRowElev = currRowElev;
    currRowElev = tmpRow;
  }

  return encodeRgbaToPngBuffer(size, size, rgba);
}
