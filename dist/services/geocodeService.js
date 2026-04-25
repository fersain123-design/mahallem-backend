"use strict";
/**
 * geocodeService.ts — Nominatim (OpenStreetMap) reverse geocoding service
 *
 * Provides Turkish neighborhood (mahalle), district (ilçe), and city (il) resolution
 * from lat/lng coordinates using the free Nominatim API.
 *
 * Features:
 *   ✅ In-memory LRU cache (~111m grid cells) to minimize API calls
 *   ✅ Rate-limiting (max 1 req/sec per Nominatim policy)
 *   ✅ Turkish locale for proper address formatting
 *   ✅ Robust parsing of Turkish administrative levels
 *   ✅ Timeout handling (5s max per request)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.reverseGeocodeNominatim = reverseGeocodeNominatim;
exports.clearGeocodeCache = clearGeocodeCache;
exports.getGeocodeStats = getGeocodeStats;
/* ── Cache ─────────────────────────────────────────────────────────────── */
// Grid-based cache: round coordinates to ~11m precision (4 decimal places)
const cache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_CACHE_SIZE = 5000;
function cacheKey(lat, lng) {
    return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}
function getCached(lat, lng) {
    const key = cacheKey(lat, lng);
    const entry = cache.get(key);
    if (!entry)
        return undefined; // not in cache
    if (Date.now() - entry.ts > CACHE_TTL_MS) {
        cache.delete(key);
        return undefined;
    }
    return entry.result ? { ...entry.result, source: 'cache' } : null;
}
function setCache(lat, lng, result) {
    if (cache.size >= MAX_CACHE_SIZE) {
        // Evict oldest entries (simple FIFO eviction)
        const keysToDelete = Array.from(cache.keys()).slice(0, Math.floor(MAX_CACHE_SIZE / 4));
        for (const k of keysToDelete)
            cache.delete(k);
    }
    cache.set(cacheKey(lat, lng), { result, ts: Date.now() });
}
/* ── Rate limiting ─────────────────────────────────────────────────────── */
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 1100; // Nominatim policy: max 1 req/sec
async function waitForRateLimit() {
    const now = Date.now();
    const elapsed = now - lastRequestTime;
    if (elapsed < MIN_REQUEST_INTERVAL_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - elapsed));
    }
    lastRequestTime = Date.now();
}
/* ── Turkish address parsing helpers ───────────────────────────────────── */
// Suffixes commonly appended to mahalle names
const MAHALLE_SUFFIXES = /\s*(mahallesi|mah\.?|mh\.?)\s*$/i;
function normalizeMahalle(raw) {
    let name = String(raw || '').trim();
    if (!name)
        return '';
    // Remove duplicate "Mahallesi" suffixes
    name = name.replace(MAHALLE_SUFFIXES, '').trim();
    // Add standard suffix
    name = name + ' Mahallesi';
    // Turkish title case
    name = name
        .split(/\s+/)
        .map((w) => {
        if (!w)
            return w;
        return w.charAt(0).toLocaleUpperCase('tr-TR') + w.slice(1).toLocaleLowerCase('tr-TR');
    })
        .join(' ');
    return name;
}
/**
 * Extract mahalle from Nominatim address fields.
 * Nominatim returns Turkish neighborhoods in various fields depending on the area.
 */
function extractMahalle(addr) {
    // Build a set of names that are likely NOT a mahalle (district/city/province-level)
    // so we can avoid returning something like "Tarsus" as a mahalle.
    const notMahalle = new Set([
        addr.town,
        addr.county,
        addr.city_district,
        addr.district,
        addr.municipality,
        addr.province,
        addr.state,
        addr.city,
    ]
        .filter(Boolean)
        .map((v) => String(v).trim().toLocaleLowerCase('tr-TR')));
    // Priority order for Turkey: quarter/residential is usually the mahalle.
    const candidates = [
        addr.quarter,
        addr.residential,
        addr.neighbourhood,
        addr.suburb,
        addr.hamlet,
        addr.village,
    ].filter(Boolean);
    for (const c of candidates) {
        const trimmed = c.trim();
        if (!trimmed)
            continue;
        const key = trimmed.toLocaleLowerCase('tr-TR');
        if (notMahalle.has(key))
            continue;
        // Skip if it looks like a district or city name rather than a neighborhood
        if (/^(ilçe|il|şehir|kent)\s*$/i.test(trimmed))
            continue;
        // Check if it contains "Mahallesi" or similar → definite neighborhood
        if (/mahalle/i.test(trimmed)) {
            return normalizeMahalle(trimmed);
        }
        // Otherwise normalize and return
        return normalizeMahalle(trimmed);
    }
    return '';
}
/**
 * Extract ilçe (district) from Nominatim address fields.
 */
function extractIlce(addr) {
    // Nominatim maps Turkish ilçe to various fields
    const candidates = [
        addr.town,
        addr.county,
        addr.city_district,
        addr.district,
        addr.municipality,
    ].filter(Boolean);
    for (const c of candidates) {
        const trimmed = c.trim();
        if (!trimmed)
            continue;
        // Skip if it's clearly a province/city
        if (isProvince(trimmed))
            continue;
        return trimmed;
    }
    return '';
}
/**
 * Extract il (province/city) from Nominatim address fields.
 */
