#!/usr/bin/env npx ts-node
"use strict";
/**
 * downloadTurkeyNeighborhoods.ts
 *
 * Downloads ALL Turkish neighborhood (mahalle) boundary polygons from
 * OpenStreetMap via the Overpass API and converts them to GeoJSON format.
 *
 * Turkey neighborhoods (mahalle) are typically mapped as admin_level=8 in OSM TR.
 * Districts (ilÃ§e) are typically admin_level=6 and provinces are admin_level=4.
 *
 * Usage:
 *   npx ts-node src/scripts/downloadTurkeyNeighborhoods.ts
 *
 * Output:
 *   src/data/neighborhoods_tr.geojson
 *
 * âš  WARNING:
 *   - The full Turkey dataset is VERY large (~50k+ neighborhoods)
 *   - Overpass API has rate limits; the script processes province-by-province
 *   - First run may take 30-60 minutes
 *   - File output can be 200MB+; consider simplifying geometries for production
 *
 * Requirements:
 *   - Internet access
 *   - Node.js 18+ (for native fetch)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
/* â”€â”€ Configuration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const OVERPASS_API_DEFAULT = 'https://overpass-api.de/api/interpreter,https://overpass.kumi.systems/api/interpreter,https://overpass.openstreetmap.ru/api/interpreter';
const OVERPASS_APIS = String(process.env.OVERPASS_APIS ?? OVERPASS_API_DEFAULT)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
const DATA_DIR = path_1.default.join(__dirname, '..', 'data');
const OUTPUT_FILE = path_1.default.join(DATA_DIR, 'neighborhoods_tr.geojson');
// Checkpointing: each province is written separately, then merged.
const TMP_DIR = path_1.default.join(DATA_DIR, '_neighborhoods_tr_tmp');
const PROGRESS_FILE = path_1.default.join(TMP_DIR, 'progress.json');
const RESUME = String(process.env.RESUME ?? '1') !== '0';
const DELAY_MS = Number(process.env.DELAY_MS ?? '20000'); // delay between provinces to respect rate limits
const MAX_RETRIES = Number(process.env.OVERPASS_MAX_RETRIES ?? '8');
const RETRY_DELAY_MS = Number(process.env.OVERPASS_RETRY_DELAY_MS ?? '120000'); // base backoff
const MAX_BACKOFF_MS = Number(process.env.OVERPASS_MAX_BACKOFF_MS ?? String(15 * 60000)); // 15 minutes
const PROVINCE_MAX_RETRIES = Number(process.env.PROVINCE_MAX_RETRIES ?? '6');
// Chunked geometry fetch to avoid huge Overpass responses.
const GEOM_CHUNK_SIZE = Number(process.env.GEOM_CHUNK_SIZE ?? '25');
const GEOM_CHUNK_DELAY_MS = Number(process.env.GEOM_CHUNK_DELAY_MS ?? '2500');
const OVERPASS_QL_TIMEOUT_SEC = Number(process.env.OVERPASS_QL_TIMEOUT_SEC ?? '600');
const OVERPASS_FETCH_TIMEOUT_MS = Number(process.env.OVERPASS_FETCH_TIMEOUT_MS ?? String(OVERPASS_QL_TIMEOUT_SEC * 1000 + 60000));
const OVERPASS_USER_AGENT = String(process.env.OVERPASS_USER_AGENT ?? 'MahallemDownloader/1.0 (+local dev)');
// Geometry optimization knobs
// Default tolerance is in degrees (EPSG:4326). 0.00015 â‰ˆ 15m.
const SIMPLIFY_TOLERANCE = Number(process.env.SIMPLIFY_TOLERANCE ?? '0.00015');
const COORD_DECIMALS = Number(process.env.COORD_DECIMALS ?? '6');
// Admin level(s) for mahalle. Default is 8 based on OSM TR admin_level usage.
const TR_MAHALLE_ADMIN_LEVELS = String(process.env.TR_MAHALLE_ADMIN_LEVELS ?? '8')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
/**
 * Province selection
 *
 * Default: discover ALL Turkey provinces dynamically from Overpass:
 *   area["ISO3166-1"="TR"][admin_level=2] + relations admin_level=4.
 *
 * Optional filters:
 *   - PROVINCE_OSM_IDS="<relId>,<relId>" (comma-separated)
 *   - MVP_WHITELIST=1 (small subset by province name)
 */
