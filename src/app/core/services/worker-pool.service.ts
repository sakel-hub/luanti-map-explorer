import { Injectable, effect, inject, signal } from '@angular/core';
import { MapStore } from '../state/map.store';
import { CoordProjectionService } from './coord-projection.service';
import { PwaStorageService } from './pwa-storage.service';
import { TileRenderJobPayload, renderTilePngBuffer } from '../utils/tile-renderer';
import {
  CompactBlockSurface,
  MacroMipmapCell,
  ParsedColumnSurface
} from '../models/world.model';

interface QueuedJob {
  coordKey: string;
  configKey: string;
  job: TileRenderJobPayload;
  revision: number;
  cacheKey: string;
  dispatchedDbVersion?: number;
  resolvers: Array<(buffer: ArrayBuffer) => void>;
  rejecters: Array<(reason?: any) => void>;
}

interface WorkerInstance {
  worker: Worker;
  busy: boolean;
  activeJobId: number | null;
}

const MAX_L1_TILES = 512; // In-memory RAM tile cache for instant 0ms return

@Injectable({
  providedIn: 'root'
})
export class WorkerPoolService {
  private readonly mapStore = inject(MapStore);
  private readonly projection = inject(CoordProjectionService);
  private readonly pwaStorage = inject(PwaStorageService);

  private readonly pool: WorkerInstance[] = [];
  private readonly queue: QueuedJob[] = [];
  private readonly pendingMap = new Map<number, QueuedJob>();
  private readonly l1TileCache = new Map<string, ArrayBuffer>();
  private readonly sessionWrittenL2Keys = new Set<string>();
  private nextJobId = 1;
  private latestRequestedZoom = 6;
  private latestRequestedRevision = 0;
  private dbStateVersion = 0;

  public readonly workerCount = signal<number>(0);
  public readonly activeTasksCount = signal<number>(0);
  public readonly completedTilesCount = signal<number>(0);

  constructor() {
    this.initWorkerPool();

    try {
      effect(() => {
        const db = this.mapStore.worldDatabase();
        const isDemo = db?.fileName === 'demo-world/map.sqlite';
        this.broadcastDatabaseToWorkers(
          isDemo && db ? Array.from(db.surfaceColumns.entries()) : [],
          db?.exploredBlockKeys ? Array.from(db.exploredBlockKeys) : [],
          db?.blockSurfaces ? Array.from(db.blockSurfaces.entries()) : [],
          db?.macroMipmap ? Array.from(db.macroMipmap.entries()) : []
        );
      });
    } catch {
      // Ignore outside injection context
    }
  }

  private putL1Tile(key: string, buffer: ArrayBuffer): void {
    if (this.l1TileCache.size >= MAX_L1_TILES) {
      const oldestKey = this.l1TileCache.keys().next().value;
      if (oldestKey !== undefined) {
        this.l1TileCache.delete(oldestKey);
      }
    }
    this.l1TileCache.set(key, buffer);
  }

  public clearMemoryCache(): void {
    this.l1TileCache.clear();
  }

  /**
   * Immediately purges all queued (unstarted) 3D 'terrain-dem' jobs when 3D Relief mode is disabled
   * so background workers stop baking 3D elevation tiles in 2D Flat mode.
   */
  public cancelPendingDemTiles(): void {
    let removed = false;
    for (let i = this.queue.length - 1; i >= 0; i--) {
      if (this.queue[i].job.tileKind === 'terrain-dem') {
        const [dropped] = this.queue.splice(i, 1);
        const err = new DOMException('Aborted', 'AbortError');
        for (const rej of dropped.rejecters) {
          rej(err);
        }
        removed = true;
      }
    }
    if (removed) {
      this.updateActiveCount();
    }
  }

  /**
   * Immediately purges ALL queued (unstarted) tile render jobs across color & DEM tiers
   * when loading a new map world, freeing worker capacity instantly.
   */
  public cancelAllPendingTiles(): void {
    if (this.queue.length === 0) return;
    const err = new DOMException('Aborted', 'AbortError');
    while (this.queue.length > 0) {
      const dropped = this.queue.pop();
      if (dropped) {
        for (const rej of dropped.rejecters) {
          try {
            rej(err);
          } catch {}
        }
      }
    }
    this.updateActiveCount();
  }

