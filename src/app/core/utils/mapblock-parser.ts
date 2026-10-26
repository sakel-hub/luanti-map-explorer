import { decompress as zstdDecompress } from 'fzstd';
import pako from 'pako';
import {
  CompactBlockSurface,
  DecodedWorldDatabase,
  MacroMipmapCell,
  ParsedColumnSurface,
  ParsedMapBlockSummary,
  VerticalSlicePresetId
} from '../models/world.model';
import { LUANTI_NODE_COLORS, resolveNodeColor } from '../data/node-colors';
import { LuantiWorldSynthesizer, createDefaultNoiseParams } from './perlin-noise';

function isBiomeGroundSurfaceNode(name: string): boolean {
  const lower = name.toLowerCase();
  if (
    lower.includes('water') ||
    lower.includes('leaves') ||
    lower.includes('needles') ||
    lower.includes('tree') ||
    lower.includes('wood') ||
    lower.includes('bush') ||
    lower.includes('flower') ||
    lower.includes('fern') ||
    lower.includes('torch') ||
    (lower.includes('grass_') && !lower.includes('dirt_with_'))
  ) {
    return false;
  }
  return (
    lower.includes('dirt') ||
    lower.includes('sand') ||
    lower.includes('snow') ||
    lower.includes('ice') ||
    lower.includes('permafrost') ||
    lower.includes('stone') ||
    lower.includes('gravel') ||
    lower.includes('turf') ||
    lower.includes('moss') ||
    lower.includes('clay')
  );
}

const EXACT_COLOR_TO_NODE_NAME: Record<number, string> = (() => {
  const map: Record<number, string> = {};
  for (const [nodeKey, c] of Object.entries(LUANTI_NODE_COLORS)) {
    const packed = (c[0] << 16) | (c[1] << 8) | c[2];
    if (!map[packed]) {
      map[packed] = nodeKey;
    }
  }
  return map;
})();

export function isPlayerStructuralNode(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.includes('stonebrick') ||
    lower.includes('sandstonebrick') ||
    lower.includes('brick') ||
    lower.includes('wood') ||
    lower.includes('glass') ||
    lower.includes('chest') ||
    lower.includes('furnace') ||
    lower.includes('meselamp') ||
    lower.includes('torch') ||
    lower.includes('protector') ||
    lower.includes('door') ||
    lower.includes('fence') ||
    lower.includes('stair') ||
    lower.includes('slab') ||
    lower.includes('rail') ||
    lower.includes('steelblock') ||
    lower.includes('goldblock') ||
    lower.includes('copperblock') ||
    lower.includes('diamondblock')
  );
}

export function resolveNodeNameFromExactColor(
  r: number,
  g: number,
  b: number,
  waterDepth: number,
  dominantNode: string
): string {
  if (waterDepth > 0) {
    if (dominantNode.includes('ice') || dominantNode.includes('mineral_water')) {
      return dominantNode;
    }
    return 'default:water_source';
  }
  const domColor = resolveNodeColor(dominantNode);
  if (
    Math.abs(domColor[0] - r) + Math.abs(domColor[1] - g) + Math.abs(domColor[2] - b) <= 18
  ) {
    return dominantNode;
  }
  const exactMatch = EXACT_COLOR_TO_NODE_NAME[(r << 16) | (g << 8) | b];
  if (exactMatch) {
    return exactMatch;
  }
  let bestNode = dominantNode;
  let bestDist = 999;
  for (const [nodeKey, c] of Object.entries(LUANTI_NODE_COLORS)) {
    const dist = Math.abs(c[0] - r) + Math.abs(c[1] - g) + Math.abs(c[2] - b);
    if (dist < bestDist) {
      bestDist = dist;
      bestNode = nodeKey;
      if (dist === 0) break;
    }
  }
  return bestDist <= 24 ? bestNode : dominantNode;
}

function pythonModulo(i: bigint, mod: bigint): bigint {
  if (i >= 0n) return i % mod;
  const rem = (-i) % mod;
  return rem === 0n ? 0n : mod - rem;
}

function unsignedToSigned12(val: bigint): number {
  return val < 2048n ? Number(val) : Number(val - 4096n);
}

/**
 * Unpacks Luanti's 64-bit signed integer block coordinate into 12-bit signed (x, y, z) MapBlock coordinates.
 * Matches Luanti's `getIntegerAsBlock(s64 i)` in `database-sqlite3.cpp` (handles negative borrows properly).
 */
export function unpackBlockPos(posInput: bigint | number | string): { x: number; y: number; z: number } {
  let i = typeof posInput === 'bigint' ? posInput : BigInt(posInput);

  const x = unsignedToSigned12(pythonModulo(i, 4096n));
  i = (i - BigInt(x)) / 4096n;

  const y = unsignedToSigned12(pythonModulo(i, 4096n));
  i = (i - BigInt(y)) / 4096n;

  const z = unsignedToSigned12(pythonModulo(i, 4096n));

  return { x, y, z };
}

/**
 * Packs (x, y, z) MapBlock coordinates into Luanti's 64-bit signed integer key (`getBlockAsInteger`).
 */
export function packBlockPos(x: number, y: number, z: number): bigint {
  return BigInt(z) * 16777216n + BigInt(y) * 4096n + BigInt(x);
}

/**
 * O(1) lookup of a single (worldX, worldZ) node column from CompactBlockSurface, Mipmap, or fallback Map.
 */
