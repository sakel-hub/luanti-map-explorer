import { TranslationDictionary } from '../translation.types';
import { en } from './en';

export const de: TranslationDictionary = {
  ...en,
  common: {
    ...en.common,
    cancel: 'Abbrechen',
    close: 'Schließen',
    save: 'Speichern',
    reset: 'Zurücksetzen',
    copy: 'Kopieren',
    copied: 'Kopiert!',
    download: 'Herunterladen',
    loading: 'Laden...',
    search: 'Suchen...',
    clear: 'Löschen',
    stop: 'Stopp',
    edit: 'Bearbeiten',
    delete: 'Löschen'
  },
  app: {
    ...en.app,
    mapView: 'Kartenansicht',
    worldAndSeed: 'Welt & Seed',
    dropWorldTitle: 'Luanti-Welt oder map.sqlite hier ablegen'
  },
  header: {
    ...en.header,
    title: 'Luanti Karten-Explorer',
    openWorldFolder: 'Weltordner öffnen',
    openSqliteOrFiles: 'map.sqlite / Dateien öffnen',
    loadDemoWorld: 'Demo-Welt DB',
    randomSeed: 'Zufalls-Seed',
    shortcuts: 'Tastenkürzel',
    help: 'Anleitung',
    share: 'Teilen',
    modeSeedShort: 'Seed',
    modeHybridShort: 'Hybrid',
    modeDbShort: 'Welt-DB',
    languageSection: 'Sprache',
    docsAndSharingSection: 'Dokumentation & Teilen',
    preferencesSection: 'Einstellungen',
    offlineBadge: 'Offline-Modus',
    updateAvailable: 'Update bereit — Neu laden'
  },
  worldPanel: {
    ...en.worldPanel,
    title: 'Welt- & Seed-Steuerung',
    worldSource: 'Luanti-Weltordner / DB',
    openDirectoryBtn: 'Luanti-Weltordner öffnen',
    openFileSqliteBtn: 'Welt-DB (SQLite / PostgreSQL) öffnen',
    loadSampleDbBtn: 'Demo-Welt laden (SQLite)',
    loadSamplePgBtn: 'Demo-Welt laden (PostgreSQL)',
    exportPostgresBtn: 'PostgreSQL-Dump exportieren (.sql)',
    backendBadge: 'Datenbank-Backend',
    backendSqlite: 'SQLite B-Tree',
    backendPostgresql: 'PostgreSQL-Dump',
    modeSeed: 'Seed-Biome',
    modeDb: 'Nur Welt-DB',
    modeHybrid: 'Hybrid (Seed + DB)',
    coresUnit: 'Kerne',
    fitWholeWorld: 'Ganze Welt einpassen',
    elevationSlicerTitle: 'Höhen- & Tiefenschnitt (Y)',
    caveXrayMode: 'Höhlen-Röntgenmodus',
    buildingExtrusions: '3D-Gebäudemodelle (DB)',
    hypsometricColors: 'Hypsometrische Höhenfarben',
    persistedBadge: 'Dauerhaft',
    tilesCachedSuffix: 'Kacheln im Cache'
  },
  voronoi: {
    ...en.voronoi,
    title: 'Voronoi-Matrix',
    subtitle: '2D Hitze (X) vs. Feuchtigkeit (Y) Biom-Diagramm',
    biomePaletteLabel: 'Biom-Palette / Mods',
    customBiomeBtn: 'Eigenes Biom',
    addCustomBiomeTitle: 'Eigenes Voronoi-Biom hinzufügen',
    addBiomeSubmit: 'Biom hinzufügen'
  },
  inspector: {
    ...en.inspector,
    title: 'Inspektor & DB',
    profileEW: 'O–W Profil',
    profileNS: 'N–S Profil',
    surfaceColumns: 'Oberflächensäulen'
  },
  markers: {
    ...en.markers,
    title: 'Markierungen',
    savedWaypoints: 'Gespeicherte Wegpunkte',
    clearAllBtn: 'Alle löschen'
  },
  viewport: {
    ...en.viewport,
    relief3dOn: '3D-Relief EIN',
    flat2d: '2D Flach',
    elevColors: 'Höhenfarben',
    biomeColors: 'Biomfarben',
    ySliceLabel: 'Y-Schnitt:',
    sliceSky: 'Himmelsinseln',
    sliceSurface: 'Oberfläche',
    sliceCaves: 'Höhlen',
    sliceDeep: 'Tiefe Höhlen',
    sliceAbyss: 'Abgrund',
    tiltLabel: 'Neigung:',
    orbitLabel: 'Rotation:',
    scale3dLabel: '3D-Skala:',
    models3dLabel: '3D-Modelle:',
    baking3dTiles: '3D-Kacheln werden berechnet'
  },
  shortcuts: {
    ...en.shortcuts,
    title: 'Tastenkürzel',
    catMapCamera: 'Karte & Kamera',
    catModesLayers: 'Modi & Ebenen',
    catWorldSeed: 'Welt & Seed',
    catGeneral: 'Allgemein'
  },
  share: {
    ...en.share,
    title: 'Luanti Weltkarte & Seed teilen',
    copyLink: 'Link kopieren',
    linkCopied: 'Kopiert!'
  },
  routes: {
    ...en.routes,
    title: 'Routenplaner',
    trySampleRoute: 'Beispielroute testen'
  }
};
