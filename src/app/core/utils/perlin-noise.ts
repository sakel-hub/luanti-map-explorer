import { BiomeDefinition } from '../models/biome.model';
import { CompactBlockSurface, MacroMipmapCell, MapgenType, NoiseParams } from '../models/world.model';
import { DEFAULT_LUANTI_BIOMES, resolveBiomeForDbNode } from '../data/default-biomes';

/**
 * Authentic Luanti C++ 2D Value/Gradient Perlin Noise (`minetest/src/noise.cpp`)
 * Uses Luanti's exact integer hash (`NOISE_MAGIC_X = 1619`, `NOISE_MAGIC_Y = 31337`,
 * `NOISE_MAGIC_SEED = 1013`) and cubic `easeCurve(t) = t * t * (3 - 2 * t)` with
 * per-octave seed `baseSeed + octave`.
 */
export class LuantiNoise2D {
  private readonly baseSeed: number;

  constructor(private readonly params: NoiseParams, private readonly worldSeed: number) {
    this.baseSeed = ((worldSeed | 0) + (params.seed | 0)) | 0;
  }

  private static easeCurve(t: number): number {
    return t * t * (3.0 - 2.0 * t);
  }

  private static lerp(t: number, a: number, b: number): number {
    return a + t * (b - a);
  }

  public static hash2d(x: number, y: number, seed: number): number {
    let n = (Math.imul(1619, x) + Math.imul(31337, y) + Math.imul(1013, seed)) & 0x7fffffff;
    n = (n >> 13) ^ n;
    n = (Math.imul(n, Math.imul(Math.imul(n, n), 60493) + 19990303) + 1376312589) & 0x7fffffff;
    return 1.0 - n / 0x40000000;
  }

  public singleNoise(x: number, y: number, octaveSeed = this.baseSeed): number {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const xl = x - x0;
    const yl = y - y0;

    const u = LuantiNoise2D.easeCurve(xl);
    const v = LuantiNoise2D.easeCurve(yl);

    const v00 = LuantiNoise2D.hash2d(x0, y0, octaveSeed);
    const v10 = LuantiNoise2D.hash2d(x0 + 1, y0, octaveSeed);
    const v01 = LuantiNoise2D.hash2d(x0, y0 + 1, octaveSeed);
    const v11 = LuantiNoise2D.hash2d(x0 + 1, y0 + 1, octaveSeed);

    const x1 = LuantiNoise2D.lerp(u, v00, v10);
    const x2 = LuantiNoise2D.lerp(u, v01, v11);
    return LuantiNoise2D.lerp(v, x1, x2);
  }

  public get2d(x: number, z: number): number {
    let g = 0.0;
    let frequencyX = 1.0 / Math.max(1, this.params.spread[0]);
    let frequencyZ = 1.0 / Math.max(1, this.params.spread[2]);
    let amplitude = 1.0;

    for (let i = 0; i < this.params.octaves; i++) {
      g += amplitude * this.singleNoise(x * frequencyX, z * frequencyZ, (this.baseSeed + i) | 0);
      amplitude *= this.params.persist;
      frequencyX *= this.params.lacunarity;
      frequencyZ *= this.params.lacunarity;
    }

    return this.params.offset + g * this.params.scale;
  }
}

export interface EvaluatedTerrainPoint {
  elevation: number;
  heat: number;
  humidity: number;
  biome: BiomeDefinition;
  secondBiome: BiomeDefinition;
  voronoiDist: number;
  secondVoronoiDist: number;
  isVoronoiBorder: boolean;
}

export class LuantiWorldSynthesizer {
  private readonly heatNoise: LuantiNoise2D;
  private readonly humidityNoise: LuantiNoise2D;
  private readonly heatBlendNoise: LuantiNoise2D;
  private readonly humidityBlendNoise: LuantiNoise2D;
  private readonly terrainBaseNoise: LuantiNoise2D;
  private readonly terrainAltNoise: LuantiNoise2D;
  private readonly heightSelectNoise: LuantiNoise2D;
  private readonly ridgeNoise: LuantiNoise2D;