export function lookupWorldColumn(
  worldX: number,
  worldZ: number,
  db: DecodedWorldDatabase | null | undefined
): ParsedColumnSurface | undefined {
  if (!db) return undefined;
  const bx = worldX >> 4;
  const bz = worldZ >> 4;

  if (db.blockSurfaces && db.blockSurfaces.size > 0) {
    const blk = db.blockSurfaces.get(`${bx},${bz}`);
    if (blk) {
      const lx = worldX & 15;
      const lz = worldZ & 15;
      const idx = (lz << 4) | lx;
      const y = blk.topY[idx];
      if (y > -32768) {
        const cOff = idx * 3;
        const r = blk.rgb[cOff];
        const g = blk.rgb[cOff + 1];
        const b = blk.rgb[cOff + 2];
        const waterDepth = blk.waterDepth[idx];
        return {
          x: worldX,
          z: worldZ,
          topY: y,
          nodeName: resolveNodeNameFromExactColor(r, g, b, waterDepth, blk.dominantNode),
          color: [r, g, b],
          waterDepth
        };
      }
    }
  }

  if (db.macroMipmap && db.macroMipmap.size > 0) {
    const exactMip = db.macroMipmap.get(`b:${bx},${bz}`);
    if (exactMip) {
      return {
        x: worldX,
        z: worldZ,
        topY: exactMip.y,
        nodeName: exactMip.nodeName,
        color: [exactMip.r, exactMip.g, exactMip.b],
        waterDepth: exactMip.waterDepth
      };
    }

    const siblingDecodedInHighRes =
      db.blockSurfaces?.has(`${bx ^ 1},${bz}`) ||
      db.blockSurfaces?.has(`${bx},${bz ^ 1}`) ||
      db.blockSurfaces?.has(`${bx ^ 1},${bz ^ 1}`);

    if (!siblingDecodedInHighRes) {
      const coarseMip =
        db.macroMipmap.get(`${bx >> 1},${bz >> 1}`) ||
        db.macroMipmap.get(`m4:${bx >> 2},${bz >> 2}`);
      if (coarseMip) {
        return {
          x: worldX,
          z: worldZ,
          topY: coarseMip.y,
          nodeName: coarseMip.nodeName,
          color: [coarseMip.r, coarseMip.g, coarseMip.b],
          waterDepth: coarseMip.waterDepth
        };
      }
    }
  }

  return db.surfaceColumns?.get(`${worldX},${worldZ}`);
}

/**
 * Merges a decoded 16x16x16 MapBlock into a CompactBlockSurface (Tier 1/2 cache)
 * and bakes its downsampled average into the Global Mipmap Pyramid (Tier 0 overview).
 */
export function mergeParsedBlockIntoCompactSurface(
  b: ParsedMapBlockSummary,
  minY: number,
  maxY: number,
  blockSurfaces: Map<string, CompactBlockSurface>,
  macroMipmap: Map<string, MacroMipmapCell>,
  nodeCounts: Record<string, number>
): CompactBlockSurface | null {
  const key = `${b.blockX},${b.blockZ}`;
  let blk = blockSurfaces.get(key);
  let modified = false;

  for (let i = 0; i < b.columns.length; i++) {
    const col = b.columns[i];
    const worldY = b.blockY * 16 + col.topLocalY;
    if (worldY < minY || worldY > maxY) continue;

    if (!blk) {
      const topYArr = new Int16Array(256);
      topYArr.fill(-32768);
      blk = {
        bx: b.blockX,
        bz: b.blockZ,
        rgb: new Uint8Array(768),
        topY: topYArr,
        waterDepth: new Uint8Array(256),
        dominantNode: col.nodeName,
        avgColor: [0, 0, 0],
        avgY: worldY,
        playerNodeCount: 0
      };
      blockSurfaces.set(key, blk);
    }

    const idx = (col.localZ << 4) | col.localX;
    if (worldY >= blk.topY[idx]) {
      const color = resolveNodeColor(col.nodeName);
      const cOff = idx * 3;
      blk.rgb[cOff] = color[0];
      blk.rgb[cOff + 1] = color[1];
      blk.rgb[cOff + 2] = color[2];
      blk.topY[idx] = worldY;
      blk.waterDepth[idx] = Math.min(255, col.waterCount);
      if (isPlayerStructuralNode(col.nodeName)) {
        blk.playerNodeCount = (blk.playerNodeCount || 0) + 1;
      }
      if (isBiomeGroundSurfaceNode(col.nodeName)) {
        blk.dominantNode = col.nodeName;
      } else if (
        !isBiomeGroundSurfaceNode(blk.dominantNode) &&
        !col.nodeName.includes('water') &&
        !col.nodeName.includes('leaves')
      ) {
        blk.dominantNode = col.nodeName;
      }
      nodeCounts[col.nodeName] = (nodeCounts[col.nodeName] || 0) + 1;
      modified = true;
    }
  }

  if (!blk || !modified) return null;

  // Recompute block average color & elevation for zoomed-out LOD & Mipmap Pyramid
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let sumY = 0;
  let sumWater = 0;
  let count = 0;

  for (let i = 0; i < 256; i++) {
    if (blk.topY[i] > -32768) {
      const cOff = i * 3;
      sumR += blk.rgb[cOff];
      sumG += blk.rgb[cOff + 1];
      sumB += blk.rgb[cOff + 2];
      sumY += blk.topY[i];
      sumWater += blk.waterDepth[i];
      count++;
    }
  }

  if (count > 0) {
    blk.avgColor = [
      Math.round(sumR / count),
      Math.round(sumG / count),
      Math.round(sumB / count)
    ];
    blk.avgY = Math.round(sumY / count);
    const avgWater = Math.round(sumWater / count);

    // 1. Store exact 1x1 MapBlock overview entry (never bleeds into adjacent unexplored blocks!)
    const exactMipKey = `b:${b.blockX},${b.blockZ}`;
    const existingExact = macroMipmap.get(exactMipKey);
    if (!existingExact || blk.avgY >= existingExact.y) {
      macroMipmap.set(exactMipKey, {
        mcx: b.blockX,
        mcz: b.blockZ,
        r: blk.avgColor[0],
        g: blk.avgColor[1],
        b: blk.avgColor[2],
        y: blk.avgY,
        waterDepth: avgWater,
        nodeName: blk.dominantNode
      });
    }

    // 2. Store 2x2 MapBlock (32x32 node) coarse overview cell for zoomed-out stride=2 world overview
    const mcx = b.blockX >> 1;
    const mcz = b.blockZ >> 1;
    const mipKey = `${mcx},${mcz}`;
    const existingMip = macroMipmap.get(mipKey);
    if (!existingMip || blk.avgY >= existingMip.y) {
      macroMipmap.set(mipKey, {
        mcx,
        mcz,
        r: blk.avgColor[0],
        g: blk.avgColor[1],
        b: blk.avgColor[2],
        y: blk.avgY,
        waterDepth: avgWater,
        nodeName: blk.dominantNode
      });
    }

    // 3. Store 4x4 MapBlock (64x64 node) ultra-coarse overview cell for whole-world stride=4 overview
    const m4x = b.blockX >> 2;
    const m4z = b.blockZ >> 2;
    const m4Key = `m4:${m4x},${m4z}`;
    const existingM4 = macroMipmap.get(m4Key);
    if (!existingM4 || blk.avgY >= existingM4.y) {
      macroMipmap.set(m4Key, {
        mcx: m4x,
        mcz: m4z,
        r: blk.avgColor[0],
        g: blk.avgColor[1],
        b: blk.avgColor[2],
        y: blk.avgY,
        waterDepth: avgWater,
        nodeName: blk.dominantNode
      });
    }
  }

  return blk;
}

