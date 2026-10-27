import { Injectable, inject, signal } from '@angular/core';
import pako from 'pako';
import { MapStore } from '../state/map.store';
import { WorkerPoolService } from './worker-pool.service';
import {
  CompactBlockSurface,
  DecodedWorldDatabase,
  DiscoveredWorldRegion,
  MacroMipmapCell,
  MapgenType,
  NoiseParams,
  ParsedColumnSurface,
  RawMapBlockRow,
  VerticalLayerSummary,
  VerticalSlicePresetId,
  WorldConfig,
  WorldDatabaseBackend,
  WorldDatabaseReader,
  WorldLoadProgress
} from '../models/world.model';
import { BiomeDefinition } from '../models/biome.model';
import {
  mergeParsedBlockIntoCompactSurface,
  parseAndMergeCoarseBlockMipmap,
  parseLuantiMapBlockCoords
} from '../utils/mapblock-parser';
import { SqliteFileBtreeReader } from '../utils/sqlite-btree-reader';
import { PostgresSqlDumpReader } from '../utils/postgres-dump-reader';
import { buildDiscoveredBiomeDefinition } from '../data/default-biomes';
import { PwaStorageService, RecentWorldEntry } from './pwa-storage.service';
import { safeGetItem, safeSetItem } from '../utils/storage.utils';

const MAX_MAIN_THREAD_BLOCKS = 131072; // Holds up to 512 full 16x16 sub-sectors so full widescreen viewports never evict active blocks

@Injectable({
  providedIn: 'root'
})
export class WorldLoaderService {
  private readonly mapStore = inject(MapStore);
  private readonly workerPool = inject(WorkerPoolService);
  private readonly pwaStorage = inject(PwaStorageService);

  public readonly lastError = signal<string | null>(null);
  public readonly lastLoadedSummary = signal<string | null>(null);
  public readonly isStreamingRegion = signal<boolean>(false);
  public readonly streamProgress = signal<WorldLoadProgress | null>(null);
  public readonly canResumeFileHandle = signal<RecentWorldEntry | null>(null);
  public readonly isOfflineCachedWorld = signal<boolean>(false);

  private activeDbReader: WorldDatabaseReader | null = null;
  public get activeBtreeReader(): WorldDatabaseReader | null {
    return this.activeDbReader;
  }
  private loadedSubSectors = new Set<string>(); // 16x16 MapBlock (256x256 node) high-res sub-sectors
  private loadedMacroSectorStride = new Map<string, number>(); // 64x64 MapBlock (1024x1024 node) Tier-0 mipmap sectors -> finest stride (4 or 2)
  private activeSliceKey = '';
  private streamGeneration = 0;
  private cancelInitialLoadRequested = false;
  private pendingViewportRequest: { centerX: number; centerZ: number; zoom: number } | null = null;

  /** Tracks empirical (Heat, Humidity) centroids per surface nodeName for dynamic Voronoi discovery */
  private readonly modBiomeClimateStats = new Map<
    string,
    { count: number; sumHeat: number; sumHumidity: number }
  >();

  /** Tracks clusters of player-crafted/structural surface nodes (bricks, wood, chests, lamps, etc.) to surface player bases */
  private readonly playerBaseBuckets = new Map<
    string,
    { sx: number; sz: number; blockCount: number; playerNodes: number; sumX: number; sumZ: number }
  >();

  public async openFilePicker(options?: { directory?: boolean; preferFileSystemApi?: boolean }): Promise<void> {
    // Only invoke modern File System Access API if explicitly requested.
    // Standard HTML file input bypasses Chromium's system directory blacklist (e.g. ~/Library/Application Support/ and AppData),
    // allowing direct selection of Luanti world saves without "contains system files" browser blocks.
    if (options?.preferFileSystemApi && this.pwaStorage.hasFileSystemAccess) {
      try {
        await this.pickWorldFileViaFileSystemApi();
        return;
      } catch (e) {
        console.warn('File System Access API failed or restricted, falling back to standard file input:', e);
      }
    }
    if (typeof document === 'undefined') return;

    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    if (options?.directory) {
      input.setAttribute('webkitdirectory', '');
      input.setAttribute('directory', '');
    } else {
      input.accept = '.sqlite,.sqlite3,.db,.sql,.pgsql,.dump,.txt,.mt';
    }
    input.onchange = () => {
      if (input.files && input.files.length > 0) {
        this.handleFileListInput(input.files);
      }
    };
    input.click();
  }

