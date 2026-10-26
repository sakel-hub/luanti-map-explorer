/**
 * Data structures for Luanti voxel world pathfinding and route planning.
 */

export type TravelMode = 'hiking' | 'sailing' | 'mining' | 'railway' | 'direct';

export interface RouteWaypoint {
  id: string;
  label: string;
  x: number;
  z: number;
  y?: number;
}

export interface RouteConstraints {
  /** Strongly penalize or forbid vertical ascents/descents > 2 blocks */
  avoidCliffs: boolean;
  /** Apply speed discounts to cobblestone, gravel, wood, and paved roads */
  preferRoads: boolean;
  /** Forbid or penalize swimming across deep ocean / water bodies */
  avoidWater: boolean;
  /** Strictly avoid high-temperature lava pools and hazard zones */
  avoidLava: boolean;
  /** Subterranean bore depth (Y level) for mining tunnel mode */
  miningDepth: number;
}

export interface RoutePoint {
  x: number;
  z: number;
  y: number;
  distanceFromStart: number;
  slopeDeg: number;
  nodeName: string;
  biomeName: string;
  isWater: boolean;
  isLava: boolean;
  isRoad: boolean;
  isSteep: boolean;
}

export interface RouteDirectionStep {
  id: string;
  text: string;
  distance: number;
  x: number;
  z: number;
  y: number;
  icon: 'straight' | 'turn-left' | 'turn-right' | 'climb' | 'descend' | 'water' | 'mine' | 'finish';
}

export interface RoutePlan {
  id: string;
  mode: TravelMode;
  start: RouteWaypoint;
  destination: RouteWaypoint;
  points: RoutePoint[];
  totalDistanceNodes: number;
  totalClimbY: number;
  totalDescentY: number;
  minY: number;
  maxY: number;
  estimatedDurationSeconds: number;
  waterCrossingsCount: number;
  cliffSectionsCount: number;
  biomesTraversed: Array<{ biome: string; percent: number }>;
  directions: RouteDirectionStep[];
  calculatedAt: number;
}
