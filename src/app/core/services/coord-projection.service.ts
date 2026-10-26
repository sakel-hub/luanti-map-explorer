import { Injectable } from '@angular/core';

/**
 * Bijective coordinate projection between Luanti's flat Cartesian world [-30912, 30912]
 * and MapLibre GL JS LngLat coordinates.
 *
 * Mapping:
 * At zoom 0, the world spans [-4096, 4096] nodes across [-180, 180] longitude.
 * To prevent spherical Web Mercator stretching, we map Z via the Mercator y projection
 * so that 1 Luanti node in X equals 1 Luanti node in Z in screen pixels!
 */
@Injectable({
  providedIn: 'root'
})
export class CoordProjectionService {
  /** Half-extent of Luanti coordinate grid mapped to [-180, 180] (covers full Luanti mapgen_limit ±31007) */
  public readonly WORLD_EXTENT = 32768;

  /**
   * Converts Luanti world (x, z) node coordinates into MapLibre [lng, lat].
   * Note: In Luanti +Z is North (up on map), +X is East (right on map).
   */
  public luantiToLngLat(x: number, z: number): [number, number] {
    const clampedX = Math.max(-this.WORLD_EXTENT, Math.min(this.WORLD_EXTENT, x));
    const clampedZ = Math.max(-this.WORLD_EXTENT, Math.min(this.WORLD_EXTENT, z));

    const lng = (clampedX / this.WORLD_EXTENT) * 180;

    // Normalized Mercator y in [-PI, PI]
    const mercY = (clampedZ / this.WORLD_EXTENT) * Math.PI;
    const latRad = 2 * Math.atan(Math.exp(mercY)) - Math.PI / 2;
    const lat = (latRad * 180) / Math.PI;

    return [lng, lat];
  }

  /**
   * Converts MapLibre (lng, lat) back into exact Luanti world (x, z) node coordinates.
   */
  public lngLatToLuanti(lng: number, lat: number): { x: number; z: number } {
    const x = (lng / 180) * this.WORLD_EXTENT;

    const clampedLat = Math.max(-85.051128, Math.min(85.051128, lat));
    const latRad = (clampedLat * Math.PI) / 180;
    const mercY = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
    const z = (mercY / Math.PI) * this.WORLD_EXTENT;

    return {
      x: Math.round(x) + 0,
      z: Math.round(z) + 0
    };
  }

  /**
   * Computes the Luanti (X, Z) bounding box for a standard slippy tile (z, tx, ty).
   * In slippy tiles, ty=0 is top (+Z in Luanti), ty=2^z-1 is bottom (-Z in Luanti).
   */
  public tileToLuantiBounds(zoom: number, tx: number, ty: number): {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  } {
    const numTiles = Math.pow(2, zoom);
    const totalSpan = this.WORLD_EXTENT * 2;
    const tileSpan = totalSpan / numTiles;

    const minX = -this.WORLD_EXTENT + tx * tileSpan;
    const maxX = minX + tileSpan;

    const maxZ = this.WORLD_EXTENT - ty * tileSpan;
    const minZ = maxZ - tileSpan;

    return { minX, maxX, minZ, maxZ };
  }
}
