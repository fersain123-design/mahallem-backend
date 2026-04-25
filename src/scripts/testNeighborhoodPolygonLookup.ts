#!/usr/bin/env npx ts-node
/**
 * testNeighborhoodPolygonLookup.ts
 *
 * Quick sanity tests for backend neighborhood polygon lookup:
 * - Loads the configured GeoJSON file (sample or full).
 * - Picks an interior point for each polygon (best-effort).
 * - Ensures `findNeighborhoodByCoordinate` resolves back to the same feature.
 *
 * Usage:
 *   npx ts-node src/scripts/testNeighborhoodPolygonLookup.ts
 */

import {
  findNeighborhoodByCoordinate,
  getAllNeighborhoodPolygons,
  getPolygonServiceStatus,
} from '../data/neighborhoodPolygonService';

type Geometry =
  | { type: 'Polygon'; coordinates: number[][][] }
  | { type: 'MultiPolygon'; coordinates: number[][][][] };

const EPS = 1e-12;

function pointOnSegment(lat: number, lng: number, a: number[], b: number[]): boolean {
  const x1 = a[0], y1 = a[1];
  const x2 = b[0], y2 = b[1];

  if (
    lng < Math.min(x1, x2) - EPS ||
    lng > Math.max(x1, x2) + EPS ||
    lat < Math.min(y1, y2) - EPS ||
    lat > Math.max(y1, y2) + EPS
  ) {
    return false;
  }

  const cross = (lng - x1) * (y2 - y1) - (lat - y1) * (x2 - x1);
  if (Math.abs(cross) > EPS) return false;
  const dot = (lng - x1) * (lng - x2) + (lat - y1) * (lat - y2);
  return dot <= EPS;
}

function pointInRing(lat: number, lng: number, ring: number[][]): boolean {
  let inside = false;
  const n = ring.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];

    if (pointOnSegment(lat, lng, [xi, yi], [xj, yj])) return true;

    const intersect = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInPolygon(lat: number, lng: number, coords: number[][][]): boolean {
  if (!coords?.[0]?.length) return false;
  if (!pointInRing(lat, lng, coords[0])) return false;
  for (let i = 1; i < coords.length; i++) {
    if (pointInRing(lat, lng, coords[i])) return false;
  }
  return true;
}

function pointInGeometry(lat: number, lng: number, g: Geometry): boolean {
  if (g.type === 'Polygon') return pointInPolygon(lat, lng, g.coordinates);
  for (const poly of g.coordinates) {
    if (pointInPolygon(lat, lng, poly)) return true;
  }
  return false;
}

function computeBBoxFromOuterRing(ring: number[][]): [number, number, number, number] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}

function pickInteriorPoint(g: Geometry): { lat: number; lng: number } | null {
  const outerRing =
    g.type === 'Polygon' ? g.coordinates?.[0] : g.coordinates?.[0]?.[0];
  if (!outerRing || outerRing.length < 4) return null;

  const [minX, minY, maxX, maxY] = computeBBoxFromOuterRing(outerRing);
  const center = { lat: (minY + maxY) / 2, lng: (minX + maxX) / 2 };
  if (pointInGeometry(center.lat, center.lng, g)) return center;

  // Random sampling inside bbox
  for (let i = 0; i < 30; i++) {
    const lat = minY + Math.random() * (maxY - minY);
    const lng = minX + Math.random() * (maxX - minX);
    if (pointInGeometry(lat, lng, g)) return { lat, lng };
  }

  // Fallback to first vertex (boundary should count as inside)
  const v = outerRing[0];
  return { lat: v[1], lng: v[0] };
}

async function main() {
  const status = getPolygonServiceStatus();
  console.log('[test] Polygon service status:', status);

  const fc = getAllNeighborhoodPolygons();
  const features = Array.isArray(fc.features) ? fc.features : [];
  console.log('[test] Features loaded:', features.length);

  let ok = 0;
  let fail = 0;
  const failures: Array<{ expected: string; got: string | null; lat: number; lng: number }> = [];

  for (const f of features as any[]) {
    const expected = String(f?.properties?.name || '').trim();
    const g = f?.geometry as Geometry | undefined;
    if (!expected || !g) continue;

    const p = pickInteriorPoint(g);
    if (!p) continue;

    const match = findNeighborhoodByCoordinate(p.lat, p.lng);
    const got = match?.name ? String(match.name).trim() : null;
    if (got === expected) {
      ok++;
    } else {
      fail++;
      if (failures.length < 10) failures.push({ expected, got, lat: p.lat, lng: p.lng });
    }
  }

  console.log('[test] OK:', ok);
  console.log('[test] FAIL:', fail);
  if (failures.length) {
    console.log('[test] Sample mismatches:');
    for (const f of failures) {
      console.log(`  - expected=${f.expected} got=${f.got} @ ${f.lat.toFixed(6)},${f.lng.toFixed(6)}`);
    }
  }

  process.exit(fail === 0 ? 0 : 2);
}

main().catch((e) => {
  console.error('[test] Error:', e);
  process.exit(1);
});

