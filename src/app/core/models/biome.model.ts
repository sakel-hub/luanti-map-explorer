import { AltitudeBand } from './world.model';

export interface BiomeDefinition {
  id: string;
  name: string;
  game: string;
  heatPoint: number;      // 0..100
  humidityPoint: number;  // 0..100
  yMin: number;
  yMax: number;
  altitudeBand: Exclude<AltitudeBand, 'all'>;
  color: [number, number, number]; // RGB
  hexColor: string;
  topNode: string;
  fillerNode: string;
  stoneNode: string;
  description: string;
  saplingKey?: string;
  treeDensity?: number;
}

export interface ClimateSample {
  x: number;
  z: number;
  y: number;
  blockX: number;
  blockY: number;
  blockZ: number;
  heat: number;
  humidity: number;
  biome: BiomeDefinition;
  voronoiDistance: number;
  secondBiome?: BiomeDefinition;
  secondVoronoiDistance?: number;
  dbNodeName?: string;
  dbElevation?: number;
  isExploredInDb: boolean;
}

export interface VoronoiCellPolygon {
  biome: BiomeDefinition;
  svgPath: string;
  points: [number, number][];
  centroid: [number, number];
  areaPercent: number;
}
