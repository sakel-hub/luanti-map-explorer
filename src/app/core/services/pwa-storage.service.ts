import { Injectable, signal } from '@angular/core';
import {
  DiscoveredWorldRegion,
  MacroMipmapCell,
  VerticalLayerSummary,
  WorldDatabaseBackend
} from '../models/world.model';
import { BiomeDefinition } from '../models/biome.model';
import { safeGetItem, safeSetItem } from '../utils/storage.utils';

export interface CachedWorldMetadata {
  fileKey: string;
  fileName: string;
  fileSizeBytes: number;
  databaseBackend?: WorldDatabaseBackend;
  totalBlocks: number;
  minBlockX: number;
  maxBlockX: number;
  minBlockZ: number;
  maxBlockZ: number;
  exploredBlockKeys: string[];
  exploredMacroSectors?: Array<{ mx: number; mz: number }>;
  discoveredRegions: DiscoveredWorldRegion[];
  verticalLayers: VerticalLayerSummary[];
  discoveredModBiomes: BiomeDefinition[];
  macroMipmap: Array<[string, MacroMipmapCell]>;
  cachedAt: number;
}

export interface RecentWorldEntry {
  id: string;
  name: string;
  handle: FileSystemFileHandle;
  size: number;
  lastOpened: number;
}

export interface StorageQuotaInfo {
  supported: boolean;
  persisted: boolean;
  usageBytes: number;
  quotaBytes: number;
  usageMb: number;
  quotaMb: number;
  tileCacheCount: number;
  tileCacheBytes: number;
  tileCacheMb: number;
}

const DB_NAME = 'luanti_explorer_pwa_v1';
const DB_VERSION = 1;
const STORE_TILES = 'tile_cache';
const STORE_METADATA = 'world_metadata';
const STORE_HANDLES = 'file_handles';

/** Maximum 50 MB storage for cached map tiles (~2,500 tiles) with automatic LRU pruning */
export const MAX_TILE_CACHE_BYTES = 50 * 1024 * 1024;
/** Maximum 10 recent worlds' metadata (~1 MB) */
export const MAX_METADATA_ENTRIES = 10;

@Injectable({
  providedIn: 'root'
})
export class PwaStorageService {
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private currentTileCacheBytes = 0;
  private currentTileCacheCount = 0;
  private hasInitializedCacheBytes = false;
  private isPruning = false;
  private wakeLockSentinel: any = null;

  public readonly isPersisted = signal<boolean>(false);
  public readonly quotaInfo = signal<StorageQuotaInfo | null>(null);
  public readonly recentWorld = signal<RecentWorldEntry | null>(null);
  public readonly isOffline = signal<boolean>(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );
  public readonly updateAvailable = signal<boolean>(false);

  constructor() {
    this.initNetworkAndSwListeners();
    this.initStorage();
  }