  constructor(
    public readonly seed: number,
    public readonly mapgen: MapgenType,
    public readonly waterLevel: number,
    heatParams: NoiseParams,
    humidityParams: NoiseParams,
    terrainParams: NoiseParams,
    private readonly biomes: BiomeDefinition[] = DEFAULT_LUANTI_BIOMES
  ) {
    this.heatNoise = new LuantiNoise2D(heatParams, seed);
    this.humidityNoise = new LuantiNoise2D(humidityParams, seed);
    this.heatBlendNoise = new LuantiNoise2D(
      {
        offset: 0,
        scale: 1.5,
        spread: [8, 8, 8],
        seed: 13,
        octaves: 2,
        persist: 1.0,
        lacunarity: 2.0
      },
      seed
    );
    this.humidityBlendNoise = new LuantiNoise2D(
      {
        offset: 0,
        scale: 1.5,
        spread: [8, 8, 8],
        seed: 90003,
        octaves: 2,
        persist: 1.0,
        lacunarity: 2.0
      },
      seed
    );
    this.terrainBaseNoise = new LuantiNoise2D(
      {
        ...terrainParams,
        octaves: Math.min(4, terrainParams.octaves)
      },
      seed
    );
    this.terrainAltNoise = new LuantiNoise2D(
      {
        offset: 4,
        scale: 25,
        spread: [600, 600, 600],
        seed: 5934,
        octaves: 3,
        persist: 0.6,
        lacunarity: 2.0
      },
      seed
    );
    this.heightSelectNoise = new LuantiNoise2D(
      {
        offset: -8,
        scale: 16,
        spread: [500, 500, 500],
        seed: 4213,
        octaves: 2,
        persist: 0.7,
        lacunarity: 2.0
      },
      seed
    );
    this.ridgeNoise = new LuantiNoise2D(
      {
        offset: 0,
        scale: 1,
        spread: [1000, 1000, 1000],
        seed: 85039,
        octaves: 2,
        persist: 0.6,
        lacunarity: 2.0
      },
      seed
    );
  }

  public evaluateElevation(x: number, z: number): number {
    if (this.mapgen === 'flat') {
      return 8;
    }

    const base = this.terrainBaseNoise.get2d(x, z);
    const alt = this.terrainAltNoise.get2d(x, z);
    const ridgeRaw = this.ridgeNoise.get2d(x, z);

    if (this.mapgen === 'valleys') {
      const riverChannel = Math.abs(ridgeRaw);
      const valleyFactor = Math.min(1, riverChannel * 3.5);
      const height = (base * 0.7 + alt * 0.5) * valleyFactor - (1 - valleyFactor) * 6;
      return Math.round(height);
    }

    if (this.mapgen === 'carpathian') {
      const ridgeline = 1.0 - Math.abs(ridgeRaw);
      const mountainBoost = Math.pow(Math.max(0, ridgeline), 2.4) * 78;
      return Math.round(base * 0.45 + mountainBoost);
    }

    // Authentic Luanti MapgenV7::baseTerrainLevelAtPoint(x, z) + ridge/river modulation
    const hselect = Math.max(0, Math.min(1, this.heightSelectNoise.get2d(x, z)));
    let height = alt > base ? alt : base * hselect + alt * (1.0 - hselect);

    // Carve MapgenV7 underwater/coastal river channels (`np_ridge_uwater`)
    const absRidge = Math.abs(ridgeRaw);
    if (absRidge < 0.055 && height > this.waterLevel - 6 && height < 28) {
      const channelDepth = (1.0 - absRidge / 0.055) * 9.0;
      height -= channelDepth;
    } else if (height > this.waterLevel + 6 && ridgeRaw > 0.35) {
      const mountFactor = ridgeRaw - 0.35;
      height += mountFactor * mountFactor * 64;
    }

    return Math.round(height);
  }

  public evaluatePoint(
    x: number,
    z: number,
    referenceY?: number,
    computeVoronoiBorder = true
  ): EvaluatedTerrainPoint {
    return this.evaluatePointWithClimateAnchor(
      x,
      z,
      50,
      50,
      0,
      referenceY,
      computeVoronoiBorder
    );
  }

