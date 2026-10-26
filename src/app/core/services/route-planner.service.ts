import { Injectable, computed, inject, signal } from '@angular/core';
import { MapStore } from '../state/map.store';
import {
  RouteConstraints,
  RouteDirectionStep,
  RoutePlan,
  RoutePoint,
  RouteWaypoint,
  TravelMode
} from '../models/route.model';
import { lookupWorldColumn } from '../utils/mapblock-parser';

interface GridNode {
  x: number;
  z: number;
  g: number;
  h: number;
  f: number;
  parent: GridNode | null;
}

/** Binary Min-Heap Priority Queue for high-performance A* search */
class MinHeap<T> {
  private data: T[] = [];
  constructor(private compare: (a: T, b: T) => number) {}

  get size(): number {
    return this.data.length;
  }

  push(item: T): void {
    this.data.push(item);
    this.bubbleUp(this.data.length - 1);
  }

  pop(): T | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const bottom = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = bottom;
      this.sinkDown(0);
    }
    return top;
  }

  private bubbleUp(index: number): void {
    const item = this.data[index];
    while (index > 0) {
      const parentIdx = (index - 1) >> 1;
      const parent = this.data[parentIdx];
      if (this.compare(item, parent) >= 0) break;
      this.data[index] = parent;
      index = parentIdx;
    }
    this.data[index] = item;
  }

  private sinkDown(index: number): void {
    const length = this.data.length;
    const item = this.data[index];
    while (true) {
      const leftIdx = (index << 1) + 1;
      const rightIdx = leftIdx + 1;
      let swapIdx: number | null = null;

      if (leftIdx < length && this.compare(this.data[leftIdx], item) < 0) {
        swapIdx = leftIdx;
      }
      if (
        rightIdx < length &&
        this.compare(this.data[rightIdx], swapIdx === null ? item : this.data[leftIdx]) < 0
      ) {
        swapIdx = rightIdx;
      }
      if (swapIdx === null) break;
      this.data[index] = this.data[swapIdx];
      index = swapIdx;
    }
    this.data[index] = item;
  }
}

@Injectable({
  providedIn: 'root'
})
export class RoutePlannerService {
  constructor(private mapStore: MapStore = inject(MapStore)) {}

  // Waypoints State
  public readonly startWaypoint = signal<RouteWaypoint | null>(null);
  public readonly destWaypoint = signal<RouteWaypoint | null>(null);
  public readonly travelMode = signal<TravelMode>('hiking');

  // Constraints & Preferences
  public readonly avoidCliffs = signal<boolean>(true);
  public readonly preferRoads = signal<boolean>(true);
  public readonly avoidWater = signal<boolean>(true);
  public readonly avoidLava = signal<boolean>(true);
  public readonly miningDepth = signal<number>(-50);

  // Active Output Route & Status
  public readonly activeRoute = signal<RoutePlan | null>(null);
  public readonly isCalculating = signal<boolean>(false);
  public readonly routeVisible = signal<boolean>(true);
  public readonly hoveredPoint = signal<RoutePoint | null>(null);
  public readonly pickingTarget = signal<'start' | 'dest' | null>(null);

  public readonly hasRoute = computed(() => !!this.activeRoute());
  public readonly destinationWaypoint = computed(() => this.destWaypoint());

  public setPickingTarget(target: 'start' | 'dest' | null): void {
    this.pickingTarget.set(target);
  }

  public toggleRouteVisible(): void {
    this.routeVisible.update(v => !v);
  }

  public setStart(x: number, z: number, label?: string, y?: number): void {
    const resolvedY = y !== undefined ? y : this.sampleElevationOnly(x, z);
    this.startWaypoint.set({
      id: 'start',
      label: label || `Start (${Math.round(x)}, ${Math.round(resolvedY)}, ${Math.round(z)})`,
      x: Math.round(x),
      z: Math.round(z),
      y: Math.round(resolvedY)
    });
    this.pickingTarget.set(null);
    this.calculateRoute();
  }