const MVP_WHITELIST_NAMES = new Set(['istanbul', 'ankara', 'izmir', 'adana', 'mersin', 'mugla', 'muğla']);
function parseCsvEnv(name) {
    return String(process.env[name] ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}
function normalizeProvinceNameForWhitelist(name) {
    return String(name || '')
        .trim()
        .toLocaleLowerCase('tr-TR')
        .replace(/\s+/g, ' ')
        .replace(/[^a-z0-9ığüşöç\s]/gi, '');
}
function buildTurkeyProvincesQuery() {
    return `
[out:json][timeout:180];
area["ISO3166-1"="TR"]["admin_level"="2"]["boundary"="administrative"]->.tr;
(
  relation["admin_level"="4"]["boundary"="administrative"]["network"="TR-provinces"](area.tr);
);
out tags;
`.trim();
}
function buildRelationTagsQuery(ids) {
    const uniq = Array.from(new Set(ids.filter((n) => Number.isFinite(n) && n > 0)));
    if (!uniq.length) {
        return `
[out:json][timeout:60];
out tags;
`.trim();
    }
    return `
[out:json][timeout:120];
relation(id:${uniq.join(',')});
out tags;
`.trim();
}
/* â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function ensureDir(p) {
    fs_1.default.mkdirSync(p, { recursive: true });
}
function readJsonIfExists(filePath) {
    try {
        if (!fs_1.default.existsSync(filePath))
            return null;
        const raw = fs_1.default.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
function writeJsonAtomic(filePath, obj) {
    ensureDir(path_1.default.dirname(filePath));
    const tmp = `${filePath}.tmp`;
    fs_1.default.writeFileSync(tmp, JSON.stringify(obj), 'utf-8');
    fs_1.default.renameSync(tmp, filePath);
}
function provinceOutFile(provinceOsmId) {
    return path_1.default.join(TMP_DIR, `province-${provinceOsmId}.json`);
}
function isValidProvinceCheckpoint(filePath) {
    const data = readJsonIfExists(filePath);
    if (!data)
        return false;
    const featureCount = Number(data.featureCount ?? (Array.isArray(data.features) ? data.features.length : 0));
    return Array.isArray(data.features) && featureCount > 0;
}
function computeBackoffMs(attempt) {
    const pow = Math.max(0, attempt - 1);
    const raw = Math.min(MAX_BACKOFF_MS, RETRY_DELAY_MS * 2 ** pow);
    const jitter = raw * (0.15 * Math.random());
    return Math.round(raw + jitter);
}
/**
 * Build Overpass QL query for district boundaries within a province.
 * Gets admin_level=6 (ilÃ§e) relations/ways.
 */
function buildDistrictsQuery(provinceOsmId) {
    return `
[out:json][timeout:${OVERPASS_QL_TIMEOUT_SEC}];
area(${3600000000 + provinceOsmId})->.a;
rel(${provinceOsmId});
map_to_area->.b;
(.a; .b;)->.province;
(
  relation["admin_level"="6"]["boundary"="administrative"](area.province);
);
out body geom;
`.trim();
}
/**
 * Build Overpass QL query for neighborhood boundaries within a province.
 * Gets admin_level=10 (mahalle) relations/ways.
 */
function buildNeighborhoodsQuery(provinceOsmId) {
    const adminLevelFilter = TR_MAHALLE_ADMIN_LEVELS.map((lvl) => `relation["admin_level"="${lvl}"]["boundary"="administrative"](area.province);
  way["admin_level"="${lvl}"]["boundary"="administrative"]["name"](area.province);
  way["admin_level"="${lvl}"]["boundary"="administrative"]["name:tr"](area.province);`).join('\n  ');
    const extraByName = `
  relation["boundary"="administrative"]["name"~"(Mahallesi|Mah\\.|Mh\\.|Mh|Köyü)$",i](area.province);
  way["boundary"="administrative"]["name"~"(Mahallesi|Mah\\.|Mh\\.|Mh|Köyü)$",i](area.province);
  `.trim();
    return `
[out:json][timeout:${OVERPASS_QL_TIMEOUT_SEC}];
area(${3600000000 + provinceOsmId})->.a;
rel(${provinceOsmId});
map_to_area->.b;
(.a; .b;)->.province;
(
  ${adminLevelFilter}
  ${extraByName}
);
out body geom;
`.trim();
}
/** Lightweight query: returns neighborhood elements without geometry (IDs+tags+center). */
function buildNeighborhoodsIndexQuery(provinceOsmId) {
    const adminLevelFilter = TR_MAHALLE_ADMIN_LEVELS.map((lvl) => `relation["admin_level"="${lvl}"]["boundary"="administrative"](area.province);
  way["admin_level"="${lvl}"]["boundary"="administrative"]["name"](area.province);
  way["admin_level"="${lvl}"]["boundary"="administrative"]["name:tr"](area.province);`).join('\n  ');
    const extraByName = `
  relation["boundary"="administrative"]["name"~"(Mahallesi|Mah\\.|Mh\\.|Mh|Köyü)$",i](area.province);
  way["boundary"="administrative"]["name"~"(Mahallesi|Mah\\.|Mh\\.|Mh|Köyü)$",i](area.province);
  `.trim();
    return `
[out:json][timeout:${OVERPASS_QL_TIMEOUT_SEC}];
area(${3600000000 + provinceOsmId})->.a;
rel(${provinceOsmId});
map_to_area->.b;
(.a; .b;)->.province;
(
  ${adminLevelFilter}
  ${extraByName}
);
out body center;
`.trim();
}
function buildGeometryByIdsQuery(items) {
    const rels = items.filter((x) => x.type === 'relation').map((x) => x.id);
    const ways = items.filter((x) => x.type === 'way').map((x) => x.id);
    const relPart = rels.length ? `relation(id:${rels.join(',')});` : '';
    const wayPart = ways.length ? `way(id:${ways.join(',')});` : '';
    return `
[out:json][timeout:${OVERPASS_QL_TIMEOUT_SEC}];
(
  ${relPart}
  ${wayPart}
);
out body geom;
`.trim();
}
function chunk(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size)
        out.push(arr.slice(i, i + size));
    return out;
}
/**
 * Fetch data from Overpass API with retries.
 */
