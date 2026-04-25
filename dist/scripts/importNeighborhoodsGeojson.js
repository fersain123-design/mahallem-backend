#!/usr/bin/env npx ts-node
"use strict";
/**
 * importNeighborhoodsGeojson.ts
 *
 * Imports a prepared Turkey neighborhood polygon GeoJSON (FeatureCollection)
 * into the backend's canonical file:
 *   src/data/neighborhoods_tr.geojson
 *
 * Expected per-feature properties:
 *   - name: string
 *   - district: string
 *   - city: string
 *
 * Geometry:
 *   - Polygon or MultiPolygon
 *   - WGS84 / EPSG:4326
 *   - Coordinate order: [lng, lat]
 *
 * Usage:
 *   npx ts-node src/scripts/importNeighborhoodsGeojson.ts <input.geojson>
 *   npm run import:neighborhoods -- <input.geojson>
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const DATA_DIR = path_1.default.join(__dirname, '..', 'data');
const OUTPUT_FILE = path_1.default.join(DATA_DIR, 'neighborhoods_tr.geojson');
const COORD_DECIMALS = Number(process.env.COORD_DECIMALS ?? '6');
function roundCoord(v) {
    const p = 10 ** COORD_DECIMALS;
    return Math.round(v * p) / p;
}
function roundCoordsPolygon(coords) {
    if (!Array.isArray(coords))
        return null;
    const out = [];
    for (const ring of coords) {
        if (!Array.isArray(ring))
            continue;
        const outRing = [];
        for (const p of ring) {
            const lng = Number(p?.[0]);
            const lat = Number(p?.[1]);
            if (!Number.isFinite(lng) || !Number.isFinite(lat))
                continue;
            outRing.push([roundCoord(lng), roundCoord(lat)]);
        }
        if (outRing.length >= 4)
            out.push(outRing);
    }
    return out.length ? out : null;
}
function roundCoordsMultiPolygon(coords) {
    if (!Array.isArray(coords))
        return null;
    const out = [];
    for (const poly of coords) {
        const rounded = roundCoordsPolygon(poly);
        if (rounded)
            out.push(rounded);
    }
    return out.length ? out : null;
}
function main() {
    const inputArg = process.argv[2];
    if (!inputArg) {
        console.error('Usage: importNeighborhoodsGeojson.ts <input.geojson>');
        process.exit(1);
    }
    const inputPath = path_1.default.isAbsolute(inputArg)
        ? inputArg
        : path_1.default.resolve(process.cwd(), inputArg);
    if (!fs_1.default.existsSync(inputPath)) {
        console.error(`Input file not found: ${inputPath}`);
        process.exit(1);
    }
    const raw = fs_1.default.readFileSync(inputPath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed?.type !== 'FeatureCollection' || !Array.isArray(parsed.features)) {
        console.error('Input must be a GeoJSON FeatureCollection');
        process.exit(1);
    }
    const outFeatures = [];
    let skipped = 0;
    for (const f of parsed.features) {
        if (f?.type !== 'Feature') {
            skipped++;
            continue;
        }
        const name = String(f?.properties?.name ?? '').trim();
        const district = String(f?.properties?.district ?? '').trim();
        const city = String(f?.properties?.city ?? '').trim();
        if (!name || !district || !city) {
            skipped++;
            continue;
        }
        const geom = f?.geometry;
        if (!geom || (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon')) {
            skipped++;
            continue;
        }
        if (geom.type === 'Polygon') {
            const rounded = roundCoordsPolygon(geom.coordinates);
            if (!rounded) {
                skipped++;
                continue;
            }
            outFeatures.push({
                type: 'Feature',
                properties: { name, district, city },
                geometry: { type: 'Polygon', coordinates: rounded },
            });
            continue;
        }
        const rounded = roundCoordsMultiPolygon(geom.coordinates);
        if (!rounded) {
            skipped++;
            continue;
        }
        outFeatures.push({
            type: 'Feature',
            properties: { name, district, city },
            geometry: { type: 'MultiPolygon', coordinates: rounded },
        });
    }
    fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
    const fc = {
        type: 'FeatureCollection',
        metadata: {
            source: path_1.default.basename(inputPath),
            importDate: new Date().toISOString(),
            crs: 'EPSG:4326',
            coordOrder: '[lng,lat]',
            coordDecimals: COORD_DECIMALS,
            featureCount: outFeatures.length,
            skipped,
        },
        features: outFeatures,
    };
    fs_1.default.writeFileSync(OUTPUT_FILE, JSON.stringify(fc), 'utf-8');
    const stat = fs_1.default.statSync(OUTPUT_FILE);
    const sizeMB = (stat.size / 1024 / 1024).toFixed(1);
    console.log(`✅ Wrote ${OUTPUT_FILE}`);
    console.log(`   features: ${outFeatures.length} (skipped: ${skipped})`);
    console.log(`   size: ${sizeMB} MB`);
}
main();
