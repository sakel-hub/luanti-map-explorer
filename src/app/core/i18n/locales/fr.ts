import { TranslationDictionary } from '../translation.types';
import { en } from './en';

export const fr: TranslationDictionary = {
  ...en,
  common: {
    ...en.common,
    cancel: 'Annuler',
    close: 'Fermer',
    save: 'Enregistrer',
    reset: 'Réinitialiser',
    copy: 'Copier',
    copied: 'Copié !',
    download: 'Télécharger',
    loading: 'Chargement...',
    search: 'Rechercher...',
    clear: 'Effacer',
    stop: 'Arrêter',
    edit: 'Modifier',
    delete: 'Supprimer'
  },
  app: {
    ...en.app,
    mapView: 'Vue Carte',
    worldAndSeed: 'Monde & Graine',
    dropWorldTitle: 'Déposez un monde Luanti ou map.sqlite'
  },
  header: {
    ...en.header,
    title: 'Explorateur de Carte Luanti',
    openWorldFolder: 'Ouvrir dossier monde',
    openSqliteOrFiles: 'Ouvrir map.sqlite / Fichiers',
    loadDemoWorld: 'Monde Démo DB',
    randomSeed: 'Graine aléatoire',
    shortcuts: 'Raccourcis',
    help: 'Guide rapide',
    share: 'Partager',
    modeSeedShort: 'Graine',
    modeHybridShort: 'Hybride',
    modeDbShort: 'Base DB',
    languageSection: 'Langue',
    docsAndSharingSection: 'Documentation & Partage',
    preferencesSection: 'Préférences',
    themeDark: 'Passer en mode sombre',
    themeLight: 'Passer en mode clair',
    installApp: 'Installer l’application',
    installShort: 'Installer',
    installingApp: 'Installation de l’application...',
    appSection: 'Application & PWA',
    appInstalled: 'L’application est installée',
    appInstalledDesc: 'Exécution en mode PWA autonome',
    appInstallingDesc: 'Android ajoute l’application à l’écran d’accueil',
    installGuideTitle: 'Installer en tant qu’application web',
    installGuideDesc: 'Pour installer sur votre téléphone, ouvrez le menu du navigateur (⋮) et appuyez sur « Ajouter à l’écran d’accueil » ou « Installer l’application ».',
    offlineBadge: 'Mode Hors-ligne',
    updateAvailable: 'Mise à jour prête — Recharger'
  },
  worldPanel: {
    ...en.worldPanel,
    title: 'Contrôles Monde & Graine',
    worldSource: 'Dossier monde Luanti / DB',
    openDirectoryBtn: 'Ouvrir le dossier monde Luanti',
    openFileSqliteBtn: 'Ouvrir la base monde (SQLite / PostgreSQL)',
    loadSampleDbBtn: 'Charger le monde démo (SQLite)',
    loadSamplePgBtn: 'Charger le monde démo (PostgreSQL)',
    exportPostgresBtn: 'Exporter le dump PostgreSQL (.sql)',
    backendBadge: 'Backend base de données',
    backendSqlite: 'SQLite B-Tree',
    backendPostgresql: 'Dump PostgreSQL',
    modeSeed: 'Biomes (Graine)',
    modeDb: 'Base du monde seule',
    modeHybrid: 'Hybride (Graine + DB)',
    coresUnit: 'Cœurs',
    fitWholeWorld: 'Ajuster au monde entier',
    elevationSlicerTitle: 'Coupe d’altitude / profondeur (Y)',
    caveXrayMode: 'Mode Rayons X grottes',
    buildingExtrusions: 'Extrusions 3D des bâtiments (DB)',
    hypsometricColors: 'Couleurs hypsométriques',
    persistedBadge: 'Persistant',
    tilesCachedSuffix: 'tuiles en cache'
  },
  voronoi: {
    ...en.voronoi,
    title: 'Matrice de Voronoï',
    subtitle: 'Diagramme 2D Chaleur (X) vs Humidité (Y)',
    biomePaletteLabel: 'Palette de Biomes / Mods',
    customBiomeBtn: 'Biome perso',
    addCustomBiomeTitle: 'Ajouter un biome Voronoï personnalisé',
    addBiomeSubmit: 'Ajouter le biome'
  },
  inspector: {
    ...en.inspector,
    title: 'Inspecteur & DB',
    profileEW: 'Profil E–O',
    profileNS: 'Profil N–S',
    surfaceColumns: 'Colonnes de surface'
  },
  markers: {
    ...en.markers,
    title: 'Marqueurs',
    savedWaypoints: 'Points enregistrés',
    clearAllBtn: 'Tout effacer'
  },
  viewport: {
    ...en.viewport,
    relief3dOn: 'Relief 3D ACTIF',
    flat2d: '2D Plat',
    elevColors: 'Couleurs Alt.',
    biomeColors: 'Couleurs Biomes',
    ySliceLabel: 'Coupe Y :',
    sliceSky: 'Îles célestes',
    sliceSurface: 'Surface',
    sliceCaves: 'Grottes',
    sliceDeep: 'Cavernes prof.',
    sliceAbyss: 'Abîme',
    tiltLabel: 'Inclinaison :',
    orbitLabel: 'Orbite :',
    scale3dLabel: 'Échelle 3D :',
    models3dLabel: 'Modèles 3D :',
    baking3dTiles: 'Calcul des tuiles 3D'
  },
  shortcuts: {
    ...en.shortcuts,
    title: 'Raccourcis clavier',
    catMapCamera: 'Carte & Caméra',
    catModesLayers: 'Modes & Calques',
    catWorldSeed: 'Monde & Graine',
    catGeneral: 'Général'
  },
  share: {
    ...en.share,
    title: 'Partager la carte & graine Luanti',
    copyLink: 'Copier le lien',
    linkCopied: 'Copié !'
  },
  routes: {
    ...en.routes,
    title: 'Planificateur d’itinéraire',
    trySampleRoute: 'Essayer un itinéraire démo'
  }
};
