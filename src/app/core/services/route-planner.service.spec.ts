import { describe, it, expect, beforeEach } from 'vitest';
import { RoutePlannerService } from './route-planner.service';
import { MapStore } from '../state/map.store';

describe('RoutePlannerService', () => {
  let service: RoutePlannerService;
  let mapStore: MapStore;

  beforeEach(() => {
    mapStore = new MapStore();
    service = new RoutePlannerService(mapStore);
  });

  it('initializes with default settings', () => {
    expect(service.travelMode()).toBe('hiking');
    expect(service.avoidCliffs()).toBe(true);
    expect(service.avoidWater()).toBe(true);
    expect(service.startWaypoint()).toBeNull();
    expect(service.destWaypoint()).toBeNull();
    expect(service.activeRoute()).toBeNull();
  });

  it('sets start and destination waypoints and calculates route', async () => {
    service.setStart(0, 0, 'Spawn');
    service.setDest(200, 200, 'Village');

    expect(service.startWaypoint()).not.toBeNull();
    expect(service.destWaypoint()).not.toBeNull();
    expect(service.startWaypoint()?.x).toBe(0);
    expect(service.destWaypoint()?.x).toBe(200);

    // Wait for the route calculation setTimeout
    await new Promise(resolve => setTimeout(resolve, 60));

    const route = service.activeRoute();
    expect(route).not.toBeNull();
    expect(route?.points.length).toBeGreaterThan(1);
    expect(route?.totalDistanceNodes).toBeGreaterThan(0);
    expect(route?.estimatedDurationSeconds).toBeGreaterThan(0);
  });

  it('swaps start and destination waypoints cleanly', () => {
    service.setStart(10, 20, 'Point A');
    service.setDest(100, 200, 'Point B');

    service.swapWaypoints();
    expect(service.startWaypoint()?.label).toBe('Point B');
    expect(service.destWaypoint()?.label).toBe('Point A');
  });

  it('formats in-game /teleport and /waypoint commands', () => {
    service.setDest(500, -300, 'Mountain Base', 45);
    const tp = service.copyTeleportCommand();
    expect(tp).toBe('/teleport 500 45 -300');

    const wp = service.copyWaypointModCommand();
    expect(wp).toBe('/waypoint add Mountain Base 500 45 -300');
  });

  it('adjusts avoidWater automatically when switching to sailing mode', () => {
    service.setTravelMode('sailing');
    expect(service.travelMode()).toBe('sailing');
    expect(service.avoidWater()).toBe(false);

    service.setTravelMode('hiking');
    expect(service.travelMode()).toBe('hiking');
    expect(service.avoidWater()).toBe(true);
  });
});
