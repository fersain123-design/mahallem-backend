import { Router } from 'express';
import { getIller, getIlceler, getMahalleler } from '../data/turkiye-lokasyonlar';
import {
  getNearbyNeighborhoodPolygons,
  getPolygonCount,
  findNeighborhoodByCoordinate,
  getPolygonServiceStatus,
} from '../data/neighborhoodPolygonService';
import { reverseGeocodeNominatim } from '../services/geocodeService';

const router = Router();

// GET /api/locations/iller - Tüm illeri listele
router.get('/iller', (req, res) => {
  const iller = getIller();
  res.json({
    success: true,
    data: iller
  });
});

// GET /api/locations/neighborhoods/resolve?lat=...&lng=...
// Server-side point-in-polygon + Nominatim fallback
router.get('/neighborhoods/resolve', async (req, res) => {
  const lat = parseFloat(String(req.query.lat || ''));
  const lng = parseFloat(String(req.query.lng || ''));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({
      success: false,
      message: 'lat and lng query parameters are required (numeric)',
    });
  }

  const start = Date.now();

  // 1. Try local polygon first
  let match = findNeighborhoodByCoordinate(lat, lng);

  // 2. If no polygon match, try Nominatim
  if (!match?.name) {
    try {
      const nominatim = await reverseGeocodeNominatim(lat, lng);
      if (nominatim && (nominatim.mahalle || nominatim.ilce)) {
        match = {
          name: nominatim.mahalle || '',
          district: nominatim.ilce || '',
          city: nominatim.il || '',
          postalCode: nominatim.postalCode || '',
        };
      }
    } catch (err) {
      console.warn('[neighborhoods/resolve] Nominatim fallback error:', err);
    }
  }

  const elapsed = Date.now() - start;

  res.json({
    success: true,
    data: match,
    meta: {
      resolvedIn: `${elapsed}ms`,
      totalPolygons: getPolygonCount(),
    },
  });
});

// GET /api/locations/neighborhoods/polygon?lat=...&lng=...
// Returns nearby neighborhood polygons as GeoJSON FeatureCollection
router.get('/neighborhoods/polygon', (req, res) => {
  const lat = parseFloat(String(req.query.lat || ''));
  const lng = parseFloat(String(req.query.lng || ''));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({
      success: false,
      message: 'lat and lng query parameters are required (numeric)',
    });
  }

  const radiusDeg = Math.min(
    parseFloat(String(req.query.radius || '0.1')),
    0.5 // max ~50km radius to prevent huge responses
  );

  const data = getNearbyNeighborhoodPolygons(lat, lng, radiusDeg);

  res.json({
    success: true,
    data,
    meta: {
      totalPolygons: getPolygonCount(),
      nearbyCount: data.features.length,
      searchCenter: { lat, lng },
      searchRadiusDeg: radiusDeg,
    },
  });
});

// GET /api/locations/neighborhoods/status - Polygon service diagnostics
router.get('/neighborhoods/status', (_req, res) => {
  const status = getPolygonServiceStatus();
  res.json({ success: true, data: status });
});

// GET /api/locations/ilceler/:ilId - Belirli bir ilin ilçelerini listele
router.get('/ilceler/:ilId', (req, res) => {
  const { ilId } = req.params;
  const ilceler = getIlceler(ilId);
  res.json({
    success: true,
    data: ilceler
  });
});

// GET /api/locations/mahalleler/:ilId/:ilceId - Belirli bir ilçenin mahallelerini listele
router.get('/mahalleler/:ilId/:ilceId', (req, res) => {
  const { ilId, ilceId } = req.params;
  const mahalleler = getMahalleler(ilId, ilceId);
  res.json({
    success: true,
    data: mahalleler
  });
});

export default router;