export interface CoarseBlockMipmapResult {
  bx: number;
  bz: number;
  avgColor: [number, number, number];
  avgY: number;
  waterDepth: number;
  dominantNode: string;
  playerNodeCount: number;
  touchedMipKeys: string[];
}

// Reusable static scratch buffers for zero-allocation coarse block mipmap merging (max 256 columns)
const coarseScratchTopY = new Int16Array(256);
const coarseScratchRgb = new Uint8Array(768);
const coarseScratchWater = new Uint8Array(256);

function decodeRawBlockBufferAndMapping(
  blob: Uint8Array,
  caveMode: boolean
): { buffer: Uint8Array; param0Offset: number; nodeMapping: Record<number, string> } | null {
  if (!blob || blob.length < 4) return null;
  const version = blob[0];

  try {
    if (version >= 29) {
      const payload = zstdDecompress(blob.subarray(1));
      let offset = 7;
      if (payload.length < 12) return null;
      const mappingVersion = payload[offset++];
      if (mappingVersion !== 0) return null;

      const numMappings = (payload[offset] << 8) | payload[offset + 1];
      offset += 2;

      const nodeMapping: Record<number, string> = {};
      let hasOpaqueOrLiquidNode = false;
      let hasAirOrNonRockInCave = false;

      for (let i = 0; i < numMappings; i++) {
        if (offset + 4 > payload.length) break;
        const nodeId = (payload[offset] << 8) | payload[offset + 1];
        const nameLen = (payload[offset + 2] << 8) | payload[offset + 3];
        offset += 4;
        if (offset + nameLen > payload.length) break;
        const name = sharedUtf8Decoder.decode(payload.subarray(offset, offset + nameLen));
        offset += nameLen;
        nodeMapping[nodeId] = name;
        if (name !== 'air' && name !== 'ignore') {
          hasOpaqueOrLiquidNode = true;
        }
        if (name === 'air' || (!isUnexcavatedMatrixRock(name) && name !== 'ignore')) {
          hasAirOrNonRockInCave = true;
        }
      }

      if (!hasOpaqueOrLiquidNode) return null;
      if (caveMode && !hasAirOrNonRockInCave) return null;
      if (offset + 2 > payload.length) return null;
      const contentWidth = payload[offset++];
      const paramsWidth = payload[offset++];
      if (contentWidth !== 2 || paramsWidth !== 2) return null;
      if (offset + 8192 > payload.length) return null;

      return { buffer: payload, param0Offset: offset, nodeMapping };
    } else if (version >= 24 && version <= 28) {
      const headerLen = version >= 27 ? 6 : 4;
      if (blob.length <= headerLen + 2) return null;
      const nodeMapping = scanNameIdMappingsFromTail(blob, headerLen);
      const mapKeys = Object.keys(nodeMapping);
      if (mapKeys.length > 0) {
        let hasOpaqueOrLiquidNode = false;
        let hasAirOrNonRockInCave = false;
        for (let i = 0; i < mapKeys.length; i++) {
          const name = nodeMapping[Number(mapKeys[i])];
          if (name !== 'air' && name !== 'ignore') {
            hasOpaqueOrLiquidNode = true;
          }
          if (name === 'air' || (!isUnexcavatedMatrixRock(name) && name !== 'ignore')) {
            hasAirOrNonRockInCave = true;
          }
        }
        if (!hasOpaqueOrLiquidNode) return null;
        if (caveMode && !hasAirOrNonRockInCave) return null;
      }
      const inflator = new pako.Inflate();
      inflator.push(blob.subarray(headerLen), false);
      if (!inflator.result) return null;
      const nodeData = inflator.result as Uint8Array;
      if (nodeData.length < 8192) return null;
      return { buffer: nodeData, param0Offset: 0, nodeMapping };
    }
  } catch {
    // Ignore corrupted or truncated block
  }

  return null;
}

