import type { DiscoveredWorldRegion, VerticalLayerSummary, VerticalSlicePresetId } from '../models/world.model';
import { packBlockPos, unpackBlockPos } from './mapblock-parser';

interface VarintResult {
  value: number;
  bytes: number;
}

export interface RawSqliteMapBlockRow {
  x: number;
  y: number;
  z: number;
  rowid: number;
  data: Uint8Array;
}

export interface SqliteOverviewSummary {
  hasXyzSchema: boolean;
  estimatedTotalBlocks: number;
  minBlockX: number;
  maxBlockX: number;
  minBlockZ: number;
  maxBlockZ: number;
  exploredBlockKeys: Set<string>;
  discoveredRegions: DiscoveredWorldRegion[];
  verticalLayers: VerticalLayerSummary[];
  /** All non-empty 64x64 MapBlock macro sectors across the database */
  exploredMacroSectors: Array<{ mx: number; mz: number }>;
  /** Interior B-Tree divider keys with exact rowids for instant global mipmap sampling */
  dividerSamples: Array<{ x: number; y: number; z: number; rowid: number }>;
}

const CHUNK_SIZE_BYTES = 512 * 1024; // 512 KB per slice read
const MAX_CACHED_CHUNKS = 64; // Max 32 MB RAM cache for random-access file slices

/**
 * Zero-OOM Random-Access SQLite3 B-Tree Reader operating directly on `File.slice()`.
 */
export class SqliteFileBtreeReader {
  private readonly file: File;
  public pageSize = 4096;
  public usableSize = 4096;
  public totalPages = 0;
  public blocksTableRootPage = 0;
  public blocksIndexRootPage = 0;
  public hasXyzSchema = false;

  private readonly chunkCache = new Map<number, Uint8Array>();
  private readonly utf8Decoder = new TextDecoder('utf-8');

  constructor(file: File) {
    this.file = file;
  }

  public async init(): Promise<void> {
    const headerBuf = new Uint8Array(await this.file.slice(0, 4096).arrayBuffer());
    const magic = this.utf8Decoder.decode(headerBuf.subarray(0, 15));
    if (magic !== 'SQLite format 3') {
      throw new Error(`"${this.file.name}" is not a valid SQLite 3 database file.`);
    }

    const rawPageSize = (headerBuf[16] << 8) | headerBuf[17];
    this.pageSize = rawPageSize === 1 ? 65536 : rawPageSize;
    const reservedSpace = headerBuf[20];
    this.usableSize = this.pageSize - reservedSpace;
    this.totalPages = Math.floor(this.file.size / this.pageSize);

    await this.scanSqliteMaster(1);

    if (this.blocksTableRootPage === 0) {
      throw new Error(`"${this.file.name}" does not contain a Luanti 'blocks' table.`);
    }
  }

  private async readBytes(offset: number, length: number): Promise<Uint8Array> {
    const chunkIndex = Math.floor(offset / CHUNK_SIZE_BYTES);
    const chunkStart = chunkIndex * CHUNK_SIZE_BYTES;
    const offsetInChunk = offset - chunkStart;

    if (offsetInChunk + length <= CHUNK_SIZE_BYTES) {
      let chunk = this.chunkCache.get(chunkIndex);
      if (!chunk) {
        const sliceEnd = Math.min(this.file.size, chunkStart + CHUNK_SIZE_BYTES);
        const ab = await this.file.slice(chunkStart, sliceEnd).arrayBuffer();
        chunk = new Uint8Array(ab);
        if (this.chunkCache.size >= MAX_CACHED_CHUNKS) {
          const oldestKey = this.chunkCache.keys().next().value;
          if (oldestKey !== undefined) {
            this.chunkCache.delete(oldestKey);
          }
        }
        this.chunkCache.set(chunkIndex, chunk);
      } else {
        this.chunkCache.delete(chunkIndex);
        this.chunkCache.set(chunkIndex, chunk);
      }
      return chunk.subarray(offsetInChunk, offsetInChunk + length);
    }

    const ab = await this.file.slice(offset, Math.min(this.file.size, offset + length)).arrayBuffer();
    return new Uint8Array(ab);
  }

  public async readPage(pageNumber: number): Promise<Uint8Array> {
    if (pageNumber < 1 || pageNumber > this.totalPages) {
      return new Uint8Array(this.pageSize);
    }
    const byteOffset = (pageNumber - 1) * this.pageSize;
    return this.readBytes(byteOffset, this.pageSize);
  }

  private async scanSqliteMaster(pageNumber: number): Promise<void> {
    const page = await this.readPage(pageNumber);
    const hdrOff = pageNumber === 1 ? 100 : 0;
    const pageType = page[hdrOff];
    const cellCount = (page[hdrOff + 3] << 8) | page[hdrOff + 4];

    if (pageType === 0x05) {
      const rightChild = this.readUint32(page, hdrOff + 8);
      const ptrBase = hdrOff + 12;
      for (let i = 0; i < cellCount; i++) {
        const cellOff = (page[ptrBase + i * 2] << 8) | page[ptrBase + i * 2 + 1];
        const leftChild = this.readUint32(page, cellOff);
        await this.scanSqliteMaster(leftChild);
      }
      await this.scanSqliteMaster(rightChild);
      return;
    }

    if (pageType !== 0x0d) return;

    const ptrBase = hdrOff + 8;
    for (let i = 0; i < cellCount; i++) {
      const cellOff = (page[ptrBase + i * 2] << 8) | page[ptrBase + i * 2 + 1];
      const payloadVar = this.readVarint(page, cellOff);
      const rowidVar = this.readVarint(page, cellOff + payloadVar.bytes);
      const recordOffset = cellOff + payloadVar.bytes + rowidVar.bytes;
      const recordBytes = page.subarray(recordOffset, recordOffset + payloadVar.value);

      const cols = this.decodeRecordFields(recordBytes);
      const type = String(cols[0] ?? '');
      const name = String(cols[1] ?? '');
      const tblName = String(cols[2] ?? '');
      const rootpage = Number(cols[3] ?? 0);
      const sql = String(cols[4] ?? '');

      if (type === 'table' && name === 'blocks') {
        this.blocksTableRootPage = rootpage;
        this.hasXyzSchema = /\bx\b/i.test(sql) && /\by\b/i.test(sql) && /\bz\b/i.test(sql);
      } else if (type === 'index' && tblName === 'blocks' && this.blocksIndexRootPage === 0) {
        this.blocksIndexRootPage = rootpage;
      }
    }
  }

