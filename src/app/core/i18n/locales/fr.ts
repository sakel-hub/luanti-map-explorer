import { TranslationDictionary } from '../translation.types';
import { en } from './en';

export const fr: TranslationDictionary = {
  ...en,
  common: {
    ...en.common,
    close: 'Fermer',
    save: 'Enregistrer',
    reset: 'Réinitialiser',
    copy: 'Copier',
    copied: 'Copié !',
    download: 'Télécharger',
    loading: 'Chargement...',
    search: 'Rechercher...',
    clear: 'Effacer'
  },
  header: {
    ...en.header,
    title: 'Explorateur de Carte Luanti',
    openWorldFolder: 'Ouvrir dossier monde',
    loadDemoWorld: 'Monde Démo DB',
    randomSeed: 'Graine aléatoire',
    shortcuts: 'Raccourcis',
    help: 'Guide rapide',
    share: 'Partager'
  },
  worldPanel: {
    ...en.worldPanel,
    title: 'Contrôles Monde & Graine',
    openDirectoryBtn: 'Ouvrir le dossier monde Luanti',
    openFileSqliteBtn: 'Charger un fichier map.sqlite',
    loadSampleDbBtn: 'Charger la base démo intégrée',
    modeSeed: 'Biomes (Graine)',
    modeDb: 'Base SQLite seule',
    modeHybrid: 'Hybride (Graine + DB)'
  },
  voronoi: {
    ...en.voronoi,
    title: 'Matrice de Voronoï',
    subtitle: 'Diagramme 2D Chaleur (X) vs Humidité (Y)'
  },
  inspector: {
    ...en.inspector,
    title: 'Inspecteur & DB'
  },
  share: {
    ...en.share,
    title: 'Partager la carte & graine Luanti',
    copyLink: 'Copier le lien',
    linkCopied: 'Copié !'
  }
};