/**
 * Zero-allocation fast preview parser for zoomed-out macro sectors & global overview:
 * Scans a downsampled `columnStride x columnStride` sub-grid of columns inside a 16x16 MapBlock
 * (e.g. `columnStride = 4` -> 16 columns; `columnStride = 2` -> 64 columns) across 1 or more vertical
 * blocks in the same `(blockX, blockZ)` column and writes directly into `macroMipmap` (`b:`, 2x2, and `m4:`).
 */
export function parseAndMergeCoarseBlockMipmap(
  blockX: number,
  blockY: number,
  blockZ: number,
  blobOrVerticalBlobs: Uint8Array | Array<{ y: number; data: Uint8Array }>,
  minY: number,
  maxY: number,
  caveMode: boolean,
  columnStride: 1 | 2 | 4,
  macroMipmap: Map<string, MacroMipmapCell>,
  nodeCounts: Record<string, number>
): CoarseBlockMipmapResult | null {
  const verticalList =
    blobOrVerticalBlobs instanceof Uint8Array
      ? [{ y: blockY, data: blobOrVerticalBlobs }]
      : blobOrVerticalBlobs;
  if (verticalList.length === 0) return null;
  if (verticalList.length > 1) {
    verticalList.sort((a, b) => b.y - a.y);
  }

  const gridSide = Math.floor(16 / columnStride);
  const totalCells = gridSide * gridSide;
  const startOffset = columnStride >= 4 ? 1 : 0;

  coarseScratchTopY.fill(-32768, 0, totalCells);

  let dominantNode = 'air';
  let playerNodeCount = 0;
  let modified = false;

  for (let vIdx = 0; vIdx < verticalList.length; vIdx++) {
    const vItem = verticalList[vIdx];
    if (modified) {
      const maxBlockWorldY = vItem.y * 16 + 15;
      let allCoveredAbove = true;
      for (let i = 0; i < totalCells; i++) {
        if (coarseScratchTopY[i] <= maxBlockWorldY) {
          allCoveredAbove = false;
          break;
        }
      }
      if (allCoveredAbove) break;
    }

    const raw = decodeRawBlockBufferAndMapping(vItem.data, caveMode);
    if (!raw) continue;

    const { buffer, param0Offset, nodeMapping } = raw;
    const baseBlockY = vItem.y * 16;

    let cellIdx = 0;
    for (let gz = 0; gz < gridSide; gz++) {
      const lz = startOffset + gz * columnStride;
      for (let gx = 0; gx < gridSide; gx++, cellIdx++) {
        const lx = startOffset + gx * columnStride;

        let topLocalY = -1;
        let topNodeName = 'air';
        let waterCount = 0;

        if (!caveMode) {
          for (let ly = 15; ly >= 0; ly--) {
            const nodeIdx = (lz << 8) | (ly << 4) | lx;
            const byteIdx = param0Offset + (nodeIdx << 1);
            const param0 = (buffer[byteIdx] << 8) | buffer[byteIdx + 1];
            const name = nodeMapping[param0] || 'air';

            if (name === 'air' || name === 'ignore') continue;
            if (name.includes('water')) {
              waterCount++;
              if (topLocalY === -1) {
                topLocalY = ly;
                topNodeName = name;
              }
              continue;
            }
            if (topLocalY === -1) {
              topLocalY = ly;
              topNodeName = name;
            }
            break;
          }
        } else {
          let seenAirCavity = false;
          let specialNodeY = -1;
          let specialNodeName = '';

          for (let ly = 15; ly >= 0; ly--) {
            const nodeIdx = (lz << 8) | (ly << 4) | lx;
            const byteIdx = param0Offset + (nodeIdx << 1);
            const param0 = (buffer[byteIdx] << 8) | buffer[byteIdx + 1];
            const name = nodeMapping[param0] || 'air';

            if (name === 'ignore') continue;
            if (name === 'air') {
              seenAirCavity = true;
              continue;
            }
            if (name.includes('water')) {
              seenAirCavity = true;
              waterCount++;
              if (topLocalY === -1) {
                topLocalY = ly;
                topNodeName = name;
              }
              continue;
            }
            if (!isUnexcavatedMatrixRock(name) && specialNodeY === -1) {
              specialNodeY = ly;
              specialNodeName = name;
            }
            if (seenAirCavity) {
              topLocalY = ly;
              topNodeName = name;
              break;
            }
          }

          if (topLocalY === -1) {
            if (specialNodeY !== -1) {
              topLocalY = specialNodeY;
              topNodeName = specialNodeName;
              waterCount = 0;
            } else if (seenAirCavity) {
              topLocalY = 0;
              topNodeName = 'default:cobble';
              waterCount = 0;
            }
          }
        }

        if (topLocalY === -1) continue;
        const worldY = baseBlockY + topLocalY;
        if (worldY < minY || worldY > maxY) continue;

        if (worldY >= coarseScratchTopY[cellIdx]) {
          const color = resolveNodeColor(topNodeName);
          const cOff = cellIdx * 3;
          coarseScratchRgb[cOff] = color[0];
          coarseScratchRgb[cOff + 1] = color[1];
          coarseScratchRgb[cOff + 2] = color[2];
          coarseScratchTopY[cellIdx] = worldY;
          coarseScratchWater[cellIdx] = Math.min(255, waterCount);

          if (isPlayerStructuralNode(topNodeName)) {
            playerNodeCount += columnStride * columnStride;
          }
          if (dominantNode === 'air' || isBiomeGroundSurfaceNode(topNodeName)) {
            dominantNode = topNodeName;
          } else if (
            !isBiomeGroundSurfaceNode(dominantNode) &&
            !topNodeName.includes('water') &&
            !topNodeName.includes('leaves')
          ) {
            dominantNode = topNodeName;
          }
          nodeCounts[topNodeName] = (nodeCounts[topNodeName] || 0) + 1;
          modified = true;
        }
      }
    }
  }

  if (!modified) return null;

  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let sumY = 0;
  let sumWater = 0;
  let count = 0;

  for (let i = 0; i < totalCells; i++) {
    if (coarseScratchTopY[i] > -32768) {
      const cOff = i * 3;
      sumR += coarseScratchRgb[cOff];
      sumG += coarseScratchRgb[cOff + 1];
      sumB += coarseScratchRgb[cOff + 2];
      sumY += coarseScratchTopY[i];
      sumWater += coarseScratchWater[i];
      count++;
    }
  }

  if (count === 0) return null;

  const avgColor: [number, number, number] = [
    Math.round(sumR / count),
    Math.round(sumG / count),
    Math.round(sumB / count)
  ];
  const avgY = Math.round(sumY / count);
  const avgWater = Math.round(sumWater / count);

  const exactMipKey = `b:${blockX},${blockZ}`;
  const existingExact = macroMipmap.get(exactMipKey);
  if (!existingExact || avgY >= existingExact.y) {
    macroMipmap.set(exactMipKey, {
      mcx: blockX,
      mcz: blockZ,
      r: avgColor[0],
      g: avgColor[1],
      b: avgColor[2],
      y: avgY,
      waterDepth: avgWater,
      nodeName: dominantNode
    });
  }

  const mcx = blockX >> 1;
  const mcz = blockZ >> 1;
  const mipKey = `${mcx},${mcz}`;
  const existingMip = macroMipmap.get(mipKey);
  if (!existingMip || avgY >= existingMip.y) {
    macroMipmap.set(mipKey, {
      mcx,
      mcz,
      r: avgColor[0],
      g: avgColor[1],
      b: avgColor[2],
      y: avgY,
      waterDepth: avgWater,
      nodeName: dominantNode
    });
  }

  const m4x = blockX >> 2;
  const m4z = blockZ >> 2;
  const m4Key = `m4:${m4x},${m4z}`;
  const existingM4 = macroMipmap.get(m4Key);
  if (!existingM4 || avgY >= existingM4.y) {
    macroMipmap.set(m4Key, {
      mcx: m4x,
      mcz: m4z,
      r: avgColor[0],
      g: avgColor[1],
      b: avgColor[2],
      y: avgY,
      waterDepth: avgWater,
      nodeName: dominantNode
    });
  }

  return {
    bx: blockX,
    bz: blockZ,
    avgColor,
    avgY,
    waterDepth: avgWater,
    dominantNode,
    playerNodeCount,
    touchedMipKeys: [exactMipKey, mipKey, m4Key]
  };
}