  public async pickWorldFileViaFileSystemApi(): Promise<void> {
    if (!this.pwaStorage.hasFileSystemAccess) return;
    try {
      const handles: FileSystemFileHandle[] = await (window as any).showOpenFilePicker({
        types: [
          {
            description: 'Luanti World Database (SQLite / PostgreSQL) & Metadata',
            accept: {
              'application/x-sqlite3': ['.sqlite', '.sqlite3', '.db'],
              'application/sql': ['.sql', '.pgsql', '.dump'],
              'text/plain': ['.txt', '.mt']
            }
          }
        ],
        multiple: true,
        excludeAcceptAllOption: false
      });

      if (!handles || handles.length === 0) return;

      const files: File[] = [];
      let primaryDbHandle: FileSystemFileHandle | null = null;
      let primaryDbFile: File | null = null;

      for (const handle of handles) {
        const file = await handle.getFile();
        files.push(file);
        const lower = file.name.toLowerCase();
        if (
          lower.endsWith('.sqlite') ||
          lower.endsWith('.sqlite3') ||
          lower.endsWith('.db') ||
          lower.endsWith('.sql') ||
          lower.endsWith('.pgsql') ||
          lower.endsWith('.dump')
        ) {
          primaryDbHandle = handle;
          primaryDbFile = file;
        }
      }

      if (primaryDbHandle && primaryDbFile) {
        await this.pwaStorage.saveRecentFileHandle(primaryDbHandle, primaryDbFile);
        this.canResumeFileHandle.set(null);
        this.isOfflineCachedWorld.set(false);
      }

      await this.handleFileListInput(files);
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        this.lastError.set(err?.message || 'Failed to open file.');
      }
    }
  }

  public async openWorldFromFileHandle(handle: FileSystemFileHandle): Promise<void> {
    try {
      const queryResult = await (handle as any).queryPermission?.({ mode: 'read' });
      if (queryResult !== 'granted') {
        const reqResult = await (handle as any).requestPermission?.({ mode: 'read' });
        if (reqResult !== 'granted') {
          this.lastError.set('File read permission denied by browser.');
          return;
        }
      }
      const file = await handle.getFile();
      await this.pwaStorage.saveRecentFileHandle(handle, file);
      this.canResumeFileHandle.set(null);
      this.isOfflineCachedWorld.set(false);
      await this.handleFileListInput([file]);
    } catch (err: any) {
      this.lastError.set(err?.message || 'Failed to open file from handle.');
    }
  }

  public async autoRestoreRecentWorld(): Promise<boolean> {
    try {
      const isDemo = safeGetItem('luanti_explorer_is_demo_v1');
      if (isDemo === 'true') {
        return false;
      }

      const recent = await this.pwaStorage.loadRecentWorld();
      if (recent && recent.handle) {
        try {
          const perm = await (recent.handle as any).queryPermission?.({ mode: 'read' });
          if (perm === 'granted') {
            const file = await recent.handle.getFile();
            await this.handleFileListInput([file], true);
            this.canResumeFileHandle.set(null);
            this.isOfflineCachedWorld.set(false);
            return true;
          } else {
            this.canResumeFileHandle.set(recent);
            const restored = await this.restoreFromCachedMetadata();
            if (restored) {
              this.isOfflineCachedWorld.set(true);
              return true;
            }
          }
        } catch (e) {
          console.warn('Auto restore via handle error:', e);
        }
      }

      const restored = await this.restoreFromCachedMetadata();
      if (restored) {
        this.isOfflineCachedWorld.set(true);
        return true;
      }

      return false;
    } catch (err) {
      console.warn('Auto restore failed:', err);
      return false;
    }
  }

  public async restoreFromCachedMetadata(): Promise<boolean> {
    try {
      const meta = await this.pwaStorage.getLastWorldMetadata();
      if (!meta) return false;

      const lastConfigRaw = safeGetItem('luanti_explorer_world_config_v1');
      let partialConfig: Partial<WorldConfig> = {
        worldName: meta.fileName.replace(/\.sqlite\d*$/i, '') || 'Restored Luanti World',
        blockCount: meta.totalBlocks
      };
      if (lastConfigRaw) {
        try {
          const parsed = JSON.parse(lastConfigRaw);
          partialConfig = { ...partialConfig, ...parsed };
        } catch {}
      }

      let exploredMacro = meta.exploredMacroSectors;
      const macroSectorKeys = new Set<string>();

      if (meta.macroMipmap) {
        for (const [key] of meta.macroMipmap) {
          let mx: number;
          let mz: number;
          if (key.startsWith('b:')) {
            const [bxStr, bzStr] = key.slice(2).split(',');
            mx = Math.floor(parseInt(bxStr, 10) / 64);
            mz = Math.floor(parseInt(bzStr, 10) / 64);
          } else if (key.startsWith('m4:')) {
            const [cxStr, czStr] = key.slice(3).split(',');
            mx = Math.floor(parseInt(cxStr, 10) / 16);
            mz = Math.floor(parseInt(czStr, 10) / 16);
          } else {
            const [cxStr, czStr] = key.split(',');
            mx = Math.floor(parseInt(cxStr, 10) / 32);
            mz = Math.floor(parseInt(czStr, 10) / 32);
          }
          if (!Number.isNaN(mx) && !Number.isNaN(mz)) {
            macroSectorKeys.add(`${mx},${mz}`);
          }
        }
      }

      if (!exploredMacro || exploredMacro.length === 0) {
        const list: Array<{ mx: number; mz: number }> = [];
        for (const k of macroSectorKeys) {
          const [mxStr, mzStr] = k.split(',');
          list.push({ mx: parseInt(mxStr, 10), mz: parseInt(mzStr, 10) });
        }
        if (list.length === 0 && meta.discoveredRegions) {
          for (const reg of meta.discoveredRegions) {
            // centerX and centerZ are world node coordinates (1024 nodes per macro sector)
            const mx = Math.floor(reg.centerX / 1024);
            const mz = Math.floor(reg.centerZ / 1024);
            const k = `${mx},${mz}`;
            if (!macroSectorKeys.has(k)) {
              macroSectorKeys.add(k);
              list.push({ mx, mz });
            }
          }
        }
        if (list.length === 0 && meta.exploredBlockKeys) {
          for (const bk of meta.exploredBlockKeys) {
            const [bxStr, bzStr] = bk.split(',');
            const mx = Math.floor(parseInt(bxStr, 10) / 64);
            const mz = Math.floor(parseInt(bzStr, 10) / 64);
            if (!Number.isNaN(mx) && !Number.isNaN(mz)) {
              const k = `${mx},${mz}`;
              if (!macroSectorKeys.has(k)) {
                macroSectorKeys.add(k);
                list.push({ mx, mz });
              }
            }
          }
        }
        exploredMacro = list;
      }

      const restoredDb: DecodedWorldDatabase = {
        fileName: meta.fileName,
        fileSizeBytes: meta.fileSizeBytes,
        databaseBackend: meta.databaseBackend || 'sqlite3',
        hasDatabase: true,
        totalBlocks: meta.totalBlocks,
        minBlockX: meta.minBlockX ?? -10,
        maxBlockX: meta.maxBlockX ?? 10,
        minBlockZ: meta.minBlockZ ?? -10,
        maxBlockZ: meta.maxBlockZ ?? 10,
        surfaceColumns: new Map(),
        exploredBlockCoords: [],
        exploredBlockKeys: new Set(meta.exploredBlockKeys || []),
        exploredMacroSectors: exploredMacro,
        discoveredRegions: meta.discoveredRegions || [],
        verticalLayers: meta.verticalLayers || [],
        discoveredModBiomes: meta.discoveredModBiomes || [],
        macroMipmap: new Map(meta.macroMipmap || []),
        nodeCounts: {}
      };

      this.loadedMacroSectorStride.clear();
      for (const k of macroSectorKeys) {
        this.loadedMacroSectorStride.set(k, 4);
      }

      this.mapStore.applyLoadedWorld(partialConfig, restoredDb);
      this.workerPool.broadcastDatabaseToWorkers(
        [],
        Array.from(restoredDb.exploredBlockKeys ?? []),
        [],
        Array.from(restoredDb.macroMipmap?.entries() ?? [])
      );
      this.lastLoadedSummary.set(
        `Restored ~${meta.totalBlocks.toLocaleString()} MapBlocks from offline cache · ${meta.discoveredRegions?.length || 1} regions`
      );
      return true;
    } catch (err) {
      console.warn('Failed to restore from cached metadata:', err);
      return false;
    }
  }

  public async handleFileListInput(fileList: FileList | File[] | null, isAutoRestore = false): Promise<void> {
    if (!fileList || fileList.length === 0) return;

    this.lastError.set(null);
    this.mapStore.isLoadingWorld.set(true);
    this.mapStore.loadStatusMessage.set('Preparing selected world files...');
    this.mapStore.loadProgress.set({
      phase: 'btree-scan',
      stepIndex: 1,
      totalSteps: 3,
      label: 'Preparing selected world files...',
      percent: 1,
      current: 0,
      total: 1,
      unit: 'pages',
      blocksDecoded: 0,
      elapsedSeconds: 0,
      etaSeconds: null
    });

    // Yield a browser paint frame so the native macOS File Dialog closes cleanly before file I/O begins
    await new Promise(resolve => setTimeout(resolve, 25));

    const filesMap = new Map<string, File>();
    let folderName = '';

    const isIgnoredAuxDb = (name: string): boolean =>
      name === 'xban.db' ||
      name === 'auth.sqlite' ||
      name === 'mod_storage.sqlite' ||
      name === 'players.sqlite';

    const count = fileList.length;
    for (let i = 0; i < count; i++) {
      const file = fileList[i];
      const relPath = (file as any).webkitRelativePath || '';
      if (relPath && relPath.includes('/')) {
        folderName = relPath.split('/')[0] || folderName;
      }
      const baseName = file.name.toLowerCase();
      if (isIgnoredAuxDb(baseName)) continue;

      if (
        baseName === 'world.mt' ||
        baseName === 'map_meta.txt' ||
        baseName.endsWith('.sqlite') ||
        baseName.endsWith('.sqlite3') ||
        baseName.endsWith('.db') ||
        baseName.endsWith('.sql') ||
        baseName.endsWith('.pgsql') ||
        baseName.endsWith('.dump')
      ) {
        filesMap.set(baseName, file);
      }
    }

    if (filesMap.size === 0 && count === 1) {
      const single = fileList[0];
      const lower = single.name.toLowerCase();
      if (lower.endsWith('.sql') || lower.endsWith('.pgsql') || lower.endsWith('.dump')) {
        filesMap.set('map.sql', single);
      } else {
        filesMap.set('map.sqlite', single);
      }
      folderName = single.name.replace(/\.(sqlite3?|db|sql|pgsql|dump)$/i, '');
    }

    if (!folderName) {
      const dbEntry = Array.from(filesMap.values()).find(f =>
        /\.(sqlite3?|db|sql|pgsql|dump)$/i.test(f.name)
      );
      folderName = dbEntry
        ? dbEntry.name === 'map.sqlite' || dbEntry.name === 'map.sql'
          ? 'Loaded Luanti World'
          : dbEntry.name.replace(/\.(sqlite3?|db|sql|pgsql|dump)$/i, '')
        : 'Imported Luanti World';
    }

    await this.processWorldFiles(folderName, filesMap, isAutoRestore);
  }

  public async handleDataTransferDrop(dataTransfer: DataTransfer | null): Promise<void> {
    if (!dataTransfer) return;
    this.lastError.set(null);
    this.mapStore.isLoadingWorld.set(true);
    this.mapStore.loadStatusMessage.set('Reading dropped world files...');

    try {
      const files: File[] = [];
      let detectedFolderName = '';

      if (dataTransfer.items && dataTransfer.items.length > 0) {
        for (let i = 0; i < dataTransfer.items.length; i++) {
          const item = dataTransfer.items[i];
          if (typeof (item as any).getAsFileSystemHandle === 'function') {
            try {
              const handle = await (item as any).getAsFileSystemHandle();
              if (handle && handle.kind === 'file') {
                const lower = handle.name.toLowerCase();
                if (
                  lower.endsWith('.sqlite') ||
                  lower.endsWith('.sqlite3') ||
                  lower.endsWith('.db') ||
                  lower.endsWith('.sql') ||
                  lower.endsWith('.pgsql') ||
                  lower.endsWith('.dump')
                ) {
                  const f = await handle.getFile();
                  await this.pwaStorage.saveRecentFileHandle(handle, f);
                  this.canResumeFileHandle.set(null);
                  this.isOfflineCachedWorld.set(false);
                }
              }
            } catch {
              // Ignore handle error
            }
          }
        }

        const entries: any[] = [];
        for (let i = 0; i < dataTransfer.items.length; i++) {
          const item = dataTransfer.items[i];
          const entry = typeof item.webkitGetAsEntry === 'function' ? item.webkitGetAsEntry() : null;
          if (entry) {
            entries.push(entry);
          }
        }

        if (entries.length > 0) {
          for (const entry of entries) {
            if (entry.isDirectory) {
              detectedFolderName = detectedFolderName || entry.name;
              const dirFiles = await this.readDirectoryEntryFiles(entry);
              files.push(...dirFiles);
            } else if (entry.isFile) {
              const file = await this.readFileEntry(entry);
              if (file) files.push(file);
            }
          }
        }
      }

      if (files.length === 0 && dataTransfer.files && dataTransfer.files.length > 0) {
        for (let i = 0; i < dataTransfer.files.length; i++) {
          files.push(dataTransfer.files[i]);
        }
      }

      if (files.length === 0) {
        this.mapStore.isLoadingWorld.set(false);
        return;
      }

      const filesMap = new Map<string, File>();
      for (const file of files) {
        const lower = file.name.toLowerCase();
        if (
          lower === 'world.mt' ||
          lower === 'map_meta.txt' ||
          lower.endsWith('.sqlite') ||
          lower.endsWith('.sqlite3') ||
          lower.endsWith('.db') ||
          lower.endsWith('.sql') ||
          lower.endsWith('.pgsql') ||
          lower.endsWith('.dump')
        ) {
          filesMap.set(lower, file);
        }
      }

      if (filesMap.size === 0 && files.length === 1) {
        const lower = files[0].name.toLowerCase();
        if (lower.endsWith('.sql') || lower.endsWith('.pgsql') || lower.endsWith('.dump')) {
          filesMap.set('map.sql', files[0]);
        } else {
          filesMap.set('map.sqlite', files[0]);
        }
      }

      await this.processWorldFiles(detectedFolderName || 'Dropped Luanti World', filesMap, false);
    } catch (err: any) {
      this.lastError.set(err?.message || 'Failed to read dropped files.');
      this.mapStore.isLoadingWorld.set(false);
      this.mapStore.loadStatusMessage.set('');
    }
  }

  private readFileEntry(fileEntry: any): Promise<File | null> {
    return new Promise(resolve => {
      fileEntry.file(
        (f: File) => resolve(f),
        () => resolve(null)
      );
    });
  }

  private async readDirectoryEntryFiles(dirEntry: any): Promise<File[]> {
    const reader = dirEntry.createReader();
    const entries: any[] = await new Promise(resolve => {
      reader.readEntries(
        (results: any[]) => resolve(results || []),
        () => resolve([])
      );
    });

    const out: File[] = [];
    for (const entry of entries) {
      if (entry.isFile) {
        const lower = String(entry.name || '').toLowerCase();
        if (
          lower === 'world.mt' ||
          lower === 'map_meta.txt' ||
          lower.endsWith('.sqlite') ||
          lower.endsWith('.sqlite3') ||
          lower.endsWith('.db') ||
          lower.endsWith('.sql') ||
          lower.endsWith('.pgsql') ||
          lower.endsWith('.dump')
        ) {
          const f = await this.readFileEntry(entry);
          if (f) out.push(f);
        }
      }
    }
    return out;
  }

  public async handleSingleDatabaseFile(file: File | null): Promise<void> {
    if (!file) return;
    await this.handleFileListInput([file]);
  }

  public async handleSingleSqliteFile(file: File | null): Promise<void> {
    await this.handleSingleDatabaseFile(file);
  }

  private async processWorldFiles(folderName: string, filesMap: Map<string, File>, isAutoRestore = false): Promise<void> {
    const releaseWakeLock = await this.pwaStorage.requestWakeLock();
    try {
      const partialConfig: Partial<WorldConfig> = {
        worldName: folderName
      };

      const hasSeedMetadata = filesMap.has('map_meta.txt');

      // 1. Parse world.mt
      const worldMtFile = filesMap.get('world.mt');
      if (worldMtFile) {
        this.mapStore.loadStatusMessage.set('Parsing world.mt...');
        const text = await worldMtFile.text();
        const parsedMt = this.parseKeyValueConfig(text);
        if (parsedMt['world_name']) partialConfig.worldName = parsedMt['world_name'];
        if (parsedMt['gameid']) partialConfig.gameId = parsedMt['gameid'];
        if (parsedMt['backend']) partialConfig.backend = parsedMt['backend'];

        const activeMods: string[] = [];
        for (const [k, v] of Object.entries(parsedMt)) {
          if (k.startsWith('load_mod_') && (v === 'true' || v === '1')) {
            activeMods.push(k.slice('load_mod_'.length));
          }
        }
        if (activeMods.length > 0) {
          partialConfig.activeMods = activeMods;
        }

        // Auto-configure biome palette mode if game is MineClone / Mineclonia
        if (
          partialConfig.gameId?.toLowerCase().includes('mineclone') ||
          partialConfig.gameId?.toLowerCase().includes('mineclonia')
        ) {
          this.mapStore.biomePaletteMode.set('mineclone');
        }
      }

      // 2. Parse map_meta.txt
      const mapMetaFile = filesMap.get('map_meta.txt');
      if (mapMetaFile) {
        this.mapStore.loadStatusMessage.set('Extracting seed & noise from map_meta.txt...');
        const text = await mapMetaFile.text();
        const parsedMeta = this.parseKeyValueConfig(text);

        if (parsedMeta['seed']) {
          const numSeed = Number(parsedMeta['seed'].slice(-9));
          if (!isNaN(numSeed)) {
            partialConfig.seed = numSeed;
          }
        }
        if (parsedMeta['mg_name']) {
          const mg = parsedMeta['mg_name'].toLowerCase();
          if (mg === 'v7' || mg === 'valleys' || mg === 'carpathian' || mg === 'flat') {
            partialConfig.mapgen = mg as MapgenType;
          }
        }
        if (parsedMeta['water_level'] && !isNaN(Number(parsedMeta['water_level']))) {
          partialConfig.waterLevel = Number(parsedMeta['water_level']);
        }

        const heatNoise = this.parseNoiseParamLine(parsedMeta['mg_biome_np_heat']);
        if (heatNoise) partialConfig.heatNoise = heatNoise;

        const humidityNoise = this.parseNoiseParamLine(parsedMeta['mg_biome_np_humidity']);
        if (humidityNoise) partialConfig.humidityNoise = humidityNoise;

        const terrainNoise = this.parseNoiseParamLine(
          parsedMeta['mgv7_np_terrain_base'] ||
            parsedMeta['mgvalleys_np_terrain_height'] ||
            parsedMeta['mgcarpathian_np_base']
        );
        if (terrainNoise) partialConfig.terrainNoise = terrainNoise;
      }

      // Apply seed & noise config first so our Synthesizer evaluates exact (Heat, Humidity) during DB scan!
      this.mapStore.worldConfig.update(c => ({ ...c, ...partialConfig }));

      // 3. Parse map database (SQLite B-Tree or PostgreSQL SQL dump)
      const preferPostgres = partialConfig.backend === 'postgresql';
      let dbFile: File | undefined = undefined;
      let detectedBackend: WorldDatabaseBackend = 'sqlite3';

      if (preferPostgres) {
        dbFile = filesMap.get('map.sql') || filesMap.get('map.pgsql') || filesMap.get('map.dump');
        if (!dbFile) {
          for (const [k, f] of filesMap.entries()) {
            if (k.endsWith('.sql') || k.endsWith('.pgsql') || k.endsWith('.dump')) {
              dbFile = f;
              break;
            }
          }
        }
        if (dbFile) {
          detectedBackend = 'postgresql';
        }
      }

      if (!dbFile) {
        dbFile = filesMap.get('map.sqlite');
        if (!dbFile) {
          for (const [k, f] of filesMap.entries()) {
            if (k.endsWith('.sqlite') || k.endsWith('.sqlite3') || k.endsWith('.db')) {
              dbFile = f;
              detectedBackend = 'sqlite3';
              break;
            }
          }
        }
      }

      if (!dbFile) {
        for (const [k, f] of filesMap.entries()) {
          if (k.endsWith('.sql') || k.endsWith('.pgsql') || k.endsWith('.dump')) {
            dbFile = f;
            detectedBackend = 'postgresql';
            break;
          }
        }
      }

      let decodedDb: DecodedWorldDatabase | null = null;
      if (dbFile) {
        const sizeMb = (dbFile.size / (1024 * 1024)).toFixed(1);
        const backendDesc = detectedBackend === 'postgresql' ? 'PostgreSQL SQL Dump' : 'SQLite B-Tree';
        this.mapStore.loadStatusMessage.set(
          `Opening ${dbFile.name} (${sizeMb} MB) via ${backendDesc}...`
        );
        decodedDb = await this.parseDatabaseFile(dbFile, detectedBackend);
      }

      if (!worldMtFile && !mapMetaFile && !decodedDb) {
        this.lastError.set(
          'No valid map.sqlite, map.sql, map_meta.txt, or world.mt found in selection.'
        );
        return;
      }

      this.mapStore.applyLoadedWorld(partialConfig, decodedDb);

      if (decodedDb) {
        this.isOfflineCachedWorld.set(false);
        this.canResumeFileHandle.set(null);
        const regionsCount = decodedDb.discoveredRegions?.length || 1;
        const modBiomesCount = decodedDb.discoveredModBiomes?.length || 0;
        const backendName = decodedDb.databaseBackend === 'postgresql' ? 'PostgreSQL' : 'SQLite';
        if (!isAutoRestore) {
          this.mapStore.requestCameraJump(0, 0, 6.2);
        }
        this.lastLoadedSummary.set(
          `Indexed ~${decodedDb.totalBlocks.toLocaleString()} MapBlocks (${backendName}) across ${regionsCount} regions${modBiomesCount > 0 ? ` · Auto-detected ${modBiomesCount} modded Voronoi biomes` : ''}`
        );
      } else if (hasSeedMetadata) {
        this.lastLoadedSummary.set(
          `Loaded seed #${partialConfig.seed ?? this.mapStore.worldConfig().seed} from map_meta.txt`
        );
      }
    } catch (err: any) {
      console.error('Error processing world files:', err);
      this.lastError.set(err?.message || 'Failed to parse world database.');
    } finally {
      releaseWakeLock();
      this.mapStore.isLoadingWorld.set(false);
      this.mapStore.loadStatusMessage.set('');
      this.mapStore.loadProgress.set(null);
      if (this.activeDbReader) {
        if (this.pendingViewportRequest) {
          const nextReq = this.pendingViewportRequest;
          this.pendingViewportRequest = null;
          this.streamViewportBlocks(nextReq.centerX, nextReq.centerZ, nextReq.zoom);
        } else {
          const cam = this.mapStore.cameraState();
          this.streamViewportBlocks(cam.x, cam.z, cam.zoom);
        }
      }
    }
  }

  public cancelActiveStreaming(): void {
    this.cancelInitialLoadRequested = true;
    this.streamGeneration++;
    this.pendingViewportRequest = null;
    this.isStreamingRegion.set(false);
    this.streamProgress.set(null);
    this.mapStore.bumpRevision();
  }

  public parseKeyValueConfig(content: string): Record<string, string> {
    const result: Record<string, string> = {};
    const lines = content.split(/\r?\n/);
    let currentKey: string | null = null;
    let currentBraceValue = '';

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#') || line === '[end_of_params]') continue;

      if (currentKey !== null) {
        currentBraceValue += ' ' + line;
        if (line.includes('}')) {
          result[currentKey] = currentBraceValue;
          currentKey = null;
          currentBraceValue = '';
        }
        continue;
      }

      const eqIdx = line.indexOf('=');
      if (eqIdx === -1) continue;
      const key = line.slice(0, eqIdx).trim();
      const val = line.slice(eqIdx + 1).trim();

      if (val.startsWith('{') && !val.includes('}')) {
        currentKey = key;
        currentBraceValue = val;
      } else {
        result[key] = val;
      }
    }
    return result;
  }

  public parseNoiseParamLine(raw?: string): NoiseParams | null {
    if (!raw) return null;
    try {
      const spreadMatch = raw.match(/\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/);
      const spread: [number, number, number] = spreadMatch
        ? [Number(spreadMatch[1]), Number(spreadMatch[2]), Number(spreadMatch[3])]
        : [750, 750, 750];

      if (raw.includes('{')) {
        const extractNum = (key: string, fallback: number): number => {
          const m = raw.match(new RegExp(`${key}\\s*=\\s*([-\\d.]+)`));
          return m ? Number(m[1]) : fallback;
        };
        return {
          offset: extractNum('offset', 50),
          scale: extractNum('scale', 50),
          spread,
          seed: extractNum('seed', 5349),
          octaves: extractNum('octaves', 3),
          persist: extractNum('persistence', extractNum('persist', 0.5)),
          lacunarity: extractNum('lacunarity', 2.0)
        };
      }
    } catch {
      // Ignore parse error
    }
    return null;
  }

  private closeActiveDb(): void {
    this.streamGeneration++;
    if (this.activeDbReader?.close) {
      try {
        this.activeDbReader.close();
      } catch {}
    }
    this.activeDbReader = null;
    this.loadedSubSectors.clear();
    this.loadedMacroSectorStride.clear();
    this.modBiomeClimateStats.clear();
    this.playerBaseBuckets.clear();
    this.activeSliceKey = '';
    this.pendingViewportRequest = null;
  }

  private getCurrentSliceKey(): string {
    const s = this.mapStore.verticalSlice();
    return `${s.minY}:${s.maxY}:${s.caveMode ? 1 : 0}`;
  }

  /**
   * Computes the [minBy, maxBy] MapBlock Y query range for a slice.
   * Because `queryBlocksInBounds` now filters the B-Tree index to only fetch the top
   * 2-3 highest-Y blocks per (x,z) column, we can include full mountain heights up to blockY=15!
   */
  private getEffectiveBlockYRange(): { minBy: number; maxBy: number } {
    const slice = this.mapStore.verticalSlice();
    if (slice.presetId === 'surface') {
      return { minBy: -1, maxBy: 9 };
    }
    return {
      minBy: Math.floor(slice.minY / 16),
      maxBy: Math.floor(slice.maxY / 16)
    };
  }

  public async parseDatabaseFile(
    file: File,
    backend: WorldDatabaseBackend = 'sqlite3'
  ): Promise<DecodedWorldDatabase | null> {
    this.closeActiveDb();
    this.cancelInitialLoadRequested = false;
    const startMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const nowSec = (): number =>
      Number((((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startMs) / 1000).toFixed(1));

    const isPg = backend === 'postgresql';
    const reader: WorldDatabaseReader = isPg
      ? new PostgresSqlDumpReader(file)
      : new SqliteFileBtreeReader(file);

    await reader.init();
    this.activeDbReader = reader;

    this.mapStore.setVerticalSlicePreset('surface');
    this.activeSliceKey = this.getCurrentSliceKey();

    const surfaceColumns = new Map<string, ParsedColumnSurface>();
    const blockSurfaces = new Map<string, CompactBlockSurface>();
    const nodeCounts: Record<string, number> = {};

    const fileKey = `${file.name}_${file.size}_${file.lastModified}_${backend}_v3`;
    const cachedMeta = await this.pwaStorage.getWorldMetadata(fileKey);

    let exploredBlockKeys: Set<string>;
    let macroMipmap: Map<string, MacroMipmapCell>;
    let discoveredModBiomes: BiomeDefinition[];
    let mergedRegions: DiscoveredWorldRegion[];
    let verticalLayers: VerticalLayerSummary[];
    let estimatedTotalBlocks: number;
    let minBlockX: number;
    let maxBlockX: number;
    let minBlockZ: number;
    let maxBlockZ: number;
    let exploredMacroSectors: Array<{ mx: number; mz: number }>;

    if (cachedMeta && cachedMeta.exploredMacroSectors && cachedMeta.exploredMacroSectors.length > 0) {
      this.mapStore.loadStatusMessage.set('Restoring world index & layers from instant cache (<10ms)...');
      exploredBlockKeys = new Set(cachedMeta.exploredBlockKeys);
      macroMipmap = new Map(cachedMeta.macroMipmap);
      discoveredModBiomes = cachedMeta.discoveredModBiomes;
      mergedRegions = cachedMeta.discoveredRegions;
      verticalLayers = cachedMeta.verticalLayers;
      estimatedTotalBlocks = cachedMeta.totalBlocks;
      minBlockX = cachedMeta.minBlockX;
      maxBlockX = cachedMeta.maxBlockX;
      minBlockZ = cachedMeta.minBlockZ;
      maxBlockZ = cachedMeta.maxBlockZ;
      exploredMacroSectors = cachedMeta.exploredMacroSectors || [];
    } else {
      const estInteriorPages = isPg
        ? 100
        : Math.min(600, Math.max(8, Math.round(((reader as any).totalPages || 100) / 180)));
      const step1Label = isPg
        ? 'Streaming PostgreSQL blocks & vertical depth layers...'
        : 'Scanning B-Tree interior index & vertical depth layers...';
      this.mapStore.loadStatusMessage.set(step1Label);
      this.mapStore.loadProgress.set({
        phase: isPg ? 'pg-scan' : 'btree-scan',
        stepIndex: 1,
        totalSteps: 3,
        label: step1Label,
        percent: 4,
        current: 0,
        total: estInteriorPages,
        unit: isPg ? '%' : 'pages',
        blocksDecoded: 0,
        elapsedSeconds: 0,
        etaSeconds: null
      });

      const overview = await reader.scanOverviewAndVerticalLayers((progressUnits, samplesFound) => {
        const totalEst = Math.max(progressUnits, estInteriorPages);
        const ratio = isPg ? Math.min(1, progressUnits / 100) : Math.min(1, progressUnits / Math.max(1, totalEst));
        this.mapStore.loadProgress.set({
          phase: isPg ? 'pg-scan' : 'btree-scan',
          stepIndex: 1,
          totalSteps: 3,
          label: step1Label,
          percent: Math.round(4 + ratio * 21),
          current: progressUnits,
          total: totalEst,
          unit: isPg ? '%' : 'pages',
          blocksDecoded: samplesFound,
          elapsedSeconds: nowSec(),
          etaSeconds: null
        });
      });

      exploredBlockKeys = overview.exploredBlockKeys;
      macroMipmap = new Map<string, MacroMipmapCell>();
      verticalLayers = overview.verticalLayers;
      estimatedTotalBlocks = overview.estimatedTotalBlocks;
      minBlockX = overview.minBlockX;
      maxBlockX = overview.maxBlockX;
      minBlockZ = overview.minBlockZ;
      maxBlockZ = overview.maxBlockZ;
      exploredMacroSectors = overview.exploredMacroSectors || [];

      // 1. Build Global Overview Mipmap & Discover Mod Biomes from divider samples!
      if (overview.dividerSamples.length > 0 && !this.cancelInitialLoadRequested) {
        const step2Label = 'Building global world overview & detecting mod biomes...';
        this.mapStore.loadStatusMessage.set(step2Label);
        const surfaceByCell = new Map<string, { x: number; y: number; z: number; rowid: number }>();
        for (let i = 0; i < overview.dividerSamples.length; i++) {
          const d = overview.dividerSamples[i];
          if (d.y < 0 || d.y > 2) continue;
          const mKey = `${d.x >> 1},${d.z >> 1}`;
          const prev = surfaceByCell.get(mKey);
          if (!prev || Math.abs(d.y) < Math.abs(prev.y)) {
            surfaceByCell.set(mKey, d);
          }
        }

        const candidates = Array.from(surfaceByCell.values());
        const maxOverviewSamples = 850;
        const step = Math.max(1, Math.floor(candidates.length / maxOverviewSamples));
        const picked: Array<{ x: number; y: number; z: number; rowid: number }> = [];
        for (let i = 0; i < candidates.length && picked.length < maxOverviewSamples; i += step) {
          picked.push(candidates[i]);
        }

        const step2StartMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const sampleRows = await reader.fetchBlocksForKeys(picked, (curr, tot) => {
          const ratio = curr / Math.max(1, tot);
          const stepElapsed =
            ((typeof performance !== 'undefined' ? performance.now() : Date.now()) - step2StartMs) / 1000;
          const eta =
            curr >= 16 && ratio < 0.98
              ? Math.max(1, Math.round((stepElapsed / ratio) * (1 - ratio) + 1.0))
              : null;
          this.mapStore.loadProgress.set({
            phase: 'global-overview',
            stepIndex: 2,
            totalSteps: 3,
            label: step2Label,
            percent: Math.round(25 + ratio * 30),
            current: curr,
            total: tot,
            unit: 'blocks',
            blocksDecoded: curr,
            elapsedSeconds: nowSec(),
            etaSeconds: eta
          });
        });

        for (const row of sampleRows) {
          const blk = parseAndMergeCoarseBlockMipmap(
            row.x,
            row.y,
            row.z,
            row.data,
            -16,
            240,
            false,
            4,
            macroMipmap,
            nodeCounts
          );
          if (blk) {
            macroMipmap.delete(`b:${row.x},${row.z}`);
            macroMipmap.delete(`${row.x >> 1},${row.z >> 1}`);
            this.recordModBiomeSample(blk.bx, blk.bz, blk.dominantNode);
            this.recordPlayerBaseSample(blk);
          }
        }
      }

      discoveredModBiomes = this.computeDiscoveredModBiomesList();
      mergedRegions = this.mergePlayerBasesIntoRegions(overview.discoveredRegions);

      this.pwaStorage.saveWorldMetadata({
        fileKey,
        fileName: file.name,
        fileSizeBytes: file.size,
        databaseBackend: backend,
        totalBlocks: estimatedTotalBlocks,
        minBlockX,
        maxBlockX,
        minBlockZ,
        maxBlockZ,
        exploredBlockKeys: Array.from(exploredBlockKeys),
        exploredMacroSectors,
        discoveredRegions: mergedRegions,
        verticalLayers,
        discoveredModBiomes,
        macroMipmap: Array.from(macroMipmap.entries()),
        cachedAt: Date.now()
      }).catch(() => {});
    }

    const step3Label = 'Decoding spawn archipelago surface sectors...';
    this.mapStore.loadStatusMessage.set(step3Label);
    const initialSubSectors = this.buildSpiralSubSectors(0, 0, 2);
    const step3StartMs = typeof performance !== 'undefined' ? performance.now() : Date.now();

    for (let i = 0; i < initialSubSectors.length; i++) {
      if (this.cancelInitialLoadRequested) break;
      const sub = initialSubSectors[i];
      await this.decodeSubSector16x16(
        sub.sx,
        sub.sz,
        blockSurfaces,
        macroMipmap,
        exploredBlockKeys,
        nodeCounts
      );

      const done = i + 1;
      const tot = initialSubSectors.length;
      const ratio = done / Math.max(1, tot);
      const stepElapsed =
        ((typeof performance !== 'undefined' ? performance.now() : Date.now()) - step3StartMs) / 1000;
      const eta =
        done >= 1 && done < tot
          ? Math.max(1, Math.round((stepElapsed / ratio) * (1 - ratio)))
          : null;

      this.mapStore.loadProgress.set({
        phase: 'spawn-sectors',
        stepIndex: 3,
        totalSteps: 3,
        label: step3Label,
        percent: Math.round(55 + ratio * 45),
        current: done,
        total: tot,
        unit: 'sectors',
        blocksDecoded: blockSurfaces.size,
        elapsedSeconds: nowSec(),
        etaSeconds: eta
      });

      await new Promise(resolve => setTimeout(resolve, 0));
    }

    return {
      fileName: file.name,
      fileSizeBytes: file.size,
      databaseBackend: backend,
      hasDatabase: true,
      totalBlocks: estimatedTotalBlocks,
      minBlockX,
      maxBlockX,
      minBlockZ,
      maxBlockZ,
      surfaceColumns,
      blockSurfaces,
      macroMipmap,
      exploredBlockCoords: [],
      exploredBlockKeys,
      exploredMacroSectors,
      discoveredRegions: mergedRegions,
      verticalLayers,
      discoveredModBiomes,
      nodeCounts
    };
  }

  public async parseSqliteFile(file: File): Promise<DecodedWorldDatabase | null> {
    return this.parseDatabaseFile(file, 'sqlite3');
  }

  public async parsePostgresFile(file: File): Promise<DecodedWorldDatabase | null> {
    return this.parseDatabaseFile(file, 'postgresql');
  }

  private recordPlayerBaseSample(blk: { bx: number; bz: number; playerNodeCount?: number }): void {
    const pCount = blk.playerNodeCount || 0;
    if (pCount < 14) return;
    const sx = blk.bx >> 3;
    const sz = blk.bz >> 3;
    const key = `${sx},${sz}`;
    const wx = blk.bx * 16 + 8;
    const wz = blk.bz * 16 + 8;
    const existing = this.playerBaseBuckets.get(key);
    if (existing) {
      existing.blockCount++;
      existing.playerNodes += pCount;
      existing.sumX += wx;
      existing.sumZ += wz;
    } else {
      this.playerBaseBuckets.set(key, {
        sx,
        sz,
        blockCount: 1,
        playerNodes: pCount,
        sumX: wx,
        sumZ: wz
      });
    }
  }

  private mergePlayerBasesIntoRegions(
    baseRegions: DiscoveredWorldRegion[]
  ): DiscoveredWorldRegion[] {
    const out = [...baseRegions];
    const candidates = Array.from(this.playerBaseBuckets.values())
      .filter(b => b.playerNodes >= 24)
      .sort((a, b) => b.playerNodes - a.playerNodes);

    for (const cand of candidates) {
      const centerX = Math.round(cand.sumX / cand.blockCount);
      const centerZ = Math.round(cand.sumZ / cand.blockCount);
      if (Math.hypot(centerX, centerZ) < 64) continue;
      const tooClose = out.some(
        r => Math.hypot(r.centerX - centerX, r.centerZ - centerZ) < 180
      );
      if (tooClose) continue;

      out.push({
        id: `base-${cand.sx}-${cand.sz}`,
        label: `Player Base (${centerX}, ${centerZ})`,
        centerX,
        centerZ,
        blockCount: cand.blockCount,
        kind: 'base'
      });
      if (out.length >= 16) break;
    }

    return out;
  }

  private recordModBiomeSample(bx: number, bz: number, nodeName: string): void {
    if (!nodeName || nodeName.startsWith('default:') || nodeName === 'air') return;
    const synth = this.mapStore.synthesizer();
    const wx = bx * 16 + 8;
    const wz = bz * 16 + 8;
    const pt = synth.evaluatePoint(wx, wz);

    const existing = this.modBiomeClimateStats.get(nodeName);
    if (existing) {
      existing.count++;
      existing.sumHeat += pt.heat;
      existing.sumHumidity += pt.humidity;
    } else {
      this.modBiomeClimateStats.set(nodeName, {
        count: 1,
        sumHeat: pt.heat,
        sumHumidity: pt.humidity
      });
    }
  }

  private computeDiscoveredModBiomesList(): BiomeDefinition[] {
    const byId = new Map<string, { biome: BiomeDefinition; weight: number }>();

    for (const [nodeName, st] of this.modBiomeClimateStats.entries()) {
      if (st.count < 2) continue;
      const meanHeat = st.sumHeat / st.count;
      const meanHum = st.sumHumidity / st.count;
      const def = buildDiscoveredBiomeDefinition(nodeName, meanHeat, meanHum);
      if (def) {
        const prev = byId.get(def.id);
        if (!prev || st.count > prev.weight) {
          byId.set(def.id, { biome: def, weight: st.count });
        }
      }
    }

    return Array.from(byId.values()).map(v => v.biome);
  }

  /**
   * Computes the exact sub-sector (256x256 nodes) and macro-sector (1024x1024 nodes) radii
   * needed to cover 100% of the visible widescreen viewport at the given MapLibre zoom level.
   */
  public computeViewportRadii(
    zoom: number,
    viewportWidthPx = typeof window !== 'undefined' ? Math.max(window.innerWidth, 1600) : 1920,
    viewportHeightPx = typeof window !== 'undefined' ? Math.max(window.innerHeight, 900) : 1080
  ): {
    halfSpanX: number;
    halfSpanZ: number;
    radiusSubSectorsX: number;
    radiusSubSectorsZ: number;
    radiusMacroX: number;
    radiusMacroZ: number;
  } {
    const nodesPerPx = 128 / Math.pow(2, zoom);
    const halfSpanX = viewportWidthPx * 0.58 * nodesPerPx;
    const halfSpanZ = viewportHeightPx * 0.58 * nodesPerPx;
    return {
      halfSpanX,
      halfSpanZ,
      radiusSubSectorsX: Math.max(3, Math.ceil(halfSpanX / 256)),
      radiusSubSectorsZ: Math.max(3, Math.ceil(halfSpanZ / 256)),
      radiusMacroX: Math.max(2, Math.ceil(halfSpanX / 1024)),
      radiusMacroZ: Math.max(2, Math.ceil(halfSpanZ / 1024))
    };
  }

  /**
   * Builds a list of 16x16 MapBlock (256x256 node) sub-sectors sorted in a spiral
   * outward from `(centerX, centerZ)` so the center of the screen always loads first!
   * When `dbState` is provided, prunes empty wilderness sub-sectors outside the world's
   * explored macro sectors in O(1) so large widescreen viewports stream without wasted I/O.
   */
  public buildSpiralSubSectors(
    centerX: number,
    centerZ: number,
    radiusSubSectorsX: number,
    radiusSubSectorsZ = radiusSubSectorsX,
    dbState?: DecodedWorldDatabase | null
  ): Array<{ sx: number; sz: number }> {
    const centerSx = Math.floor(centerX / 256);
    const centerSz = Math.floor(centerZ / 256);
    const list: Array<{ sx: number; sz: number; dist: number }> = [];

    let minAllowedSx = -Infinity;
    let maxAllowedSx = Infinity;
    let minAllowedSz = -Infinity;
    let maxAllowedSz = Infinity;
    let expandedMacroSet: Set<string> | null = null;

    if (dbState) {
      if (
        typeof dbState.minBlockX === 'number' &&
        typeof dbState.maxBlockX === 'number' &&
        typeof dbState.minBlockZ === 'number' &&
        typeof dbState.maxBlockZ === 'number' &&
        dbState.maxBlockX >= dbState.minBlockX
      ) {
        minAllowedSx = Math.floor(dbState.minBlockX / 16) - 1;
        maxAllowedSx = Math.ceil(dbState.maxBlockX / 16) + 1;
        minAllowedSz = Math.floor(dbState.minBlockZ / 16) - 1;
        maxAllowedSz = Math.ceil(dbState.maxBlockZ / 16) + 1;
      }

      if (dbState.exploredMacroSectors && dbState.exploredMacroSectors.length > 0) {
        expandedMacroSet = new Set<string>();
        for (const s of dbState.exploredMacroSectors) {
          for (let dz = -1; dz <= 1; dz++) {
            for (let dx = -1; dx <= 1; dx++) {
              expandedMacroSet.add(`${s.mx + dx},${s.mz + dz}`);
            }
          }
        }
      }
    }

    for (let dz = -radiusSubSectorsZ; dz <= radiusSubSectorsZ; dz++) {
      const sz = centerSz + dz;
      if (sz < minAllowedSz || sz > maxAllowedSz) continue;

      for (let dx = -radiusSubSectorsX; dx <= radiusSubSectorsX; dx++) {
        const sx = centerSx + dx;
        if (sx < minAllowedSx || sx > maxAllowedSx) continue;

        if (expandedMacroSet) {
          const mx = sx >> 2;
          const mz = sz >> 2;
          if (!expandedMacroSet.has(`${mx},${mz}`)) continue;
        }

        list.push({
          sx,
          sz,
          dist: Math.hypot(dx, dz)
        });
      }
    }

    list.sort((a, b) => a.dist - b.dist);
    return list.map(({ sx, sz }) => ({ sx, sz }));
  }

  public async selectVerticalSlicePresetAndStream(
    presetId: Exclude<VerticalSlicePresetId, 'custom'>,
    jumpToLayerHotspot = true
  ): Promise<void> {
    this.mapStore.setVerticalSlicePreset(presetId);

    if (!this.activeDbReader) {
      return;
    }

    const dbState = this.mapStore.worldDatabase();
    if (!dbState) return;

    const layerInfo = dbState.verticalLayers?.find(l => l.id === presetId);
    let targetX = this.mapStore.cameraState().x;
    let targetZ = this.mapStore.cameraState().z;

    if (jumpToLayerHotspot && layerInfo && (layerInfo.estimatedBlocks ?? 0) > 0) {
      if (presetId === 'surface') {
        targetX = 0;
        targetZ = 0;
      } else {
        targetX = layerInfo.hotspotX ?? targetX;
        targetZ = layerInfo.hotspotZ ?? targetZ;
      }
      this.mapStore.requestCameraJump(targetX, targetZ, 6.2);
    }

    await this.reloadActiveVerticalSlice(targetX, targetZ);
  }

  public async reloadActiveVerticalSlice(centerX?: number, centerZ?: number): Promise<void> {
    if (!this.activeDbReader) return;
    const dbState = this.mapStore.worldDatabase();
    if (!dbState) return;

    const gen = ++this.streamGeneration;
    this.loadedSubSectors.clear();
    this.loadedMacroSectorStride.clear();
    this.activeSliceKey = this.getCurrentSliceKey();
    dbState.blockSurfaces?.clear();
    dbState.macroMipmap?.clear();
    dbState.nodeCounts = {};

    const cx = centerX ?? this.mapStore.cameraState().x;
    const cz = centerZ ?? this.mapStore.cameraState().z;
    const startMs = typeof performance !== 'undefined' ? performance.now() : Date.now();

    this.isStreamingRegion.set(true);
    try {
      const subSectors = this.buildSpiralSubSectors(cx, cz, 2);
      for (let i = 0; i < subSectors.length; i++) {
        if (gen !== this.streamGeneration) break;
        const sub = subSectors[i];
        await this.decodeSubSector16x16(
          sub.sx,
          sub.sz,
          dbState.blockSurfaces!,
          dbState.macroMipmap!,
          dbState.exploredBlockKeys,
          dbState.nodeCounts
        );

        const done = i + 1;
        const tot = subSectors.length;
        const ratio = done / Math.max(1, tot);
        const elapsed =
          ((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startMs) / 1000;
        const eta =
          done >= 2 && done < tot ? Math.max(1, Math.round((elapsed / ratio) * (1 - ratio))) : null;

        this.streamProgress.set({
          phase: 'slice-reload',
          stepIndex: 1,
          totalSteps: 1,
          label: 'Streaming Y-slice blocks...',
          percent: Math.round(ratio * 100),
          current: done,
          total: tot,
          unit: 'sectors',
          blocksDecoded: dbState.blockSurfaces?.size || 0,
          elapsedSeconds: Number(elapsed.toFixed(1)),
          etaSeconds: eta
        });

        if ((i & 1) === 1) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }

      this.workerPool.broadcastDatabaseToWorkers(
        [],
        dbState.exploredBlockKeys ? Array.from(dbState.exploredBlockKeys) : [],
        dbState.blockSurfaces ? Array.from(dbState.blockSurfaces.entries()) : [],
        dbState.macroMipmap ? Array.from(dbState.macroMipmap.entries()) : []
      );
      this.mapStore.bumpRevision();

      const slice = this.mapStore.verticalSlice();
      this.lastLoadedSummary.set(
        `Elevation Slice Y:[${slice.minY}..${slice.maxY}]${slice.caveMode ? ' (Cave X-Ray)' : ''} — ${(dbState.blockSurfaces?.size || 0).toLocaleString()} blocks in LRU cache`
      );
    } finally {
      this.isStreamingRegion.set(false);
      this.streamProgress.set(null);
      if (this.activeDbReader && gen === this.streamGeneration) {
        if (this.pendingViewportRequest) {
          const nextReq = this.pendingViewportRequest;
          this.pendingViewportRequest = null;
          this.streamViewportBlocks(nextReq.centerX, nextReq.centerZ, nextReq.zoom);
        } else {
          const cam = this.mapStore.cameraState();
          this.streamViewportBlocks(cx, cz, cam.zoom);
        }
      }
    }
  }

  /**
   * Google Maps-Style Multi-Resolution Viewport Streamer:
   * - When zoomed out (`zoom < 5.3`), continuously streams 64x64 MapBlock macro sectors (`stride = 2`)
   *   across the ENTIRE visible world overview until 100% of visible sectors are filled!
   * - When zoomed in (`zoom >= 5.3`), streams 16x16 MapBlock sub-sectors in a center-outward spiral
   *   proportional to the viewport radius, with distance-aware eviction that NEVER evicts the center!
   */
  public async streamViewportBlocks(centerX: number, centerZ: number, zoom: number): Promise<void> {
    if (!this.activeDbReader) return;

    if (this.mapStore.isLoadingWorld() || this.isStreamingRegion()) {
      this.pendingViewportRequest = { centerX, centerZ, zoom };
      return;
    }

    const dbState = this.mapStore.worldDatabase();
    if (!dbState || !dbState.blockSurfaces || !dbState.macroMipmap) return;

    const currentSliceKey = this.getCurrentSliceKey();
    if (this.activeSliceKey !== currentSliceKey) {
      await this.reloadActiveVerticalSlice(centerX, centerZ);
      return;
    }

    const gen = ++this.streamGeneration;
    const startMs = typeof performance !== 'undefined' ? performance.now() : Date.now();

    try {
      let lastRevisionBumpMs = performance.now();
      let unbumpedData = false;

      if (zoom < 6.0) {
        // TIER 0 & TIER 1 MACRO-SECTORMIPMAP STREAMING (Zoom < 6.0):
        // - World 4x4 Tier (zoom < 2.7): stream macro sectors across the world at stride = 4 (1 sample per 4x4 MapBlocks = 64x64 nodes).
        // - Region 2x2 Tier (2.7 <= zoom < 3.8): stream regional macro sectors around the camera at stride = 2 (1 sample per 2x2 MapBlocks = 32x32 nodes).
        // - Sector 1x1 Tier (3.8 <= zoom < 6.0): stream visible macro sectors at stride = 1 (1 sample per 1x1 MapBlock = 16x16 nodes via fast 4x4 intra-block subsampling!).
        const centerMx = Math.floor(centerX / 1024);
        const centerMz = Math.floor(centerZ / 1024);
        let targetStride: 1 | 2 | 4 = zoom < 2.7 ? 4 : zoom < 3.8 ? 2 : 1;

        const collectMissingForStride = (
          desiredStride: 1 | 2 | 4
        ): Array<{ mx: number; mz: number; dist: number }> => {
          const list: Array<{ mx: number; mz: number; dist: number }> = [];
          if (dbState.exploredMacroSectors && dbState.exploredMacroSectors.length > 0) {
            for (const s of dbState.exploredMacroSectors) {
              const key = `${s.mx},${s.mz}`;
              const prevStride = this.loadedMacroSectorStride.get(key) ?? 99;
              if (prevStride > desiredStride) {
                list.push({
                  mx: s.mx,
                  mz: s.mz,
                  dist: Math.hypot(s.mx - centerMx, s.mz - centerMz)
                });
              }
            }
          } else {
            const minAllowedMx = Math.floor(dbState.minBlockX / 64) - 1;
            const maxAllowedMx = Math.ceil(dbState.maxBlockX / 64) + 1;
            const minAllowedMz = Math.floor(dbState.minBlockZ / 64) - 1;
            const maxAllowedMz = Math.ceil(dbState.maxBlockZ / 64) + 1;

            for (let mz = minAllowedMz; mz <= maxAllowedMz; mz++) {
              for (let mx = minAllowedMx; mx <= maxAllowedMx; mx++) {
                const key = `${mx},${mz}`;
                const prevStride = this.loadedMacroSectorStride.get(key) ?? 99;
                if (prevStride > desiredStride) {
                  list.push({
                    mx,
                    mz,
                    dist: Math.hypot(mx - centerMx, mz - centerMz)
                  });
                }
              }
            }
          }
          list.sort((a, b) => a.dist - b.dist);
          return list;
        };

        const { radiusMacroX, radiusMacroZ } = this.computeViewportRadii(zoom);
        let missingMacro: Array<{ mx: number; mz: number; dist: number }>;
        if (targetStride === 4) {
          missingMacro = collectMissingForStride(4);
          // Progressive refinement: once all macro sectors have stride = 4 preview,
          // refine visible sectors around camera to stride = 2!
          if (missingMacro.length === 0) {
            targetStride = 2;
            missingMacro = collectMissingForStride(2).filter(
              m =>
                Math.abs(m.mx - centerMx) <= Math.max(6, radiusMacroX) &&
                Math.abs(m.mz - centerMz) <= Math.max(5, radiusMacroZ)
            );
            if (missingMacro.length > 25) {
              missingMacro.length = 25;
            }
          } else if (missingMacro.length > 250) {
            missingMacro.length = 250;
          }
        } else if (targetStride === 2) {
          // Region 2x2 mode (2.7 <= zoom < 3.8): stream explored macro sectors visible in the viewport at stride = 2
          missingMacro = collectMissingForStride(2).filter(
            m =>
              Math.abs(m.mx - centerMx) <= Math.max(6, radiusMacroX) &&
              Math.abs(m.mz - centerMz) <= Math.max(5, radiusMacroZ)
          );
          if (missingMacro.length > 64) {
            missingMacro.length = 64;
          }
        } else {
          // Sector 1x1 mode (3.8 <= zoom < 6.0): stream explored macro sectors visible in the viewport at stride = 1 (16x16 node block mipmaps)
          missingMacro = collectMissingForStride(1).filter(
            m =>
              Math.abs(m.mx - centerMx) <= Math.max(4, radiusMacroX) &&
              Math.abs(m.mz - centerMz) <= Math.max(3, radiusMacroZ)
          );
          if (missingMacro.length > 48) {
            missingMacro.length = 48;
          }
        }

        if (missingMacro.length === 0) {
          return;
        }
        this.isStreamingRegion.set(true);

        const batchSize = targetStride === 4 ? 10 : targetStride === 2 ? 6 : 4;
        for (let offset = 0; offset < missingMacro.length; offset += batchSize) {
          if (gen !== this.streamGeneration || this.pendingViewportRequest) break;
          const batch = missingMacro.slice(offset, offset + batchSize);
          const batchMips: Array<[string, MacroMipmapCell]> = [];
          const batchEvictedMips: string[] = [];

          for (let bIdx = 0; bIdx < batch.length; bIdx++) {
            if (gen !== this.streamGeneration || this.pendingViewportRequest) break;
            const m = batch[bIdx];
            this.loadedMacroSectorStride.set(`${m.mx},${m.mz}`, targetStride);
            const mipRes = await this.decodeMacroSectorCoarse(
              m.mx,
              m.mz,
              dbState.macroMipmap,
              dbState.nodeCounts,
              targetStride
            );
            batchMips.push(...mipRes.newMips);
            batchEvictedMips.push(...mipRes.evictedMipKeys);

            const done = offset + bIdx + 1;
            const tot = missingMacro.length;
            const ratio = done / Math.max(1, tot);
            const elapsed =
              ((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startMs) / 1000;
            const eta =
              done >= 2 && done < tot ? Math.max(1, Math.round((elapsed / ratio) * (1 - ratio))) : null;

            this.streamProgress.set({
              phase: 'viewport-stream',
              stepIndex: 1,
              totalSteps: 1,
              label:
                targetStride === 4
                  ? 'Streaming 4×4 World Overview:'
                  : targetStride === 2
                    ? 'Streaming 2×2 Region Overview:'
                    : 'Streaming 1×1 High-Res Sectors:',
              percent: Math.round(ratio * 100),
              current: done,
              total: tot,
              unit: 'sectors',
              blocksDecoded: dbState.macroMipmap.size,
              elapsedSeconds: Number(elapsed.toFixed(1)),
              etaSeconds: eta
            });
          }

          if (batchMips.length > 0 || batchEvictedMips.length > 0) {
            this.workerPool.appendCompactBlocksToWorkers([], batchMips, [], batchEvictedMips);
            unbumpedData = true;
            const now = performance.now();
            const elapsedSinceBump = now - lastRevisionBumpMs;
            const workersIdle = this.workerPool.activeTasksCount() === 0;
            if (elapsedSinceBump >= 900 && workersIdle) {
              this.mapStore.bumpRevision();
              lastRevisionBumpMs = now;
              unbumpedData = false;
            }
          }

          if (offset + batchSize < missingMacro.length) {
            await new Promise(resolve => setTimeout(resolve, 6));
          }
        }

        if (unbumpedData) {
          const modBiomes = this.computeDiscoveredModBiomesList();
          if (modBiomes.length > this.mapStore.discoveredModBiomes().length) {
            this.mapStore.setDiscoveredModBiomes(modBiomes);
          }
          if (dbState.discoveredRegions) {
            dbState.discoveredRegions = this.mergePlayerBasesIntoRegions(dbState.discoveredRegions);
          }
          this.mapStore.bumpRevision();
        }
      } else {
        // TIER 1 & 2 HIGH-RES SPIRAL SUB-SECTOR STREAMING (Zoom >= 6.0):
        // Dynamically scale widescreen (radiusSubSectorsX, radiusSubSectorsZ) to cover 100% of the visible viewport!
        const { radiusSubSectorsX, radiusSubSectorsZ } = this.computeViewportRadii(zoom);
        const spiral = this.buildSpiralSubSectors(
          centerX,
          centerZ,
          radiusSubSectorsX,
          radiusSubSectorsZ,
          dbState
        );
        const missing = spiral.filter(s => !this.loadedSubSectors.has(`${s.sx},${s.sz}`));
        if (missing.length === 0) {
          return;
        }
        this.isStreamingRegion.set(true);
        let hasBumpedFirstBatch = false;

        for (let offset = 0; offset < missing.length; offset += 4) {
          if (gen !== this.streamGeneration || this.pendingViewportRequest) break;

          const batch = missing.slice(offset, offset + 4);
          const batchBlocks: Array<[string, CompactBlockSurface]> = [];
          const batchMips: Array<[string, MacroMipmapCell]> = [];
          const batchEvictedMips: string[] = [];

          for (let bIdx = 0; bIdx < batch.length; bIdx++) {
            if (gen !== this.streamGeneration || this.pendingViewportRequest) break;
            const sub = batch[bIdx];
            const res = await this.decodeSubSector16x16(
              sub.sx,
              sub.sz,
              dbState.blockSurfaces,
              dbState.macroMipmap,
              dbState.exploredBlockKeys,
              dbState.nodeCounts
            );
            batchBlocks.push(...res.newBlocks);
            batchMips.push(...res.newMips);
            batchEvictedMips.push(...res.evictedMipKeys);

            const done = offset + bIdx + 1;
            const tot = missing.length;
            const ratio = done / Math.max(1, tot);
            const elapsed =
              ((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startMs) / 1000;
            const eta =
              done >= 2 && done < tot ? Math.max(1, Math.round((elapsed / ratio) * (1 - ratio))) : null;

            this.streamProgress.set({
              phase: 'viewport-stream',
              stepIndex: 1,
              totalSteps: 1,
              label:
                zoom >= 6.0
                  ? 'Streaming 1:1 Detail Sectors:'
                  : 'Streaming 1×1 High-Res Sectors:',
              percent: Math.round(ratio * 100),
              current: done,
              total: tot,
              unit: 'sectors',
              blocksDecoded: dbState.blockSurfaces.size,
              elapsedSeconds: Number(elapsed.toFixed(1)),
              etaSeconds: eta
            });
          }

          const evictedKeys = this.evictDistantBlocksIfNeeded(
            dbState.blockSurfaces,
            centerX,
            centerZ
          );

          if (
            batchBlocks.length > 0 ||
            batchMips.length > 0 ||
            evictedKeys.length > 0 ||
            batchEvictedMips.length > 0
          ) {
            this.workerPool.appendCompactBlocksToWorkers(
              batchBlocks,
              batchMips,
              evictedKeys,
              batchEvictedMips
            );
            unbumpedData = true;
            const now = performance.now();
            const elapsedSinceBump = now - lastRevisionBumpMs;
            const workersIdle = this.workerPool.activeTasksCount() === 0;
            if (!hasBumpedFirstBatch || (elapsedSinceBump >= 900 && workersIdle)) {
              const modBiomes = this.computeDiscoveredModBiomesList();
              if (modBiomes.length > this.mapStore.discoveredModBiomes().length) {
                this.mapStore.setDiscoveredModBiomes(modBiomes);
              }
              this.mapStore.bumpRevision();
              lastRevisionBumpMs = now;
              hasBumpedFirstBatch = true;
              unbumpedData = false;
            }
          }

          if (offset + 4 < missing.length) {
            await new Promise(resolve => setTimeout(resolve, 4));
          }
        }

        if (unbumpedData) {
          const modBiomes = this.computeDiscoveredModBiomesList();
          if (modBiomes.length > this.mapStore.discoveredModBiomes().length) {
            this.mapStore.setDiscoveredModBiomes(modBiomes);
          }
          if (dbState.discoveredRegions) {
            dbState.discoveredRegions = this.mergePlayerBasesIntoRegions(dbState.discoveredRegions);
          }
          this.mapStore.bumpRevision();
        }
      }
    } finally {
      if (gen === this.streamGeneration) {
        this.isStreamingRegion.set(false);
        this.streamProgress.set(null);
        if (this.pendingViewportRequest) {
          const nextReq = this.pendingViewportRequest;
          this.pendingViewportRequest = null;
          this.streamViewportBlocks(nextReq.centerX, nextReq.centerZ, nextReq.zoom);
        }
      }
    }
  }

  /**
   * Distance-Aware Cache Eviction:
   * Only runs when `blockSurfaces.size > 24,576` (~36 MB).
   * Evicts blocks FARTHEST from `(centerX, centerZ)` so the center of the viewport is NEVER evicted,
   * and removes their sub-sector from `loadedSubSectors` so panning back re-streams them!
   */
  private evictDistantBlocksIfNeeded(
    blockSurfaces: Map<string, CompactBlockSurface>,
    centerX: number,
    centerZ: number
  ): string[] {
    if (blockSurfaces.size <= MAX_MAIN_THREAD_BLOCKS) return [];

    const centerBx = centerX >> 4;
    const centerBz = centerZ >> 4;
    const targetEvictCount = Math.max(
      1024,
      blockSurfaces.size - Math.floor(MAX_MAIN_THREAD_BLOCKS * 0.88)
    );

    const candidates: Array<{ key: string; bx: number; bz: number; distSq: number }> = [];
    for (const [key, blk] of blockSurfaces.entries()) {
      const dx = blk.bx - centerBx;
      const dz = blk.bz - centerBz;
      candidates.push({ key, bx: blk.bx, bz: blk.bz, distSq: dx * dx + dz * dz });
    }

    candidates.sort((a, b) => b.distSq - a.distSq);

    const evictedKeys: string[] = [];
    for (let i = 0; i < Math.min(targetEvictCount, candidates.length); i++) {
      const c = candidates[i];
      blockSurfaces.delete(c.key);
      evictedKeys.push(c.key);
      this.loadedSubSectors.delete(`${c.bx >> 4},${c.bz >> 4}`);
    }

    return evictedKeys;
  }

  /**
   * Decodes a single 16x16 MapBlock (256x256 node) sub-sector at 100% resolution.
   * Uses `maxBlocksPerColumn = 3` so only the topmost surface blocks per (x,z) column are fetched!
   * Purges all coarse 2x2 and 4x4 (`m4:`) mipmap cells inside this sub-sector so unexplored
   * border blocks never retain blocky overview bleed.
   */
  private async decodeSubSector16x16(
    sx: number,
    sz: number,
    blockSurfaces: Map<string, CompactBlockSurface>,
    macroMipmap: Map<string, MacroMipmapCell>,
    exploredBlockKeys: Set<string> | undefined,
    nodeCounts: Record<string, number>
  ): Promise<{
    newBlocks: Array<[string, CompactBlockSurface]>;
    newMips: Array<[string, MacroMipmapCell]>;
    evictedMipKeys: string[];
  }> {
    const newBlocks: Array<[string, CompactBlockSurface]> = [];
    const newMips: Array<[string, MacroMipmapCell]> = [];
    const evictedMipKeysSet = new Set<string>();
    if (!this.activeDbReader) return { newBlocks, newMips, evictedMipKeys: [] };

    this.loadedSubSectors.add(`${sx},${sz}`);

    const minBx = sx * 16;
    const maxBx = (sx + 1) * 16 - 1;
    const minBz = sz * 16;
    const maxBz = (sz + 1) * 16 - 1;

    // Purge coarse 4x4 (`m4:`), 2x2 (`mcx,mcz`), and stale `b:` mipmap keys in this 16x16 sub-sector
    for (let m4z = sz * 4; m4z < (sz + 1) * 4; m4z++) {
      for (let m4x = sx * 4; m4x < (sx + 1) * 4; m4x++) {
        const k = `m4:${m4x},${m4z}`;
        if (macroMipmap.delete(k)) evictedMipKeysSet.add(k);
      }
    }
    for (let mcz = sz * 8; mcz < (sz + 1) * 8; mcz++) {
      for (let mcx = sx * 8; mcx < (sx + 1) * 8; mcx++) {
        const k = `${mcx},${mcz}`;
        if (macroMipmap.delete(k)) evictedMipKeysSet.add(k);
      }
    }
    for (let bz = minBz; bz <= maxBz; bz++) {
      for (let bx = minBx; bx <= maxBx; bx++) {
        const k = `b:${bx},${bz}`;
        if (macroMipmap.delete(k)) evictedMipKeysSet.add(k);
      }
    }

    const slice = this.mapStore.verticalSlice();
    const { minBy, maxBy } = this.getEffectiveBlockYRange();

    const rows = await this.activeDbReader.queryBlocksInBounds(
      minBx,
      maxBx,
      minBz,
      maxBz,
      minBy,
      maxBy,
      4096,
      1
    );

    if (rows.length > 1) {
      rows.sort((a, b) => b.y - a.y);
    }

    const touchedBlockKeys = new Set<string>();
    const touchedMipKeys = new Set<string>();
    let lastYieldMs = typeof performance !== 'undefined' ? performance.now() : Date.now();

    for (let i = 0; i < rows.length; i++) {
      if ((i & 7) === 7) {
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        if (now - lastYieldMs >= 8) {
          await new Promise(resolve => setTimeout(resolve, 0));
          lastYieldMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
        }
      }

      const row = rows[i];
      const bKey = `${row.x},${row.z}`;
      const existingBlk = blockSurfaces.get(bKey);
      if (existingBlk) {
        const maxRowWorldY = row.y * 16 + 15;
        let allCoveredAbove = true;
        for (let c = 0; c < 256; c++) {
          if (
            existingBlk.topY[c] <= maxRowWorldY ||
            (existingBlk.groundY && existingBlk.groundY[c] <= maxRowWorldY)
          ) {
            allCoveredAbove = false;
            break;
          }
        }
        if (allCoveredAbove) continue;
      }

      const decoded = parseLuantiMapBlockCoords(
        row.x,
        row.y,
        row.z,
        row.data,
        undefined,
        slice.caveMode
      );
      if (decoded) {
        const blk = mergeParsedBlockIntoCompactSurface(
          decoded,
          slice.minY,
          slice.maxY,
          blockSurfaces,
          macroMipmap,
          nodeCounts
        );
        if (blk) {
          // Remove coarse 2x2 and 4x4 entries created by mergeParsedBlockIntoCompactSurface
          // so a 100%-decoded 1x1 sub-sector only stores exact 1x1 `b:` overview entries!
          macroMipmap.delete(`${row.x >> 1},${row.z >> 1}`);
          macroMipmap.delete(`m4:${row.x >> 2},${row.z >> 2}`);

          const exactMipKey = `b:${row.x},${row.z}`;
          touchedBlockKeys.add(bKey);
          touchedMipKeys.add(exactMipKey);
          evictedMipKeysSet.delete(exactMipKey);
          exploredBlockKeys?.add(bKey);
          this.recordPlayerBaseSample(blk);
          if ((row.x & 1) === 0 && (row.z & 1) === 0) {
            this.recordModBiomeSample(row.x, row.z, blk.dominantNode);
          }
        }
      }
    }

    for (const bKey of touchedBlockKeys) {
      const blk = blockSurfaces.get(bKey);
      if (blk) newBlocks.push([bKey, blk]);
    }
    for (const mKey of touchedMipKeys) {
      const mip = macroMipmap.get(mKey);
      if (mip) newMips.push([mKey, mip]);
    }

    return { newBlocks, newMips, evictedMipKeys: Array.from(evictedMipKeysSet) };
  }

  /**
   * Tier 0 & Tier 1 Coarse Mipmap Sampler (used when zoomed out < 6.0):
   * Queries a 64x64 MapBlock sector with `stride = 4`, `stride = 2`, or `stride = 1`
   * and uses zero-allocation intra-block column subsampling (`parseAndMergeCoarseBlockMipmap`).
   * Preserves any 16x16 sub-sector already in `loadedSubSectors` and purges coarser mipmap keys
   * when refining a sector to a finer stride.
   */
  private async decodeMacroSectorCoarse(
    mx: number,
    mz: number,
    macroMipmap: Map<string, MacroMipmapCell>,
    nodeCounts: Record<string, number>,
    stride: 1 | 2 | 4 = 2
  ): Promise<{
    newMips: Array<[string, MacroMipmapCell]>;
    evictedMipKeys: string[];
  }> {
    const newMips: Array<[string, MacroMipmapCell]> = [];
    const evictedMipKeysSet = new Set<string>();
    if (!this.activeDbReader) return { newMips, evictedMipKeys: [] };

    const minBx = mx * 64;
    const maxBx = (mx + 1) * 64 - 1;
    const minBz = mz * 64;
    const maxBz = (mz + 1) * 64 - 1;

    // Purge stale coarser mipmap keys in sub-sectors that are NOT already decoded in high-res (`loadedSubSectors`)
    for (let sz = mz * 4; sz < (mz + 1) * 4; sz++) {
      for (let sx = mx * 4; sx < (mx + 1) * 4; sx++) {
        if (this.loadedSubSectors.has(`${sx},${sz}`)) continue;

        if (stride === 1 || stride === 2) {
          for (let m4z = sz * 4; m4z < (sz + 1) * 4; m4z++) {
            for (let m4x = sx * 4; m4x < (sx + 1) * 4; m4x++) {
              const k = `m4:${m4x},${m4z}`;
              if (macroMipmap.delete(k)) evictedMipKeysSet.add(k);
            }
          }
          for (let bz = sz * 16; bz < (sz + 1) * 16; bz++) {
            for (let bx = sx * 16; bx < (sx + 1) * 16; bx++) {
              const k = `b:${bx},${bz}`;
              if (macroMipmap.delete(k)) evictedMipKeysSet.add(k);
            }
          }
        }
        if (stride === 1) {
          for (let mcz = sz * 8; mcz < (sz + 1) * 8; mcz++) {
            for (let mcx = sx * 8; mcx < (sx + 1) * 8; mcx++) {
              const k = `${mcx},${mcz}`;
              if (macroMipmap.delete(k)) evictedMipKeysSet.add(k);
            }
          }
        }
      }
    }

    const slice = this.mapStore.verticalSlice();
    const { minBy, maxBy } = this.getEffectiveBlockYRange();
    const effectiveMaxBy = stride === 4 && slice.presetId === 'surface' ? Math.min(maxBy, 4) : maxBy;
    const maxSectorResults = stride === 4 ? 512 : stride === 2 ? 2048 : 4096;

    const rows = await this.activeDbReader.queryBlocksInBounds(
      minBx,
      maxBx,
      minBz,
      maxBz,
      minBy,
      effectiveMaxBy,
      maxSectorResults,
      stride
    );

    // Group vertical blocks by (x, z) column (rows are already sorted ascending by y)
    const columnBlobs = new Map<
      string,
      { x: number; z: number; blobs: Array<{ y: number; data: Uint8Array }> }
    >();
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (this.loadedSubSectors.has(`${r.x >> 4},${r.z >> 4}`)) continue;
      const cKey = `${r.x},${r.z}`;
      const existing = columnBlobs.get(cKey);
      if (existing) {
        existing.blobs.push({ y: r.y, data: r.data });
      } else {
        columnBlobs.set(cKey, { x: r.x, z: r.z, blobs: [{ y: r.y, data: r.data }] });
      }
    }

    const touchedMipKeys = new Set<string>();
    let colIdx = 0;
    let lastYieldMs = typeof performance !== 'undefined' ? performance.now() : Date.now();

    for (const col of columnBlobs.values()) {
      colIdx++;
      if ((colIdx & 7) === 7) {
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        if (now - lastYieldMs >= 8) {
          await new Promise(resolve => setTimeout(resolve, 0));
          lastYieldMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
        }
      }

      const res = parseAndMergeCoarseBlockMipmap(
        col.x,
        col.blobs[0].y,
        col.z,
        col.blobs,
        slice.minY,
        slice.maxY,
        slice.caveMode,
        stride,
        macroMipmap,
        nodeCounts
      );
      if (res) {
        if (stride === 1) {
          macroMipmap.delete(`${col.x >> 1},${col.z >> 1}`);
          macroMipmap.delete(`m4:${col.x >> 2},${col.z >> 2}`);
          const exactKey = `b:${col.x},${col.z}`;
          touchedMipKeys.add(exactKey);
          evictedMipKeysSet.delete(exactKey);
        } else if (stride === 2) {
          macroMipmap.delete(`b:${col.x},${col.z}`);
          macroMipmap.delete(`m4:${col.x >> 2},${col.z >> 2}`);
          const mip2Key = `${col.x >> 1},${col.z >> 1}`;
          touchedMipKeys.add(mip2Key);
          evictedMipKeysSet.delete(mip2Key);
        } else {
          macroMipmap.delete(`b:${col.x},${col.z}`);
          macroMipmap.delete(`${col.x >> 1},${col.z >> 1}`);
          const mip4Key = `m4:${col.x >> 2},${col.z >> 2}`;
          touchedMipKeys.add(mip4Key);
          evictedMipKeysSet.delete(mip4Key);
        }
        this.recordPlayerBaseSample(res);
      }
    }

    for (const mKey of touchedMipKeys) {
      const mip = macroMipmap.get(mKey);
      if (mip) newMips.push([mKey, mip]);
    }

    return { newMips, evictedMipKeys: Array.from(evictedMipKeysSet) };
  }

  /**
   * Fetches and loads the bundled sample Luanti demo world from assets,
   * supporting either SQLite (`map.sqlite`) or PostgreSQL dump (`map.sql`).
   */
  public async loadDemoWorld(backend: WorldDatabaseBackend = 'sqlite3'): Promise<void> {
    const dbFileName = backend === 'postgresql' ? 'map.sql' : 'map.sqlite';
    try {
      this.lastError.set(null);
      this.mapStore.isLoadingWorld.set(true);
      const backendLabel = backend === 'postgresql' ? 'PostgreSQL SQL Dump' : 'SQLite DB';
      this.mapStore.loadStatusMessage.set(`Fetching demo world (${backendLabel})...`);

      // Resolve base path dynamically to support subpath hosting (e.g. GitHub Pages /luanti-map-explorer/)
      let sampleWorldBase = 'sample-luanti-world/';
      try {
        const rawBase =
          typeof document !== 'undefined' && document.baseURI
            ? document.baseURI
            : typeof window !== 'undefined' && window.location?.href
              ? window.location.href
              : '';
        if (rawBase && (rawBase.startsWith('http://') || rawBase.startsWith('https://'))) {
          const baseWithSlash = rawBase.endsWith('/')
            ? rawBase
            : `${rawBase.split('?')[0].replace(/\/[^/]*$/, '')}/`;
          sampleWorldBase = new URL('sample-luanti-world/', baseWithSlash).href;
        }
      } catch {
        sampleWorldBase = 'sample-luanti-world/';
      }

      const [dbRes, metaRes, mtRes] = await Promise.all([
        fetch(`${sampleWorldBase}${dbFileName}`),
        fetch(`${sampleWorldBase}map_meta.txt`),
        fetch(`${sampleWorldBase}world.mt`)
      ]);

      if (!dbRes.ok) {
        throw new Error(`Could not load ${sampleWorldBase}${dbFileName} (HTTP ${dbRes.status})`);
      }

      const dbBlob = await dbRes.blob();
      const metaBlob = await metaRes.blob();
      const mtBlob = await mtRes.blob();

      const files: File[] = [
        new File([dbBlob], dbFileName, {
          type: backend === 'postgresql' ? 'application/sql' : 'application/x-sqlite3'
        }),
        new File([metaBlob], 'map_meta.txt', { type: 'text/plain' }),
        new File([mtBlob], 'world.mt', { type: 'text/plain' })
      ];

      safeSetItem('luanti_explorer_is_demo_v1', 'true');
      await this.handleFileListInput(files);
    } catch (err: any) {
      console.warn('Failed to fetch bundled sample files, falling back to in-memory demo world generator:', err);
      try {
        this.mapStore.loadDemoDatabase(backend);
        this.lastLoadedSummary.set(
          `Loaded in-memory Demo Citadel World (${backend === 'postgresql' ? 'PostgreSQL' : 'SQLite'})`
        );
      } catch (fallbackErr: any) {
        console.error('Failed to load demo world:', fallbackErr);
        this.lastError.set(err?.message || 'Failed to load demo world.');
      }
    } finally {
      this.mapStore.isLoadingWorld.set(false);
      this.mapStore.loadStatusMessage.set('');
    }
  }

  /**
   * Exports the currently loaded Luanti world as a PostgreSQL SQL dump (.sql),
   * formatted for standard Luanti `postgresql` backend (`COPY public.blocks (pos, data) FROM stdin;`).
   */
  public async exportCurrentWorldAsPostgresDump(): Promise<string | void> {
    const dbState = this.mapStore.worldDatabase();
    if (!dbState) {
      this.lastError.set('No active world database loaded to export.');
      return;
    }

    try {
      this.mapStore.loadStatusMessage.set('Preparing PostgreSQL SQL dump export...');
      let rows: RawMapBlockRow[] = [];

      if (this.activeDbReader) {
        rows = await this.activeDbReader.queryBlocksInBounds(
          dbState.minBlockX,
          dbState.maxBlockX,
          dbState.minBlockZ,
          dbState.maxBlockZ,
          -2048,
          2048,
          1000000,
          1
        );
      }

      // If activeDbReader produced no rows or is absent, fallback to synthesizing from in-memory blockSurfaces
      if (rows.length === 0 && dbState.blockSurfaces && dbState.blockSurfaces.size > 0) {
        for (const [key, surf] of dbState.blockSurfaces.entries()) {
          const [bxStr, bzStr] = key.split(',');
          const bx = parseInt(bxStr, 10);
          const bz = parseInt(bzStr, 10);
          const by = Math.floor(surf.avgY / 16);
          // Synthetic v28 MapBlock blob
          const rawNodes = new Uint8Array(16384);
          rawNodes[1] = 1;
          const compressedNodes = pako.deflate(rawNodes);
          const nameStr = new TextEncoder().encode(surf.dominantNode || 'default:stone');
          const tail = new Uint8Array(7 + nameStr.length);
          tail[2] = 1; tail[4] = 1; tail[6] = nameStr.length;
          tail.set(nameStr, 7);
          const header = new Uint8Array([28, 1, 255, 255, 2, 2]);
          const fullBlob = new Uint8Array(header.length + compressedNodes.length + tail.length);
          fullBlob.set(header, 0);
          fullBlob.set(compressedNodes, header.length);
          fullBlob.set(tail, header.length + compressedNodes.length);
          rows.push({ x: bx, y: by, z: bz, data: fullBlob });
        }
      }

      if (rows.length === 0) {
        this.lastError.set('No raw block data available to export.');
        return;
      }

      const worldName = this.mapStore.worldConfig().worldName || 'luanti-world';
      const safeName = worldName.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      const filename = `${safeName}-map.sql`;

      const header = `--
-- Luanti World Map PostgreSQL Database Dump
-- World: ${worldName}
-- Exported by: Luanti Map Explorer
-- Blocks: ${rows.length}
--

SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

CREATE TABLE IF NOT EXISTS public.blocks (
    pos bigint NOT NULL,
    data bytea,
    CONSTRAINT blocks_pkey PRIMARY KEY (pos)
);

CREATE INDEX IF NOT EXISTS blocks_pos_idx ON public.blocks USING btree (pos);

COPY public.blocks (pos, data) FROM stdin;
`;

      const chunks: BlobPart[] = [header];
      const linesPerChunk = 250;
      let buffer = '';

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        // Calculate 64-bit pos
        const pos =
          BigInt(row.z) * 16777216n +
          BigInt(row.y) * 4096n +
          BigInt(row.x);

        let hex = '\\x';
        const data = row.data;
        for (let b = 0; b < data.length; b++) {
          const byte = data[b];
          hex += (byte < 16 ? '0' : '') + byte.toString(16);
        }

        buffer += `${pos.toString()}\t${hex}\n`;

        if ((i + 1) % linesPerChunk === 0) {
          chunks.push(buffer);
          buffer = '';
        }
      }

      if (buffer.length > 0) {
        chunks.push(buffer);
      }

      chunks.push('\\.\n\n-- Completed Luanti Map PostgreSQL dump\n');

      if (typeof document !== 'undefined' && typeof URL !== 'undefined' && URL.createObjectURL) {
        const blob = new Blob(chunks, { type: 'application/sql' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      this.lastLoadedSummary.set(
        `Successfully exported ${rows.length.toLocaleString()} blocks to ${filename}`
      );
      return chunks.join('');
    } catch (err: any) {
      console.error('Export failed:', err);
      this.lastError.set(err?.message || 'Failed to export world database.');
    } finally {
      this.mapStore.loadStatusMessage.set('');
    }
  }
}
