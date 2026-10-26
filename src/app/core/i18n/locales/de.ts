import { TranslationDictionary } from '../translation.types';
import { en } from './en';

export const de: TranslationDictionary = {
  ...en,
  common: {
    ...en.common,
    close: 'Schließen',
    save: 'Speichern',
    reset: 'Zurücksetzen',
    copy: 'Kopieren',
    copied: 'Kopiert!',
    download: 'Herunterladen',
    loading: 'Laden...',
    search: 'Suchen...',
    clear: 'Löschen'
  },
  header: {
    ...en.header,
    title: 'Luanti Karten-Explorer',
    openWorldFolder: 'Weltordner öffnen',
    loadDemoWorld: 'Demo-Welt DB',
    randomSeed: 'Zufalls-Seed',
    shortcuts: 'Tastenkürzel',
    help: 'Anleitung',
    share: 'Teilen'
  },
  worldPanel: {
    ...en.worldPanel,
    title: 'Welt- & Seed-Steuerung',
    openDirectoryBtn: 'Luanti-Weltordner öffnen',
    openFileSqliteBtn: 'map.sqlite Datei laden',
    loadSampleDbBtn: 'Demo-Welt-DB laden',
    modeSeed: 'Seed-Biome',
    modeDb: 'Nur SQLite-DB',
    modeHybrid: 'Hybrid (Seed + DB)'
  },
  voronoi: {
    ...en.voronoi,
    title: 'Voronoi-Matrix',
    subtitle: '2D Hitze (X) vs. Feuchtigkeit (Y) Biom-Diagramm'
  },
  inspector: {
    ...en.inspector,
    title: 'Inspektor & DB'
  },
  share: {
    ...en.share,
    title: 'Luanti Weltkarte & Seed teilen',
    copyLink: 'Link kopieren',
    linkCopied: 'Kopiert!'
  }
};
