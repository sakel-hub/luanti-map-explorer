import { TranslationDictionary } from '../translation.types';
import { en } from './en';

export const es: TranslationDictionary = {
  ...en,
  common: {
    ...en.common,
    close: 'Cerrar',
    save: 'Guardar',
    reset: 'Restablecer',
    copy: 'Copiar',
    copied: '¡Copiado!',
    download: 'Descargar',
    loading: 'Cargando...',
    search: 'Buscar...',
    clear: 'Limpiar'
  },
  header: {
    ...en.header,
    title: 'Explorador de Mapas Luanti',
    openWorldFolder: 'Abrir carpeta del mundo',
    loadDemoWorld: 'Mundo Demo DB',
    randomSeed: 'Semilla aleatoria',
    shortcuts: 'Atajos',
    help: 'Guía rápida',
    share: 'Compartir'
  },
  worldPanel: {
    ...en.worldPanel,
    title: 'Controles de Mundo y Semilla',
    openDirectoryBtn: 'Abrir carpeta de mundo Luanti',
    openFileSqliteBtn: 'Cargar archivo map.sqlite',
    loadSampleDbBtn: 'Cargar mundo demo integrado',
    modeSeed: 'Biomas de Semilla',
    modeDb: 'Solo SQLite DB',
    modeHybrid: 'Híbrido (Semilla + DB)'
  },
  voronoi: {
    ...en.voronoi,
    title: 'Matriz de Voronoi',
    subtitle: 'Diagrama 2D Calor (X) vs. Humedad (Y)'
  },
  inspector: {
    ...en.inspector,
    title: 'Inspector y DB'
  },
  share: {
    ...en.share,
    title: 'Compartir mapa y semilla de Luanti',
    copyLink: 'Copiar enlace',
    linkCopied: '¡Copiado!'
  }
};