/**
 * Parses a Luanti MapBlock binary blob (v24..v29) given its packed 64-bit integer key.
 */
export function parseLuantiMapBlock(
  posKey: bigint | number | string,
  blob: Uint8Array,
  caveMode = false
): ParsedMapBlockSummary | null {
  if (!blob || blob.length < 4) return null;
  const { x: blockX, y: blockY, z: blockZ } = unpackBlockPos(posKey);
  return parseLuantiMapBlockCoords(blockX, blockY, blockZ, blob, posKey.toString(), caveMode);
}

/**
 * Parses a Luanti MapBlock binary blob (v24..v29) directly from explicit (blockX, blockY, blockZ) coordinates.
 */
export function parseLuantiMapBlockCoords(
  blockX: number,
  blockY: number,
  blockZ: number,
  blob: Uint8Array,
  posKeyStr?: string,
  caveMode = false
): ParsedMapBlockSummary | null {
  if (!blob || blob.length < 4) return null;
  const version = blob[0];
  const key = posKeyStr ?? `${blockX},${blockY},${blockZ}`;

  try {
    if (version >= 29) {
      const compressedPayload = blob.subarray(1);
      const payload = zstdDecompress(compressedPayload);
      return decodeV29Payload(key, blockX, blockY, blockZ, version, payload, caveMode);
    } else if (version >= 24 && version <= 28) {
      return decodeV28Payload(key, blockX, blockY, blockZ, version, blob, caveMode);
    }
  } catch {
    // Ignore corrupted or truncated block
  }

  return null;
}

const sharedUtf8Decoder = new TextDecoder('utf-8');

function isUnexcavatedMatrixRock(name: string): boolean {
  return (
    name === 'default:stone' ||
    name === 'default:desert_stone' ||
    name === 'default:sandstone' ||
    name === 'default:silver_sandstone' ||
    name === 'everness:mineral_stone' ||
    name === 'everness:cursed_stone' ||
    name === 'everness:forsaken_desert_stone' ||
    name === 'everness:coral_desert_stone'
  );
}

function decodeV29Payload(
  posKey: string,
  blockX: number,
  blockY: number,
  blockZ: number,
  version: number,
  payload: Uint8Array,
  caveMode: boolean
): ParsedMapBlockSummary | null {
  let offset = 7;
  if (payload.length < 12) return null;

  const mappingVersion = payload[offset++];
  if (mappingVersion !== 0) return null;

  const numMappings = (payload[offset] << 8) | payload[offset + 1];
  offset += 2;

  const nodeMapping: Record<number, string> = {};
  let hasOpaqueOrLiquidNode = false;
  let hasAirOrNonRockInCave = false;

  for (let i = 0; i < numMappings; i++) {
    if (offset + 4 > payload.length) break;
    const nodeId = (payload[offset] << 8) | payload[offset + 1];
    const nameLen = (payload[offset + 2] << 8) | payload[offset + 3];
    offset += 4;
    if (offset + nameLen > payload.length) break;
    const name = sharedUtf8Decoder.decode(payload.subarray(offset, offset + nameLen));
    offset += nameLen;
    nodeMapping[nodeId] = name;
    if (name !== 'air' && name !== 'ignore') {
      hasOpaqueOrLiquidNode = true;
    }
    if (name === 'air' || (!isUnexcavatedMatrixRock(name) && name !== 'ignore')) {
      hasAirOrNonRockInCave = true;
    }
  }

  if (!hasOpaqueOrLiquidNode) {
    return null;
  }

  if (caveMode && !hasAirOrNonRockInCave) {
    return null;
  }

  if (offset + 2 > payload.length) return null;
  const contentWidth = payload[offset++];
  const paramsWidth = payload[offset++];
  if (contentWidth !== 2 || paramsWidth !== 2) return null;

  if (offset + 8192 > payload.length) return null;

  const columns = extractSurfaceColumnsFromParam0(payload, offset, nodeMapping, caveMode);
  if (columns.length === 0) return null;

  return {
    posKey,
    blockX,
    blockY,
    blockZ,
    version,
    nodeMapping,
    columns
  };
}