  public setDest(x: number, z: number, label?: string, y?: number): void {
    const resolvedY = y !== undefined ? y : this.sampleElevationOnly(x, z);
    this.destWaypoint.set({
      id: 'dest',
      label: label || `Destination (${Math.round(x)}, ${Math.round(resolvedY)}, ${Math.round(z)})`,
      x: Math.round(x),
      z: Math.round(z),
      y: Math.round(resolvedY)
    });
    this.pickingTarget.set(null);
    this.calculateRoute();
  }

  public setWaypointFromCoordinates(target: 'start' | 'dest', x: number, z: number, y?: number): void {
    if (target === 'start') {
      this.setStart(x, z, undefined, y);
    } else {
      this.setDest(x, z, undefined, y);
    }
  }

  public swapWaypoints(): void {
    const a = this.startWaypoint();
    const b = this.destWaypoint();
    if (!a && !b) return;
    this.startWaypoint.set(b);
    this.destWaypoint.set(a);
    this.calculateRoute();
  }

  public setTravelMode(mode: TravelMode): void {
    this.travelMode.set(mode);
    if (mode === 'sailing') {
      this.avoidWater.set(false);
    } else if (mode === 'hiking') {
      this.avoidWater.set(true);
    }
    this.calculateRoute();
  }

  public toggleAvoidCliffs(): void {
    this.avoidCliffs.update(v => !v);
    this.calculateRoute();
  }

  public togglePreferRoads(): void {
    this.preferRoads.update(v => !v);
    this.calculateRoute();
  }

  public toggleAvoidWater(): void {
    this.avoidWater.update(v => !v);
    this.calculateRoute();
  }

  public toggleAvoidLava(): void {
    this.avoidLava.update(v => !v);
    this.calculateRoute();
  }

  public setMiningDepth(depth: number): void {
    this.miningDepth.set(depth);
    if (this.travelMode() === 'mining') {
      this.calculateRoute();
    }
  }

  public clearRoute(): void {
    this.startWaypoint.set(null);
    this.destWaypoint.set(null);
    this.activeRoute.set(null);
    this.hoveredPoint.set(null);
    this.pickingTarget.set(null);
  }

  public calculateRoute(): void {
    const start = this.startWaypoint();
    const dest = this.destWaypoint();
    if (!start || !dest) {
      this.activeRoute.set(null);
      return;
    }

    this.isCalculating.set(true);

    // Run pathfinding on next tick so UI never drops a frame
    setTimeout(() => {
      try {
        const plan = this.computeRoutePlan(start, dest);
        this.activeRoute.set(plan);
      } catch (err) {
        console.warn('Failed to calculate route:', err);
      } finally {
        this.isCalculating.set(false);
      }
    }, 10);
  }

  private sampleElevationOnly(x: number, z: number): number {
    const db = this.mapStore.worldDatabase();
    if (db) {
      const col = lookupWorldColumn(x, z, db);
      if (col) return col.topY;
    }
    const synth = this.mapStore.synthesizer();
    return Math.round(synth.evaluatePoint(x, z).elevation);
  }

  private samplePoint(x: number, z: number, forcedY?: number): {
    y: number;
    nodeName: string;
    biomeName: string;
    isWater: boolean;
    isLava: boolean;
    isRoad: boolean;
  } {
    const db = this.mapStore.worldDatabase();
    const synth = this.mapStore.synthesizer();
    const evalPt = synth.evaluatePoint(x, z);

    let y = forcedY !== undefined ? forcedY : Math.round(evalPt.elevation);
    let nodeName = evalPt.biome.topNode || 'default:dirt_with_grass';
    let isWater = y <= synth.waterLevel;
    let biomeName = evalPt.biome.name || 'Grassland';

    if (forcedY === undefined && db) {
      const col = lookupWorldColumn(x, z, db);
      if (col) {
        y = col.topY;
        nodeName = col.nodeName;
        isWater = col.waterDepth > 0 || nodeName.toLowerCase().includes('water');
      }
    }

    const lower = nodeName.toLowerCase();
    const isLava = lower.includes('lava') || lower.includes('fire');
    const isRoad =
      lower.includes('cobble') ||
      lower.includes('gravel') ||
      lower.includes('wood') ||
      lower.includes('brick') ||
      lower.includes('path') ||
      lower.includes('rail');

    return { y, nodeName, biomeName, isWater, isLava, isRoad };
  }