  private initNetworkAndSwListeners(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => this.isOffline.set(false));
    window.addEventListener('offline', () => this.isOffline.set(true));

    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .getRegistration()
        .then(reg => {
          if (!reg) return;
          if (reg.waiting) {
            this.updateAvailable.set(true);
          }
          reg.addEventListener('updatefound', () => {
            const installing = reg.installing;
            if (!installing) return;
            installing.addEventListener('statechange', () => {
              if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                this.updateAvailable.set(true);
              }
            });
          });
        })
        .catch(() => {
          // Ignore service worker registration query errors
        });
    }
  }

  public async applyUpdate(): Promise<void> {
    try {
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg?.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      }
    } catch {
      // Ignore activation error and reload anyway
    }
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }

  private async initStorage(): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      await this.getDb();
      await this.checkPersistence();
      await this.loadRecentWorld();
      await this.refreshStorageQuota();
    } catch {
      // Storage unavailable or restricted
    }
  }

  private getDb(): Promise<IDBDatabase | null> {
    if (this.dbPromise) return this.dbPromise;
    if (typeof indexedDB === 'undefined') {
      this.dbPromise = Promise.resolve(null);
      return this.dbPromise;
    }

    this.dbPromise = new Promise(resolve => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_TILES)) {
            const tileStore = db.createObjectStore(STORE_TILES, { keyPath: 'key' });
            tileStore.createIndex('timestamp', 'timestamp', { unique: false });
          }
          if (!db.objectStoreNames.contains(STORE_METADATA)) {
            const metaStore = db.createObjectStore(STORE_METADATA, { keyPath: 'fileKey' });
            metaStore.createIndex('cachedAt', 'cachedAt', { unique: false });
          }
          if (!db.objectStoreNames.contains(STORE_HANDLES)) {
            db.createObjectStore(STORE_HANDLES, { keyPath: 'id' });
          }
        };

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  public get hasFileSystemAccess(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof (window as any).showOpenFilePicker === 'function'
    );
  }

  public async checkPersistence(): Promise<boolean> {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persisted) {
      try {
        const persisted = await navigator.storage.persisted();
        this.isPersisted.set(persisted);
        return persisted;
      } catch {
        return false;
      }
    }
    return false;
  }

  public async requestPersistentStorage(): Promise<boolean> {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
      try {
        const granted = await navigator.storage.persist();
        this.isPersisted.set(granted);
        await this.refreshStorageQuota();
        return granted;
      } catch {
        return false;
      }
    }
    return false;
  }

  public async requestWakeLock(): Promise<() => void> {
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator && (navigator as any).wakeLock) {
      try {
        this.wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
        return () => {
          try {
            if (this.wakeLockSentinel) {
              this.wakeLockSentinel.release();
              this.wakeLockSentinel = null;
            }
          } catch {
            // Ignore release errors
          }
        };
      } catch {
        // WakeLock unsupported or rejected by browser power policy
      }
    }
    return () => {};
  }

  // =========================================================================
  // 1. L2 TILE CACHE (IndexedDB)
  // =========================================================================

  public async getTile(key: string): Promise<ArrayBuffer | null> {
    const db = await this.getDb();
    if (!db) return null;

    return new Promise(resolve => {
      try {
        const tx = db.transaction(STORE_TILES, 'readonly');
        const store = tx.objectStore(STORE_TILES);
        const req = store.get(key);
        req.onsuccess = () => {
          if (req.result && req.result.buffer instanceof ArrayBuffer) {
            resolve(req.result.buffer);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  public async putTile(key: string, buffer: ArrayBuffer): Promise<void> {
    const db = await this.getDb();
    if (!db) return;

    const size = buffer.byteLength;
    const entry = {
      key,
      buffer,
      size,
      timestamp: Date.now()
    };

    await new Promise<void>(resolve => {
      try {
        const tx = db.transaction(STORE_TILES, 'readwrite');
        const store = tx.objectStore(STORE_TILES);
        store.put(entry);
        tx.oncomplete = () => {
          this.currentTileCacheBytes += size;
          this.currentTileCacheCount += 1;
          resolve();
        };
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });

    if (this.currentTileCacheBytes > MAX_TILE_CACHE_BYTES && !this.isPruning) {
      this.pruneTileCacheLru();
    }
  }

  private async pruneTileCacheLru(): Promise<void> {
    const db = await this.getDb();
    if (!db || this.isPruning) return;
    this.isPruning = true;

    try {
      const tx = db.transaction(STORE_TILES, 'readwrite');
      const store = tx.objectStore(STORE_TILES);
      const index = store.index('timestamp');
      const req = index.openCursor();

      let freedBytes = 0;
      let deletedCount = 0;
      const targetFree = MAX_TILE_CACHE_BYTES * 0.25; // Free 25% when cap exceeded

      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor && (this.currentTileCacheBytes - freedBytes > MAX_TILE_CACHE_BYTES - targetFree || deletedCount < 100)) {
          const val = cursor.value;
          freedBytes += val.size || 0;
          deletedCount++;
          cursor.delete();
          cursor.continue();
        } else {
          this.currentTileCacheBytes = Math.max(0, this.currentTileCacheBytes - freedBytes);
          this.currentTileCacheCount = Math.max(0, this.currentTileCacheCount - deletedCount);
        }
      };

      tx.oncomplete = () => {
        this.isPruning = false;
        this.refreshStorageQuota();
      };
      tx.onerror = () => {
        this.isPruning = false;
      };
    } catch {
      this.isPruning = false;
    }
  }

  public async clearTileCache(): Promise<void> {
    const db = await this.getDb();
    if (!db) return;

    await new Promise<void>(resolve => {
      try {
        const tx = db.transaction(STORE_TILES, 'readwrite');
        const store = tx.objectStore(STORE_TILES);
        store.clear();
        tx.oncomplete = () => {
          this.currentTileCacheBytes = 0;
          this.currentTileCacheCount = 0;
          resolve();
        };
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });

    await this.refreshStorageQuota();
  }

  public async getTileCacheStats(): Promise<{ count: number; totalBytes: number }> {
    const db = await this.getDb();
    if (!db) return { count: 0, totalBytes: 0 };

    return new Promise(resolve => {
      try {
        const tx = db.transaction(STORE_TILES, 'readonly');
        const store = tx.objectStore(STORE_TILES);
        let count = 0;
        let totalBytes = 0;
        const req = store.openCursor();
        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor) {
            count++;
            totalBytes += cursor.value.size || cursor.value.buffer?.byteLength || 0;
            cursor.continue();
          } else {
            this.currentTileCacheBytes = totalBytes;
            this.currentTileCacheCount = count;
            this.hasInitializedCacheBytes = true;
            resolve({ count, totalBytes });
          }
        };
        req.onerror = () => resolve({ count: 0, totalBytes: 0 });
      } catch {
        resolve({ count: 0, totalBytes: 0 });
      }
    });
  }

  // =========================================================================
  // 2. WORLD METADATA & B-TREE OVERVIEW CACHE
  // =========================================================================

  public async getWorldMetadata(fileKey: string): Promise<CachedWorldMetadata | null> {
    const db = await this.getDb();
    if (!db) return null;

    return new Promise(resolve => {
      try {
        const tx = db.transaction(STORE_METADATA, 'readonly');
        const store = tx.objectStore(STORE_METADATA);
        const req = store.get(fileKey);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  public async getLastWorldMetadata(): Promise<CachedWorldMetadata | null> {
    const db = await this.getDb();
    if (!db) return null;

    const lastKey = safeGetItem('luanti_last_world_meta_key');
    if (lastKey) {
      const meta = await this.getWorldMetadata(lastKey);
      if (meta) return meta;
    }

    return new Promise(resolve => {
      try {
        const tx = db.transaction(STORE_METADATA, 'readonly');
        const store = tx.objectStore(STORE_METADATA);
        const index = store.index('cachedAt');
        const req = index.openCursor(null, 'prev');
        req.onsuccess = () => {
          const cursor = req.result;
          resolve(cursor ? (cursor.value as CachedWorldMetadata) : null);
        };
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  public async saveWorldMetadata(metadata: CachedWorldMetadata): Promise<void> {
    safeSetItem('luanti_last_world_meta_key', metadata.fileKey);
    const db = await this.getDb();
    if (!db) return;

    await new Promise<void>(resolve => {
      try {
        const tx = db.transaction(STORE_METADATA, 'readwrite');
        const store = tx.objectStore(STORE_METADATA);
        store.put(metadata);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });

    this.pruneMetadataLru();
  }

  private async pruneMetadataLru(): Promise<void> {
    const db = await this.getDb();
    if (!db) return;

    try {
      const tx = db.transaction(STORE_METADATA, 'readwrite');
      const store = tx.objectStore(STORE_METADATA);
      const countReq = store.count();

      countReq.onsuccess = () => {
        if (countReq.result > MAX_METADATA_ENTRIES) {
          const excess = countReq.result - MAX_METADATA_ENTRIES;
          const index = store.index('cachedAt');
          const cursorReq = index.openCursor();
          let deleted = 0;
          cursorReq.onsuccess = () => {
            const cursor = cursorReq.result;
            if (cursor && deleted < excess) {
              cursor.delete();
              deleted++;
              cursor.continue();
            }
          };
        }
      };
    } catch {
      // Ignore
    }
  }

  // =========================================================================
  // 3. FILE SYSTEM ACCESS API & HANDLE PERSISTENCE
  // =========================================================================

  public async saveRecentFileHandle(handle: FileSystemFileHandle, file: File): Promise<void> {
    const db = await this.getDb();
    if (!db) return;

    const entry: RecentWorldEntry = {
      id: 'last_opened_world',
      name: file.name,
      handle,
      size: file.size,
      lastOpened: Date.now()
    };

    safeSetItem('luanti_has_recent_world', 'true');

    await new Promise<void>(resolve => {
      try {
        const tx = db.transaction(STORE_HANDLES, 'readwrite');
        const store = tx.objectStore(STORE_HANDLES);
        store.put(entry);
        tx.oncomplete = () => {
          this.recentWorld.set(entry);
          resolve();
        };
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  public async loadRecentWorld(): Promise<RecentWorldEntry | null> {
    const db = await this.getDb();
    if (!db) return null;

    return new Promise(resolve => {
      try {
        const tx = db.transaction(STORE_HANDLES, 'readonly');
        const store = tx.objectStore(STORE_HANDLES);
        const req = store.get('last_opened_world');
        req.onsuccess = () => {
          const val = req.result as RecentWorldEntry | undefined;
          this.recentWorld.set(val || null);
          resolve(val || null);
        };
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  public async clearRecentWorld(): Promise<void> {
    const db = await this.getDb();
    if (!db) return;

    await new Promise<void>(resolve => {
      try {
        const tx = db.transaction(STORE_HANDLES, 'readwrite');
        const store = tx.objectStore(STORE_HANDLES);
        store.delete('last_opened_world');
        tx.oncomplete = () => {
          this.recentWorld.set(null);
          resolve();
        };
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  // =========================================================================
  // 4. STORAGE QUOTA & REPORTING
  // =========================================================================

  public async refreshStorageQuota(): Promise<StorageQuotaInfo> {
    const stats = this.hasInitializedCacheBytes
      ? { count: this.currentTileCacheCount, totalBytes: this.currentTileCacheBytes }
      : await this.getTileCacheStats();

    let usageBytes = stats.totalBytes;
    let quotaBytes = 1024 * 1024 * 1024; // 1 GB fallback
    let persisted = this.isPersisted();

    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        if (estimate.usage !== undefined) usageBytes = estimate.usage;
        if (estimate.quota !== undefined) quotaBytes = estimate.quota;
      } catch {
        // Ignore estimate error
      }
    }

    const info: StorageQuotaInfo = {
      supported: typeof indexedDB !== 'undefined',
      persisted,
      usageBytes,
      quotaBytes,
      usageMb: Number((usageBytes / (1024 * 1024)).toFixed(1)),
      quotaMb: Number((quotaBytes / (1024 * 1024)).toFixed(1)),
      tileCacheCount: stats.count,
      tileCacheBytes: stats.totalBytes,
      tileCacheMb: Number((stats.totalBytes / (1024 * 1024)).toFixed(1))
    };

    this.quotaInfo.set(info);
    return info;
  }
}
