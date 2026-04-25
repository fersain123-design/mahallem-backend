#!/usr/bin/env npx ts-node
/**
 * validateNeighborhoodGeojson.ts
 *
 * Offline integrity checks (and optional normalization) for neighborhood GeoJSON files.
 *
 * Usage:
 *   npx ts-node src/scripts/validateNeighborhoodGeojson.ts
 *   npx ts-node src/scripts/validateNeighborhoodGeojson.ts --in src/data/neighborhoods_tr.geojson
 *   npx ts-node src/scripts/validateNeighborhoodGeojson.ts --fix --out src/data/neighborhoods_tr.normalized.geojson
 *
 * Notes:
 * - GeoJSON expects coordinates as [lng, lat].
 * - The backend polygon service also normalizes rings at load time; this script helps verify datasets upfront.
 */

import fs from 'fs';
import path from 'path';

type Geometry =
  | { type: 'Polygon'; coordinates: number[][][] }
  | { type: 'MultiPolygon'; coordinates: number[][][][] };

type Feature = {
  type: 'Feature';
  properties?: any;
  geometry?: Geometry;
};

type FeatureCollection = {
  type: 'FeatureCollection';
  features: Feature[];
};

const TR_BOUNDS = {
  minLat: 34.5,
  maxLat: 43.8,
  minLng: 24.5,
  maxLng: 45.5,
};

function parseArgs(argv: string[]) {
  const args = new Map<string, string | boolean>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args.set(key, true);
    } else {
      args.set(key, next);
      i++;
    }
  }
  return args;
}

function isLikelyTrLngLat(lng: number, lat: number): boolean {
  return (
    lat >= TR_BOUNDS.minLat &&
    lat <= TR_BOUNDS.maxLat &&
    lng >= TR_BOUNDS.minLng &&
    lng <= TR_BOUNDS.maxLng
  );
}

function scoreRingTurkeyFit(ring: number[][], swap: boolean): number {
  let score = 0;
  for (const p of ring) {
    const x = Number(p?.[0]);
    const y = Number(p?.[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const lng = swap ? y : x;
    const lat = swap ? x : y;
    if (isLikelyTrLngLat(lng, lat)) score++;
  }
  return score;
}

function normalizeRing(ring: number[][]) {
  if (!Array.isArray(ring) || ring.length < 3) return { ring: null as number[][] | null, swapped: false, closed: false };

  const cleaned: number[][] = [];
  for (const p of ring) {
    const x = Number(p?.[0]);
    const y = Number(p?.[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const prev = cleaned[cleaned.length - 1];
    if (prev && Math.abs(prev[0] - x) < 1e-12 && Math.abs(prev[1] - y) < 1e-12) continue;
    cleaned.push([x, y]);
  }

  if (cleaned.length < 3) return { ring: null, swapped: false, closed: false };

  const scoreNormal = scoreRingTurkeyFit(cleaned, false);
  const scoreSwapped = scoreRingTurkeyFit(cleaned, true);
  const swapped = scoreSwapped > scoreNormal && scoreSwapped >= Math.min(10, Math.ceil(cleaned.length * 0.6));

  const out = swapped ? cleaned.map(([x, y]) => [y, x]) : cleaned;

  const first = out[0];
  const last = out[out.length - 1];
  const closed = Math.abs(first[0] - last[0]) < 1e-12 && Math.abs(first[1] - last[1]) < 1e-12;
  if (!closed) out.push([first[0], first[1]]);

  return { ring: out.length >= 4 ? out : null, swapped, closed };
}

function normalizeGeometry(g: Geometry) {
  if (g.type === 'Polygon') {
    const rings: number[][][] = [];
    let swappedAny = false;
    let unclosedAny = false;
    for (const r of g.coordinates || []) {
      const nr = normalizeRing(r);
      if (nr.swapped) swappedAny = true;
      if (!nr.closed) unclosedAny = true;
      if (nr.ring) rings.push(nr.ring);
    }
    return { geometry: rings.length ? ({ type: 'Polygon', coordinates: rings } as Geometry) : null, swappedAny, unclosedAny };
  }

  const polys: number[][][][] = [];
  let swappedAny = false;
  let unclosedAny = false;
  for (const poly of g.coordinates || []) {
    const rings: number[][][] = [];
    for (const r of poly || []) {
      const nr = normalizeRing(r);
      if (nr.swapped) swappedAny = true;
      if (!nr.closed) unclosedAny = true;
      if (nr.ring) rings.push(nr.ring);
    }
    if (rings.length) polys.push(rings);
  }
  return { geometry: polys.length ? ({ type: 'MultiPolygon', coordinates: polys } as Geometry) : null, swappedAny, unclosedAny };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const projectRoot = path.join(__dirname, '..', '..');
  const defaultInCandidates = [
    path.join(projectRoot, 'src', 'data', 'neighborhoods_tr.geojson'),
    path.join(projectRoot, 'src', 'data', 'neighborhoods.geojson'),
  ];

  const inArg = args.get('in');
  const fix = args.get('fix') === true;
  const outArg = args.get('out');

  const inputPath =
    typeof inArg === 'string'
      ? path.isAbsolute(inArg)
        ? inArg
        : path.join(projectRoot, inArg)
      : defaultInCandidates.find((p) => fs.existsSync(p));

  if (!inputPath || !fs.existsSync(inputPath)) {
    console.error('[validate] No input GeoJSON found.');
    process.exit(1);
  }

  const raw = fs.readFileSync(inputPath, 'utf8');
  const fc = JSON.parse(raw) as FeatureCollection;

  if (fc?.type !== 'FeatureCollection' || !Array.isArray(fc.features)) {
    console.error('[validate] Invalid FeatureCollection:', inputPath);
    process.exit(1);
  }

  let total = 0;
  let invalidGeom = 0;
  let invalidAfterFix = 0;
  let swappedGuess = 0;
  let unclosedRings = 0;

  const normalizedFeatures: Feature[] = [];

  for (const f of fc.features) {
    total++;
    const g = f.geometry;
    if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) {
      invalidGeom++;
      continue;
    }

    const norm = normalizeGeometry(g);
    if (norm.swappedAny) swappedGuess++;
    if (norm.unclosedAny) unclosedRings++;

    if (fix) {
      if (!norm.geometry) {
        invalidAfterFix++;
        continue;
      }
      normalizedFeatures.push({ ...f, geometry: norm.geometry });
    }
  }

  console.log('[validate] File:', inputPath);
  console.log('[validate] Features:', total);
  console.log('[validate] Invalid geometry:', invalidGeom);
  console.log('[validate] Rings not closed (detected):', unclosedRings);
  console.log('[validate] Likely lat/lng swapped (detected):', swappedGuess);

  if (fix) {
    const outPath =
      typeof outArg === 'string'
        ? path.isAbsolute(outArg)
          ? outArg
          : path.join(projectRoot, outArg)
        : path.join(path.dirname(inputPath), path.basename(inputPath, '.geojson') + '.normalized.geojson');

    const outFc: FeatureCollection = { ...fc, features: normalizedFeatures };
    fs.writeFileSync(outPath, JSON.stringify(outFc));
    console.log('[validate] Written:', outPath);
    console.log('[validate] Dropped features during fix:', invalidAfterFix);
  }
}

main();