  private computeRoutePlan(start: RouteWaypoint, dest: RouteWaypoint): RoutePlan {
    const mode = this.travelMode();
    const rawPoints = this.findPathCoords(start.x, start.z, dest.x, dest.z, mode);

    let cumDist = 0;
    let totalClimb = 0;
    let totalDescent = 0;
    let waterCrossings = 0;
    let cliffSections = 0;
    let minY = Infinity;
    let maxY = -Infinity;

    const biomeCounts: Record<string, number> = {};
    const routePoints: RoutePoint[] = [];

    const forcedY = mode === 'mining' ? this.miningDepth() : undefined;

    for (let i = 0; i < rawPoints.length; i++) {
      const pt = rawPoints[i];
      const samp = this.samplePoint(pt.x, pt.z, forcedY);

      if (i > 0) {
        const prev = routePoints[i - 1];
        const stepDist2d = Math.hypot(pt.x - prev.x, pt.z - prev.z);
        const dy = samp.y - prev.y;
        const slopeDeg = stepDist2d > 0 ? (Math.atan(Math.abs(dy) / stepDist2d) * 180) / Math.PI : 0;

        cumDist += stepDist2d;
        if (dy > 0) totalClimb += dy;
        else if (dy < 0) totalDescent += Math.abs(dy);

        if (samp.isWater && !prev.isWater) waterCrossings++;
        if (slopeDeg > 35) cliffSections++;

        const isSteep = slopeDeg > 30;

        routePoints.push({
          x: pt.x,
          z: pt.z,
          y: samp.y,
          distanceFromStart: Math.round(cumDist),
          slopeDeg: Math.round(slopeDeg),
          nodeName: samp.nodeName,
          biomeName: samp.biomeName,
          isWater: samp.isWater,
          isLava: samp.isLava,
          isRoad: samp.isRoad,
          isSteep
        });
      } else {
        routePoints.push({
          x: pt.x,
          z: pt.z,
          y: samp.y,
          distanceFromStart: 0,
          slopeDeg: 0,
          nodeName: samp.nodeName,
          biomeName: samp.biomeName,
          isWater: samp.isWater,
          isLava: samp.isLava,
          isRoad: samp.isRoad,
          isSteep: false
        });
      }

      minY = Math.min(minY, samp.y);
      maxY = Math.max(maxY, samp.y);
      biomeCounts[samp.biomeName] = (biomeCounts[samp.biomeName] || 0) + 1;
    }

    if (minY === Infinity) minY = 0;
    if (maxY === -Infinity) maxY = 0;

    // Calculate speed based on travel mode:
    // Walking ~4.3 m/s; Sailing ~7.0 m/s; Mining ~1.3 m/s; Railway ~8.5 m/s; Direct ~12.0 m/s
    let speedNodesPerSec = 4.3;
    if (mode === 'sailing') speedNodesPerSec = 7.0;
    else if (mode === 'mining') speedNodesPerSec = 1.3;
    else if (mode === 'railway') speedNodesPerSec = 8.5;
    else if (mode === 'direct') speedNodesPerSec = 12.0;

    // Add extra time penalty for vertical climbing (Tobler's hiking adjustment)
    const extraClimbSecs = totalClimb * 0.45;
    const estSeconds = Math.round(cumDist / speedNodesPerSec + extraClimbSecs);

    // Biome distribution breakdown
    const totalSamples = Math.max(1, routePoints.length);
    const biomesTraversed = Object.entries(biomeCounts)
      .map(([biome, count]) => ({
        biome,
        percent: Math.round((count / totalSamples) * 100)
      }))
      .sort((a, b) => b.percent - a.percent);

    // Generate Turn-by-Turn Waypoint Directions
    const directions = this.generateDirections(routePoints, mode);

    return {
      id: `route_${Date.now()}`,
      mode,
      start,
      destination: dest,
      points: routePoints,
      totalDistanceNodes: Math.round(cumDist),
      totalClimbY: Math.round(totalClimb),
      totalDescentY: Math.round(totalDescent),
      minY: Math.round(minY),
      maxY: Math.round(maxY),
      estimatedDurationSeconds: estSeconds,
      waterCrossingsCount: waterCrossings,
      cliffSectionsCount: cliffSections,
      biomesTraversed,
      directions,
      calculatedAt: Date.now()
    };
  }