  private initWorkerPool(): void {
    if (typeof Worker === 'undefined') {
      return;
    }

    try {
      const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
      // Scale up to 6 workers on modern multi-core machines (Apple Silicon M1-M4, Ryzen, 8+ cores)
      const count = Math.max(2, Math.min(6, cores));

      for (let i = 0; i < count; i++) {
        const worker = new Worker(new URL('../../workers/map-tile.worker', import.meta.url), {
          type: 'module'
        });

        const instance: WorkerInstance = {
          worker,
          busy: false,
          activeJobId: null
        };

        worker.onmessage = ({ data }) => {
          if (data?.type === 'TILE_DONE') {
            instance.busy = false;
            instance.activeJobId = null;
            const pending = this.pendingMap.get(data.jobId);
            if (pending) {
              this.pendingMap.delete(data.jobId);
              this.completedTilesCount.update(c => c + 1);

              const buf: ArrayBuffer | undefined = data.buffer;
              if (buf && buf.byteLength > 0) {
                const copy = buf.slice(0);
                this.putL1Tile(pending.cacheKey, copy);
                if (pending.dispatchedDbVersion === this.dbStateVersion) {
                  const currentRev = this.mapStore.renderRevision();
                  if (currentRev > pending.revision) {
                    this.putL1Tile(
                      `${pending.configKey}_r${currentRev}/${pending.coordKey}`,
                      copy
                    );
                  }
                  if (this.latestRequestedRevision > pending.revision) {
                    this.putL1Tile(
                      `${pending.configKey}_r${this.latestRequestedRevision}/${pending.coordKey}`,
                      copy
                    );
                  }
                }
                if (!this.mapStore.isLoadingWorld()) {
                  this.sessionWrittenL2Keys.add(pending.cacheKey);
                  this.pwaStorage.putTile(pending.cacheKey, copy).catch(() => {});
                }
              }
              if (buf) {
                const resolvers = pending.resolvers;
                for (let i = 0; i < resolvers.length; i++) {
                  resolvers[i](i === resolvers.length - 1 ? buf : buf.slice(0));
                }
              }
            }
            this.updateActiveCount();
            this.dispatchNext();
          }
        };

        worker.onerror = () => {
          instance.busy = false;
          instance.activeJobId = null;
          this.updateActiveCount();
          this.dispatchNext();
        };

        this.pool.push(instance);
      }

      this.workerCount.set(this.pool.length);
    } catch {
      // Fallback to synchronous rendering if Worker instantiation fails in restricted test envs
    }
  }

  public broadcastDatabaseToWorkers(
    entries: Array<[string, ParsedColumnSurface]>,
    exploredKeys: string[],
    blockEntries: Array<[string, CompactBlockSurface]> = [],
    mipmapEntries: Array<[string, MacroMipmapCell]> = []
  ): void {
    this.dbStateVersion++;
    for (const inst of this.pool) {
      inst.worker.postMessage({
        type: 'SYNC_DB',
        entries,
        exploredKeys,
        blockEntries,
        mipmapEntries
      });
    }
  }

  public appendCompactBlocksToWorkers(
    blockEntries: Array<[string, CompactBlockSurface]>,
    mipmapEntries: Array<[string, MacroMipmapCell]>,
    evictedKeys: string[] = [],
    evictedMipKeys: string[] = []
  ): void {
    if (
      blockEntries.length === 0 &&
      mipmapEntries.length === 0 &&
      evictedKeys.length === 0 &&
      evictedMipKeys.length === 0
    ) {
      return;
    }
    this.dbStateVersion++;
    for (const inst of this.pool) {
      inst.worker.postMessage({
        type: 'APPEND_DB_BLOCKS',
        blockEntries,
        mipmapEntries,
        evictedKeys,
        evictedMipKeys
      });
    }
  }