  /**
   * Evaluates terrain & biome classification at `(x, z)`, optionally anchored toward an empirical
   * SQLite climate centroid `(anchorHeat, anchorHumidity)` and coastal/bathymetric elevation
   * `anchorElev` so Hybrid mode unexplored terrain seamlessly matches adjacent explored SQLite blocks.
   */
  public evaluatePointWithClimateAnchor(
    x: number,
    z: number,
    anchorHeat: number,
    anchorHumidity: number,
    anchorBlend: number,
    referenceY?: number,
    computeVoronoiBorder = true,
    anchorElev?: number,
    anchorElevBlend = 0
  ): EvaluatedTerrainPoint {
    const rawElevation = this.evaluateElevation(x, z);
    let elevation = rawElevation;
    if (anchorElev !== undefined && anchorElevBlend > 0) {
      const localAnchoredElev = anchorElev + (rawElevation - this.waterLevel) * 0.22;
      elevation = Math.round(
        rawElevation * (1 - anchorElevBlend) + localAnchoredElev * anchorElevBlend
      );
    }

    const effectiveY = referenceY !== undefined ? referenceY : elevation;
    const rawHeat = this.heatNoise.get2d(x, z) + this.heatBlendNoise.get2d(x, z);
    const rawHumidity = this.humidityNoise.get2d(x, z) + this.humidityBlendNoise.get2d(x, z);

    let effectiveHeat = rawHeat;
    let effectiveHumidity = rawHumidity;

    if (anchorBlend > 0) {
      const localAnchoredHeat = anchorHeat + (rawHeat - 50) * 0.22;
      const localAnchoredHumidity = anchorHumidity + (rawHumidity - 50) * 0.22;
      effectiveHeat = rawHeat * (1 - anchorBlend) + localAnchoredHeat * anchorBlend;
      effectiveHumidity = rawHumidity * (1 - anchorBlend) + localAnchoredHumidity * anchorBlend;
    }

    // Clamp into 0..100 climate range for Voronoi chart
    const heat = Math.max(0, Math.min(100, effectiveHeat));
    const humidity = Math.max(0, Math.min(100, effectiveHumidity));

    let bestBiome = this.biomes[0];
    let secondBiome = this.biomes[1] || this.biomes[0];
    let minDistSq = Number.MAX_VALUE;
    let secondDistSq = Number.MAX_VALUE;

    for (let i = 0; i < this.biomes.length; i++) {
      const b = this.biomes[i];
      if (effectiveY >= b.yMin && effectiveY <= b.yMax) {
        const dh = heat - b.heatPoint;
        const du = humidity - b.humidityPoint;
        const distSq = dh * dh + du * du;
        if (distSq < minDistSq) {
          secondDistSq = minDistSq;
          secondBiome = bestBiome;
          minDistSq = distSq;
          bestBiome = b;
        } else if (distSq < secondDistSq) {
          secondDistSq = distSq;
          secondBiome = b;
        }
      }
    }

    let d1 = 0;
    let d2 = 0;
    let isVoronoiBorder = false;
    if (computeVoronoiBorder) {
      d1 = Math.sqrt(minDistSq);
      d2 = Math.sqrt(secondDistSq);
      isVoronoiBorder = Math.abs(d2 - d1) < 1.85;
    }

    return {
      elevation,
      heat,
      humidity,
      biome: bestBiome,
      secondBiome,
      voronoiDist: d1,
      secondVoronoiDist: d2,
      isVoronoiBorder
    };
  }
}

const MIPMAP_CLIMATE_SAMPLE_OFFSETS: ReadonlyArray<[number, number, number]> = (() => {
  const steps = [-6, -3, -1, 0, 1, 3, 6];
  const list: Array<[number, number, number]> = [];
  for (const dz of steps) {
    for (const dx of steps) {
      list.push([dx, dz, dx * dx + dz * dz]);
    }
  }
  return list;
})();

/**
 * Computes an Inverse-Distance-Weighted (IDW) climate & bathymetric/coastal elevation anchor from
 * nearby explored SQLite mipmap/block cells so Hybrid mode unexplored regions & borders match the
 * true biomes, coastlines, and oceans of the loaded `map.sqlite` world.
 */