  private findPathCoords(
    startX: number,
    startZ: number,
    destX: number,
    destZ: number,
    mode: TravelMode
  ): Array<{ x: number; z: number }> {
    // 1. Direct mode or Mining mode: straight geometric interpolation
    if (mode === 'direct' || mode === 'mining') {
      const dist = Math.hypot(destX - startX, destZ - startZ);
      const stepSize = Math.max(8, Math.min(32, Math.round(dist / 40)));
      const steps = Math.max(2, Math.ceil(dist / stepSize));
      const res: Array<{ x: number; z: number }> = [];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        res.push({
          x: Math.round(startX + (destX - startX) * t),
          z: Math.round(startZ + (destZ - startZ) * t)
        });
      }
      return res;
    }

    // 2. Adaptive Step Size for Multi-Scale Hierarchical A*
    const totalDist = Math.hypot(destX - startX, destZ - startZ);
    const step =
      totalDist <= 300 ? 8 : totalDist <= 1200 ? 16 : totalDist <= 3500 ? 32 : 64;

    const startGx = Math.round(startX / step) * step;
    const startGz = Math.round(startZ / step) * step;
    const destGx = Math.round(destX / step) * step;
    const destGz = Math.round(destZ / step) * step;

    if (startGx === destGx && startGz === destGz) {
      return [{ x: startX, z: startZ }, { x: destX, z: destZ }];
    }

    const openHeap = new MinHeap<GridNode>((a, b) => a.f - b.f);
    const closed = new Set<string>();
    const gScore = new Map<string, number>();

    const startNode: GridNode = {
      x: startGx,
      z: startGz,
      g: 0,
      h: Math.hypot(destGx - startGx, destGz - startGz),
      f: Math.hypot(destGx - startGx, destGz - startGz),
      parent: null
    };

    openHeap.push(startNode);
    gScore.set(`${startGx},${startGz}`, 0);

    const avoidCliffs = this.avoidCliffs();
    const preferRoads = this.preferRoads();
    const avoidWater = this.avoidWater();
    const avoidLava = this.avoidLava();

    let bestNode = startNode;
    let closestDistToGoal = startNode.h;
    let iterations = 0;
    const maxIterations = 3200;

    // 8-directional neighbor offsets
    const DIRS = [
      { dx: step, dz: 0, dist: step },
      { dx: -step, dz: 0, dist: step },
      { dx: 0, dz: step, dist: step },
      { dx: 0, dz: -step, dist: step },
      { dx: step, dz: step, dist: step * 1.414 },
      { dx: -step, dz: step, dist: step * 1.414 },
      { dx: step, dz: -step, dist: step * 1.414 },
      { dx: -step, dz: -step, dist: step * 1.414 }
    ];

