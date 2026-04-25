"use strict";
/**
 * neighborhoodPolygonService.ts  –  Enterprise-grade edition
 *
 * Serves Turkish neighborhood polygon data from GeoJSON with:
 *   ✅ R-tree spatial index (rbush) for O(log n) lookups
 *   ✅ Server-side point-in-polygon (ray-casting)
 *   ✅ Memory cache with infinite TTL (reloadable)
 *   ✅ Multiple GeoJSON source support (full Turkey or sample)
 *   ✅ <50ms lookup for any coordinate in Turkey
 *
 * GeoJSON files (tried in order):
 *   1. src/data/neighborhoods_tr.geojson  (full Turkey dataset from Overpass)
 *   2. src/data/neighborhoods.geojson     (sample / fallback)
 *
 * To populate with real data, run:
 *   npx ts-node src/scripts/downloadTurkeyNeighborhoods.ts
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.findNeighborhoodByCoordinate = findNeighborhoodByCoordinate;
exports.getNearbyNeighborhoodPolygons = getNearbyNeighborhoodPolygons;
exports.getAllNeighborhoodPolygons = getAllNeighborhoodPolygons;
exports.getDistanceToNeighborhoodBoundaryKm = getDistanceToNeighborhoodBoundaryKm;
exports.getDistanceToNeighborhoodBoundaryUsingReferencePointKm = getDistanceToNeighborhoodBoundaryUsingReferencePointKm;
exports.getDistanceToBoundaryOfNeighborhoodContainingPointKm = getDistanceToBoundaryOfNeighborhoodContainingPointKm;
exports.getDistanceToBoundaryOfNearestNeighborhoodToReferencePointKm = getDistanceToBoundaryOfNearestNeighborhoodToReferencePointKm;
exports.reloadPolygonData = reloadPolygonData;
exports.getPolygonCount = getPolygonCount;
exports.getPolygonServiceStatus = getPolygonServiceStatus;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const rbush_1 = __importDefault(require("rbush"));
const trNormalize_1 = require("../utils/trNormalize");
const TR_BOUNDS = {
    minLat: 34.5,
    maxLat: 43.8,
    minLng: 24.5,
    maxLng: 45.5,
};
/* ── Singleton state ──────────────────────────────────────────────────── */
let features = [];
let tree = new rbush_1.default();
let featureIdxByNeighborhood = new Map();
let loaded = false;
let loadedFile = '';
let loadTimeMs = 0;
/* ── Geometry helpers ─────────────────────────────────────────────────── */
function isLikelyTrLngLat(lng, lat) {
    return (lat >= TR_BOUNDS.minLat &&
        lat <= TR_BOUNDS.maxLat &&
        lng >= TR_BOUNDS.minLng &&
        lng <= TR_BOUNDS.maxLng);
}
function scoreRingTurkeyFit(ring, swap) {
    let score = 0;
    for (const p of ring) {
        const x = Number(p?.[0]);
        const y = Number(p?.[1]);
        if (!Number.isFinite(x) || !Number.isFinite(y))
            continue;
        const lng = swap ? y : x;
        const lat = swap ? x : y;
        if (isLikelyTrLngLat(lng, lat))
            score++;
    }
    return score;
}
function normalizeRing(ring) {
    if (!Array.isArray(ring) || ring.length < 3)
        return null;
    const cleaned = [];
    for (const p of ring) {
        const x = Number(p?.[0]);
        const y = Number(p?.[1]);
        if (!Number.isFinite(x) || !Number.isFinite(y))
            continue;
        const prev = cleaned[cleaned.length - 1];
        if (prev && Math.abs(prev[0] - x) < 1e-12 && Math.abs(prev[1] - y) < 1e-12)
            continue;
        cleaned.push([x, y]);
    }
    if (cleaned.length < 3)
        return null;
    const scoreNormal = scoreRingTurkeyFit(cleaned, false);
    const scoreSwapped = scoreRingTurkeyFit(cleaned, true);
    const shouldSwap = scoreSwapped > scoreNormal && scoreSwapped >= Math.min(10, Math.ceil(cleaned.length * 0.6));
    if (shouldSwap) {
        for (let i = 0; i < cleaned.length; i++) {
            const [x, y] = cleaned[i];
            cleaned[i] = [y, x];
        }
    }
    const first = cleaned[0];
    const last = cleaned[cleaned.length - 1];
    if (Math.abs(first[0] - last[0]) > 1e-12 || Math.abs(first[1] - last[1]) > 1e-12) {
        cleaned.push([first[0], first[1]]);
    }
    return cleaned.length >= 4 ? cleaned : null;
}
function normalizePolygonCoordinates(coords) {
    if (!Array.isArray(coords) || coords.length === 0)
        return null;
    const out = [];
    for (let i = 0; i < coords.length; i++) {
        const ring = normalizeRing(coords[i]);
        if (!ring)
            continue;
        out.push(ring);
    }
    if (out.length === 0)
        return null;
    if (out[0].length < 4)
        return null;
    return out;
}
function normalizeMultiPolygonCoordinates(coords) {
    if (!Array.isArray(coords) || coords.length === 0)
        return null;
    const out = [];
    for (const poly of coords) {
        const normalized = normalizePolygonCoordinates(poly);
        if (normalized)
            out.push(normalized);
    }
    return out.length ? out : null;
}
function normalizeFeature(f) {
    try {
        const geom = f.geometry;
        if (!geom || !geom.coordinates)
            return null;
        if (geom.type === 'Polygon') {
            const normalized = normalizePolygonCoordinates(geom.coordinates);
            if (!normalized)
                return null;
            return { ...f, geometry: { type: 'Polygon', coordinates: normalized } };
        }
        if (geom.type === 'MultiPolygon') {
            const normalized = normalizeMultiPolygonCoordinates(geom.coordinates);
            if (!normalized)
                return null;
            return { ...f, geometry: { type: 'MultiPolygon', coordinates: normalized } };
        }
        return null;
    }
    catch {
        return null;
    }
}
function computeBBox(feature) {
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    const processRing = (ring) => {
        for (const [lng, lat] of ring) {
            if (lng < minLng)
                minLng = lng;
            if (lng > maxLng)
                maxLng = lng;
            if (lat < minLat)
                minLat = lat;
            if (lat > maxLat)
                maxLat = lat;
        }
    };
    const geom = feature.geometry;
    if (geom.type === 'Polygon') {
        const coords = geom.coordinates;
        if (coords[0])
            processRing(coords[0]);
    }
    else if (geom.type === 'MultiPolygon') {
        const coords = geom.coordinates;
        for (const poly of coords) {
            if (poly[0])
                processRing(poly[0]);
        }
    }
    return [minLng, minLat, maxLng, maxLat];
}
/* ── Ray-casting point-in-polygon ─────────────────────────────────────
 *  Server-side geometry tests so polygon matching can run without client.
 * ──────────────────────────────────────────────────────────────────────── */
