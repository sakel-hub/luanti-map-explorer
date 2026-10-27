import type {
  DatabaseOverviewSummary,
  DiscoveredWorldRegion,
  RawMapBlockRow,
  VerticalLayerSummary,
  WorldDatabaseReader
} from '../models/world.model';
import { unpackBlockPos } from './mapblock-parser';

interface PostgresBlockIndexEntry {
  x: number;
  y: number;
  z: number;
  offset: number;
  length: number;
}

const HEX_LOOKUP = new Int8Array(256).fill(-1);
for (let i = 0; i < 10; i++) HEX_LOOKUP[48 + i] = i; // '0'-'9'
for (let i = 0; i < 6; i++) {
  HEX_LOOKUP[65 + i] = 10 + i; // 'A'-'F'
  HEX_LOOKUP[97 + i] = 10 + i; // 'a'-'f'
}

/**
 * Fast zero-allocation hexadecimal bytea decoder for PostgreSQL string representations.
 * Handles `\x...`, `\\x...`, and `'...;` syntax.
 */
export function decodePostgresByteaHex(raw: string): Uint8Array {
  let start = 0;
  if (raw.startsWith('\\\\x') || raw.startsWith('\\x')) {
    start = raw.indexOf('x') + 1;
  } else if (raw.startsWith("'\\x") || raw.startsWith("'\\\\x")) {
    start = raw.indexOf('x') + 1;
  }

  let end = raw.length;
  while (
    end > start &&
    (raw[end - 1] === "'" ||
      raw[end - 1] === '\r' ||
      raw[end - 1] === '\n' ||
      raw[end - 1] === ';' ||
      raw[end - 1] === ')' ||
      raw[end - 1] === ',')
  ) {
    end--;
  }

  const hexLen = end - start;
  const byteLen = hexLen >> 1;
  const out = new Uint8Array(byteLen);

  for (let i = 0; i < byteLen; i++) {
    const off = start + (i << 1);
    const hi = HEX_LOOKUP[raw.charCodeAt(off)] ?? -1;
    const lo = HEX_LOOKUP[raw.charCodeAt(off + 1)] ?? -1;
    if (hi === -1 || lo === -1) {
      break;
    }
    out[i] = (hi << 4) | lo;
  }

  return out;
}

const SCAN_CHUNK_SIZE = 2 * 1024 * 1024; // 2 MB slice buffer for scan passes

/**
 * Zero-OOM Streaming PostgreSQL SQL Dump Reader.
 * Reads `.sql`, `.pgsql`, and `.dump` text dumps created via `pg_dump`.
 * Indexes 64-bit integer MapBlock positions during overview scan, and
 * extracts binary bytea blocks on demand via `File.slice()`.
 */
export class PostgresSqlDumpReader implements WorldDatabaseReader {
  public readonly backendType = 'postgresql' as const;

  private readonly file: File;
  private readonly index: PostgresBlockIndexEntry[] = [];
  private readonly decoder = new TextDecoder('utf-8');
  private isClosed = false;

  constructor(file: File) {
    this.file = file;
  }

  public get fileName(): string {
    return this.file.name;
  }

  public async init(): Promise<void> {
    // Quick validation of first 8 KB to ensure it resembles a PostgreSQL dump or SQL file
    const sampleSize = Math.min(8192, this.file.size);
    const headerBuf = new Uint8Array(await this.file.slice(0, sampleSize).arrayBuffer());
    const headerText = this.decoder.decode(headerBuf).toLowerCase();

    const isSql =
      headerText.includes('postgresql') ||
      headerText.includes('create table') ||
      headerText.includes('copy ') ||
      headerText.includes('insert into') ||
      headerText.includes('blocks') ||
      this.file.name.toLowerCase().endsWith('.sql') ||
      this.file.name.toLowerCase().endsWith('.pgsql');

    if (!isSql) {
      throw new Error(`"${this.file.name}" does not appear to be a valid PostgreSQL SQL dump.`);
    }
  }