    while (openHeap.size > 0 && iterations < maxIterations) {
      iterations++;
      const current = openHeap.pop()!;
      const curKey = `${current.x},${current.z}`;

      if (closed.has(curKey)) continue;
      closed.add(curKey);

      // Reached destination grid cell
      const distToGoal = Math.hypot(destGx - current.x, destGz - current.z);
      if (distToGoal < closestDistToGoal) {
        closestDistToGoal = distToGoal;
        bestNode = current;
      }
      if (distToGoal <= step * 0.75) {
        bestNode = current;
        break;
      }

      const curSample = this.samplePoint(current.x, current.z);

      for (const d of DIRS) {
        const nx = current.x + d.dx;
        const nz = current.z + d.dz;
        const nKey = `${nx},${nz}`;
        if (closed.has(nKey)) continue;

        const nextSample = this.samplePoint(nx, nz);
        const dy = nextSample.y - curSample.y;
        const absDy = Math.abs(dy);

        let traversalCost = d.dist;

        if (mode === 'sailing') {
          // Sailing strictly favors water surfaces
          if (!nextSample.isWater) {
            traversalCost *= 45.0; // Heavy land penalty
          } else {
            traversalCost *= 1.0;
          }
        } else if (mode === 'railway') {
          // Railway heavily discounts roads, bridges, and rails
          if (nextSample.isRoad) {
            traversalCost *= 0.25;
          } else {
            traversalCost *= 1.8;
          }
        } else {
          // Hiking Mode (Voxel Slope & Tobler's Hiking function)
          if (avoidCliffs) {
            if (absDy > 5) {
              traversalCost += 400 * (absDy - 4); // Near-impassable cliffs
            } else if (absDy > 2) {
              traversalCost += 50 * absDy; // Steeper rock jump
            }
          }

          // Gentle uphill energy cost
          if (dy > 0) {
            traversalCost += dy * 2.2;
          }

          if (avoidWater && nextSample.isWater) {
            traversalCost *= 7.5; // Walking avoids deep swimming
          }

          if (avoidLava && nextSample.isLava) {
            traversalCost += 25000; // Lethal hazard avoidance
          }

          if (preferRoads && nextSample.isRoad) {
            traversalCost *= 0.55; // Player highway / road speed bonus
          }
        }

        const tentativeG = current.g + traversalCost;
        const prevG = gScore.get(nKey) ?? Infinity;

        if (tentativeG < prevG) {
          gScore.set(nKey, tentativeG);
          const h = Math.hypot(destGx - nx, destGz - nz);
          openHeap.push({
            x: nx,
            z: nz,
            g: tentativeG,
            h,
            f: tentativeG + h * 1.05, // Slight tie-breaking epsilon
            parent: current
          });
        }
      }
    }

    // Backtrack from bestNode to start
    const path: Array<{ x: number; z: number }> = [];
    let curr: GridNode | null = bestNode;
    while (curr) {
      path.push({ x: curr.x, z: curr.z });
      curr = curr.parent;
    }
    path.reverse();

    // Splice exact start and destination coordinates
    path[0] = { x: startX, z: startZ };
    path[path.length - 1] = { x: destX, z: destZ };