function extractIl(addr) {
    const candidates = [
        addr.province,
        addr.state,
        addr.city,
    ].filter(Boolean);
    for (const c of candidates) {
        const trimmed = c.trim();
        if (!trimmed)
            continue;
        if (isProvince(trimmed))
            return trimmed;
    }
    // Sometimes Nominatim puts the province in city field
    if (addr.city && isProvince(addr.city.trim())) {
        return addr.city.trim();
    }
    return '';
}
const TURKEY_PROVINCES = new Set([
    'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Amasya', 'Ankara', 'Antalya',
    'Artvin', 'Aydın', 'Balıkesir', 'Bilecik', 'Bingöl', 'Bitlis', 'Bolu', 'Burdur',
    'Bursa', 'Çanakkale', 'Çankırı', 'Çorum', 'Denizli', 'Diyarbakır', 'Edirne',
    'Elazığ', 'Erzincan', 'Erzurum', 'Eskişehir', 'Gaziantep', 'Giresun', 'Gümüşhane',
    'Hakkari', 'Hatay', 'Isparta', 'Mersin', 'İstanbul', 'İzmir', 'Kars', 'Kastamonu',
    'Kayseri', 'Kırklareli', 'Kırşehir', 'Kocaeli', 'Konya', 'Kütahya', 'Malatya',
    'Manisa', 'Kahramanmaraş', 'Mardin', 'Muğla', 'Muş', 'Nevşehir', 'Niğde', 'Ordu',
    'Rize', 'Sakarya', 'Samsun', 'Siirt', 'Sinop', 'Sivas', 'Tekirdağ', 'Tokat',
    'Trabzon', 'Tunceli', 'Şanlıurfa', 'Uşak', 'Van', 'Yozgat', 'Zonguldak',
    'Aksaray', 'Bayburt', 'Karaman', 'Kırıkkale', 'Batman', 'Şırnak', 'Bartın',
    'Ardahan', 'Iğdır', 'Yalova', 'Karabük', 'Kilis', 'Osmaniye', 'Düzce',
]);
function isProvince(name) {
    return TURKEY_PROVINCES.has(name.trim());
}
/* ── Main API ──────────────────────────────────────────────────────────── */
/**
 * Reverse geocode a lat/lng coordinate to Turkish mahalle/ilçe/il using Nominatim.
 * Returns null if no Turkish address could be resolved.
 */
async function reverseGeocodeNominatim(lat, lng) {
    // Check cache first
    const cached = getCached(lat, lng);
    if (cached !== undefined) {
        if (cached)
            console.log(`[GeocodeSvc] Cache hit: ${cached.mahalle}, ${cached.ilce}, ${cached.il}`);
        return cached;
    }
    await waitForRateLimit();
    const url = `https://nominatim.openstreetmap.org/reverse` +
        `?lat=${lat}&lon=${lng}` +
        `&format=json` +
        `&addressdetails=1` +
        `&accept-language=tr` +
        `&zoom=18`; // max detail level
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'MahallemApp/1.0 (contact@mahallem.com)',
                Accept: 'application/json',
            },
            signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!response.ok) {
            console.warn(`[GeocodeSvc] Nominatim HTTP ${response.status}`);
            setCache(lat, lng, null);
            return null;
        }
        const data = await response.json();
        if (data.error || !data.address) {
            console.warn('[GeocodeSvc] Nominatim returned error or no address');
            setCache(lat, lng, null);
            return null;
        }
        // Only process Turkish addresses
        if (data.address.country_code && data.address.country_code !== 'tr') {
            console.warn('[GeocodeSvc] Not a Turkish address');
            setCache(lat, lng, null);
            return null;
        }
        const mahalle = extractMahalle(data.address);
        const ilce = extractIlce(data.address);
        const il = extractIl(data.address);
        console.log('[GeocodeSvc] Nominatim resolved:', {
            mahalle,
            ilce,
            il,
            rawNeighbourhood: data.address.neighbourhood,
            rawSuburb: data.address.suburb,
            rawQuarter: data.address.quarter,
            rawTown: data.address.town,
            rawCounty: data.address.county,
            rawCity: data.address.city,
            rawState: data.address.state,
            rawProvince: data.address.province,
        });
        // We need at least a mahalle to be useful
        if (!mahalle) {
            // If we got ilçe and il but no mahalle, still return with empty mahalle
            // The frontend can decide what to do
            if (ilce && il) {
                const result = {
                    mahalle: '',
                    ilce,
                    il,
                    postalCode: data.address.postcode || '',
                    source: 'nominatim',
                };
                setCache(lat, lng, result);
                return result;
            }
            setCache(lat, lng, null);
            return null;
        }
        const result = {
            mahalle,
            ilce,
            il,
            postalCode: data.address.postcode || '',
            source: 'nominatim',
        };
        setCache(lat, lng, result);
        return result;
    }
    catch (error) {
        if (error?.name === 'AbortError') {
            console.warn('[GeocodeSvc] Nominatim request timed out');
        }
        else {
            console.error('[GeocodeSvc] Nominatim error:', error?.message);
        }
        return null;
    }
}
/**
 * Clear the geocode cache (useful for testing).
 */
function clearGeocodeCache() {
    cache.clear();
}
/**
 * Get cache stats.
 */
function getGeocodeStats() {
    return {
        cacheSize: cache.size,
        maxCacheSize: MAX_CACHE_SIZE,
        cacheTTL: `${CACHE_TTL_MS / 1000}s`,
    };
}