  public async requestTile(
    tileKind: 'color' | 'terrain-dem',
    zoom: number,
    tx: number,
    ty: number,
    revision = 0,
    abortSignal?: AbortSignal,
    cameraZoom?: number
  ): Promise<ArrayBuffer> {
    if (abortSignal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    if (revision > this.latestRequestedRevision) {
      this.latestRequestedRevision = revision;
    }

    this.latestRequestedZoom = zoom;

    const coordKey = `${tileKind}/${zoom}/${tx}_${ty}`;
    const bounds = this.projection.tileToLuantiBounds(zoom, tx, ty);
    const cfg = this.mapStore.worldConfig();
    const vSlice = this.mapStore.verticalSlice();
    const customBiomes = this.mapStore.activeBiomes();
    const tierTag = cameraZoom !== undefined && cameraZoom < 6.0 ? 'm' : 'd';

    const configKey = `v3_${cfg.seed}_${cfg.mapgen}_${this.mapStore.viewMode()}_${vSlice.presetId}_${vSlice.minY}_${vSlice.maxY}_${vSlice.caveMode ? 1 : 0}_${this.mapStore.isolatedBiomeId() || 'none'}_${this.mapStore.hypsometricMode() ? 1 : 0}_${this.mapStore.hillshadeEnabled() ? 1 : 0}_${this.mapStore.voronoiContoursEnabled() ? 1 : 0}_${this.mapStore.exploredBoundsEnabled() ? 1 : 0}_${tierTag}`;
    const cacheKey = `${configKey}_r${revision}/${coordKey}`;

    // 1. Check L1 In-Memory RAM Cache (Instant 0ms synchronous return)
    const l1Hit = this.l1TileCache.get(cacheKey);
    if (l1Hit) {
      return l1Hit.slice(0);
    }

    // 2. Check L2 IndexedDB Persistent Cache (< 2ms lookup without worker computation)
    // Skip guaranteed-miss IndexedDB transactions for intermediate streaming revisions > 1
    if (revision <= 1 || this.sessionWrittenL2Keys.has(cacheKey)) {
      const l2Hit = await this.pwaStorage.getTile(cacheKey);
      if (abortSignal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      if (l2Hit) {
        this.putL1Tile(cacheKey, l2Hit.slice(0));
        return l2Hit;
      }

      // Re-check L1 after async L2 lookup in case an in-flight worker completed while awaiting
      const l1HitAfterAwait = this.l1TileCache.get(cacheKey);
      if (l1HitAfterAwait) {
        return l1HitAfterAwait.slice(0);
      }
    }

    const job: TileRenderJobPayload = {
      jobId: this.nextJobId++,
      zoom,
      cameraZoom,
      tileKind,
      tileSize: tileKind === 'terrain-dem' ? 64 : 256,
      minX: bounds.minX,
      maxX: bounds.maxX,
      minZ: bounds.minZ,
      maxZ: bounds.maxZ,
      seed: cfg.seed,
      mapgen: cfg.mapgen,
      waterLevel: cfg.waterLevel,
      heatNoise: cfg.heatNoise,
      humidityNoise: cfg.humidityNoise,
      terrainNoise: cfg.terrainNoise,
      viewMode: this.mapStore.viewMode(),
      hypsometricMode: this.mapStore.hypsometricMode(),
      hillshadeEnabled: this.mapStore.hillshadeEnabled(),
      voronoiContoursEnabled: this.mapStore.voronoiContoursEnabled(),
      exploredBoundsEnabled: this.mapStore.exploredBoundsEnabled(),
      isolatedBiomeId: this.mapStore.isolatedBiomeId(),
      sliceMinY: vSlice.minY,
      sliceMaxY: vSlice.maxY,
      caveMode: vSlice.caveMode,
      customBiomes
    };

    if (this.pool.length === 0) {
      const db = this.mapStore.worldDatabase();
      const buf = renderTilePngBuffer(
        job,
        db?.surfaceColumns || null,
        db?.exploredBlockKeys || null,
        db?.blockSurfaces || null,
        db?.macroMipmap || null
      );
      this.putL1Tile(cacheKey, buf.slice(0));
      if (!this.mapStore.isLoadingWorld()) {
        this.sessionWrittenL2Keys.add(cacheKey);
        this.pwaStorage.putTile(cacheKey, buf.slice(0)).catch(() => {});
      }
      this.completedTilesCount.update(c => c + 1);
      return buf;
    }

    return new Promise<ArrayBuffer>((resolve, reject) => {
      const attachAbortCleanup = (target: QueuedJob) => {
        if (!abortSignal) return;
        const onAbort = () => {
          const rIdx = target.resolvers.indexOf(resolve);
          if (rIdx !== -1) {
            target.resolvers.splice(rIdx, 1);
            target.rejecters.splice(rIdx, 1);
          }
          if (target.resolvers.length === 0) {
            const qIdx = this.queue.indexOf(target);
            if (qIdx !== -1) {
              this.queue.splice(qIdx, 1);
              this.updateActiveCount();
            }
          }
          reject(new DOMException('Aborted', 'AbortError'));
        };
        if (abortSignal.aborted) {
          onAbort();
          return;
        }
        abortSignal.addEventListener('abort', onAbort, { once: true });
      };

      // If an in-flight worker job is already rendering this exact cacheKey (or same coordKey + configKey at the current DB version), piggyback on it
      for (const inFlight of this.pendingMap.values()) {
        if (
          inFlight.cacheKey === cacheKey ||
          (inFlight.coordKey === coordKey &&
            inFlight.configKey === configKey &&
            inFlight.dispatchedDbVersion === this.dbStateVersion)
        ) {
          inFlight.resolvers.push(resolve);
          inFlight.rejecters.push(reject);
          attachAbortCleanup(inFlight);
          return;
        }
      }

      // If an unstarted job for the same tile coordinate is already in the queue,
      // coalesce & upgrade it in-place so all concurrent MapLibre loadTile() calls
      // for this shared Tile receive the valid rendered PNG buffer (never a 0-byte buffer!).
      const existingQueued = this.queue.find(q => q.coordKey === coordKey);
      if (existingQueued) {
        if (revision >= existingQueued.revision) {
          existingQueued.job = job;
          existingQueued.configKey = configKey;
          existingQueued.revision = revision;
          existingQueued.cacheKey = cacheKey;
        }
        existingQueued.resolvers.push(resolve);
        existingQueued.rejecters.push(reject);
        attachAbortCleanup(existingQueued);
        this.dispatchNext();
        return;
      }

      const queued: QueuedJob = {
        coordKey,
        configKey,
        job,
        revision,
        cacheKey,
        resolvers: [resolve],
        rejecters: [reject]
      };
      if (this.queue.length >= 1024) {
        const dropped = this.queue.shift();
        if (dropped) {
          const err = new Error('Tile queue overflow');
          for (const rej of dropped.rejecters) {
            rej(err);
          }
        }
      }
      this.queue.push(queued);
      attachAbortCleanup(queued);
      this.dispatchNext();
    });
  }

  private dispatchNext(): void {
    while (this.queue.length > 0) {
      const idleWorker = this.pool.find(w => !w.busy);
      if (!idleWorker) break;

      // Drain tiles in strict FIFO order (prioritizing visible 'color' tiles ahead of 'terrain-dem'
      // mesh tiles) without penalizing horizon/midground zoom levels in 3D pitched views so MapLibre's
      // 32-slot ImageRequest concurrency window is never starved!
      let bestIdx = 0;
      let bestScore = -Infinity;
      for (let i = 0; i < this.queue.length; i++) {
        const q = this.queue[i];
        const kindBonus = q.job.tileKind === 'color' ? 10 : 0;
        const score = kindBonus - i * 0.01;
        if (score > bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }

      const [nextJob] = this.queue.splice(bestIdx, 1);
      nextJob.dispatchedDbVersion = this.dbStateVersion;
      idleWorker.busy = true;
      idleWorker.activeJobId = nextJob.job.jobId;
      this.pendingMap.set(nextJob.job.jobId, nextJob);
      idleWorker.worker.postMessage({
        type: 'RENDER_TILE',
        job: nextJob.job
      });
    }
    this.updateActiveCount();
  }

  private updateActiveCount(): void {
    const busyWorkers = this.pool.filter(w => w.busy).length;
    this.activeTasksCount.set(busyWorkers + this.queue.length);
  }
}