export function sampleMipmapClimateAnchor(
  worldX: number,
  worldZ: number,
  macroMipmap: Map<string, MacroMipmapCell> | null | undefined,
  biomes: BiomeDefinition[],
  blockSurfaces?: Map<string, CompactBlockSurface> | null,
  waterLevel = 1
): { heat: number; humidity: number; blend: number; elev: number; elevBlend: number } | null {
  if ((!macroMipmap || macroMipmap.size === 0) && (!blockSurfaces || blockSurfaces.size === 0)) {
    return null;
  }

  const centerMcx = worldX >> 5;
  const centerMcz = worldZ >> 5;

  let sumHeat = 0;
  let sumHumidity = 0;
  let totalWeight = 0;
  let minDistSq = Number.MAX_VALUE;

  let sumElev = 0;
  let elevWeight = 0;
  let minElevDistSq = Number.MAX_VALUE;

  for (let i = 0; i < MIPMAP_CLIMATE_SAMPLE_OFFSETS.length; i++) {
    const [dx, dz, distSq] = MIPMAP_CLIMATE_SAMPLE_OFFSETS[i];
    const mcx = centerMcx + dx;
    const mcz = centerMcz + dz;
    const bx = mcx << 1;
    const bz = mcz << 1;

    let nodeName: string | undefined;
    let cellY = 0;
    let waterDepth = 0;

    const mip =
      macroMipmap?.get(`${mcx},${mcz}`) ||
      macroMipmap?.get(`b:${bx},${bz}`) ||
      macroMipmap?.get(`b:${bx + 1},${bz}`) ||
      macroMipmap?.get(`b:${bx},${bz + 1}`) ||
      macroMipmap?.get(`b:${bx + 1},${bz + 1}`) ||
      macroMipmap?.get(`m4:${mcx >> 1},${mcz >> 1}`);

    if (mip) {
      nodeName = mip.nodeName;
      cellY = mip.y;
      waterDepth = mip.waterDepth;
    } else if (blockSurfaces && blockSurfaces.size > 0) {
      const blk =
        blockSurfaces.get(`${bx},${bz}`) ||
        blockSurfaces.get(`${bx + 1},${bz}`) ||
        blockSurfaces.get(`${bx},${bz + 1}`) ||
        blockSurfaces.get(`${bx + 1},${bz + 1}`);
      if (blk) {
        nodeName = blk.dominantNode;
        cellY = blk.avgY;
        waterDepth = blk.waterDepth[0] || (blk.dominantNode.includes('water') ? 6 : 0);
      }
    }

    if (!nodeName) continue;

    const w = 1 / (distSq + 0.35);
    const isWater = waterDepth > 0 || nodeName.includes('water');
    // For water cells, anchor elevation below waterLevel so Hybrid coastlines & oceans continue seamlessly!
    const bathymetricElev = isWater
      ? waterLevel - Math.max(5, Math.min(20, waterDepth || 6))
      : Math.max(waterLevel, cellY);
    sumElev += bathymetricElev * w;
    elevWeight += w;
    if (distSq < minElevDistSq) {
      minElevDistSq = distSq;
    }

    if (isWater) continue;

    const biome = resolveBiomeForDbNode(nodeName, cellY, waterDepth, biomes);
    sumHeat += biome.heatPoint * w;
    sumHumidity += biome.humidityPoint * w;
    totalWeight += w;
    if (distSq < minDistSq) {
      minDistSq = distSq;
    }
  }

  if (totalWeight === 0 && elevWeight === 0) return null;

  const effDist = Math.max(0, Math.sqrt(minDistSq) - 1.0);
  const blend =
    totalWeight > 0
      ? Math.max(0, Math.min(0.94, 0.94 * Math.exp(-effDist * 0.22)))
      : 0;
  const effElevDist = Math.max(0, Math.sqrt(minElevDistSq) - 1.0);
  const elevBlend =
    elevWeight > 0
      ? Math.max(0, Math.min(0.94, 0.94 * Math.exp(-effElevDist * 0.28)))
      : 0;

  return {
    heat: totalWeight > 0 ? sumHeat / totalWeight : 50,
    humidity: totalWeight > 0 ? sumHumidity / totalWeight : 50,
    blend,
    elev: elevWeight > 0 ? sumElev / elevWeight : waterLevel,
    elevBlend
  };
}

export function createDefaultNoiseParams(): {
  heatNoise: NoiseParams;
  humidityNoise: NoiseParams;
  terrainNoise: NoiseParams;
} {
  return {
    heatNoise: {
      offset: 50,
      scale: 50,
      spread: [1000, 1000, 1000],
      seed: 5349,
      octaves: 3,
      persist: 0.5,
      lacunarity: 2.0
    },
    humidityNoise: {
      offset: 50,
      scale: 50,
      spread: [1000, 1000, 1000],
      seed: 842,
      octaves: 3,
      persist: 0.5,
      lacunarity: 2.0
    },
    terrainNoise: {
      offset: 4,
      scale: 70,
      spread: [600, 600, 600],
      seed: 82341,
      octaves: 5,
      persist: 0.6,
      lacunarity: 2.0
    }
  };
}
