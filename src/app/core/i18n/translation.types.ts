export type LocaleId = 'en' | 'sk' | 'de' | 'fr' | 'es' | 'ru';

export interface LocaleMeta {
  id: LocaleId;
  name: string;
  nativeName: string;
  flag: string;
}

export const SUPPORTED_LOCALES: LocaleMeta[] = [
  { id: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { id: 'sk', name: 'Slovak', nativeName: 'Slovenčina', flag: '🇸🇰' },
  { id: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { id: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { id: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { id: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' }
];

export interface TranslationDictionary {
  common: {
    ok: string;
    cancel: string;
    close: string;
    save: string;
    reset: string;
    copy: string;
    copied: string;
    download: string;
    loading: string;
    search: string;
    clear: string;
  };
  header: {
    title: string;
    pwaBadge: string;
    worldName: string;
    seedLabel: string;
    openWorldFolder: string;
    loadDemoWorld: string;
    randomSeed: string;
    shortcuts: string;
    help: string;
    share: string;
    github: string;
    menu: string;
    themeDark: string;
    themeLight: string;
    installApp: string;
  };
  worldPanel: {
    title: string;
    worldSource: string;
    openDirectoryBtn: string;
    openFileSqliteBtn: string;
    loadSampleDbBtn: string;
    seedSection: string;
    seedInput: string;
    randomize: string;
    mapgenType: string;
    waterLevel: string;
    viewModeSection: string;
    modeSeed: string;
    modeDb: string;
    modeHybrid: string;
    layersSection: string;
    terrain3d: string;
    exaggeration: string;
    hillshade: string;
    voronoiContours: string;
    chunkGrid: string;
    exploredBounds: string;
    noiseParamsSection: string;
    heatSpread: string;
    humiditySpread: string;
    storageSection: string;
    tileCacheUsage: string;
    clearTileCacheBtn: string;
    tileCacheCleared: string;
    persistentStorage: string;
    reopenRecentWorld: string;
  };
  voronoi: {
    title: string;
    subtitle: string;
    modeAuto: string;
    modeAll: string;
    modeVanilla: string;
    modeEverness: string;
    modeEthereal: string;
    modeMineclone: string;
    bandAll: string;
    bandLowland: string;
    bandOcean: string;
    bandHighland: string;
    bandUnderground: string;
    heatAxis: string;
    humidityAxis: string;
    cursorTelemetry: string;
    isolatedBiome: string;
    clearFilter: string;
    clickToIsolateHint: string;
  };
  inspector: {
    title: string;
    cursorCoordinates: string;
    nodeCoords: string;
    blockCoords: string;
    chunkCoords: string;
    climateSection: string;
    heat: string;
    humidity: string;
    elevation: string;
    activeBiome: string;
    voronoiDist: string;
    surfaceNodes: string;
    databaseSection: string;
    dbStatusLoaded: string;
    dbStatusEmpty: string;
    totalBlocks: string;
    exploredNode: string;
    jumpToOrigin: string;
    jumpToCoord: string;
  };
  markers: {
    title: string;
    subtitle: string;
    pinAtCursor: string;
    addMarker: string;
    exportJson: string;
    importJson: string;
    copyWaypoints: string;
    emptyState: string;
  };
  viewport: {
    resetNorth: string;
    toggle3D: string;
    toggleGrid: string;
    zoomIn: string;
    zoomOut: string;
    centerOrigin: string;
    exportPng: string;
  };
  shortcuts: {
    title: string;
    subtitle: string;
  };
  help: {
    title: string;
    subtitle: string;
    tabWorldFolder: string;
    tabVoronoi: string;
    tabSqlite: string;
    tabControls: string;
  };
  share: {
    title: string;
    subtitle: string;
    copyLink: string;
    linkCopied: string;
    shareViaDevice: string;
    shareOnX: string;
    shareOnReddit: string;
    shareOnDiscord: string;
    shareOnWhatsApp: string;
    shareOnFacebook: string;
    viewGitHub: string;
  };
  routes: {
    title: string;
    subtitle: string;
    modeHiking: string;
    modeSailing: string;
    modeMining: string;
    modeRailway: string;
    modeDirect: string;
    startPoint: string;
    destPoint: string;
    pickOnMap: string;
    pickOnMapHint: string;
    swap: string;
    constraintsTitle: string;
    avoidCliffs: string;
    avoidCliffsTooltip: string;
    preferRoads: string;
    preferRoadsTooltip: string;
    avoidWater: string;
    avoidWaterTooltip: string;
    avoidLava: string;
    avoidLavaTooltip: string;
    miningDepth: string;
    miningDepthTooltip: string;
    summaryTitle: string;
    estTime: string;
    distance: string;
    elevationProfile: string;
    climb: string;
    descent: string;
    highestPeak: string;
    lowestValley: string;
    waterCrossings: string;
    biomesSection: string;
    directionsSection: string;
    copyTeleport: string;
    copyTeleportDone: string;
    copyWaypoint: string;
    copyWaypointDone: string;
    clearRoute: string;
    emptyPrompt: string;
    calculating: string;
    setAsStart: string;
    setAsDest: string;
  };
}

type NestedKeyOf<ObjectType extends object> = {
  [Key in keyof ObjectType & (string | number)]: ObjectType[Key] extends object
    ? `${Key}.${NestedKeyOf<ObjectType[Key]>}`
    : `${Key}`;
}[keyof ObjectType & (string | number)];

export type TranslationKey = NestedKeyOf<TranslationDictionary>;
