import { TranslationDictionary } from '../translation.types';
import { en } from './en';

export const ru: TranslationDictionary = {
  ...en,
  common: {
    ...en.common,
    close: 'Закрыть',
    save: 'Сохранить',
    reset: 'Сброс',
    copy: 'Копировать',
    copied: 'Скопировано!',
    download: 'Скачать',
    loading: 'Загрузка...',
    search: 'Поиск...',
    clear: 'Очистить'
  },
  header: {
    ...en.header,
    title: 'Карта и Биомы Luanti',
    openWorldFolder: 'Открыть папку мира',
    loadDemoWorld: 'Демо-мир БД',
    randomSeed: 'Случайный сид',
    shortcuts: 'Клавиши',
    help: 'Справка',
    share: 'Поделиться'
  },
  worldPanel: {
    ...en.worldPanel,
    title: 'Мир и параметры сида',
    openDirectoryBtn: 'Открыть папку мира Luanti',
    openFileSqliteBtn: 'Загрузить файл map.sqlite',
    loadSampleDbBtn: 'Загрузить демо-базу мира',
    modeSeed: 'Биомы по сиду',
    modeDb: 'Только БД SQLite',
    modeHybrid: 'Гибрид (Сид + БД)'
  },
  voronoi: {
    ...en.voronoi,
    title: 'Диаграмма Вороного',
    subtitle: '2D распределение биомов: Тепло (X) и Влажность (Y)'
  },
  inspector: {
    ...en.inspector,
    title: 'Инспектор и БД'
  },
  share: {
    ...en.share,
    title: 'Поделиться картой и сидом Luanti',
    copyLink: 'Копировать ссылку',
    linkCopied: 'Скопировано!'
  }
};