async function fetchOverpass(query, retries = MAX_RETRIES) {
    if (!OVERPASS_APIS.length) {
        throw new Error('No Overpass API endpoints configured');
    }
    for (let attempt = 1; attempt <= retries; attempt++) {
        const api = OVERPASS_APIS[(attempt - 1) % OVERPASS_APIS.length];
        try {
            const resp = await fetch(api, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Accept: 'application/json',
                    'User-Agent': OVERPASS_USER_AGENT,
                },
                body: `data=${encodeURIComponent(query)}`,
                signal: AbortSignal.timeout(OVERPASS_FETCH_TIMEOUT_MS),
            });
            // Overpass can return 429 or 5xx during load.
            if (resp.status === 429 || (resp.status >= 500 && resp.status <= 599)) {
                const retryAfterHeader = resp.headers.get('retry-after');
                const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : NaN;
                const waitMs = Number.isFinite(retryAfterMs) ? retryAfterMs : computeBackoffMs(attempt);
                console.log(`  â³ Overpass HTTP ${resp.status} (${api}). Waiting ${Math.round(waitMs / 1000)}s...`);
                await sleep(waitMs);
                continue;
            }
            if (!resp.ok) {
                throw new Error(`HTTP ${resp.status}: ${resp.statusText} (${api})`);
            }
            // Overpass sometimes returns HTML/XML error pages with status 200.
            const rawText = await resp.text();
            let data;
            try {
                data = JSON.parse(rawText);
            }
            catch {
                throw new Error(`Non-JSON response from Overpass (${api}): ${rawText.slice(0, 200)}`);
            }
            if (data?.remark && typeof data.remark === 'string' && data.remark.toLowerCase().includes('rate')) {
                const waitMs = computeBackoffMs(attempt);
                console.log(`  â³ Overpass remark indicates rate limiting (${api}). Waiting ${Math.round(waitMs / 1000)}s...`);
                await sleep(waitMs);
                continue;
            }
            if (data?.remark && typeof data.remark === 'string') {
                const remark = data.remark.toLowerCase();
                // Fail fast for likely permanent query issues.
                if (remark.includes('parse error') || remark.includes('unknown') || remark.includes('line ')) {
                    throw new Error(`Overpass remark (${api}): ${data.remark}`);
                }
                // Most other remarks are transient overload/timeouts.
                const waitMs = computeBackoffMs(attempt);
                console.log(`  â³ Overpass remark (${api}). Waiting ${Math.round(waitMs / 1000)}s...`);
                await sleep(waitMs);
                continue;
            }
            return Array.isArray(data?.elements) ? data.elements : [];
        }
        catch (err) {
            const msg = err?.message ? String(err.message) : String(err);
            console.log(`  âš  Attempt ${attempt}/${retries} failed: ${msg}`);
            if (attempt < retries) {
                const waitMs = computeBackoffMs(attempt);
                console.log(`  â†» Retrying in ${Math.round(waitMs / 1000)}s...`);
                await sleep(waitMs);
            }
        }
    }
    throw new Error(`All retries failed after ${retries} attempts`);
}
/** Extract district name from tags as a weak fallback (preferred path is spatial match). */
function extractDistrict(element) {
    const tags = element.tags || {};
    // Sometimes the is_in:district or is_in tag contains the district
    if (tags['is_in:district'])
        return tags['is_in:district'];
    if (tags['is_in:county'])
        return tags['is_in:county'];
    // addr:district
    if (tags['addr:district'])
        return tags['addr:district'];
    return '';
}
function getElementName(tags) {
    const t = tags || {};
    return (t.name || t['name:tr'] || t['official_name'] || '').toString().trim();
}
function roundCoord(v) {
    const p = 10 ** COORD_DECIMALS;
    return Math.round(v * p) / p;
}
function dedupeConsecutive(points) {
    const out = [];
    for (const p of points) {
        const lng = Number(p?.[0]);
        const lat = Number(p?.[1]);
        if (!Number.isFinite(lng) || !Number.isFinite(lat))
            continue;
        const prev = out[out.length - 1];
        if (prev && Math.abs(prev[0] - lng) < 1e-12 && Math.abs(prev[1] - lat) < 1e-12)
            continue;
        out.push([roundCoord(lng), roundCoord(lat)]);
    }
    return out;
}
function ensureClosedRing(ring) {
    if (ring.length < 3)
        return ring;
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (!first || !last)
        return ring;
    if (Math.abs(first[0] - last[0]) > 1e-12 || Math.abs(first[1] - last[1]) > 1e-12) {
        return ring.concat([[first[0], first[1]]]);
    }
    return ring;
}
// Douglas-Peucker simplification for a polyline (not closed). Returns a subset of points.
function simplifyRDP(points, epsilon) {
    if (points.length <= 2)
        return points;
    const sq = (x) => x * x;
    const distSqPointToSegment = (p, a, b) => {
        const px = p[0], py = p[1];
        const ax = a[0], ay = a[1];
        const bx = b[0], by = b[1];
        const dx = bx - ax;
        const dy = by - ay;
        if (Math.abs(dx) < 1e-20 && Math.abs(dy) < 1e-20)
            return sq(px - ax) + sq(py - ay);
        const t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
        const tt = Math.max(0, Math.min(1, t));
        const x = ax + tt * dx;
        const y = ay + tt * dy;
        return sq(px - x) + sq(py - y);
    };
    const epsSq = epsilon * epsilon;
    let index = -1;
    let maxDistSq = 0;
    const a = points[0];
    const b = points[points.length - 1];
    for (let i = 1; i < points.length - 1; i++) {
        const d = distSqPointToSegment(points[i], a, b);
        if (d > maxDistSq) {
            maxDistSq = d;
            index = i;
        }
    }
    if (maxDistSq <= epsSq || index === -1) {
        return [a, b];
    }
    const left = simplifyRDP(points.slice(0, index + 1), epsilon);
    const right = simplifyRDP(points.slice(index), epsilon);
    return left.slice(0, -1).concat(right);
}
function simplifyRingClosed(ring, epsilon) {
    const cleaned = ensureClosedRing(dedupeConsecutive(ring));
    if (cleaned.length < 4)
        return cleaned;
    // drop closure for simplification
    const open = cleaned.slice(0, -1);
    if (open.length < 3)
        return cleaned;
    // keep ring stable by anchoring start/end at the same point
    const simplifiedOpen = simplifyRDP(open.concat([open[0]]), epsilon).slice(0, -1);
    const reclosed = ensureClosedRing(dedupeConsecutive(simplifiedOpen));
    return reclosed.length >= 4 ? reclosed : cleaned;
}
function simplifyPolygonCoords(coords, epsilon) {
    if (!Array.isArray(coords) || coords.length === 0)
        return null;
    const out = [];
    for (const ring of coords) {
        const simplified = simplifyRingClosed(ring, epsilon);
        if (simplified.length >= 4)
            out.push(simplified);
    }
    return out.length ? out : null;
}
function simplifyMultiPolygonCoords(coords, epsilon) {
    if (!Array.isArray(coords) || coords.length === 0)
        return null;
    const out = [];
    for (const poly of coords) {
        const simplified = simplifyPolygonCoords(poly, epsilon);
        if (simplified)
            out.push(simplified);
    }
    return out.length ? out : null;
}
function normalizeGeometry(geometry, epsilon) {
    if (geometry.type === 'Polygon') {
        const simplified = simplifyPolygonCoords(geometry.coordinates, epsilon);
        if (!simplified)
            return null;
        return { type: 'Polygon', coordinates: simplified };
    }
    if (geometry.type === 'MultiPolygon') {
        const simplified = simplifyMultiPolygonCoords(geometry.coordinates, epsilon);
        if (!simplified)
            return null;
        // MultiPolygon optimize: if it collapsed to a single polygon, store as Polygon.
        if (simplified.length === 1) {
            return { type: 'Polygon', coordinates: simplified[0] };
        }
        return { type: 'MultiPolygon', coordinates: simplified };
    }
    return null;
}
function computeBBoxOfRing(ring) {
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    for (const p of ring) {
        const lng = Number(p?.[0]);
        const lat = Number(p?.[1]);
        if (!Number.isFinite(lng) || !Number.isFinite(lat))
            continue;
        if (lng < minLng)
            minLng = lng;
        if (lng > maxLng)
            maxLng = lng;
        if (lat < minLat)
            minLat = lat;
        if (lat > maxLat)
            maxLat = lat;
    }
    if (!Number.isFinite(minLng))
        return null;
    return [minLng, minLat, maxLng, maxLat];
}
function computeBBoxOfGeometry(geom) {
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    const visitPoint = (p) => {
        const lng = Number(p?.[0]);
        const lat = Number(p?.[1]);
        if (!Number.isFinite(lng) || !Number.isFinite(lat))
            return;
        if (lng < minLng)
            minLng = lng;
        if (lng > maxLng)
            maxLng = lng;
        if (lat < minLat)
            minLat = lat;
        if (lat > maxLat)
            maxLat = lat;
    };
    if (geom.type === 'Polygon') {
        const coords = geom.coordinates;
        for (const ring of coords) {
            for (const p of ring)
                visitPoint(p);
        }
    }
    else {
        const coords = geom.coordinates;
        for (const poly of coords) {
            for (const ring of poly) {
                for (const p of ring)
                    visitPoint(p);
            }
        }
    }
    if (!Number.isFinite(minLng))
        return null;
    return [minLng, minLat, maxLng, maxLat];
}
function bboxContains(b, lat, lng) {
    return lng >= b[0] && lng <= b[2] && lat >= b[1] && lat <= b[3];
}
function pointInPolygon(lat, lng, coordinates) {
    if (!pointInRing(lat, lng, coordinates[0]))
        return false;
    for (let i = 1; i < coordinates.length; i++) {
        if (pointInRing(lat, lng, coordinates[i]))
            return false;
    }
    return true;
}
function pointInMultiPolygon(lat, lng, coordinates) {
    for (const poly of coordinates) {
        if (pointInPolygon(lat, lng, poly))
            return true;
    }
    return false;
}
function pointInGeometry(lat, lng, geom) {
    if (geom.type === 'Polygon')
        return pointInPolygon(lat, lng, geom.coordinates);
    return pointInMultiPolygon(lat, lng, geom.coordinates);
}
function ringCentroidLngLat(ring) {
    if (!Array.isArray(ring) || ring.length < 3)
        return null;
    let signedArea = 0;
    let cx = 0;
    let cy = 0;
    const n = ring.length;
    for (let i = 0; i < n - 1; i++) {
        const x0 = Number(ring[i]?.[0]);
        const y0 = Number(ring[i]?.[1]);
        const x1 = Number(ring[i + 1]?.[0]);
        const y1 = Number(ring[i + 1]?.[1]);
        if (!Number.isFinite(x0) || !Number.isFinite(y0) || !Number.isFinite(x1) || !Number.isFinite(y1))
            continue;
        const a = x0 * y1 - x1 * y0;
        signedArea += a;
        cx += (x0 + x1) * a;
        cy += (y0 + y1) * a;
    }
    signedArea *= 0.5;
    if (!Number.isFinite(signedArea) || Math.abs(signedArea) < 1e-18) {
        // Fallback: average of points
        let sumX = 0;
        let sumY = 0;
        let count = 0;
        for (const p of ring) {
            const x = Number(p?.[0]);
            const y = Number(p?.[1]);
            if (!Number.isFinite(x) || !Number.isFinite(y))
                continue;
            sumX += x;
            sumY += y;
            count++;
        }
        if (!count)
            return null;
        return { lng: sumX / count, lat: sumY / count };
    }
    const k = 1 / (6 * signedArea);
    const lng = cx * k;
    const lat = cy * k;
    if (!Number.isFinite(lng) || !Number.isFinite(lat))
        return null;
    return { lng, lat };
}
function representativePointFromCoordinates(coordinates) {
    const maybeMulti = Array.isArray(coordinates[0]) &&
        Array.isArray(coordinates[0][0]) &&
        Array.isArray(coordinates[0][0][0]);
    // Pick the largest polygon (by abs signed area of its outer ring).
    let bestOuter = null;
    let bestAbsArea = 0;
    const considerOuter = (ring) => {
        if (!ring || ring.length < 3)
            return;
        const closed = ensureClosedRing(dedupeConsecutive(ring));
        if (closed.length < 4)
            return;
        const absArea = Math.abs((() => {
            let sum = 0;
            for (let i = 0; i < closed.length - 1; i++) {
                const x0 = Number(closed[i]?.[0]);
                const y0 = Number(closed[i]?.[1]);
                const x1 = Number(closed[i + 1]?.[0]);
                const y1 = Number(closed[i + 1]?.[1]);
                if (!Number.isFinite(x0) || !Number.isFinite(y0) || !Number.isFinite(x1) || !Number.isFinite(y1))
                    continue;
                sum += x0 * y1 - x1 * y0;
            }
            return sum / 2;
        })());
        if (absArea > bestAbsArea) {
            bestAbsArea = absArea;
            bestOuter = ring;
        }
    };
    if (maybeMulti) {
        for (const poly of coordinates) {
            considerOuter(poly?.[0]);
        }
    }
    else {
        considerOuter(coordinates[0]);
    }
    if (!bestOuter)
        return null;
    // Try centroid first.
    const c = ringCentroidLngLat(bestOuter);
    if (c && Number.isFinite(c.lat) && Number.isFinite(c.lng)) {
        // Only accept centroid if it actually lies within the geometry; centroid can be outside for concave shapes.
        const inside = maybeMulti
            ? pointInMultiPolygon(c.lat, c.lng, coordinates)
            : pointInPolygon(c.lat, c.lng, coordinates);
        if (inside)
            return { lat: c.lat, lng: c.lng };
    }
    // Fallback: use a boundary vertex (treated as inside by pointInRing).
    const first = bestOuter[0];
    const lng = Number(first?.[0]);
    const lat = Number(first?.[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng))
        return null;
    return { lat, lng };
}
/**
 * Convert an OSM way/relation geometry to GeoJSON coordinates.
 */
