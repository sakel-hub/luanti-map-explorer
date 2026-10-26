import { BiomeDefinition } from '../models/biome.model';
import { MacroMipmapCell, MapgenType, NoiseParams } from '../models/world.model';
import { DEFAULT_LUANTI_BIOMES, resolveBiomeForDbNode } from '../data/default-biomes';

/**
 * Deterministic Luanti-inspired 2D Octave Gradient/Value Perlin Noise
 * Supports offset, scale, spread, seed, octaves, persistence, and lacunarity.
 */
export class LuantiNoise2D {
  private readonly perm: Uint8Array;

  constructor(private readonly params: NoiseParams, private readonly worldSeed: number) {
    this.perm = new Uint8Array(512);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      p[i] = i;
    }

    // Mix worldSeed and noise seed using Mulberry32 PRNG
    let state = (Math.imul(worldSeed ^ 0x9e3779b9, 0x85ebca6b) + Math.imul(params.seed, 0xc2b2ae35)) >>> 0;
    const nextRand = () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    for (let i = 255; i > 0; i--) {
      const j = Math.floor(nextRand() * (i + 1));
      const tmp = p[i];
      p[i] = p[j];
      p[j] = tmp;
    }

    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
    }
  }

  private static fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private static lerp(t: number, a: number, b: number): number {
    return a + t * (b - a);
  }

  private static grad(hash: number, x: number, y: number): number {
    const h = hash & 7;
    const u = h < 4 ? x : y;
    const v = h < 4 ? y : x;
    return ((h & 1) !== 0 ? -u : u) + ((h & 2) !== 0 ? -2.0 * v : 2.0 * v);
  }

  public singleNoise(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    const u = LuantiNoise2D.fade(xf);
    const v = LuantiNoise2D.fade(yf);

    const aa = this.perm[this.perm[X] + Y];
    const ab = this.perm[this.perm[X] + Y + 1];
    const ba = this.perm[this.perm[X + 1] + Y];
    const bb = this.perm[this.perm[X + 1] + Y + 1];

    const x1 = LuantiNoise2D.lerp(u, LuantiNoise2D.grad(aa, xf, yf), LuantiNoise2D.grad(ba, xf - 1, yf));
    const x2 = LuantiNoise2D.lerp(u, LuantiNoise2D.grad(ab, xf, yf - 1), LuantiNoise2D.grad(bb, xf - 1, yf - 1));

    // Normalize into [-1.3, 1.3] so multi-octave sum covers the full [-1, 1] climate domain
    return LuantiNoise2D.lerp(v, x1, x2) * 0.85;
  }

  public get2d(x: number, z: number): number {
    let total = 0;
    let frequencyX = 1.0 / Math.max(1, this.params.spread[0]);
    let frequencyZ = 1.0 / Math.max(1, this.params.spread[2]);
    let amplitude = 1.0;
    let maxAmplitude = 0;

    for (let i = 0; i < this.params.octaves; i++) {
      total += this.singleNoise(x * frequencyX + i * 17.3, z * frequencyZ + i * 31.7) * amplitude;
      maxAmplitude += amplitude;
      amplitude *= this.params.persist;
      frequencyX *= this.params.lacunarity;
      frequencyZ *= this.params.lacunarity;
    }

    const normalized = maxAmplitude > 0 ? total / (maxAmplitude * 0.66) : 0;
    return this.params.offset + normalized * this.params.scale;
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
  private readonly terrainBaseNoise: LuantiNoise2D;
  private readonly terrainAltNoise: LuantiNoise2D;
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
    this.terrainBaseNoise = new LuantiNoise2D(terrainParams, seed);
    this.terrainAltNoise = new LuantiNoise2D(
      {
        offset: 4,
        scale: 32,
        spread: [300, 300, 300],
        seed: 5934,
        octaves: 4,
        persist: 0.55,
        lacunarity: 2.0
      },
      seed
    );
    this.ridgeNoise = new LuantiNoise2D(
      {
        offset: 0,
        scale: 1,
        spread: [450, 450, 450],
        seed: 8412,
        octaves: 3,
        persist: 0.5,
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

    // Default Mapgen v7
    const mountFactor = Math.max(0, ridgeRaw + 0.25);
    const mountHeight = mountFactor * mountFactor * 68;
    return Math.round(base * 0.65 + alt * 0.35 + mountHeight);
  }

  public evaluatePoint(x: number, z: number, referenceY?: number): EvaluatedTerrainPoint {
    return this.evaluatePointWithClimateAnchor(x, z, 50, 50, 0, referenceY);
  }

  /**
   * Evaluates terrain & biome classification at `(x, z)`, optionally anchored toward an empirical
   * SQLite climate centroid `(anchorHeat, anchorHumidity)` with weight `anchorBlend` (0..1) so
   * Hybrid mode unexplored terrain seamlessly matches adjacent explored SQLite biomes.
   */
  public evaluatePointWithClimateAnchor(
    x: number,
    z: number,
    anchorHeat: number,
    anchorHumidity: number,
    anchorBlend: number,
    referenceY?: number
  ): EvaluatedTerrainPoint {
    const elevation = this.evaluateElevation(x, z);
    const effectiveY = referenceY !== undefined ? referenceY : elevation;
    const rawHeat = this.heatNoise.get2d(x, z);
    const rawHumidity = this.humidityNoise.get2d(x, z);

    let effectiveHeat = rawHeat;
    let effectiveHumidity = rawHumidity;

    if (anchorBlend > 0) {
      const localAnchoredHeat = anchorHeat + (rawHeat - 50) * 0.28;
      const localAnchoredHumidity = anchorHumidity + (rawHumidity - 50) * 0.28;
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

    const d1 = Math.sqrt(minDistSq);
    const d2 = Math.sqrt(secondDistSq);
    const isVoronoiBorder = Math.abs(d2 - d1) < 1.85;

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
  const steps = [-10, -6, -3, -2, -1, 0, 1, 2, 3, 6, 10];
  const list: Array<[number, number, number]> = [];
  for (const dz of steps) {
    for (const dx of steps) {
      list.push([dx, dz, dx * dx + dz * dz]);
    }
  }
  return list;
})();

/**
 * Computes an Inverse-Distance-Weighted (IDW) climate anchor `(heat, humidity, blend)` from
 * nearby explored SQLite mipmap cells so Hybrid mode unexplored regions & borders match the
 * true biomes of the loaded `map.sqlite` world.
 */
export function sampleMipmapClimateAnchor(
  worldX: number,
  worldZ: number,
  macroMipmap: Map<string, MacroMipmapCell> | null | undefined,
  biomes: BiomeDefinition[]
): { heat: number; humidity: number; blend: number } | null {
  if (!macroMipmap || macroMipmap.size === 0) return null;

  const centerMcx = worldX >> 5;
  const centerMcz = worldZ >> 5;

  let sumHeat = 0;
  let sumHumidity = 0;
  let totalWeight = 0;
  let minDistSq = Number.MAX_VALUE;

  for (let i = 0; i < MIPMAP_CLIMATE_SAMPLE_OFFSETS.length; i++) {
    const [dx, dz, distSq] = MIPMAP_CLIMATE_SAMPLE_OFFSETS[i];
    const mcx = centerMcx + dx;
    const mcz = centerMcz + dz;
    const mip =
      macroMipmap.get(`${mcx},${mcz}`) ||
      macroMipmap.get(`b:${mcx << 1},${mcz << 1}`) ||
      macroMipmap.get(`m4:${mcx >> 1},${mcz >> 1}`);
    if (!mip) continue;
    if (mip.waterDepth > 0 || mip.nodeName.includes('water')) continue;

    const biome = resolveBiomeForDbNode(mip.nodeName, mip.y, mip.waterDepth, biomes);
    const w = 1 / (distSq + 0.5);
    sumHeat += biome.heatPoint * w;
    sumHumidity += biome.humidityPoint * w;
    totalWeight += w;
    if (distSq < minDistSq) {
      minDistSq = distSq;
    }
  }

  if (totalWeight === 0) return null;

  const minDist = Math.sqrt(minDistSq);
  const blend = Math.max(0, Math.min(0.92, 0.95 * Math.exp(-minDist * 0.14)));

  return {
    heat: sumHeat / totalWeight,
    humidity: sumHumidity / totalWeight,
    blend
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
      spread: [750, 750, 750],
      seed: 5349,
      octaves: 3,
      persist: 0.5,
      lacunarity: 2.0
    },
    humidityNoise: {
      offset: 50,
      scale: 50,
      spread: [750, 750, 750],
      seed: 842,
      octaves: 3,
      persist: 0.5,
      lacunarity: 2.0
    },
    terrainNoise: {
      offset: 12,
      scale: 42,
      spread: [600, 600, 600],
      seed: 82341,
      octaves: 5,
      persist: 0.6,
      lacunarity: 2.0
    }
  };
}