function decodeV28Payload(
  posKey: string,
  blockX: number,
  blockY: number,
  blockZ: number,
  version: number,
  blob: Uint8Array,
  caveMode: boolean
): ParsedMapBlockSummary | null {
  const headerLen = version >= 27 ? 6 : 4;
  if (blob.length <= headerLen + 2) return null;

  const nodeMapping = scanNameIdMappingsFromTail(blob, headerLen);
  const mapKeys = Object.keys(nodeMapping);
  if (mapKeys.length > 0) {
    let hasOpaqueOrLiquidNode = false;
    let hasAirOrNonRockInCave = false;
    for (let i = 0; i < mapKeys.length; i++) {
      const name = nodeMapping[Number(mapKeys[i])];
      if (name !== 'air' && name !== 'ignore') {
        hasOpaqueOrLiquidNode = true;
      }
      if (name === 'air' || (!isUnexcavatedMatrixRock(name) && name !== 'ignore')) {
        hasAirOrNonRockInCave = true;
      }
    }
    if (!hasOpaqueOrLiquidNode) return null;
    if (caveMode && !hasAirOrNonRockInCave) return null;
  }

  const inflator = new pako.Inflate();
  inflator.push(blob.subarray(headerLen), false);
  if (!inflator.result) return null;
  const nodeData = inflator.result as Uint8Array;
  if (nodeData.length < 8192) return null;

  const columns = extractSurfaceColumnsFromParam0(nodeData, 0, nodeMapping, caveMode);
  if (columns.length === 0) return null;

  return {
    posKey,
    blockX,
    blockY,
    blockZ,
    version,
    nodeMapping,
    columns
  };
}

function scanNameIdMappingsFromTail(blob: Uint8Array, startOffset: number): Record<number, string> {
  const mapping: Record<number, string> = {};

  for (let pos = blob.length - 6; pos >= startOffset; pos--) {
    if (blob[pos] === 0) {
      const count = (blob[pos + 1] << 8) | blob[pos + 2];
      if (count >= 1 && count <= 512) {
        let cursor = pos + 3;
        let valid = true;
        const tempMap: Record<number, string> = {};
        for (let i = 0; i < count; i++) {
          if (cursor + 4 > blob.length) {
            valid = false;
            break;
          }
          const id = (blob[cursor] << 8) | blob[cursor + 1];
          const len = (blob[cursor + 2] << 8) | blob[cursor + 3];
          cursor += 4;
          if (len === 0 || len > 96 || cursor + len > blob.length) {
            valid = false;
            break;
          }
          const strBytes = blob.subarray(cursor, cursor + len);
          for (let b = 0; b < strBytes.length; b++) {
            if (strBytes[b] < 32 || strBytes[b] > 126) {
              valid = false;
              break;
            }
          }
          if (!valid) break;
          tempMap[id] = sharedUtf8Decoder.decode(strBytes);
          cursor += len;
        }
        if (valid && Object.keys(tempMap).length > 0) {
          return tempMap;
        }
      }
    }
  }

  return mapping;
}

function extractSurfaceColumnsFromParam0(
  buffer: Uint8Array,
  param0Offset: number,
  nodeMapping: Record<number, string>,
  caveMode: boolean
): ParsedMapBlockSummary['columns'] {
  const columns: ParsedMapBlockSummary['columns'] = [];

  for (let lz = 0; lz < 16; lz++) {
    for (let lx = 0; lx < 16; lx++) {
      if (!caveMode) {
        let topLocalY = -1;
        let topNodeName = 'air';
        let waterCount = 0;

        for (let ly = 15; ly >= 0; ly--) {
          const nodeIdx = (lz << 8) | (ly << 4) | lx;
          const byteIdx = param0Offset + (nodeIdx << 1);
          const param0 = (buffer[byteIdx] << 8) | buffer[byteIdx + 1];
          const name = nodeMapping[param0] || 'air';

          if (name === 'air' || name === 'ignore') {
            continue;
          }
          if (name.includes('water')) {
            waterCount++;
            if (topLocalY === -1) {
              topLocalY = ly;
              topNodeName = name;
            }
            continue;
          }
          if (topLocalY === -1) {
            topLocalY = ly;
            topNodeName = name;
          }
          break;
        }

        if (topLocalY !== -1) {
          columns.push({
            localX: lx,
            localZ: lz,
            topLocalY,
            nodeName: topNodeName,
            waterCount
          });
        }
      } else {
        let seenAirCavity = false;
        let floorLocalY = -1;
        let floorNodeName = 'air';
        let waterCount = 0;
        let specialNodeY = -1;
        let specialNodeName = '';

        for (let ly = 15; ly >= 0; ly--) {
          const nodeIdx = (lz << 8) | (ly << 4) | lx;
          const byteIdx = param0Offset + (nodeIdx << 1);
          const param0 = (buffer[byteIdx] << 8) | buffer[byteIdx + 1];
          const name = nodeMapping[param0] || 'air';

          if (name === 'ignore') continue;

          if (name === 'air') {
            seenAirCavity = true;
            continue;
          }

          if (name.includes('water')) {
            seenAirCavity = true;
            waterCount++;
            if (floorLocalY === -1) {
              floorLocalY = ly;
              floorNodeName = name;
            }
            continue;
          }

          if (!isUnexcavatedMatrixRock(name) && specialNodeY === -1) {
            specialNodeY = ly;
            specialNodeName = name;
          }

          if (seenAirCavity) {
            floorLocalY = ly;
            floorNodeName = name;
            break;
          }
        }

        if (floorLocalY !== -1) {
          columns.push({
            localX: lx,
            localZ: lz,
            topLocalY: floorLocalY,
            nodeName: floorNodeName,
            waterCount
          });
        } else if (specialNodeY !== -1) {
          columns.push({
            localX: lx,
            localZ: lz,
            topLocalY: specialNodeY,
            nodeName: specialNodeName,
            waterCount: 0
          });
        } else if (seenAirCavity) {
          columns.push({
            localX: lx,
            localZ: lz,
            topLocalY: 0,
            nodeName: 'default:cobble',
            waterCount: 0
          });
        }
      }
    }
  }

  return columns;
}