function elementToCoordinates(element) {
    if (element.type === 'way' && element.geometry) {
        // Simple polygon from way geometry (ONLY if it is already closed).
        const ring = element.geometry.map((p) => [p.lon, p.lat]);
        if (ring.length < 4)
            return null;
        const first = ring[0];
        const last = ring[ring.length - 1];
        if (!first || !last)
            return null;
        if (first[0] !== last[0] || first[1] !== last[1])
            return null;
        return [ring];
    }
    if (element.type === 'relation' && element.members) {
        // Build polygon from relation members
        const outerRings = [];
        const innerRings = [];
        for (const member of element.members) {
            if (member.type !== 'way' || !member.geometry)
                continue;
            // IMPORTANT: member ways in a multipolygon relation are typically segments.
            // Do NOT force-close them individually; mergeRings will stitch segments into closed rings.
            const ring = member.geometry.map((p) => [p.lon, p.lat]);
            if (ring.length < 2)
                continue;
            if (member.role === 'outer' || member.role === '') {
                outerRings.push(ring);
            }
            else if (member.role === 'inner') {
                innerRings.push(ring);
            }
        }
        // Try to merge outer rings that share endpoints (multi-part boundaries)
        const mergedOuters = mergeRings(outerRings);
        const mergedInners = mergeRings(innerRings);
        if (mergedOuters.length === 0)
            return null;
        if (mergedOuters.length === 1) {
            // Single polygon (possibly with holes)
            const coords = [mergedOuters[0]];
            for (const inner of mergedInners) {
                const p = inner?.[0];
                if (!p)
                    continue;
                if (pointInRing(p[1], p[0], mergedOuters[0])) {
                    coords.push(inner);
                }
            }
            return coords; // Polygon
        }
        // MultiPolygon
        const multiCoords = mergedOuters.map((outer) => [outer]);
        if (mergedInners.length > 0 && multiCoords.length > 0) {
            for (const inner of mergedInners) {
                const p = inner?.[0];
                if (!p)
                    continue;
                let assigned = false;
                for (let i = 0; i < mergedOuters.length; i++) {
                    if (pointInRing(p[1], p[0], mergedOuters[i])) {
                        multiCoords[i].push(inner);
                        assigned = true;
                        break;
                    }
                }
                // If containment check fails (rare), keep it rather than dropping.
                if (!assigned) {
                    multiCoords[0].push(inner);
                }
            }
        }
        return multiCoords; // MultiPolygon
    }
    return null;
}
/**
 * Try to merge line segments that share endpoints into closed rings.
 */
