/// <reference lib="webworker" />

import {
  CompactBlockSurface,
  MacroMipmapCell,
  ParsedColumnSurface
} from '../core/models/world.model';
import { TileRenderJobPayload, renderTilePngBuffer } from '../core/utils/tile-renderer';

// Eviction is coordinated by the main thread's distance-aware `evictDistantBlocksIfNeeded()`
// via `evictedKeys` in `APPEND_DB_BLOCKS` so workers never silently drop spawn/center sectors
// behind the main thread's `loadedSubSectors` tracker.
const MAX_WORKER_CACHED_BLOCKS = 131072;

let cachedDbColumns: Map<string, ParsedColumnSurface> = new Map();
let cachedExploredBlocks: Set<string> = new Set();
let cachedBlockSurfaces: Map<string, CompactBlockSurface> = new Map();
let cachedMacroMipmap: Map<string, MacroMipmapCell> = new Map();

function enforceWorkerBlockLruCap(): void {
  if (cachedBlockSurfaces.size <= MAX_WORKER_CACHED_BLOCKS) return;
  const excess = cachedBlockSurfaces.size - MAX_WORKER_CACHED_BLOCKS;
  let removed = 0;
  for (const key of cachedBlockSurfaces.keys()) {
    cachedBlockSurfaces.delete(key);
    removed++;
    if (removed >= excess) break;
  }
}

addEventListener('message', ({ data }) => {
  if (!data) return;

  if (data.type === 'SYNC_DB') {
    const entries: Array<[string, ParsedColumnSurface]> = data.entries || [];
    const exploredKeys: string[] = data.exploredKeys || [];
    const blockEntries: Array<[string, CompactBlockSurface]> = data.blockEntries || [];
    const mipmapEntries: Array<[string, MacroMipmapCell]> = data.mipmapEntries || [];

    cachedDbColumns = new Map(entries);
    cachedExploredBlocks = new Set(exploredKeys);
    cachedBlockSurfaces = new Map(blockEntries);
    cachedMacroMipmap = new Map(mipmapEntries);
    enforceWorkerBlockLruCap();
    return;
  }

  if (data.type === 'APPEND_DB_BLOCKS') {
    const blockEntries: Array<[string, CompactBlockSurface]> = data.blockEntries || [];
    const mipmapEntries: Array<[string, MacroMipmapCell]> = data.mipmapEntries || [];
    const evictedKeys: string[] = data.evictedKeys || [];

    for (let i = 0; i < evictedKeys.length; i++) {
      cachedBlockSurfaces.delete(evictedKeys[i]);
    }

    for (let i = 0; i < blockEntries.length; i++) {
      const [k, v] = blockEntries[i];
      cachedBlockSurfaces.delete(k);
      cachedBlockSurfaces.set(k, v);
      cachedExploredBlocks.add(k);
    }

    for (let i = 0; i < mipmapEntries.length; i++) {
      const [k, v] = mipmapEntries[i];
      cachedMacroMipmap.set(k, v);
    }

    enforceWorkerBlockLruCap();
    return;
  }

  if (data.type === 'RENDER_TILE') {
    const job: TileRenderJobPayload = data.job;
    const pngBuffer = renderTilePngBuffer(
      job,
      cachedDbColumns,
      cachedExploredBlocks,
      cachedBlockSurfaces,
      cachedMacroMipmap
    );
    postMessage(
      {
        type: 'TILE_DONE',
        jobId: job.jobId,
        buffer: pngBuffer
      },
      [pngBuffer]
    );
  }
});