/**
 * Generates a rich, realistic built-in Demo World Database around spawn
 * with support for vertical elevation slices (Sky Islands / Floatlands, Surface Citadel, Underground Caves).
 */
export function buildDemoWorldDatabase(
  seed: number,
  slicePreset: VerticalSlicePresetId = 'surface'
): DecodedWorldDatabase {
  const defaults = createDefaultNoiseParams();
  const synth = new LuantiWorldSynthesizer(
    seed,
    'v7',
    1,
    defaults.heatNoise,
    defaults.humidityNoise,
    defaults.terrainNoise
  );

  const surfaceColumns = new Map<string, ParsedColumnSurface>();
  const blockSurfaces = new Map<string, CompactBlockSurface>();
  const macroMipmap = new Map<string, MacroMipmapCell>();
  const exploredBlockCoords: Array<{ bx: number; by: number; bz: number }> = [];
  const exploredBlockKeys = new Set<string>();
  const nodeCounts: Record<string, number> = {};

  const radiusBlocks = 14;
  let totalBlocks = 0;

  for (let bz = -radiusBlocks; bz <= radiusBlocks; bz++) {
    for (let bx = -radiusBlocks; bx <= radiusBlocks; bx++) {
      const dist = Math.hypot(bx, bz);
      const angle = Math.atan2(bz, bx);
      const lobe = Math.sin(angle * 3 + 0.8) * 2.5 + Math.cos(angle * 5) * 1.5;
      if (dist > radiusBlocks - 2.5 + lobe) continue;

      totalBlocks++;
      exploredBlockCoords.push({ bx, by: 0, bz });
      exploredBlockKeys.add(`${bx},${bz}`);

      const columns: ParsedMapBlockSummary['columns'] = [];

      for (let lz = 0; lz < 16; lz++) {
        for (let lx = 0; lx < 16; lx++) {
          const worldX = bx * 16 + lx;
          const worldZ = bz * 16 + lz;

          if (slicePreset === 'floatlands' || slicePreset === 'high_sky') {
            const c1 = Math.hypot(worldX - 35, worldZ - 25);
            const c2 = Math.hypot(worldX + 60, worldZ + 45);
            const c3 = Math.hypot(worldX - 80, worldZ + 70);
            const skyWave = Math.sin(worldX * 0.08) * 6 + Math.cos(worldZ * 0.08) * 6;
            if (c1 < 42 + skyWave || c2 < 34 + skyWave || c3 < 28 + skyWave) {
              const rDist = Math.min(c1, c2, c3);
              const topY = Math.round(980 + Math.max(0, 40 - rDist) * 1.4);
              const nodeName =
                rDist < 10
                  ? 'default:meselamp'
                  : rDist < 24
                    ? 'everness:crystal_grass'
                    : 'default:silver_sand';
              const color = resolveNodeColor(nodeName);
              surfaceColumns.set(`${worldX},${worldZ}`, {
                x: worldX,
                z: worldZ,
                topY,
                nodeName,
                color,
                waterDepth: 0
              });
              columns.push({
                localX: lx,
                localZ: lz,
                topLocalY: topY - 960,
                nodeName,
                waterCount: 0
              });
            }
            continue;
          }

          if (
            slicePreset === 'caves' ||
            slicePreset === 'deep_caverns' ||
            slicePreset === 'abyss'
          ) {
            const tunnelA = Math.abs(Math.sin(worldX * 0.035) * 45 - worldZ);
            const tunnelB = Math.abs(Math.cos(worldZ * 0.04) * 50 - worldX);
            const chamber = Math.hypot(worldX - 30, worldZ + 30);
            if (tunnelA < 11 || tunnelB < 10 || chamber < 32) {
              const isLava = chamber < 14 || (tunnelA < 3 && worldX > 20);
              const isCrystal = chamber >= 14 && chamber < 20;
              const nodeName = isLava
                ? 'default:lava_source'
                : isCrystal
                  ? 'everness:crystal_moss_block'
                  : 'default:cobble';
              const topY =
                slicePreset === 'abyss' ? -20100 : slicePreset === 'deep_caverns' ? -4200 : -140;
              const color = resolveNodeColor(nodeName);
              surfaceColumns.set(`${worldX},${worldZ}`, {
                x: worldX,
                z: worldZ,
                topY,
                nodeName,
                color,
                waterDepth: 0
              });
              columns.push({
                localX: lx,
                localZ: lz,
                topLocalY: 4,
                nodeName,
                waterCount: 0
              });
            }
            continue;
          }

          const pt = synth.evaluatePoint(worldX, worldZ);
          let topY = pt.elevation;
          let nodeName = pt.biome.topNode;
          let waterDepth = 0;

          if (topY < 1) {
            waterDepth = 1 - topY;
            nodeName = pt.heat < 18 ? 'default:ice' : 'default:water_source';
            topY = 1;
          }

          const distFromOrigin = Math.hypot(worldX, worldZ);

          if (Math.abs(worldX) <= 22 && Math.abs(worldZ) <= 22) {
            const ax = Math.abs(worldX);
            const az = Math.abs(worldZ);
            topY = Math.max(topY, 14);
            waterDepth = 0;
            if ((ax === 22 || az === 22) && (ax >= 18 || az >= 18)) {
              topY += 12;
              nodeName = 'default:stonebrick';
            } else if (ax === 22 || az === 22) {
              topY += 6;
              nodeName = 'default:cobble';
            } else if (ax <= 6 && az <= 6) {
              topY += 10;
              nodeName = ax <= 1 && az <= 1 ? 'default:meselamp' : 'default:brick';
            } else {
              nodeName = (worldX + worldZ) % 2 === 0 ? 'default:stonebrick' : 'default:cobble';
            }
          } else if (
            (Math.abs(worldX) <= 2 && Math.abs(worldZ) <= 160) ||
            (Math.abs(worldZ) <= 2 && Math.abs(worldX) <= 160)
          ) {
            if (pt.elevation < 1) {
              topY = 3;
              waterDepth = 0;
              nodeName = 'default:wood';
            } else {
              topY = pt.elevation + 1;
              nodeName =
                Math.abs(worldX) === 2 || Math.abs(worldZ) === 2
                  ? 'default:stonebrick'
                  : 'default:cobble';
            }
          } else if (Math.hypot(worldX - 85, worldZ - 65) < 26) {
            const vx = worldX - 85;
            const vz = worldZ - 65;
            if (Math.abs(vx % 12) < 6 && Math.abs(vz % 12) < 6) {
              topY = Math.max(4, pt.elevation + 5);
              waterDepth = 0;
              nodeName = 'default:wood';
            }
          } else if (distFromOrigin > 40 && Math.hypot(worldX + 95, worldZ + 80) <= 8) {
            const r = Math.hypot(worldX + 95, worldZ + 80);
            topY = Math.max(8, pt.elevation) + Math.round((8 - r) * 3);
            waterDepth = 0;
            nodeName = r < 2.5 ? 'default:meselamp' : 'default:brick';
          }

          const color = resolveNodeColor(nodeName);
          surfaceColumns.set(`${worldX},${worldZ}`, {
            x: worldX,
            z: worldZ,
            topY,
            nodeName,
            color,
            waterDepth
          });

          columns.push({
            localX: lx,
            localZ: lz,
            topLocalY: topY,
            nodeName,
            waterCount: waterDepth
          });
        }
      }

      if (columns.length > 0) {
        const blockY =
          slicePreset === 'floatlands' || slicePreset === 'high_sky'
            ? 60
            : slicePreset === 'abyss'
              ? -1256
              : slicePreset === 'deep_caverns'
                ? -262
                : slicePreset === 'caves'
                  ? -9
                  : 0;
        mergeParsedBlockIntoCompactSurface(
          {
            posKey: `${bx},${blockY},${bz}`,
            blockX: bx,
            blockY,
            blockZ: bz,
            version: 29,
            nodeMapping: {},
            columns
          },
          -31000,
          31000,
          blockSurfaces,
          macroMipmap,
          nodeCounts
        );
      }
    }
  }

  return {
    fileName: 'demo-world/map.sqlite',
    fileSizeBytes: totalBlocks * 4096,
    totalBlocks,
    minBlockX: -radiusBlocks,
    maxBlockX: radiusBlocks,
    minBlockZ: -radiusBlocks,
    maxBlockZ: radiusBlocks,
    surfaceColumns,
    blockSurfaces,
    macroMipmap,
    exploredBlockCoords,
    exploredBlockKeys,
    discoveredRegions: [
      {
        id: 'spawn',
        label: 'Spawn Citadel (0, 0)',
        centerX: 0,
        centerZ: 0,
        blockCount: totalBlocks,
        kind: 'spawn'
      },
      {
        id: 'village',
        label: 'East Outpost (85, 65)',
        centerX: 85,
        centerZ: 65,
        blockCount: 16,
        kind: 'base'
      },
      {
        id: 'lighthouse',
        label: 'West Lighthouse (-95, -80)',
        centerX: -95,
        centerZ: -80,
        blockCount: 9,
        kind: 'base'
      }
    ],
    verticalLayers: [
      {
        id: 'floatlands',
        label: 'Sky Islands / Floatlands',
        description: 'Floating sky islands & cloud realms (+480 to +1,760)',
        minY: 480,
        maxY: 1760,
        estimatedBlocks: 84,
        hotspotX: 0,
        hotspotZ: 0,
        caveMode: false
      },
      {
        id: 'surface',
        label: 'Surface, Islands & Ocean',
        description: 'Main world ocean, islands & mountain peaks (-16 to +240)',
        minY: -16,
        maxY: 240,
        estimatedBlocks: totalBlocks,
        hotspotX: 0,
        hotspotZ: 0,
        caveMode: false
      },
      {
        id: 'caves',
        label: 'Underground Caves & Mines',
        description: 'Shallow cave networks, mineshafts & lava chambers (-1,024 to -17)',
        minY: -1024,
        maxY: -17,
        estimatedBlocks: 142,
        hotspotX: 0,
        hotspotZ: 0,
        caveMode: true
      }
    ],
    nodeCounts
  };
}