function pointInRing(lat, lng, ring) {
    const eps = 1e-12;
    const pointOnSegment = (a, b) => {
        const x1 = a[0], y1 = a[1];
        const x2 = b[0], y2 = b[1];
        if (lng < Math.min(x1, x2) - eps ||
            lng > Math.max(x1, x2) + eps ||
            lat < Math.min(y1, y2) - eps ||
            lat > Math.max(y1, y2) + eps) {
            return false;
        }
        const cross = (lng - x1) * (y2 - y1) - (lat - y1) * (x2 - x1);
        if (Math.abs(cross) > eps)
            return false;
        const dot = (lng - x1) * (lng - x2) + (lat - y1) * (lat - y2);
        return dot <= eps;
    };
    let inside = false;
    const n = ring.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
        const yi = ring[i][1], xi = ring[i][0];
        const yj = ring[j][1], xj = ring[j][0];
        if (pointOnSegment([xi, yi], [xj, yj]))
            return true;
        const intersect = yi > lat !== yj > lat &&
            lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
        if (intersect)
            inside = !inside;
    }
    return inside;
}
function pointInPolygon(lat, lng, coordinates) {
    if (!pointInRing(lat, lng, coordinates[0]))
        return false;
    // Holes: if point is in any hole, it's outside the polygon
    for (let i = 1; i < coordinates.length; i++) {
        if (pointInRing(lat, lng, coordinates[i]))
            return false;
    }
    return true;
}
function pointInMultiPolygon(lat, lng, coordinates) {
    for (const polygon of coordinates) {
        if (pointInPolygon(lat, lng, polygon))
            return true;
    }
    return false;
}
function pointInFeature(lat, lng, feature) {
    const { type, coordinates } = feature.geometry;
    if (type === 'Polygon')
        return pointInPolygon(lat, lng, coordinates);
    if (type === 'MultiPolygon')
        return pointInMultiPolygon(lat, lng, coordinates);
    return false;
}
function projectToLocalKm(lat, lng, originLat, originLng) {
    const meanLatRad = ((lat + originLat) / 2) * (Math.PI / 180);
    const xKm = (lng - originLng) * 111.32 * Math.cos(meanLatRad);
    const yKm = (lat - originLat) * 110.574;
    return { xKm, yKm };
}
function pointToSegmentDistanceKm(px, py, ax, ay, bx, by) {
    const vx = bx - ax;
    const vy = by - ay;
    const wx = px - ax;
    const wy = py - ay;
    const len2 = vx * vx + vy * vy;
    if (len2 <= 1e-15) {
        return Math.hypot(px - ax, py - ay);
    }
    const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2));
    const cx = ax + t * vx;
    const cy = ay + t * vy;
    return Math.hypot(px - cx, py - cy);
}
function featureBoundaryDistanceKm(lat, lng, feature) {
    if (pointInFeature(lat, lng, feature)) {
        return 0;
    }
    const rings = [];
    if (feature.geometry.type === 'Polygon') {
        rings.push(...feature.geometry.coordinates);
    }
    else {
        for (const polygon of feature.geometry.coordinates) {
            rings.push(...polygon);
        }
    }
    let minKm = Infinity;
    for (const ring of rings) {
        if (!Array.isArray(ring) || ring.length < 2)
            continue;
        for (let i = 0; i < ring.length - 1; i++) {
            const a = ring[i];
            const b = ring[i + 1];
            if (!a || !b)
                continue;
            const ap = projectToLocalKm(a[1], a[0], lat, lng);
            const bp = projectToLocalKm(b[1], b[0], lat, lng);
            const d = pointToSegmentDistanceKm(0, 0, ap.xKm, ap.yKm, bp.xKm, bp.yKm);
            if (d < minKm)
                minKm = d;
        }
    }
    return Number.isFinite(minKm) ? minKm : Infinity;
}
/* ── GeoJSON loading + R-tree indexing ────────────────────────────────── */
function loadGeoJSON() {
    if (loaded)
        return;
    const start = Date.now();
    const envPathRaw = String(process.env.NEIGHBORHOODS_GEOJSON_PATH || '').trim();
    const envPath = envPathRaw
        ? (path_1.default.isAbsolute(envPathRaw) ? envPathRaw : path_1.default.resolve(process.cwd(), envPathRaw))
        : '';
    // Try full dataset first, fall back to sample
    const candidates = [
        envPath,
        path_1.default.join(__dirname, 'neighborhoods_tr.geojson'),
        path_1.default.join(__dirname, 'neighborhoods-tr.geojson'),
        path_1.default.join(__dirname, 'tr_neighborhoods.geojson'),
        path_1.default.join(__dirname, 'neighborhoods.geojson'),
        path_1.default.resolve(process.cwd(), 'src', 'data', 'neighborhoods_tr.geojson'),
        path_1.default.resolve(process.cwd(), 'src', 'data', 'neighborhoods.geojson'),
    ];
    let geojsonPath = '';
    for (const p of candidates) {
        if (fs_1.default.existsSync(p)) {
            geojsonPath = p;
            break;
        }
    }
    if (!geojsonPath) {
        console.warn('[PolygonService] No GeoJSON file found. Tried:', candidates.map((p) => path_1.default.basename(p)).join(', '), '— polygon matching disabled.');
        loaded = true;
        return;
    }
    try {
        const raw = fs_1.default.readFileSync(geojsonPath, 'utf-8');
        const fc = JSON.parse(raw);
        if (fc?.type !== 'FeatureCollection' || !Array.isArray(fc.features)) {
            console.warn('[PolygonService] Invalid GeoJSON format in', path_1.default.basename(geojsonPath));
            loaded = true;
            return;
        }
        // Filter + normalize features (ring closure, de-dup, lat/lng swap repair)
        features = fc.features
            .filter((f) => f?.type === 'Feature' &&
            f?.properties?.name &&
            f?.geometry?.coordinates &&
            (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'))
            .map((f) => normalizeFeature(f))
            .filter(Boolean);
        // Build R-tree index
        tree = new rbush_1.default();
        featureIdxByNeighborhood = new Map();
        const items = [];
        for (let i = 0; i < features.length; i++) {
            const [minLng, minLat, maxLng, maxLat] = computeBBox(features[i]);
            if (!Number.isFinite(minLng))
                continue;
            items.push({
                minX: minLng,
                minY: minLat,
                maxX: maxLng,
                maxY: maxLat,
                idx: i,
            });
            const nKey = (0, trNormalize_1.normalizeTrForCompare)(features[i]?.properties?.name || '');
            if (nKey) {
                const list = featureIdxByNeighborhood.get(nKey) || [];
                list.push(i);
                featureIdxByNeighborhood.set(nKey, list);
            }
        }
        tree.load(items); // Bulk-load for optimal tree structure
        loadedFile = geojsonPath;
        loadTimeMs = Date.now() - start;
        console.log(`[PolygonService] ✅ Loaded ${features.length} polygons from ${path_1.default.basename(geojsonPath)} ` +
            `(R-tree indexed in ${loadTimeMs}ms)`);
    }
    catch (err) {
        console.error('[PolygonService] Failed to load GeoJSON:', err);
    }
    loaded = true;
}
/* ── Public API ────────────────────────────────────────────────────────── */
/**
 * Find the neighborhood that contains the given coordinate.
 * Uses R-tree for O(log n) candidate lookup + ray-casting for exact test.
 *
 * @returns Matching neighborhood or null
 */
function findNeighborhoodByCoordinate(lat, lng) {
    loadGeoJSON();
    if (features.length === 0)
        return null;
    // R-tree point query: find all bboxes containing the point
    const candidates = tree.search({
        minX: lng,
        minY: lat,
        maxX: lng,
        maxY: lat,
    });
    // Ray-casting on candidates only (typically 1-5 instead of 50k+)
    for (const item of candidates) {
        const feature = features[item.idx];
        if (!feature)
            continue;
        if (pointInFeature(lat, lng, feature)) {
            const props = feature.properties;
            return {
                name: props.name,
                district: props.district,
                city: props.city,
                postalCode: props.postalCode,
            };
        }
    }
    return null;
}
/**
 * Get neighborhood polygons near a coordinate.
 * Returns features whose R-tree bounding box intersects the search area.
 */
function getNearbyNeighborhoodPolygons(lat, lng, radiusDeg = 0.1) {
    loadGeoJSON();
    const candidates = tree.search({
        minX: lng - radiusDeg,
        minY: lat - radiusDeg,
        maxX: lng + radiusDeg,
        maxY: lat + radiusDeg,
    });
    return {
        type: 'FeatureCollection',
        features: candidates.map((item) => features[item.idx]).filter(Boolean),
    };
}
/**
 * Get ALL loaded neighborhood polygons (admin/debug).
 */
function getAllNeighborhoodPolygons() {
    loadGeoJSON();
    return { type: 'FeatureCollection', features };
}
function getDistanceToNeighborhoodBoundaryKm(params) {
    loadGeoJSON();
    if (features.length === 0)
        return null;
    const nKey = (0, trNormalize_1.normalizeTrForCompare)(params.neighborhood || '');
    if (!nKey)
        return null;
    const dKey = (0, trNormalize_1.normalizeTrForCompare)(params.district || '');
    const cKey = (0, trNormalize_1.normalizeTrForCompare)(params.city || '');
    const candidateIdx = featureIdxByNeighborhood.get(nKey) || [];
    if (candidateIdx.length === 0)
        return null;
    const scoped = candidateIdx.filter((idx) => {
        const f = features[idx];
        if (!f)
            return false;
        const featureDistrict = (0, trNormalize_1.normalizeTrForCompare)(f.properties?.district || '');
        const featureCity = (0, trNormalize_1.normalizeTrForCompare)(f.properties?.city || '');
        if (dKey && dKey !== featureDistrict)
            return false;
        if (cKey && cKey !== featureCity)
            return false;
        return true;
    });
    if ((dKey || cKey) && scoped.length === 0) {
        return null;
    }
    const toCheck = scoped.length > 0 ? scoped : candidateIdx;
    let minKm = Infinity;
    for (const idx of toCheck) {
        const feature = features[idx];
        if (!feature)
            continue;
        const distanceKm = featureBoundaryDistanceKm(params.lat, params.lng, feature);
        if (distanceKm < minKm)
            minKm = distanceKm;
    }
    if (!Number.isFinite(minKm))
        return null;
    return Number(minKm.toFixed(3));
}
function getDistanceToNeighborhoodBoundaryUsingReferencePointKm(params) {
    loadGeoJSON();
    if (features.length === 0)
        return null;
    const nKey = (0, trNormalize_1.normalizeTrForCompare)(params.neighborhood || '');
    if (!nKey)
        return null;
    const dKey = (0, trNormalize_1.normalizeTrForCompare)(params.district || '');
    const cKey = (0, trNormalize_1.normalizeTrForCompare)(params.city || '');
    const candidateIdx = featureIdxByNeighborhood.get(nKey) || [];
    if (candidateIdx.length === 0)
        return null;
    const scoped = candidateIdx.filter((idx) => {
        const f = features[idx];
        if (!f)
            return false;
        const featureDistrict = (0, trNormalize_1.normalizeTrForCompare)(f.properties?.district || '');
        const featureCity = (0, trNormalize_1.normalizeTrForCompare)(f.properties?.city || '');
        if (dKey && dKey !== featureDistrict)
            return false;
        if (cKey && cKey !== featureCity)
            return false;
        return true;
    });
    if ((dKey || cKey) && scoped.length === 0) {
        return null;
    }
    const toCheck = scoped.length > 0 ? scoped : candidateIdx;
    let selectedFeature = null;
    let selectedRefDistance = Infinity;
    for (const idx of toCheck) {
        const feature = features[idx];
        if (!feature)
            continue;
        const refDistance = featureBoundaryDistanceKm(params.referenceLat, params.referenceLng, feature);
        if (refDistance < selectedRefDistance) {
            selectedRefDistance = refDistance;
            selectedFeature = feature;
        }
    }
    if (!selectedFeature || !Number.isFinite(selectedRefDistance)) {
        return null;
    }
    const targetDistance = featureBoundaryDistanceKm(params.targetLat, params.targetLng, selectedFeature);
    if (!Number.isFinite(targetDistance))
        return null;
    return Number(targetDistance.toFixed(3));
}
function getDistanceToBoundaryOfNeighborhoodContainingPointKm(params) {
    loadGeoJSON();
    if (features.length === 0)
        return null;
    const candidates = tree.search({
        minX: params.referenceLng,
        minY: params.referenceLat,
        maxX: params.referenceLng,
        maxY: params.referenceLat,
    });
    const containing = [];
    for (const item of candidates) {
        const feature = features[item.idx];
        if (!feature)
            continue;
        if (pointInFeature(params.referenceLat, params.referenceLng, feature)) {
            containing.push(feature);
        }
    }
    if (containing.length === 0) {
        return null;
    }
    let minKm = Infinity;
    for (const feature of containing) {
        const d = featureBoundaryDistanceKm(params.targetLat, params.targetLng, feature);
        if (d < minKm)
            minKm = d;
    }
    if (!Number.isFinite(minKm))
        return null;
    return Number(minKm.toFixed(3));
}
function getDistanceToBoundaryOfNearestNeighborhoodToReferencePointKm(params) {
    loadGeoJSON();
    if (features.length === 0)
        return null;
    const radiusDegSteps = [0.03, 0.06, 0.12, 0.25, 0.5, 1.0];
    let candidateItems = [];
    for (const radiusDeg of radiusDegSteps) {
        const found = tree.search({
            minX: params.referenceLng - radiusDeg,
            minY: params.referenceLat - radiusDeg,
            maxX: params.referenceLng + radiusDeg,
            maxY: params.referenceLat + radiusDeg,
        });
        if (found.length > 0) {
            candidateItems = found;
            break;
        }
    }
    if (candidateItems.length === 0) {
        return null;
    }
    let selectedFeature = null;
    let selectedRefDistance = Infinity;
    for (const item of candidateItems) {
        const feature = features[item.idx];
        if (!feature)
            continue;
        const refDistance = featureBoundaryDistanceKm(params.referenceLat, params.referenceLng, feature);
        if (refDistance < selectedRefDistance) {
            selectedRefDistance = refDistance;
            selectedFeature = feature;
        }
    }
    if (!selectedFeature || !Number.isFinite(selectedRefDistance)) {
        return null;
    }
    const targetDistance = featureBoundaryDistanceKm(params.targetLat, params.targetLng, selectedFeature);
    if (!Number.isFinite(targetDistance))
        return null;
    return Number(targetDistance.toFixed(3));
}
/**
 * Reload GeoJSON data from disk. Rebuilds R-tree.
 */
function reloadPolygonData() {
    loaded = false;
    features = [];
    tree = new rbush_1.default();
    featureIdxByNeighborhood = new Map();
    loadGeoJSON();
}
/**
 * Get polygon count for health checks.
 */
function getPolygonCount() {
    loadGeoJSON();
    return features.length;
}
/**
 * Get service status for diagnostics.
 */
function getPolygonServiceStatus() {
    loadGeoJSON();
    return {
        loaded,
        file: loadedFile ? path_1.default.basename(loadedFile) : null,
        featureCount: features.length,
        loadTimeMs,
        rtreeSize: tree.all().length,
    };
}