function mergeRings(rings) {
    if (rings.length <= 1)
        return rings;
    const result = [];
    const used = new Set();
    for (let i = 0; i < rings.length; i++) {
        if (used.has(i))
            continue;
        let merged = [...rings[i]];
        used.add(i);
        // Check if ring is already closed
        const isClosed = (r) => {
            if (r.length < 3)
                return false;
            const f = r[0], l = r[r.length - 1];
            return Math.abs(f[0] - l[0]) < 1e-8 && Math.abs(f[1] - l[1]) < 1e-8;
        };
        // Try to append other rings
        let changed = true;
        while (changed && !isClosed(merged)) {
            changed = false;
            const end = merged[merged.length - 1];
            for (let j = 0; j < rings.length; j++) {
                if (used.has(j))
                    continue;
                const rj = rings[j];
                const rjFirst = rj[0];
                const rjLast = rj[rj.length - 1];
                const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
                if (dist(end, rjFirst) < 1e-6) {
                    merged = merged.concat(rj.slice(1));
                    used.add(j);
                    changed = true;
                    break;
                }
                else if (dist(end, rjLast) < 1e-6) {
                    merged = merged.concat([...rj].reverse().slice(1));
                    used.add(j);
                    changed = true;
                    break;
                }
            }
        }
        if (merged.length >= 3) {
            const f = merged[0];
            const l = merged[merged.length - 1];
            const nearClosed = Math.abs(f[0] - l[0]) + Math.abs(f[1] - l[1]) < 1e-6;
            if (!isClosed(merged) && nearClosed) {
                merged.push([f[0], f[1]]);
            }
            if (isClosed(merged) && merged.length >= 4) {
                result.push(merged);
            }
        }
    }
    return result;
}
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
async function getActiveProvinces() {
    const osmIdStrings = parseCsvEnv('PROVINCE_OSM_IDS');
    const useMvpWhitelist = String(process.env.MVP_WHITELIST ?? '') === '1';
    if (osmIdStrings.length) {
        const ids = [];
        for (const s of osmIdStrings) {
            const n = Number(s);
            if (Number.isFinite(n) && n > 0)
                ids.push(n);
        }
        if (!ids.length)
            return [];
        const relTags = await fetchOverpass(buildRelationTagsQuery(ids));
        const byId = new Map();
        for (const el of relTags) {
            if (el.type !== 'relation')
                continue;
            if (!Number.isFinite(el.id))
                continue;
            const name = getElementName(el.tags);
            if (name)
                byId.set(el.id, name);
        }
        return ids.map((id) => ({ osmId: id, name: byId.get(id) || `Relation ${id}` }));
    }
    const provinceElements = await fetchOverpass(buildTurkeyProvincesQuery());
    const provinces = [];
    for (const el of provinceElements) {
        if (el.type !== 'relation')
            continue;
        if (!Number.isFinite(el.id))
            continue;
        const name = getElementName(el.tags);
        if (!name)
            continue;
        provinces.push({ osmId: el.id, name });
    }
    const filtered = useMvpWhitelist
        ? provinces.filter((p) => MVP_WHITELIST_NAMES.has(normalizeProvinceNameForWhitelist(p.name)))
        : provinces;
    filtered.sort((a, b) => a.name.localeCompare(b.name, 'tr-TR'));
    return filtered;
}
/* â”€â”€ Main â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
async function main() {
    const activeProvinces = await getActiveProvinces();
    if (!activeProvinces.length) {
        throw new Error('Province selection resolved to 0 provinces. Check PROVINCE_OSM_IDS / MVP_WHITELIST env vars.');
    }
    console.log('ğŸ‡¹ğŸ‡· Downloading Turkey neighborhood polygons from OpenStreetMap...');
    console.log(`   Output: ${OUTPUT_FILE}`);
    console.log(`   Resume: ${RESUME ? 'ON' : 'OFF'}`);
    console.log(`   Tmp: ${TMP_DIR}`);
    const provinceOsmIdsEnv = String(process.env.PROVINCE_OSM_IDS ?? '').trim();
    const mvpWhitelistEnv = String(process.env.MVP_WHITELIST ?? '').trim();
    console.log(`   Provinces: ${activeProvinces.length}` +
        (provinceOsmIdsEnv ? ` (filtered by PROVINCE_OSM_IDS=${provinceOsmIdsEnv})` : '') +
        (!provinceOsmIdsEnv && mvpWhitelistEnv === '1' ? ' (MVP_WHITELIST=1)' : ''));
    console.log(`   Mahalle admin_level(s): ${TR_MAHALLE_ADMIN_LEVELS.join(', ')}`);
    console.log(`   Simplify tolerance: ${SIMPLIFY_TOLERANCE}Â°  (COORD_DECIMALS=${COORD_DECIMALS})`);
    console.log(`   Overpass APIs: ${OVERPASS_APIS.join(', ')}`);
    console.log(`   Overpass retries: ${MAX_RETRIES}`);
    console.log(`   Province retries: ${PROVINCE_MAX_RETRIES}`);
    console.log('');
    ensureDir(TMP_DIR);
    const progressExisting = readJsonIfExists(PROGRESS_FILE);
    const progress = progressExisting && progressExisting.version === 1
        ? progressExisting
        : {
            version: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            outputFile: OUTPUT_FILE,
            tmpDir: TMP_DIR,
            simplifyToleranceDeg: SIMPLIFY_TOLERANCE,
            coordDecimals: COORD_DECIMALS,
            adminLevels: TR_MAHALLE_ADMIN_LEVELS,
            completed: [],
            failed: [],
        };
    // Prune any bogus entries (e.g., 0-feature province files from interrupted runs)
    progress.completed = (progress.completed || []).filter((c) => {
        if (!c || !Number.isFinite(c.osmId) || !c.file)
            return false;
        if (!fs_1.default.existsSync(c.file))
            return false;
        if (!isValidProvinceCheckpoint(c.file))
            return false;
        return Number(c.featureCount || 0) > 0;
    });
    const completedSet = new Set(progress.completed.map((c) => c.osmId));
    const provinceFilesPresent = new Set();
    for (const p of activeProvinces) {
        const f = provinceOutFile(p.osmId);
        if (fs_1.default.existsSync(f))
            provinceFilesPresent.add(p.osmId);
    }
    // If file exists but progress is missing entry, backfill it.
    for (const p of activeProvinces) {
        if (completedSet.has(p.osmId))
            continue;
        if (!provinceFilesPresent.has(p.osmId))
            continue;
        const filePath = provinceOutFile(p.osmId);
        if (!isValidProvinceCheckpoint(filePath)) {
            // Delete invalid checkpoint to allow re-download.
            try {
                fs_1.default.unlinkSync(filePath);
            }
            catch {
                // ignore
            }
            continue;
        }
        const data = readJsonIfExists(filePath);
        if (!data || !Array.isArray(data.features) || (data.featureCount ?? data.features.length) <= 0)
            continue;
        progress.completed.push({
            name: p.name,
            osmId: p.osmId,
            file: filePath,
            featureCount: data.featureCount ?? data.features.length,
            totalElements: data.totalElements ?? 0,
            finishedAt: data.createdAt ?? new Date().toISOString(),
        });
        completedSet.add(p.osmId);
    }
    progress.updatedAt = new Date().toISOString();
    writeJsonAtomic(PROGRESS_FILE, progress);
    let totalFeatureCount = 0;
    let totalElements = 0;
    let skippedNoGeom = 0;
    let skippedNoName = 0;
    let skippedNoDistrict = 0;
    let simplifiedDropped = 0;
    const activeIdSet = new Set(activeProvinces.map((p) => p.osmId));
    if (RESUME && progress.completed.length) {
        const completedInActive = progress.completed.filter((c) => activeIdSet.has(c.osmId));
        totalFeatureCount = completedInActive.reduce((acc, c) => acc + (c.featureCount || 0), 0);
        console.log(`â†» Resume detected: ${completedInActive.length}/${activeProvinces.length} active provinces already completed (${totalFeatureCount} features).`);
        console.log('');
    }
    for (let i = 0; i < activeProvinces.length; i++) {
        const province = activeProvinces[i];
        const progressLabel = `[${i + 1}/${activeProvinces.length}]`;
        const provinceFile = provinceOutFile(province.osmId);
        if (RESUME && completedSet.has(province.osmId) && fs_1.default.existsSync(provinceFile) && isValidProvinceCheckpoint(provinceFile)) {
            console.log(`${progressLabel} â­ï¸  ${province.name} (already downloaded)`);
            continue;
        }
        if (RESUME && fs_1.default.existsSync(provinceFile) && !isValidProvinceCheckpoint(provinceFile)) {
            try {
                fs_1.default.unlinkSync(provinceFile);
            }
            catch {
                // ignore
            }
        }
        console.log(`${progressLabel} ğŸ“ ${province.name}...`);
        const provinceTotalBefore = totalFeatureCount;
        let lastErr = null;
        for (let provinceAttempt = 1; provinceAttempt <= PROVINCE_MAX_RETRIES; provinceAttempt++) {
            let provinceElements = 0;
            let provinceSkippedNoGeom = 0;
            let provinceSkippedNoName = 0;
            let provinceSkippedNoDistrict = 0;
            let provinceOptFail = 0;
            try {
                // 1) Load districts for this province (admin_level=6)
                const districtQuery = buildDistrictsQuery(province.osmId);
                const districtElements = await fetchOverpass(districtQuery);
                const districtFeatures = [];
                for (const el of districtElements) {
                    const name = getElementName(el.tags);
                    if (!name)
                        continue;
                    const coordinates = elementToCoordinates(el);
                    if (!coordinates)
                        continue;
                    const isMulti = Array.isArray(coordinates[0]) &&
                        Array.isArray(coordinates[0][0]) &&
                        Array.isArray(coordinates[0][0][0]);
                    const rawGeom = isMulti
                        ? { type: 'MultiPolygon', coordinates: coordinates }
                        : { type: 'Polygon', coordinates: coordinates };
                    const optimized = normalizeGeometry(rawGeom, SIMPLIFY_TOLERANCE);
                    if (!optimized)
                        continue;
                    const bbox = computeBBoxOfGeometry(optimized);
                    if (!bbox)
                        continue;
                    districtFeatures.push({ name, geom: optimized, bbox });
                }
                // 2) Load neighborhoods for this province (admin_level=10)
                const indexQuery = buildNeighborhoodsIndexQuery(province.osmId);
                const indexElements = await fetchOverpass(indexQuery);
                const centerByKey = new Map();
                for (const el of indexElements) {
                    if (!el || (el.type !== 'relation' && el.type !== 'way'))
                        continue;
                    if (!Number.isFinite(el.id))
                        continue;
                    const lat = Number(el.center?.lat);
                    const lon = Number(el.center?.lon);
                    if (!Number.isFinite(lat) || !Number.isFinite(lon))
                        continue;
                    centerByKey.set(`${el.type}:${el.id}`, { lat, lon });
                }
                const indexItems = indexElements
                    .filter((el) => (el.type === 'relation' || el.type === 'way') && Number.isFinite(el.id))
                    .map((el) => ({ type: el.type, id: el.id }));
                if (!indexItems.length) {
                    throw new Error('Overpass returned 0 neighborhood ids (transient)');
                }
                const indexChunks = chunk(indexItems, Math.max(1, GEOM_CHUNK_SIZE));
                const elements = [];
                for (let ci = 0; ci < indexChunks.length; ci++) {
                    const q = buildGeometryByIdsQuery(indexChunks[ci]);
                    const chunkElements = await fetchOverpass(q);
                    elements.push(...chunkElements);
                    if (ci < indexChunks.length - 1) {
                        await sleep(GEOM_CHUNK_DELAY_MS);
                    }
                }
                // Restore centers (used for district matching) from the index query.
                for (const el of elements) {
                    if (!el || (el.type !== 'relation' && el.type !== 'way'))
                        continue;
                    if (el.center && Number.isFinite(el.center.lat) && Number.isFinite(el.center.lon))
                        continue;
                    const c = centerByKey.get(`${el.type}:${el.id}`);
                    if (c) {
                        el.center = { lat: c.lat, lon: c.lon };
                    }
                }
                if (!elements.length) {
                    throw new Error('Overpass returned 0 neighborhood elements after geometry fetch (transient)');
                }
                console.log(`  â†’ districts: ${districtFeatures.length}, neighborhoods: ${elements.length} elements (attempt ${provinceAttempt}/${PROVINCE_MAX_RETRIES})`);
                totalElements += elements.length;
                provinceElements += elements.length;
                const provinceFeatures = [];
                for (const el of elements) {
                    const tags = el.tags || {};
                    const name = getElementName(tags);
                    if (!name) {
                        skippedNoName++;
                        provinceSkippedNoName++;
                        continue;
                    }
                    const coordinates = elementToCoordinates(el);
                    if (!coordinates) {
                        skippedNoGeom++;
                        provinceSkippedNoGeom++;
                        continue;
                    }
                    // Resolve district primarily via spatial match against admin_level=8 polygons.
                    let centerLat = Number(el.center?.lat);
                    let centerLng = Number(el.center?.lon);
                    if (!Number.isFinite(centerLat) || !Number.isFinite(centerLng)) {
                        const rp = representativePointFromCoordinates(coordinates);
                        if (rp) {
                            centerLat = rp.lat;
                            centerLng = rp.lng;
                        }
                    }
                    let district = '';
                    if (Number.isFinite(centerLat) && Number.isFinite(centerLng) && districtFeatures.length > 0) {
                        for (const d of districtFeatures) {
                            if (!bboxContains(d.bbox, centerLat, centerLng))
                                continue;
                            if (pointInGeometry(centerLat, centerLng, d.geom)) {
                                district = d.name;
                                break;
                            }
                        }
                    }
                    if (!district) {
                        district = extractDistrict(el);
                    }
                    if (!district) {
                        skippedNoDistrict++;
                        provinceSkippedNoDistrict++;
                    }
                    // Determine geometry type
                    const isMulti = Array.isArray(coordinates[0]) &&
                        Array.isArray(coordinates[0][0]) &&
                        Array.isArray(coordinates[0][0][0]);
                    const rawGeom = isMulti
                        ? { type: 'MultiPolygon', coordinates: coordinates }
                        : { type: 'Polygon', coordinates: coordinates };
                    const optimizedGeom = normalizeGeometry(rawGeom, SIMPLIFY_TOLERANCE);
                    if (!optimizedGeom) {
                        simplifiedDropped++;
                        provinceOptFail++;
                        continue;
                    }
                    provinceFeatures.push({
                        type: 'Feature',
                        properties: {
                            name,
                            district,
                            city: province.name,
                        },
                        geometry: optimizedGeom,
                    });
                }
                if (!provinceFeatures.length) {
                    throw new Error('0 features after processing (transient)');
                }
                const provinceOut = {
                    province: { name: province.name, osmId: province.osmId },
                    createdAt: new Date().toISOString(),
                    simplifyToleranceDeg: SIMPLIFY_TOLERANCE,
                    coordDecimals: COORD_DECIMALS,
                    adminLevels: TR_MAHALLE_ADMIN_LEVELS,
                    totalElements: provinceElements,
                    featureCount: provinceFeatures.length,
                    skipped: {
                        noGeom: provinceSkippedNoGeom,
                        noName: provinceSkippedNoName,
                        noDistrict: provinceSkippedNoDistrict,
                        optFail: provinceOptFail,
                    },
                    features: provinceFeatures,
                };
                writeJsonAtomic(provinceOutFile(province.osmId), provinceOut);
                totalFeatureCount += provinceFeatures.length;
                // Update progress
                const existingIdx = progress.completed.findIndex((c) => c.osmId === province.osmId);
                const entry = {
                    name: province.name,
                    osmId: province.osmId,
                    file: provinceOutFile(province.osmId),
                    featureCount: provinceFeatures.length,
                    totalElements: provinceElements,
                    finishedAt: new Date().toISOString(),
                };
                if (existingIdx >= 0)
                    progress.completed[existingIdx] = entry;
                else
                    progress.completed.push(entry);
                completedSet.add(province.osmId);
                progress.updatedAt = new Date().toISOString();
                writeJsonAtomic(PROGRESS_FILE, progress);
                console.log(`  âœ… ${provinceFeatures.length} features written (${totalFeatureCount} total; +${totalFeatureCount - provinceTotalBefore} this province)`);
                lastErr = null;
                break;
            }
            catch (e) {
                lastErr = e;
                const msg = e?.message ? String(e.message) : String(e);
                console.log(`  âš  Province attempt ${provinceAttempt}/${PROVINCE_MAX_RETRIES} failed: ${msg}`);
                if (provinceAttempt < PROVINCE_MAX_RETRIES) {
                    const waitMs = computeBackoffMs(provinceAttempt);
                    console.log(`  â†» Retrying province in ${Math.round(waitMs / 1000)}s...`);
                    await sleep(waitMs);
                    continue;
                }
            }
        }
        if (lastErr) {
            const msg = lastErr?.message ? String(lastErr.message) : String(lastErr);
            console.log(`${progressLabel} âŒ ${province.name} failed after ${PROVINCE_MAX_RETRIES} attempts: ${msg}`);
            if (!progress.failed)
                progress.failed = [];
            progress.failed.push({
                name: province.name,
                osmId: province.osmId,
                error: msg,
                failedAt: new Date().toISOString(),
            });
            progress.updatedAt = new Date().toISOString();
            writeJsonAtomic(PROGRESS_FILE, progress);
            continue;
        }
        // Rate limit delay (except for last province)
        if (i < activeProvinces.length - 1) {
            await sleep(DELAY_MS);
        }
    }
    console.log('');
    console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
    console.log(`Total OSM elements: ${totalElements}`);
    console.log(`Valid features:     ${totalFeatureCount}`);
    console.log(`Skipped (no geom):  ${skippedNoGeom}`);
    console.log(`Skipped (no name):  ${skippedNoName}`);
    console.log(`No district found:  ${skippedNoDistrict}`);
    console.log(`Dropped (opt fail): ${simplifiedDropped}`);
    console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
    // Merge per-province files into final GeoJSON (streamed; avoids huge memory).
    const metadata = {
        source: 'OpenStreetMap via Overpass API',
        downloadDate: new Date().toISOString(),
        country: 'Turkey',
        crs: 'EPSG:4326',
        coordOrder: '[lng,lat]',
        adminLevel: TR_MAHALLE_ADMIN_LEVELS.length === 1 ? Number(TR_MAHALLE_ADMIN_LEVELS[0]) : TR_MAHALLE_ADMIN_LEVELS,
        districtAdminLevel: 6,
        provinceAdminLevel: 4,
        simplifyToleranceDeg: SIMPLIFY_TOLERANCE,
        coordDecimals: COORD_DECIMALS,
        featureCount: totalFeatureCount,
        provinces: activeProvinces.length,
    };
    console.log(`\nğŸ’¾ Writing ${OUTPUT_FILE} (merge from province checkpoints)...`);
    ensureDir(path_1.default.dirname(OUTPUT_FILE));
    const ws = fs_1.default.createWriteStream(OUTPUT_FILE, { encoding: 'utf-8' });
    const finished = new Promise((resolve, reject) => {
        ws.on('finish', () => resolve());
        ws.on('error', (e) => reject(e));
    });
    ws.write('{"type":"FeatureCollection","metadata":');
    ws.write(JSON.stringify(metadata));
    ws.write(',"features":[\n');
    let first = true;
    for (const p of activeProvinces) {
        const f = provinceOutFile(p.osmId);
        if (!fs_1.default.existsSync(f)) {
            console.log(`âš  Missing province file for ${p.name} (${p.osmId}): ${f}`);
            continue;
        }
        const data = readJsonIfExists(f);
        if (!data || !Array.isArray(data.features)) {
            console.log(`âš  Could not read province file for ${p.name} (${p.osmId}): ${f}`);
            continue;
        }
        for (const feat of data.features) {
            if (!first)
                ws.write(',\n');
            ws.write(JSON.stringify(feat));
            first = false;
        }
    }
    ws.write('\n]}\n');
    ws.end();
    await finished;
    const stat = fs_1.default.statSync(OUTPUT_FILE);
    const sizeMB = (stat.size / 1024 / 1024).toFixed(1);
    console.log(`âœ… Done! File size: ${sizeMB} MB`);
    console.log(`   ${totalFeatureCount} neighborhood polygons saved.`);
    console.log('');
    console.log('Next steps:');
    console.log('  1. Ensure mahallem-backend loads src/data/neighborhoods_tr.geojson (it is preferred automatically)');
    console.log('  2. Restart backend and verify /api/locations/neighborhoods/status shows file=neighborhoods_tr.geojson');
}
main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