    // Subsample/smooth intermediate dense points
    return this.smoothPath(path, mode === 'sailing' ? 24 : 16);
  }

  private smoothPath(
    raw: Array<{ x: number; z: number }>,
    targetSpacing: number
  ): Array<{ x: number; z: number }> {
    if (raw.length <= 2) return raw;

    const smoothed: Array<{ x: number; z: number }> = [raw[0]];
    for (let i = 0; i < raw.length - 1; i++) {
      const p1 = raw[i];
      const p2 = raw[i + 1];
      const segDist = Math.hypot(p2.x - p1.x, p2.z - p1.z);
      const subSegments = Math.max(1, Math.round(segDist / targetSpacing));

      for (let s = 1; s <= subSegments; s++) {
        const t = s / subSegments;
        smoothed.push({
          x: Math.round(p1.x + (p2.x - p1.x) * t),
          z: Math.round(p1.z + (p2.z - p1.z) * t)
        });
      }
    }
    return smoothed;
  }

  private generateDirections(points: RoutePoint[], mode: TravelMode): RouteDirectionStep[] {
    if (points.length < 2) return [];

    const steps: RouteDirectionStep[] = [];
    const first = points[0];
    const last = points[points.length - 1];

    steps.push({
      id: 'step_start',
      text: `Start at (${first.x}, ${first.y}, ${first.z}) in ${first.biomeName}`,
      distance: 0,
      x: first.x,
      z: first.z,
      y: first.y,
      icon: 'straight'
    });

    if (mode === 'mining') {
      steps.push({
        id: 'step_bore',
        text: `Bore horizontal mining shaft at depth Y=${first.y} directly toward destination`,
        distance: last.distanceFromStart,
        x: Math.round((first.x + last.x) / 2),
        z: Math.round((first.z + last.z) / 2),
        y: first.y,
        icon: 'mine'
      });
    } else {
      let lastBearing = Math.atan2(points[1].z - first.z, points[1].x - first.x);
      let stepAccumDist = 0;

      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const cur = points[i];
        const stepDist = cur.distanceFromStart - prev.distanceFromStart;
        stepAccumDist += stepDist;

        const curBearing = Math.atan2(cur.z - prev.z, cur.x - prev.x);
        let angleDiff = curBearing - lastBearing;
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

        const degDiff = (angleDiff * 180) / Math.PI;

        // Detect major turns or milestones every ~200+ nodes
        if (Math.abs(degDiff) > 35 && stepAccumDist >= 120) {
          const isLeft = degDiff < 0;
          const compassDir = this.bearingToCompass(curBearing);
          steps.push({
            id: `step_${i}`,
            text: `Turn ${isLeft ? 'left' : 'right'} heading ${compassDir} through ${cur.biomeName}`,
            distance: Math.round(stepAccumDist),
            x: cur.x,
            z: cur.z,
            y: cur.y,
            icon: isLeft ? 'turn-left' : 'turn-right'
          });
          lastBearing = curBearing;
          stepAccumDist = 0;
        } else if (cur.isWater && !prev.isWater && stepAccumDist >= 60) {
          steps.push({
            id: `step_water_${i}`,
            text: `Cross river / water passage in ${cur.biomeName}`,
            distance: Math.round(stepAccumDist),
            x: cur.x,
            z: cur.z,
            y: cur.y,
            icon: 'water'
          });
          stepAccumDist = 0;
        } else if (cur.y - prev.y > 15 && stepAccumDist >= 80) {
          steps.push({
            id: `step_climb_${i}`,
            text: `Ascend slope to elevation Y=${cur.y}`,
            distance: Math.round(stepAccumDist),
            x: cur.x,
            z: cur.z,
            y: cur.y,
            icon: 'climb'
          });
          stepAccumDist = 0;
        }
      }
    }

    steps.push({
      id: 'step_finish',
      text: `Arrive at destination (${last.x}, ${last.y}, ${last.z})`,
      distance: last.distanceFromStart,
      x: last.x,
      z: last.z,
      y: last.y,
      icon: 'finish'
    });

    return steps;
  }

  private bearingToCompass(rad: number): string {
    // In Luanti: +Z is North, +X is East.
    // rad = atan2(dz, dx): 0 is East (+X), PI/2 is North (+Z)
    const deg = ((rad * 180) / Math.PI + 360) % 360;
    if (deg >= 67.5 && deg < 112.5) return 'North';
    if (deg >= 22.5 && deg < 67.5) return 'North-East';
    if (deg >= 337.5 || deg < 22.5) return 'East';
    if (deg >= 292.5 && deg < 337.5) return 'South-East';
    if (deg >= 247.5 && deg < 292.5) return 'South';
    if (deg >= 202.5 && deg < 247.5) return 'South-West';
    if (deg >= 157.5 && deg < 202.5) return 'West';
    return 'North-West';
  }

  public copyTeleportCommand(point?: RoutePoint | RouteWaypoint): string {
    const target = point || this.destWaypoint();
    if (!target) return '';
    const cmd = `/teleport ${target.x} ${target.y ?? 20} ${target.z}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(cmd);
    }
    return cmd;
  }

  public copyWaypointModCommand(): string {
    const dest = this.destWaypoint();
    if (!dest) return '';
    const label = dest.label.replace(/[^\w\s-]/g, '').trim() || 'Waypoint';
    const cmd = `/waypoint add ${label} ${dest.x} ${dest.y ?? 20} ${dest.z}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(cmd);
    }
    return cmd;
  }
}