  /**
   * Rapidly scans ONLY the interior pages (`0x02`) of `sqlite_autoindex_blocks_1`
   * (or the single leaf root page on small databases).
   *
   * IMPORTANT: Does NOT populate `exploredBlockKeys` with sparse 1-in-195 B-Tree divider keys,
   * avoiding the "fractured scattered 16x16 squares" artifact!
   */
  public async scanOverviewAndVerticalLayers(
    onProgress?: (pagesVisited: number, samplesFound: number) => void
  ): Promise<SqliteOverviewSummary> {
    const exploredBlockKeys = new Set<string>();
    const dividerSamples: Array<{ x: number; y: number; z: number; rowid: number }> = [];
    const regionMap = new Map<
      string,
      { rx: number; rz: number; count: number; surfaceCount: number; sumX: number; sumZ: number }
    >();
    let pagesVisited = 0;
    let lastYieldMs = typeof performance !== 'undefined' ? performance.now() : Date.now();

    const maybeYieldProgress = async (): Promise<void> => {
      pagesVisited++;
      if ((pagesVisited & 7) === 0) {
        onProgress?.(pagesVisited, totalSamples);
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        if (now - lastYieldMs >= 24) {
          lastYieldMs = now;
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
    };

    const layerDefs: Array<{
      id: VerticalSlicePresetId;
      label: string;
      description: string;
      minY: number;
      maxY: number;
      minBlockY: number;
      maxBlockY: number;
      caveMode: boolean;
    }> = [
      {
        id: 'high_sky',
        label: 'High Space / Stratosphere',
        description: 'Orbital & stratosphere structures (+3,800 to +10,300)',
        minY: 3800,
        maxY: 10300,
        minBlockY: 237,
        maxBlockY: 644,
        caveMode: false
      },
      {
        id: 'floatlands',
        label: 'Sky Islands / Floatlands',
        description: 'Floating sky islands & cloud realms (+480 to +1,760)',
        minY: 480,
        maxY: 1760,
        minBlockY: 30,
        maxBlockY: 110,
        caveMode: false
      },
      {
        id: 'surface',
        label: 'Surface, Islands & Ocean',
        description: 'Main world ocean, islands & mountain peaks (-16 to +240)',
        minY: -16,
        maxY: 240,
        minBlockY: -1,
        maxBlockY: 15,
        caveMode: false
      },
      {
        id: 'caves',
        label: 'Underground Caves & Mines',
        description: 'Shallow cave networks, mineshafts & caverns (-1,024 to -17)',
        minY: -1024,
        maxY: -17,
        minBlockY: -64,
        maxBlockY: -2,
        caveMode: true
      },
      {
        id: 'deep_caverns',
        label: 'Deep Caverns & Magma',
        description: 'Deep subterranean caverns & mese realms (-10,240 to -1,025)',
        minY: -10240,
        maxY: -1025,
        minBlockY: -640,
        maxBlockY: -65,
        caveMode: true
      },
      {
        id: 'abyss',
        label: 'Deep Abyss / Underworld',
        description: 'Extreme depth underworld realms (-31,000 to -10,241)',
        minY: -31000,
        maxY: -10241,
        minBlockY: -1938,
        maxBlockY: -641,
        caveMode: true
      }
    ];

    const layerStats = new Map<
      VerticalSlicePresetId,
      {
        sampleCount: number;
        sectorBuckets: Map<string, { count: number; sumX: number; sumZ: number }>;
      }
    >();
    for (const def of layerDefs) {
      layerStats.set(def.id, { sampleCount: 0, sectorBuckets: new Map() });
    }

    let minBlockX = 0;
    let maxBlockX = 0;
    let minBlockZ = 0;
    let maxBlockZ = 0;
    let first = true;
    let sampleMultiplier = 195;
    let totalSamples = 0;

    const recordKey = (bx: number, by: number, bz: number, rowid: number, isExactLeaf: boolean) => {
      if (bx < -2048 || bx > 2048 || bz < -2048 || bz > 2048) return;
      totalSamples++;

      if (first) {
        minBlockX = maxBlockX = bx;
        minBlockZ = maxBlockZ = bz;
        first = false;
      } else {
        if (bx < minBlockX) minBlockX = bx;
        if (bx > maxBlockX) maxBlockX = bx;
        if (bz < minBlockZ) minBlockZ = bz;
        if (bz > maxBlockZ) maxBlockZ = bz;
      }

      if (isExactLeaf) {
        exploredBlockKeys.add(`${bx},${bz}`);
      } else {
        dividerSamples.push({ x: bx, y: by, z: bz, rowid });
      }

      const rx = Math.floor(bx / 64);
      const rz = Math.floor(bz / 64);
      const rKey = `${rx},${rz}`;
      const isSurfaceBand = by >= -2 && by <= 15;
      const existing = regionMap.get(rKey);
      if (existing) {
        existing.count++;
        if (isSurfaceBand) existing.surfaceCount++;
        existing.sumX += bx * 16 + 8;
        existing.sumZ += bz * 16 + 8;
      } else {
        regionMap.set(rKey, {
          rx,
          rz,
          count: 1,
          surfaceCount: isSurfaceBand ? 1 : 0,
          sumX: bx * 16 + 8,
          sumZ: bz * 16 + 8
        });
      }

      for (const def of layerDefs) {
        if (by >= def.minBlockY && by <= def.maxBlockY) {
          const st = layerStats.get(def.id)!;
          st.sampleCount++;
          const secKey = `${Math.floor(bx / 32)},${Math.floor(bz / 32)}`;
          const bucket = st.sectorBuckets.get(secKey);
          if (bucket) {
            bucket.count++;
            bucket.sumX += bx * 16 + 8;
            bucket.sumZ += bz * 16 + 8;
          } else {
            st.sectorBuckets.set(secKey, {
              count: 1,
              sumX: bx * 16 + 8,
              sumZ: bz * 16 + 8
            });
          }
          break;
        }
      }
    };

    if (this.hasXyzSchema && this.blocksIndexRootPage > 0) {
      const rootPage = await this.readPage(this.blocksIndexRootPage);
      const rootHdr = this.blocksIndexRootPage === 1 ? 100 : 0;
      const rootType = rootPage[rootHdr];

      if (rootType === 0x0a) {
        sampleMultiplier = 1;
        const cellCount = (rootPage[rootHdr + 3] << 8) | rootPage[rootHdr + 4];
        const ptrBase = rootHdr + 8;
        for (let i = 0; i < cellCount; i++) {
          const cellOff = (rootPage[ptrBase + i * 2] << 8) | rootPage[ptrBase + i * 2 + 1];
          const k = this.decodeIndexKeyXZYRowid(rootPage, cellOff);
          recordKey(k.x, k.y, k.z, k.rowid, true);
        }
        await maybeYieldProgress();
      } else {
        let knownLeafDepth = -1;
        const visitInterior = async (pageNum: number, depth: number): Promise<void> => {
          if (
            depth > 4 ||
            (knownLeafDepth !== -1 && depth >= knownLeafDepth) ||
            pageNum < 1 ||
            pageNum > this.totalPages
          ) {
            return;
          }
          const page = await this.readPage(pageNum);
          await maybeYieldProgress();
          const hdrOff = pageNum === 1 ? 100 : 0;
          const pageType = page[hdrOff];
          if (pageType !== 0x02) {
            // SQLite B-Trees are 100% height-balanced: all 0x0a leaf pages live at the exact same depth!
            knownLeafDepth = depth;
            return;
          }

          const cellCount = (page[hdrOff + 3] << 8) | page[hdrOff + 4];
          const rightChild = this.readUint32(page, hdrOff + 8);
          const ptrBase = hdrOff + 12;

          for (let i = 0; i < cellCount; i++) {
            const cellOff = (page[ptrBase + i * 2] << 8) | page[ptrBase + i * 2 + 1];
            const k = this.decodeIndexKeyXZYRowid(page, cellOff + 4);
            recordKey(k.x, k.y, k.z, k.rowid, false);
            if (
              depth < 4 &&
              (knownLeafDepth === -1 || depth + 1 < knownLeafDepth)
            ) {
              const leftChild = this.readUint32(page, cellOff);
              await visitInterior(leftChild, depth + 1);
            }
          }
          if (depth < 4 && (knownLeafDepth === -1 || depth + 1 < knownLeafDepth)) {
            await visitInterior(rightChild, depth + 1);
          }
        };

        await visitInterior(this.blocksIndexRootPage, 0);
      }
    } else if (!this.hasXyzSchema && this.blocksIndexRootPage > 0) {
      // Classic `blocks(pos INT64 PRIMARY KEY, data BLOB)` with `sqlite_autoindex_blocks_1 (pos, rowid)`
      const rootPage = await this.readPage(this.blocksIndexRootPage);
      const rootHdr = this.blocksIndexRootPage === 1 ? 100 : 0;
      const rootType = rootPage[rootHdr];

      if (rootType === 0x0a) {
        sampleMultiplier = 1;
        const cellCount = (rootPage[rootHdr + 3] << 8) | rootPage[rootHdr + 4];
        const ptrBase = rootHdr + 8;
        for (let i = 0; i < cellCount; i++) {
          const cellOff = (rootPage[ptrBase + i * 2] << 8) | rootPage[ptrBase + i * 2 + 1];
          const k = this.decodeIndexKeyPosRowid(rootPage, cellOff);
          const coords = unpackBlockPos(k.pos);
          recordKey(coords.x, coords.y, coords.z, k.rowid, true);
        }
        await maybeYieldProgress();
      } else {
        sampleMultiplier = 195;
        let knownLeafDepth = -1;
        const visitPosIndexInterior = async (pageNum: number, depth: number): Promise<void> => {
          if (
            depth > 4 ||
            (knownLeafDepth !== -1 && depth >= knownLeafDepth) ||
            pageNum < 1 ||
            pageNum > this.totalPages
          ) {
            return;
          }
          const page = await this.readPage(pageNum);
          await maybeYieldProgress();
          const hdrOff = pageNum === 1 ? 100 : 0;
          const pageType = page[hdrOff];
          if (pageType !== 0x02) {
            knownLeafDepth = depth;
            return;
          }

          const cellCount = (page[hdrOff + 3] << 8) | page[hdrOff + 4];
          const rightChild = this.readUint32(page, hdrOff + 8);
          const ptrBase = hdrOff + 12;

          for (let i = 0; i < cellCount; i++) {
            const cellOff = (page[ptrBase + i * 2] << 8) | page[ptrBase + i * 2 + 1];
            const k = this.decodeIndexKeyPosRowid(page, cellOff + 4);
            const coords = unpackBlockPos(k.pos);
            recordKey(coords.x, coords.y, coords.z, k.rowid, false);
            if (
              depth < 4 &&
              (knownLeafDepth === -1 || depth + 1 < knownLeafDepth)
            ) {
              const leftChild = this.readUint32(page, cellOff);
              await visitPosIndexInterior(leftChild, depth + 1);
            }
          }
          if (depth < 4 && (knownLeafDepth === -1 || depth + 1 < knownLeafDepth)) {
            await visitPosIndexInterior(rightChild, depth + 1);
          }
        };

        await visitPosIndexInterior(this.blocksIndexRootPage, 0);
      }
    } else if (!this.hasXyzSchema && this.blocksTableRootPage > 0) {
      sampleMultiplier = 1;
      const isSmallDb = this.totalPages <= 1024;
      let knownLeafDepth = -1;
      const visitClassicOverview = async (pageNum: number, depth: number): Promise<void> => {
        if (
          depth > 6 ||
          (!isSmallDb && knownLeafDepth !== -1 && depth >= knownLeafDepth) ||
          pageNum < 1 ||
          pageNum > this.totalPages
        ) {
          return;
        }
        const page = await this.readPage(pageNum);
        await maybeYieldProgress();
        const hdrOff = pageNum === 1 ? 100 : 0;
        const pageType = page[hdrOff];
        const cellCount = (page[hdrOff + 3] << 8) | page[hdrOff + 4];

        if (pageType === 0x05) {
          const rightChild = this.readUint32(page, hdrOff + 8);
          const ptrBase = hdrOff + 12;

          for (let i = 0; i < cellCount; i++) {
            const cellOff = (page[ptrBase + i * 2] << 8) | page[ptrBase + i * 2 + 1];
            const leftChild = this.readUint32(page, cellOff);
            if (isSmallDb) {
              await visitClassicOverview(leftChild, depth + 1);
            } else {
              const keyBig = this.readVarintBigInt(page, cellOff + 4);
              const keyNum = Number(keyBig);
              const coords = unpackBlockPos(keyBig);
              recordKey(coords.x, coords.y, coords.z, keyNum, false);
              if (
                depth < 4 &&
                (knownLeafDepth === -1 || depth + 1 < knownLeafDepth)
              ) {
                await visitClassicOverview(leftChild, depth + 1);
              }
            }
          }
          if (isSmallDb || (depth < 4 && (knownLeafDepth === -1 || depth + 1 < knownLeafDepth))) {
            await visitClassicOverview(rightChild, depth + 1);
          }
        } else if (pageType === 0x0d) {
          if (!isSmallDb) {
            knownLeafDepth = depth;
            return;
          }
          const ptrBase = hdrOff + 8;
          for (let i = 0; i < cellCount; i++) {
            const cellOff = (page[ptrBase + i * 2] << 8) | page[ptrBase + i * 2 + 1];
            const payloadVar = this.readVarint(page, cellOff);
            const rowidVar = this.readVarint(page, cellOff + payloadVar.bytes);
            const rowidSigned = Number(this.readVarintBigInt(page, cellOff + payloadVar.bytes));
            const posBig = this.extractClassicPosFromLeafCell(page, cellOff, payloadVar, rowidVar);
            const coords = unpackBlockPos(posBig);
            recordKey(coords.x, coords.y, coords.z, rowidSigned, true);
            if (dividerSamples.length < 750) {
              dividerSamples.push({ x: coords.x, y: coords.y, z: coords.z, rowid: rowidSigned });
            }
          }
        }
      };

      if (!isSmallDb) {
        sampleMultiplier = 120;
      }
      await visitClassicOverview(this.blocksTableRootPage, 0);
    }

    onProgress?.(pagesVisited, totalSamples);
    const discoveredRegions = this.buildDiscoveredRegions(regionMap, sampleMultiplier);

    const verticalLayers: VerticalLayerSummary[] = layerDefs.map(def => {
      const st = layerStats.get(def.id)!;
      let bestCenterX = 0;
      let bestCenterZ = 0;
      let bestCount = 0;
      for (const bucket of st.sectorBuckets.values()) {
        if (bucket.count > bestCount) {
          bestCount = bucket.count;
          bestCenterX = Math.round(bucket.sumX / bucket.count);
          bestCenterZ = Math.round(bucket.sumZ / bucket.count);
        }
      }
      return {
        id: def.id,
        label: def.label,
        description: def.description,
        minY: def.minY,
        maxY: def.maxY,
        estimatedBlocks: st.sampleCount * sampleMultiplier,
        hotspotX: bestCenterX,
        hotspotZ: bestCenterZ,
        caveMode: def.caveMode
      };
    });

    const allRegions = Array.from(regionMap.values());
    const hasSurfaceSectors = allRegions.some(r => r.surfaceCount > 0);
    const filteredRegions = hasSurfaceSectors
      ? allRegions.filter(r => r.surfaceCount > 0 || r.count >= 3)
      : allRegions;

    return {
      hasXyzSchema: this.hasXyzSchema,
      estimatedTotalBlocks: Math.max(exploredBlockKeys.size, totalSamples * sampleMultiplier),
      minBlockX,
      maxBlockX,
      minBlockZ,
      maxBlockZ,
      exploredBlockKeys,
      discoveredRegions,
      verticalLayers,
      dividerSamples,
      exploredMacroSectors: filteredRegions.map(r => ({ mx: r.rx, mz: r.rz }))
    };
  }

  /**
   * Fetches BLOBs for a list of pre-selected `{ x, y, z, rowid }` keys (sorted by rowid).
   */
  public async fetchBlocksForKeys(
    keys: Array<{ x: number; y: number; z: number; rowid: number }>,
    onProgress?: (current: number, total: number) => void
  ): Promise<RawSqliteMapBlockRow[]> {
    const sorted = [...keys].sort((a, b) => a.rowid - b.rowid);
    const rows: RawSqliteMapBlockRow[] = [];
    let lastYieldMs = typeof performance !== 'undefined' ? performance.now() : Date.now();

    for (let i = 0; i < sorted.length; i++) {
      const m = sorted[i];
      const blob = await this.fetchBlockBlobByRowid(this.blocksTableRootPage, m.rowid);
      // In Luanti v29 Zstd format, 100% air blocks are 48 bytes and 100% ignore blocks are 50 bytes.
      // Skipping blob.length <= 51 avoids decompressing thousands of empty sky air blocks!
      if (blob && blob.length > 51) {
        rows.push({
          x: m.x,
          y: m.y,
          z: m.z,
          rowid: m.rowid,
          data: blob
        });
      }
      if ((i & 7) === 7 || i === sorted.length - 1) {
        onProgress?.(i + 1, sorted.length);
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        if (now - lastYieldMs >= 24) {
          lastYieldMs = now;
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
    }
    rows.sort((a, b) => a.y - b.y);
    return rows;
  }

  /**
   * Queries `sqlite_autoindex_blocks_1` or the classic `pos` table for MapBlocks inside
   * `[minBx..maxBx, minBz..maxBz, minBy..maxBy]`.
   */
  public async queryBlocksInBounds(
    minBx: number,
    maxBx: number,
    minBz: number,
    maxBz: number,
    minBy: number,
    maxBy: number,
    maxResults = 4096,
    stride = 1
  ): Promise<RawSqliteMapBlockRow[]> {
    if (!this.hasXyzSchema) {
      if (this.blocksIndexRootPage > 0) {
        return this.queryClassicPosIndex(
          minBx,
          maxBx,
          minBz,
          maxBz,
          minBy,
          maxBy,
          maxResults,
          stride
        );
      }
      return this.scanClassicPosTable(minBx, maxBx, minBz, maxBz, minBy, maxBy, maxResults, stride);
    }
    if (this.blocksIndexRootPage === 0) {
      return this.scanClassicPosTable(minBx, maxBx, minBz, maxBz, minBy, maxBy, maxResults, stride);
    }

    const rawMatches: Array<{ x: number; y: number; z: number; rowid: number }> = [];
    const maxRawIndexKeys = maxResults * 16;
    let pagesVisited = 0;
    let lastYieldMs = typeof performance !== 'undefined' ? performance.now() : Date.now();

    const searchIndexPage = async (pageNum: number, depth: number): Promise<void> => {
      if (
        depth > 10 ||
        rawMatches.length >= maxRawIndexKeys ||
        pageNum < 1 ||
        pageNum > this.totalPages
      ) {
        return;
      }
      pagesVisited++;
      if ((pagesVisited & 31) === 0) {
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        if (now - lastYieldMs >= 24) {
          lastYieldMs = now;
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }

      const page = await this.readPage(pageNum);
      const hdrOff = pageNum === 1 ? 100 : 0;
      const pageType = page[hdrOff];
      const cellCount = (page[hdrOff + 3] << 8) | page[hdrOff + 4];

      if (pageType === 0x02) {
        const rightChild = this.readUint32(page, hdrOff + 8);
        const ptrBase = hdrOff + 12;

        for (let i = 0; i < cellCount; i++) {
          const cellOff = (page[ptrBase + i * 2] << 8) | page[ptrBase + i * 2 + 1];
          const leftChild = this.readUint32(page, cellOff);
          const div = this.decodeIndexKeyXZYRowid(page, cellOff + 4);

          let prevMaxX = -Infinity;
          let prevMaxZ = -Infinity;
          if (i > 0) {
            const prevOff = (page[ptrBase + (i - 1) * 2] << 8) | page[ptrBase + (i - 1) * 2 + 1];
            const prevDiv = this.decodeIndexKeyXZYRowid(page, prevOff + 4);
            prevMaxX = prevDiv.x;
            prevMaxZ = prevDiv.z;
          }

          const xOverlaps = div.x >= minBx && prevMaxX <= maxBx;
          if (xOverlaps) {
            const zOverlaps = prevMaxX < div.x || (div.z >= minBz && prevMaxZ <= maxBz);
            if (zOverlaps) {
              await searchIndexPage(leftChild, depth + 1);
              if (rawMatches.length >= maxRawIndexKeys) return;
            }
          }

          if (
            div.x >= minBx &&
            div.x <= maxBx &&
            div.z >= minBz &&
            div.z <= maxBz &&
            div.y >= minBy &&
            div.y <= maxBy
          ) {
            rawMatches.push(div);
          }

          if (div.x > maxBx || (div.x === maxBx && div.z > maxBz)) {
            return;
          }
        }

        await searchIndexPage(rightChild, depth + 1);
      } else if (pageType === 0x0a) {
        const ptrBase = hdrOff + 8;
        for (let i = 0; i < cellCount; i++) {
          const cellOff = (page[ptrBase + i * 2] << 8) | page[ptrBase + i * 2 + 1];
          const k = this.decodeIndexKeyXZYRowid(page, cellOff);
          if (k.x < minBx) continue;
          if (k.x > maxBx) break;
          if (k.z >= minBz && k.z <= maxBz && k.y >= minBy && k.y <= maxBy) {
            rawMatches.push(k);
            if (rawMatches.length >= maxRawIndexKeys) return;
          }
        }
      }
    };

    await searchIndexPage(this.blocksIndexRootPage, 0);
    return this.groupAndFetchColumnMatches(rawMatches, maxResults, stride, minBy, maxBy);
  }

  /**
   * Computes in O(1) arithmetic the smallest valid 64-bit Luanti `pos = (z << 24) + (y << 12) + x`
   * inside `[minBx..maxBx] × [minBy..maxBy] × [minBz..maxBz]` that is `>= lowPos`, or `null` if none exists.
   * Enables true 3D (Z, Y, X) B-Tree interval skip-scanning that skips underground caves and off-X subtrees!
   */
  private nextValidClassicPos(
    lowPos: bigint,
    minBx: number,
    maxBx: number,
    minBy: number,
    maxBy: number,
    minBz: number,
    maxBz: number,
    stride = 1
  ): bigint | null {
    const zStep = stride > 1 && maxBz - minBz >= 16 ? stride : 1;
    const alignZ = (z: number): number => {
      if (zStep <= 1) return z;
      const rem = ((z % zStep) + zStep) % zStep;
      return rem === 0 ? z : z + (zStep - rem);
    };

    const startBz = alignZ(minBz);
    if (startBz > maxBz) return null;
    const boxMin = packBlockPos(minBx, minBy, startBz);
    if (lowPos <= boxMin) return boxMin;
    const boxMax = packBlockPos(maxBx, maxBy, maxBz);
    if (lowPos > boxMax) return null;

    const { x: lx, y: ly, z: lz } = unpackBlockPos(lowPos);
    if (lz < startBz) return boxMin;
    if (lz > maxBz) return null;

    const alignedLz = alignZ(lz);
    if (alignedLz > lz) {
      return alignedLz <= maxBz ? packBlockPos(minBx, minBy, alignedLz) : null;
    }

    if (ly < minBy) {
      return packBlockPos(minBx, minBy, lz);
    }
    if (ly > maxBy) {
      const nextZ = alignZ(lz + 1);
      return nextZ <= maxBz ? packBlockPos(minBx, minBy, nextZ) : null;
    }

    if (lx <= minBx) {
      return packBlockPos(minBx, ly, lz);
    }
    if (lx <= maxBx) {
      return lowPos;
    }
    if (ly + 1 <= maxBy) {
      return packBlockPos(minBx, ly + 1, lz);
    }
    const nextZ = alignZ(lz + 1);
    return nextZ <= maxBz ? packBlockPos(minBx, minBy, nextZ) : null;
  }

  private async queryClassicPosIndex(
    minBx: number,
    maxBx: number,
    minBz: number,
    maxBz: number,
    minBy: number,
    maxBy: number,
    maxResults: number,
    stride: number
  ): Promise<RawSqliteMapBlockRow[]> {
    const boxMinPos = packBlockPos(minBx, minBy, minBz);
    const boxMaxPos = packBlockPos(maxBx, maxBy, maxBz);
    const rawMatches: Array<{ x: number; y: number; z: number; rowid: number }> = [];
    const maxRawIndexKeys = Math.max(65536, maxResults * 16);
    let pagesVisited = 0;
    let lastYieldMs = typeof performance !== 'undefined' ? performance.now() : Date.now();

    const searchPosIndexPage = async (
      pageNum: number,
      depth: number,
      lowerBoundPos: bigint
    ): Promise<void> => {
      if (
        depth > 10 ||
        rawMatches.length >= maxRawIndexKeys ||
        pageNum < 1 ||
        pageNum > this.totalPages
      ) {
        return;
      }
      pagesVisited++;
      if ((pagesVisited & 31) === 0) {
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        if (now - lastYieldMs >= 24) {
          lastYieldMs = now;
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }

      const page = await this.readPage(pageNum);
      const hdrOff = pageNum === 1 ? 100 : 0;
      const pageType = page[hdrOff];
      const cellCount = (page[hdrOff + 3] << 8) | page[hdrOff + 4];

      if (pageType === 0x02) {
        const rightChild = this.readUint32(page, hdrOff + 8);
        const ptrBase = hdrOff + 12;
        let prevPos = lowerBoundPos;
        let nextTarget = this.nextValidClassicPos(prevPos, minBx, maxBx, minBy, maxBy, minBz, maxBz, stride);

        for (let i = 0; i < cellCount; i++) {
          if (nextTarget === null) return;
          const cellOff = (page[ptrBase + i * 2] << 8) | page[ptrBase + i * 2 + 1];
          const div = this.decodeIndexKeyPosRowid(page, cellOff + 4);

          if (div.pos >= nextTarget) {
            const leftChild = this.readUint32(page, cellOff);
            await searchPosIndexPage(leftChild, depth + 1, prevPos);
            if (rawMatches.length >= maxRawIndexKeys) return;

            const coords = unpackBlockPos(div.pos);
            if (
              coords.x >= minBx &&
              coords.x <= maxBx &&
              coords.z >= minBz &&
              coords.z <= maxBz &&
              coords.y >= minBy &&
              coords.y <= maxBy
            ) {
              rawMatches.push({ x: coords.x, y: coords.y, z: coords.z, rowid: div.rowid });
            }

            if (div.pos > boxMaxPos) {
              return;
            }
            nextTarget = this.nextValidClassicPos(div.pos, minBx, maxBx, minBy, maxBy, minBz, maxBz, stride);
          }
          prevPos = div.pos;
        }

        if (nextTarget !== null && prevPos <= boxMaxPos) {
          await searchPosIndexPage(rightChild, depth + 1, prevPos);
        }
      } else if (pageType === 0x0a) {
        const ptrBase = hdrOff + 8;
        for (let i = 0; i < cellCount; i++) {
          const cellOff = (page[ptrBase + i * 2] << 8) | page[ptrBase + i * 2 + 1];
          const k = this.decodeIndexKeyPosRowid(page, cellOff);
          if (k.pos < boxMinPos) continue;
          if (k.pos > boxMaxPos) break;
          const coords = unpackBlockPos(k.pos);
          if (
            coords.x >= minBx &&
            coords.x <= maxBx &&
            coords.z >= minBz &&
            coords.z <= maxBz &&
            coords.y >= minBy &&
            coords.y <= maxBy
          ) {
            rawMatches.push({ x: coords.x, y: coords.y, z: coords.z, rowid: k.rowid });
            if (rawMatches.length >= maxRawIndexKeys) return;
          }
        }
      }
    };

    await searchPosIndexPage(this.blocksIndexRootPage, 0, -9223372036854775808n);
    return this.groupAndFetchColumnMatches(rawMatches, maxResults, stride, minBy, maxBy);
  }

  private async groupAndFetchColumnMatches(
    rawMatches: Array<{ x: number; y: number; z: number; rowid: number }>,
    maxResults: number,
    stride: number,
    minBy = -1,
    maxBy = 9
  ): Promise<RawSqliteMapBlockRow[]> {
    const columnGroups = new Map<
      string,
      { targetX: number; targetZ: number; blocks: Array<{ x: number; y: number; z: number; rowid: number }> }
    >();

    for (let i = 0; i < rawMatches.length; i++) {
      const m = rawMatches[i];
      const groupKey =
        stride > 1 ? `${Math.floor(m.x / stride)},${Math.floor(m.z / stride)}` : `${m.x},${m.z}`;
      let grp = columnGroups.get(groupKey);
      if (!grp) {
        grp = { targetX: m.x, targetZ: m.z, blocks: [m] };
        columnGroups.set(groupKey, grp);
      } else if (m.x === grp.targetX && m.z === grp.targetZ) {
        if (!grp.blocks.some(b => b.rowid === m.rowid || b.y === m.y)) {
          grp.blocks.push(m);
        }
      }
    }

    const targetY = minBy <= 0 && maxBy >= 0 ? 0.5 : (minBy + maxBy) / 2;
    const cols = Array.from(columnGroups.values());

    // If total distinct columns exceed maxResults, stride sample columns evenly across all X and Z
    // so no Z-band / horizontal slice is dropped
    if (cols.length > maxResults) {
      const filteredMatches: Array<{ x: number; y: number; z: number; rowid: number }> = [];
      const step = Math.ceil(cols.length / maxResults);
      for (let i = 0; i < cols.length && filteredMatches.length < maxResults; i += step) {
        const c = cols[i];
        c.blocks.sort((a, b) => Math.abs(a.y - targetY) - Math.abs(b.y - targetY));
        filteredMatches.push(c.blocks[0]);
      }
      return this.fetchBlocksForKeys(filteredMatches);
    }

    // Adaptive Multi-Pass Surface Fetch for Surface slice (minBy <= 0 && maxBy >= 3):
    // In Luanti worlds, columns often have 11 vertical blocks (y = -1..9) where y = 2..9 (73% of blocks)
    // are 48-byte pure-air sky blocks. Instead of performing thousands of B-Tree table lookups on sky air:
    // - Pass 1 fetches the near-surface band (y in [-1..1] for stride=1, or y in [0..1] for stride>1).
    // - Pass 2a only fetches y in [2..3] for columns that had non-air terrain at y = 1 (plus any column
    //   that had zero non-air blocks in Pass 1).
    // - Pass 2b only fetches y >= 4 for columns that had non-air mountain terrain at y = 3!
    if (minBy <= 0 && maxBy >= 3) {
      const minPass1Y = stride === 1 && cols.length <= 256 ? -1 : 0;
      const pass1Keys: Array<{ x: number; y: number; z: number; rowid: number }> = [];
      const fetchedRowids = new Set<number>();

      for (let i = 0; i < cols.length; i++) {
        const c = cols[i];
        c.blocks.sort((a, b) => Math.abs(a.y - targetY) - Math.abs(b.y - targetY));
        let addedForCol = 0;
        for (let k = 0; k < c.blocks.length; k++) {
          const b = c.blocks[k];
          if (b.y >= minPass1Y && b.y <= 1) {
            pass1Keys.push(b);
            fetchedRowids.add(b.rowid);
            addedForCol++;
          }
        }
        if (addedForCol === 0 && c.blocks.length > 0) {
          pass1Keys.push(c.blocks[0]);
          fetchedRowids.add(c.blocks[0].rowid);
        }
      }

      const pass1Rows = await this.fetchBlocksForKeys(pass1Keys);
      const colsWithNonAir = new Set<string>();
      const colsWithY1NonAir = new Set<string>();

      for (let i = 0; i < pass1Rows.length; i++) {
        const r = pass1Rows[i];
        const ck = `${r.x},${r.z}`;
        colsWithNonAir.add(ck);
        if (r.y >= 1) {
          colsWithY1NonAir.add(ck);
        }
      }

      const pass2aKeys: Array<{ x: number; y: number; z: number; rowid: number }> = [];
      for (let i = 0; i < cols.length; i++) {
        const c = cols[i];
        const ck = `${c.targetX},${c.targetZ}`;
        if (!colsWithNonAir.has(ck)) {
          for (let k = 0; k < c.blocks.length; k++) {
            const b = c.blocks[k];
            if (b.y === -1 && !fetchedRowids.has(b.rowid)) {
              pass2aKeys.push(b);
              fetchedRowids.add(b.rowid);
            }
          }
        } else if (colsWithY1NonAir.has(ck)) {
          for (let k = 0; k < c.blocks.length; k++) {
            const b = c.blocks[k];
            if ((b.y === 2 || b.y === 3) && !fetchedRowids.has(b.rowid)) {
              pass2aKeys.push(b);
              fetchedRowids.add(b.rowid);
            }
          }
        }
      }

      if (pass2aKeys.length === 0) {
        return pass1Rows;
      }

      const pass2aRows = await this.fetchBlocksForKeys(pass2aKeys);
      const colsWithY3NonAir = new Set<string>();
      for (let i = 0; i < pass2aRows.length; i++) {
        const r = pass2aRows[i];
        if (r.y >= 3) {
          colsWithY3NonAir.add(`${r.x},${r.z}`);
        }
      }

      let pass2bRows: RawSqliteMapBlockRow[] = [];
      if (colsWithY3NonAir.size > 0) {
        const pass2bKeys: Array<{ x: number; y: number; z: number; rowid: number }> = [];
        for (let i = 0; i < cols.length; i++) {
          const c = cols[i];
          if (!colsWithY3NonAir.has(`${c.targetX},${c.targetZ}`)) continue;
          for (let k = 0; k < c.blocks.length; k++) {
            const b = c.blocks[k];
            if (b.y >= 4 && !fetchedRowids.has(b.rowid)) {
              pass2bKeys.push(b);
              fetchedRowids.add(b.rowid);
            }
          }
        }
        if (pass2bKeys.length > 0) {
          pass2bRows = await this.fetchBlocksForKeys(pass2bKeys);
        }
      }

      const combined = pass1Rows.concat(pass2aRows, pass2bRows);
      combined.sort((a, b) => a.y - b.y);
      return combined;
    }

    let totalBlocks = 0;
    for (let i = 0; i < cols.length; i++) {
      totalBlocks += cols[i].blocks.length;
    }

    // Fast path for non-surface slices when all blocks fit within maxResults
    if (totalBlocks <= maxResults) {
      const allMatches: Array<{ x: number; y: number; z: number; rowid: number }> = [];
      for (let i = 0; i < cols.length; i++) {
        const grp = cols[i];
        for (let k = 0; k < grp.blocks.length; k++) {
          allMatches.push(grp.blocks[k]);
        }
      }
      return this.fetchBlocksForKeys(allMatches);
    }

    const filteredMatches: Array<{ x: number; y: number; z: number; rowid: number }> = [];

    // When cols.length <= maxResults:
    // Sort each column's vertical blocks by proximity to target elevation
    for (let i = 0; i < cols.length; i++) {
      cols[i].blocks.sort((a, b) => Math.abs(a.y - targetY) - Math.abs(b.y - targetY));
    }

    // Pass 1: Ensure EVERY single column across all X and Z gets its primary block!
    for (let i = 0; i < cols.length && filteredMatches.length < maxResults; i++) {
      filteredMatches.push(cols[i].blocks[0]);
    }

    // Subsequent passes: distribute secondary blocks round-robin across columns
    let blockIndex = 1;
    let addedInPass = true;
    while (filteredMatches.length < maxResults && addedInPass) {
      addedInPass = false;
      for (let i = 0; i < cols.length && filteredMatches.length < maxResults; i++) {
        if (blockIndex < cols[i].blocks.length) {
          filteredMatches.push(cols[i].blocks[blockIndex]);
          addedInPass = true;
        }
      }
      blockIndex++;
    }

    return this.fetchBlocksForKeys(filteredMatches);
  }

  private async scanClassicPosTable(
    minBx: number,
    maxBx: number,
    minBz: number,
    maxBz: number,
    minBy: number,
    maxBy: number,
    maxResults: number,
    stride = 1
  ): Promise<RawSqliteMapBlockRow[]> {
    const rows: RawSqliteMapBlockRow[] = [];
    const boxMinPos = packBlockPos(minBx, minBy, minBz);
    const boxMaxPos = packBlockPos(maxBx, maxBy, maxBz);
    const canPruneByRowidPos = !this.hasXyzSchema && this.blocksIndexRootPage === 0;
    let pagesVisited = 0;
    let lastYieldMs = typeof performance !== 'undefined' ? performance.now() : Date.now();

    const visitTable = async (
      pageNum: number,
      depth: number,
      lowerBoundPos: bigint
    ): Promise<void> => {
      if (
        depth > 10 ||
        rows.length >= maxResults ||
        pageNum < 1 ||
        pageNum > this.totalPages
      ) {
        return;
      }
      pagesVisited++;
      if ((pagesVisited & 31) === 0) {
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        if (now - lastYieldMs >= 24) {
          lastYieldMs = now;
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }

      const page = await this.readPage(pageNum);
      const hdrOff = pageNum === 1 ? 100 : 0;
      const pageType = page[hdrOff];
      const cellCount = (page[hdrOff + 3] << 8) | page[hdrOff + 4];

      if (pageType === 0x05) {
        const rightChild = this.readUint32(page, hdrOff + 8);
        const ptrBase = hdrOff + 12;

        if (canPruneByRowidPos) {
          let prevPos = lowerBoundPos;
          let nextTarget = this.nextValidClassicPos(prevPos, minBx, maxBx, minBy, maxBy, minBz, maxBz, stride);

          for (let i = 0; i < cellCount; i++) {
            if (nextTarget === null) return;
            const cellOff = (page[ptrBase + i * 2] << 8) | page[ptrBase + i * 2 + 1];
            const divPos = this.readVarintBigInt(page, cellOff + 4);

            if (divPos >= nextTarget) {
              const leftChild = this.readUint32(page, cellOff);
              await visitTable(leftChild, depth + 1, prevPos);
              if (rows.length >= maxResults) return;
              if (divPos > boxMaxPos) {
                return;
              }
              nextTarget = this.nextValidClassicPos(divPos, minBx, maxBx, minBy, maxBy, minBz, maxBz, stride);
            }
            prevPos = divPos;
          }

          if (nextTarget !== null && prevPos <= boxMaxPos) {
            await visitTable(rightChild, depth + 1, prevPos);
          }
        } else {
          for (let i = 0; i < cellCount; i++) {
            const cellOff = (page[ptrBase + i * 2] << 8) | page[ptrBase + i * 2 + 1];
            const leftChild = this.readUint32(page, cellOff);
            await visitTable(leftChild, depth + 1, lowerBoundPos);
            if (rows.length >= maxResults) return;
          }
          await visitTable(rightChild, depth + 1, lowerBoundPos);
        }
      } else if (pageType === 0x0d) {
        const ptrBase = hdrOff + 8;
        for (let i = 0; i < cellCount; i++) {
          const cellOff = (page[ptrBase + i * 2] << 8) | page[ptrBase + i * 2 + 1];
          const payloadVar = this.readVarint(page, cellOff);
          const rowidVar = this.readVarint(page, cellOff + payloadVar.bytes);
          const posInt = this.extractClassicPosFromLeafCell(page, cellOff, payloadVar, rowidVar);
          if (canPruneByRowidPos) {
            if (posInt < boxMinPos) continue;
            if (posInt > boxMaxPos) break;
          }
          const coords = unpackBlockPos(posInt);

          if (
            coords.x >= minBx &&
            coords.x <= maxBx &&
            coords.z >= minBz &&
            coords.z <= maxBz &&
            coords.y >= minBy &&
            coords.y <= maxBy &&
            (stride <= 1 || ((coords.x & (stride - 1)) === 0 && (coords.z & (stride - 1)) === 0))
          ) {
            const payloadStart = cellOff + payloadVar.bytes + rowidVar.bytes;
            const fullRecord = await this.readTableCellPayload(page, payloadStart, payloadVar.value);
            const blob = this.extractLastBlobFromRecord(fullRecord);
            if (blob && blob.length > 51) {
              rows.push({
                x: coords.x,
                y: coords.y,
                z: coords.z,
                rowid: Number(this.readVarintBigInt(page, cellOff + payloadVar.bytes)),
                data: blob
              });
              if (rows.length >= maxResults) return;
            }
          }
        }
      }
    };

    await visitTable(this.blocksTableRootPage, 0, -9223372036854775808n);
    rows.sort((a, b) => a.y - b.y);
    return rows;
  }

  private async fetchBlockBlobByRowid(rootPage: number, targetRowid: number): Promise<Uint8Array | null> {
    let pageNum = rootPage;
    const targetBig = BigInt(Math.trunc(targetRowid));

    for (let depth = 0; depth < 12; depth++) {
      const page = await this.readPage(pageNum);
      const hdrOff = pageNum === 1 ? 100 : 0;
      const pageType = page[hdrOff];
      const cellCount = (page[hdrOff + 3] << 8) | page[hdrOff + 4];

      if (pageType === 0x05) {
        const rightChild = this.readUint32(page, hdrOff + 8);
        const ptrBase = hdrOff + 12;
        let lo = 0;
        let hi = cellCount - 1;
        let chosenChild = rightChild;

        while (lo <= hi) {
          const mid = (lo + hi) >>> 1;
          const cellOff = (page[ptrBase + mid * 2] << 8) | page[ptrBase + mid * 2 + 1];
          const keyBig = this.readVarintBigInt(page, cellOff + 4);
          if (targetBig <= keyBig) {
            chosenChild = this.readUint32(page, cellOff);
            hi = mid - 1;
          } else {
            lo = mid + 1;
          }
        }
        pageNum = chosenChild;
      } else if (pageType === 0x0d) {
        const ptrBase = hdrOff + 8;
        let lo = 0;
        let hi = cellCount - 1;

        while (lo <= hi) {
          const mid = (lo + hi) >>> 1;
          const cellOff = (page[ptrBase + mid * 2] << 8) | page[ptrBase + mid * 2 + 1];
          const payloadVar = this.readVarint(page, cellOff);
          const rowidVar = this.readVarint(page, cellOff + payloadVar.bytes);
          const rowidBig = this.readVarintBigInt(page, cellOff + payloadVar.bytes);

          if (rowidBig === targetBig) {
            const payloadStart = cellOff + payloadVar.bytes + rowidVar.bytes;
            const fullRecord = await this.readTableCellPayload(page, payloadStart, payloadVar.value);
            return this.extractLastBlobFromRecord(fullRecord);
          } else if (rowidBig < targetBig) {
            lo = mid + 1;
          } else {
            hi = mid - 1;
          }
        }
        return null;
      } else {
        return null;
      }
    }
    return null;
  }

  private async readTableCellPayload(
    page: Uint8Array,
    payloadStart: number,
    payloadSize: number
  ): Promise<Uint8Array> {
    const U = this.usableSize;
    const X = U - 35;

    if (payloadSize <= X) {
      return page.slice(payloadStart, payloadStart + payloadSize);
    }

    const M = ((U - 12) * 32) / 255 - 23;
    const K = M + ((payloadSize - M) % (U - 4));
    const localSize = Math.floor(K <= X ? K : M);

    const out = new Uint8Array(payloadSize);
    out.set(page.subarray(payloadStart, payloadStart + localSize), 0);
    let written = localSize;

    let overflowPage = this.readUint32(page, payloadStart + localSize);
    while (overflowPage > 0 && written < payloadSize) {
      const ovPage = await this.readPage(overflowPage);
      overflowPage = this.readUint32(ovPage, 0);
      const chunkLen = Math.min(payloadSize - written, U - 4);
      out.set(ovPage.subarray(4, 4 + chunkLen), written);
      written += chunkLen;
    }

    return out;
  }

  private extractLastBlobFromRecord(recordBuf: Uint8Array): Uint8Array | null {
    const hdrVar = this.readVarint(recordBuf, 0);
    let pos = hdrVar.bytes;
    const hdrEnd = hdrVar.value;
    const serialTypes: number[] = [];

    while (pos < hdrEnd && pos < recordBuf.length) {
      const st = this.readVarint(recordBuf, pos);
      serialTypes.push(st.value);
      pos += st.bytes;
    }

    if (serialTypes.length === 0) return null;

    let bodyOffset = hdrEnd;
    for (let i = 0; i < serialTypes.length - 1; i++) {
      bodyOffset += this.serialTypeByteLen(serialTypes[i]);
    }

    const blobLen = this.serialTypeByteLen(serialTypes[serialTypes.length - 1]);
    if (blobLen <= 0 || bodyOffset + blobLen > recordBuf.length) return null;
    return recordBuf.subarray(bodyOffset, bodyOffset + blobLen);
  }

  private decodeIndexKeyXZYRowid(
    buf: Uint8Array,
    cellOffset: number
  ): { x: number; z: number; y: number; rowid: number } {
    const payloadVar = this.readVarint(buf, cellOffset);
    let pos = cellOffset + payloadVar.bytes;
    const hdrStart = pos;
    const hdrVar = this.readVarint(buf, pos);
    pos += hdrVar.bytes;
    const hdrEnd = hdrStart + hdrVar.value;

    const types: number[] = [];
    while (pos < hdrEnd) {
      const st = this.readVarint(buf, pos);
      types.push(st.value);
      pos += st.bytes;
    }

    const vals: number[] = [];
    for (let i = 0; i < types.length; i++) {
      const st = types[i];
      if (st === 8) {
        vals.push(0);
      } else if (st === 9) {
        vals.push(1);
      } else {
        const len = this.serialTypeByteLen(st);
        vals.push(this.readSignedInt(buf, pos, len));
        pos += len;
      }
    }

    return {
      x: vals[0] ?? 0,
      z: vals[1] ?? 0,
      y: vals[2] ?? 0,
      rowid: vals[3] ?? 0
    };
  }

  private decodeIndexKeyPosRowid(
    buf: Uint8Array,
    cellOffset: number
  ): { pos: bigint; rowid: number } {
    const payloadVar = this.readVarint(buf, cellOffset);
    let pos = cellOffset + payloadVar.bytes;
    const hdrStart = pos;
    const hdrVar = this.readVarint(buf, pos);
    pos += hdrVar.bytes;
    const hdrEnd = hdrStart + hdrVar.value;

    const types: number[] = [];
    while (pos < hdrEnd) {
      const st = this.readVarint(buf, pos);
      types.push(st.value);
      pos += st.bytes;
    }

    let posBig = 0n;
    const st0 = types[0] ?? 0;
    if (st0 === 8) {
      posBig = 0n;
    } else if (st0 === 9) {
      posBig = 1n;
    } else {
      const len0 = this.serialTypeByteLen(st0);
      posBig = this.readSignedBigInt(buf, pos, len0);
      pos += len0;
    }

    let rowid = 0;
    const st1 = types[1] ?? 0;
    if (st1 === 8) {
      rowid = 0;
    } else if (st1 === 9) {
      rowid = 1;
    } else {
      const len1 = this.serialTypeByteLen(st1);
      rowid = this.readSignedInt(buf, pos, len1);
    }

    return { pos: posBig, rowid };
  }

  private decodeRecordFields(recordBuf: Uint8Array): Array<string | number | Uint8Array | null> {
    const hdrVar = this.readVarint(recordBuf, 0);
    let pos = hdrVar.bytes;
    const hdrEnd = hdrVar.value;
    const types: number[] = [];

    while (pos < hdrEnd && pos < recordBuf.length) {
      const st = this.readVarint(recordBuf, pos);
      types.push(st.value);
      pos += st.bytes;
    }

    let bodyPos = hdrEnd;
    const out: Array<string | number | Uint8Array | null> = [];
    for (const st of types) {
      if (st === 0) {
        out.push(null);
      } else if (st === 8) {
        out.push(0);
      } else if (st === 9) {
        out.push(1);
      } else if (st >= 1 && st <= 6) {
        const len = this.serialTypeByteLen(st);
        out.push(this.readSignedInt(recordBuf, bodyPos, len));
        bodyPos += len;
      } else if (st >= 12 && st % 2 === 0) {
        const len = (st - 12) / 2;
        out.push(recordBuf.subarray(bodyPos, bodyPos + len));
        bodyPos += len;
      } else if (st >= 13 && st % 2 === 1) {
        const len = (st - 13) / 2;
        out.push(this.utf8Decoder.decode(recordBuf.subarray(bodyPos, bodyPos + len)));
        bodyPos += len;
      } else {
        const len = this.serialTypeByteLen(st);
        bodyPos += len;
        out.push(null);
      }
    }
    return out;
  }

  private buildDiscoveredRegions(
    regionMap: Map<string, { rx: number; rz: number; count: number; sumX: number; sumZ: number }>,
    sampleMultiplier: number
  ): DiscoveredWorldRegion[] {
    const all = Array.from(regionMap.values()).map(r => {
      const centerX = Math.round(r.sumX / r.count);
      const centerZ = Math.round(r.sumZ / r.count);
      const dist = Math.hypot(centerX, centerZ);
      return {
        ...r,
        estimatedBlocks: r.count * sampleMultiplier,
        centerX,
        centerZ,
        dist
      };
    });

    const spawnBlocks = all
      .filter(r => Math.abs(r.rx) <= 1 && Math.abs(r.rz) <= 1)
      .reduce((acc, r) => acc + r.estimatedBlocks, 0);

    const results: DiscoveredWorldRegion[] = [
      {
        id: 'spawn-origin',
        label: 'Spawn Archipelago (0, 0)',
        centerX: 0,
        centerZ: 0,
        blockCount: Math.max(spawnBlocks, 1),
        kind: 'spawn'
      }
    ];

    const nonSpawnByDensity = all
      .filter(r => r.dist > 1400 && r.estimatedBlocks >= 300)
      .sort((a, b) => b.estimatedBlocks - a.estimatedBlocks);

    const chosenCoords: Array<{ x: number; z: number }> = [{ x: 0, z: 0 }];

    for (const candidate of nonSpawnByDensity) {
      const tooClose = chosenCoords.some(
        c => Math.hypot(c.x - candidate.centerX, c.z - candidate.centerZ) < 1800
      );
      if (tooClose) continue;

      chosenCoords.push({ x: candidate.centerX, z: candidate.centerZ });
      const dir = this.formatCompassDirection(candidate.centerX, candidate.centerZ);
      results.push({
        id: `hub-${candidate.rx}-${candidate.rz}`,
        label: `${dir} Island Hub (${candidate.centerX}, ${candidate.centerZ})`,
        centerX: candidate.centerX,
        centerZ: candidate.centerZ,
        blockCount: candidate.estimatedBlocks,
        kind: 'hub'
      });

      if (results.length >= 9) break;
    }

    const farExpeditions = all
      .filter(r => r.dist > 8000 && r.estimatedBlocks >= 200)
      .sort((a, b) => b.dist - a.dist);

    for (const exp of farExpeditions) {
      const tooClose = chosenCoords.some(
        c => Math.hypot(c.x - exp.centerX, c.z - exp.centerZ) < 2500
      );
      if (tooClose) continue;

      chosenCoords.push({ x: exp.centerX, z: exp.centerZ });
      const dir = this.formatCompassDirection(exp.centerX, exp.centerZ);
      results.push({
        id: `exp-${exp.rx}-${exp.rz}`,
        label: `Far ${dir} Base (${exp.centerX}, ${exp.centerZ})`,
        centerX: exp.centerX,
        centerZ: exp.centerZ,
        blockCount: exp.estimatedBlocks,
        kind: 'expedition'
      });

      if (results.length >= 12) break;
    }

    return results;
  }

  private formatCompassDirection(x: number, z: number): string {
    const ns = z > 800 ? 'N' : z < -800 ? 'S' : '';
    const ew = x > 800 ? 'E' : x < -800 ? 'W' : '';
    return ns + ew || 'Central';
  }

  private readUint32(buf: Uint8Array, offset: number): number {
    return (
      ((buf[offset] << 24) >>> 0) +
      ((buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3])
    );
  }

  private readVarint(buf: Uint8Array, offset: number): VarintResult {
    let val = 0;
    for (let i = 0; i < 8; i++) {
      const b = buf[offset + i];
      val = val * 128 + (b & 0x7f);
      if ((b & 0x80) === 0) {
        return { value: val, bytes: i + 1 };
      }
    }
    val = val * 256 + buf[offset + 8];
    return { value: val, bytes: 9 };
  }

  private readVarintBigInt(buf: Uint8Array, offset: number): bigint {
    let val = 0n;
    for (let i = 0; i < 8; i++) {
      const b = buf[offset + i];
      val = (val << 7n) | BigInt(b & 0x7f);
      if ((b & 0x80) === 0) {
        return BigInt.asIntN(64, val);
      }
    }
    val = (val << 8n) | BigInt(buf[offset + 8]);
    return BigInt.asIntN(64, val);
  }

  private extractClassicPosFromLeafCell(
    page: Uint8Array,
    cellOff: number,
    payloadVar: VarintResult,
    rowidVar: VarintResult
  ): bigint {
    const recordStart = cellOff + payloadVar.bytes + rowidVar.bytes;
    if (recordStart + 2 < page.length) {
      const hdrVar = this.readVarint(page, recordStart);
      const st0 = this.readVarint(page, recordStart + hdrVar.bytes).value;
      if (st0 === 8) return 0n;
      if (st0 === 9) return 1n;
      if (st0 >= 1 && st0 <= 6) {
        const len = this.serialTypeByteLen(st0);
        const valOffset = recordStart + hdrVar.value;
        if (valOffset + len <= page.length) {
          return this.readSignedBigInt(page, valOffset, len);
        }
      }
    }
    return this.readVarintBigInt(page, cellOff + payloadVar.bytes);
  }

  private readSignedBigInt(buf: Uint8Array, offset: number, byteLen: number): bigint {
    if (byteLen <= 0) return 0n;
    let v = 0n;
    for (let i = 0; i < byteLen; i++) {
      v = (v << 8n) | BigInt(buf[offset + i]);
    }
    const bits = BigInt(byteLen * 8);
    if (v >= 1n << (bits - 1n)) {
      v -= 1n << bits;
    }
    return v;
  }

  private readSignedInt(buf: Uint8Array, offset: number, byteLen: number): number {
    if (byteLen === 0) return 0;
    if (byteLen === 1) {
      const v = buf[offset];
      return v >= 128 ? v - 256 : v;
    }
    if (byteLen === 2) {
      const v = (buf[offset] << 8) | buf[offset + 1];
      return v >= 32768 ? v - 65536 : v;
    }
    if (byteLen === 3) {
      const v = (buf[offset] << 16) | (buf[offset + 1] << 8) | buf[offset + 2];
      return v >= 8388608 ? v - 16777216 : v;
    }
    if (byteLen === 4) {
      return (
        (buf[offset] << 24) |
        (buf[offset + 1] << 16) |
        (buf[offset + 2] << 8) |
        buf[offset + 3]
      );
    }
    let v = 0n;
    for (let i = 0; i < byteLen; i++) {
      v = (v << 8n) | BigInt(buf[offset + i]);
    }
    const bits = BigInt(byteLen * 8);
    if (v >= 1n << (bits - 1n)) {
      v -= 1n << bits;
    }
    return Number(v);
  }

  private serialTypeByteLen(st: number): number {
    if (st === 0 || st === 8 || st === 9) return 0;
    if (st === 1) return 1;
    if (st === 2) return 2;
    if (st === 3) return 3;
    if (st === 4) return 4;
    if (st === 5) return 6;
    if (st === 6 || st === 7) return 8;
    if (st >= 12) return Math.floor((st - 12) / 2);
    return 0;
  }
}