  /**
   * Scans the PostgreSQL dump line-by-line using chunked slicing.
   * Discovers bounds, elevation layers, and macro sectors without loading full bytea into RAM.
   */
  public async scanOverviewAndVerticalLayers(
    onProgress?: (progressUnits: number, samplesFound: number) => void
  ): Promise<DatabaseOverviewSummary> {
    this.index.length = 0;
    const fileSize = this.file.size;
    let byteOffset = 0;
    let leftover = '';

    let minBlockX = Infinity;
    let maxBlockX = -Infinity;
    let minBlockZ = Infinity;
    let maxBlockZ = -Infinity;

    const exploredBlockKeys = new Set<string>();
    const macroSectorMap = new Map<string, { mx: number; mz: number }>();
    const yLayerMap = new Map<string, { count: number; sumY: number }>();
    const dividerSamples: Array<{ x: number; y: number; z: number; rowid: number }> = [];

    let isCopyMode = false;
    let processedLines = 0;
    const regionAccumulator = new Map<
      string,
      { rx: number; rz: number; count: number; sumX: number; sumZ: number }
    >();

    while (byteOffset < fileSize) {
      const sliceEnd = Math.min(fileSize, byteOffset + SCAN_CHUNK_SIZE);
      const chunkBuf = new Uint8Array(await this.file.slice(byteOffset, sliceEnd).arrayBuffer());
      const chunkText = leftover + this.decoder.decode(chunkBuf, { stream: sliceEnd < fileSize });

      const lines = chunkText.split(/\r?\n/);
      // The last element is either empty (if ended with newline) or partial line
      leftover = lines.pop() ?? '';
      if (sliceEnd >= fileSize && leftover) {
        lines.push(leftover);
        leftover = '';
      }

      // Calculate where each line begins in file
      let currentLineFileOffset = byteOffset;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineByteLength = line.length + 1; // approx including newline
        processedLines++;

        const trimmed = line.trim();

        if (trimmed.startsWith('COPY ') && trimmed.includes('blocks')) {
          isCopyMode = true;
          currentLineFileOffset += lineByteLength;
          continue;
        }

        if (isCopyMode && (trimmed === '\\.' || trimmed.startsWith('\\.'))) {
          isCopyMode = false;
          currentLineFileOffset += lineByteLength;
          continue;
        }

        if (isCopyMode) {
          const tabIdx = line.indexOf('\t');
          if (tabIdx > 0) {
            const posStr = line.slice(0, tabIdx).trim();
            if (posStr && (posStr[0] === '-' || (posStr[0] >= '0' && posStr[0] <= '9'))) {
              try {
                const posBig = BigInt(posStr);
                const coords = unpackBlockPos(posBig);

                const entryIndex = this.index.length;
                this.index.push({
                  x: coords.x,
                  y: coords.y,
                  z: coords.z,
                  offset: currentLineFileOffset,
                  length: lineByteLength
                });

                if (coords.x < minBlockX) minBlockX = coords.x;
                if (coords.x > maxBlockX) maxBlockX = coords.x;
                if (coords.z < minBlockZ) minBlockZ = coords.z;
                if (coords.z > maxBlockZ) maxBlockZ = coords.z;

                exploredBlockKeys.add(`${coords.x},${coords.z}`);

                const mx = coords.x >> 6;
                const mz = coords.z >> 6;
                const mKey = `${mx},${mz}`;
                if (!macroSectorMap.has(mKey)) {
                  macroSectorMap.set(mKey, { mx, mz });
                }

                // Regional cluster aggregation
                const rx = coords.x >> 3;
                const rz = coords.z >> 3;
                const rKey = `${rx},${rz}`;
                let reg = regionAccumulator.get(rKey);
                if (!reg) {
                  reg = { rx, rz, count: 0, sumX: 0, sumZ: 0 };
                  regionAccumulator.set(rKey, reg);
                }
                reg.count++;
                reg.sumX += coords.x * 16;
                reg.sumZ += coords.z * 16;

                // Vertical layers
                let layerKey = 'surface';
                if (coords.y >= 30) layerKey = 'floatlands';
                else if (coords.y >= 237) layerKey = 'high_sky';
                else if (coords.y < -125) layerKey = 'abyss';
                else if (coords.y < -32) layerKey = 'deep_caverns';
                else if (coords.y < -2) layerKey = 'caves';

                let yLayer = yLayerMap.get(layerKey);
                if (!yLayer) {
                  yLayer = { count: 0, sumY: 0 };
                  yLayerMap.set(layerKey, yLayer);
                }
                yLayer.count++;
                yLayer.sumY += coords.y;

                if (entryIndex % 20 === 0) {
                  dividerSamples.push({
                    x: coords.x,
                    y: coords.y,
                    z: coords.z,
                    rowid: entryIndex
                  });
                }
              } catch {
                // Ignore parse errors on malformed lines
              }
            }
          }
        } else if (trimmed.startsWith('INSERT INTO') && trimmed.includes('blocks')) {
          // Parse INSERT INTO public.blocks (pos, data) VALUES (pos, '...')
          const valMatch = trimmed.match(/\(([-\d]+)\s*,\s*['"]?(\\+x[0-9a-fA-F]+)['"]?\)/);
          if (valMatch) {
            try {
              const posBig = BigInt(valMatch[1]);
              const coords = unpackBlockPos(posBig);
              const entryIndex = this.index.length;

              this.index.push({
                x: coords.x,
                y: coords.y,
                z: coords.z,
                offset: currentLineFileOffset,
                length: lineByteLength
              });

              if (coords.x < minBlockX) minBlockX = coords.x;
              if (coords.x > maxBlockX) maxBlockX = coords.x;
              if (coords.z < minBlockZ) minBlockZ = coords.z;
              if (coords.z > maxBlockZ) maxBlockZ = coords.z;

              exploredBlockKeys.add(`${coords.x},${coords.z}`);
              const mx = coords.x >> 6;
              const mz = coords.z >> 6;
              const mKey = `${mx},${mz}`;
              if (!macroSectorMap.has(mKey)) {
                macroSectorMap.set(mKey, { mx, mz });
              }

              let layerKey = 'surface';
              if (coords.y >= 30) layerKey = 'floatlands';
              else if (coords.y >= 237) layerKey = 'high_sky';
              else if (coords.y < -125) layerKey = 'abyss';
              else if (coords.y < -32) layerKey = 'deep_caverns';
              else if (coords.y < -2) layerKey = 'caves';

              let yLayer = yLayerMap.get(layerKey);
              if (!yLayer) {
                yLayer = { count: 0, sumY: 0 };
                yLayerMap.set(layerKey, yLayer);
              }
              yLayer.count++;
              yLayer.sumY += coords.y;

              if (entryIndex % 20 === 0) {
                dividerSamples.push({
                  x: coords.x,
                  y: coords.y,
                  z: coords.z,
                  rowid: entryIndex
                });
              }
            } catch {
              // Ignore
            }
          }
        }

        currentLineFileOffset += lineByteLength;
      }

      byteOffset = sliceEnd;
      if (onProgress) {
        onProgress(Math.round((byteOffset / fileSize) * 100), this.index.length);
      }
    }

    if (minBlockX === Infinity) {
      minBlockX = -4;
      maxBlockX = 4;
      minBlockZ = -4;
      maxBlockZ = 4;
    }

    // Build discovered regions from accumulated clusters
    const discoveredRegions: DiscoveredWorldRegion[] = [
      {
        id: 'spawn-origin',
        label: 'Spawn Origin (0, 0)',
        centerX: 0,
        centerZ: 0,
        blockCount: Math.max(1, this.index.length),
        kind: 'spawn'
      }
    ];

    const sortedClusters = Array.from(regionAccumulator.values())
      .filter(r => r.count >= 12)
      .sort((a, b) => b.count - a.count);

    for (const cluster of sortedClusters.slice(0, 15)) {
      const cx = Math.round(cluster.sumX / cluster.count);
      const cz = Math.round(cluster.sumZ / cluster.count);
      if (Math.hypot(cx, cz) > 100) {
        discoveredRegions.push({
          id: `cluster_${cluster.rx}_${cluster.rz}`,
          label: `Settlement Sector (${cx}, ${cz})`,
          centerX: cx,
          centerZ: cz,
          blockCount: cluster.count,
          kind: 'base'
        });
      }
    }

    const verticalLayers: VerticalLayerSummary[] = [];
    for (const [id, l] of yLayerMap.entries()) {
      verticalLayers.push({
        id: id as any,
        label: id.toUpperCase(),
        shortLabel: id,
        description: `${l.count} MapBlocks detected`,
        minY: -31000,
        maxY: 31000,
        estimatedBlocks: l.count,
        hotspotX: 0,
        hotspotZ: 0,
        caveMode: id.includes('cave') || id.includes('abyss'),
        badge: `${l.count} blocks`
      });
    }

    return {
      backendType: 'postgresql',
      hasXyzSchema: false,
      estimatedTotalBlocks: this.index.length,
      minBlockX,
      maxBlockX,
      minBlockZ,
      maxBlockZ,
      exploredBlockKeys,
      discoveredRegions,
      verticalLayers,
      exploredMacroSectors: Array.from(macroSectorMap.values()),
      dividerSamples
    };
  }

  /**
   * Queries blocks in bounds by filtering the in-memory index,
   * then reading and decoding the bytea payloads from the file slice on demand.
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
  ): Promise<RawMapBlockRow[]> {
    if (this.isClosed) return [];
    const columnGroups = new Map<
      string,
      { targetX: number; targetZ: number; entries: PostgresBlockIndexEntry[] }
    >();

    for (let i = 0; i < this.index.length; i++) {
      const e = this.index[i];
      if (
        e.x >= minBx &&
        e.x <= maxBx &&
        e.z >= minBz &&
        e.z <= maxBz &&
        e.y >= minBy &&
        e.y <= maxBy
      ) {
        const groupKey =
          stride > 1
            ? `${Math.floor(e.x / stride)},${Math.floor(e.z / stride)}`
            : `${e.x},${e.z}`;
        let grp = columnGroups.get(groupKey);
        if (!grp) {
          grp = { targetX: e.x, targetZ: e.z, entries: [e] };
          columnGroups.set(groupKey, grp);
        } else if (e.x === grp.targetX && e.z === grp.targetZ) {
          if (!grp.entries.some(b => b.y === e.y)) {
            grp.entries.push(e);
          }
        }
      }
    }

    const cols = Array.from(columnGroups.values());
    if (cols.length === 0) return [];

    let selectedCols = cols;
    if (cols.length > maxResults) {
      selectedCols = [];
      const step = Math.ceil(cols.length / maxResults);
      for (let i = 0; i < cols.length && selectedCols.length < maxResults; i += step) {
        selectedCols.push(cols[i]);
      }
    }

    const toFetch: PostgresBlockIndexEntry[] = [];
    for (let i = 0; i < selectedCols.length; i++) {
      const grp = selectedCols[i];
      grp.entries.sort((a, b) => a.y - b.y);
      for (let k = 0; k < grp.entries.length; k++) {
        toFetch.push(grp.entries[k]);
      }
    }

    const results: RawMapBlockRow[] = [];

    // Fetch and decode bytea payload for each candidate block
    for (let i = 0; i < toFetch.length; i++) {
      const entry = toFetch[i];
      const row = await this.fetchSingleBlock(entry, i);
      if (row && row.data.length > 0) {
        results.push(row);
      }
    }

    results.sort((a, b) => a.y - b.y);
    return results;
  }

  /**
   * Fetches bytea blocks for a pre-selected list of `{ x, y, z, rowid }` keys.
   */
  public async fetchBlocksForKeys(
    keys: Array<{ x: number; y: number; z: number; rowid?: number } | string>,
    onProgress?: (current: number, total: number) => void
  ): Promise<RawMapBlockRow[]> {
    const results: RawMapBlockRow[] = [];
    const total = keys.length;

    for (let i = 0; i < total; i++) {
      const rawK = keys[i];
      let entry: PostgresBlockIndexEntry | undefined;
      let rowid = 0;

      if (typeof rawK === 'string') {
        const [x, y, z] = rawK.split(',').map(n => parseInt(n, 10));
        const idx = this.index.findIndex(e => e.x === x && e.y === y && e.z === z);
        if (idx >= 0) {
          entry = this.index[idx];
          rowid = idx;
        }
      } else if (rawK.rowid !== undefined && this.index[rawK.rowid]) {
        entry = this.index[rawK.rowid];
        rowid = rawK.rowid;
      } else {
        const idx = this.index.findIndex(e => e.x === rawK.x && e.y === rawK.y && e.z === rawK.z);
        if (idx >= 0) {
          entry = this.index[idx];
          rowid = idx;
        }
      }

      if (entry) {
        const row = await this.fetchSingleBlock(entry, rowid);
        if (row) {
          results.push(row);
        }
      }
      if (onProgress && (i % 25 === 0 || i === total - 1)) {
        onProgress(i + 1, total);
      }
    }

    return results;
  }

  private async fetchSingleBlock(entry: PostgresBlockIndexEntry, rowid: number): Promise<RawMapBlockRow | null> {
    try {
      const sliceBuf = new Uint8Array(
        await this.file.slice(entry.offset, entry.offset + entry.length).arrayBuffer()
      );
      const lineText = this.decoder.decode(sliceBuf);

      let hexPayload = '';
      const tabIdx = lineText.indexOf('\t');
      if (tabIdx >= 0) {
        hexPayload = lineText.slice(tabIdx + 1).trim();
      } else {
        const match = lineText.match(/['"]?(\\+x[0-9a-fA-F]+)['"]?/);
        if (match) hexPayload = match[1];
      }

      if (hexPayload) {
        const dataBytes = decodePostgresByteaHex(hexPayload);
        if (dataBytes.length > 0) {
          return {
            x: entry.x,
            y: entry.y,
            z: entry.z,
            rowid,
            data: dataBytes
          };
        }
      }
    } catch {
      // Skip individual corrupted block slices
    }
    return null;
  }

  public close(): void {
    this.isClosed = true;
    this.index.length = 0;
  }
}
