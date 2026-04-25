import { Request, Response } from 'express';
import { reverseGeocodeNominatim, getGeocodeStats } from '../services/geocodeService';
import {
  findNeighborhoodByCoordinate,
  getPolygonCount,
} from '../data/neighborhoodPolygonService';

/**
 * POST /api/location/resolve
 * Body: { lat: number, lng: number }
 *
 * Resolution strategy (3-tier):
 *   1. Local polygon R-tree (instant, but limited to loaded GeoJSON)
 *   2. Nominatim reverse geocoding (comprehensive Turkey coverage, free)
 *   3. Return partial data if available
 */
export const resolveLocation = async (req: Request, res: Response) => {
  try {
    const { lat, lng } = req.body;

    // 1. Validate input
    if (lat === undefined || lng === undefined || lat === null || lng === null) {
      return res.status(400).json({
        success: false,
        message: 'lat ve lng parametreleri zorunludur.',
      });
    }

    const numericLat = Number(lat);
    const numericLng = Number(lng);

    if (isNaN(numericLat) || isNaN(numericLng)) {
      return res.status(400).json({
        success: false,
        message: 'lat ve lng geçerli birer sayı olmalıdır.',
      });
    }

    if (numericLat < -90 || numericLat > 90 || numericLng < -180 || numericLng > 180) {
      return res.status(400).json({
        success: false,
        message: 'Koordinatlar dünya sınırları dışında.',
      });
    }

    // Turkey bounds check (loose) — log warning but still attempt resolution
    const isTurkeyArea =
      numericLat >= 34.0 && numericLat <= 44.0 &&
      numericLng >= 24.0 && numericLng <= 46.0;

    if (!isTurkeyArea) {
      console.warn(`[LocationResolve] Coordinates outside Turkey bounds: ${numericLat}, ${numericLng}`);
    }

    console.log(`[LocationResolve] lat=${numericLat}, lng=${numericLng}`);

    // 2. Try local polygon data first (instant, no network)
    let result: { mahalle: string; ilce: string; il: string; postalCode?: string; source?: string } | null = null;

    try {
      const polygonMatch = findNeighborhoodByCoordinate(numericLat, numericLng);
      if (polygonMatch?.name) {
        result = {
          mahalle: polygonMatch.name,
          ilce: polygonMatch.district || '',
          il: polygonMatch.city || '',
          postalCode: polygonMatch.postalCode || '',
          source: 'polygon',
        };
        console.log(`[LocationResolve] Polygon hit: ${result.mahalle}, ${result.ilce}, ${result.il}`);
      }
    } catch (err) {
      console.warn('[LocationResolve] Polygon service error:', err);
    }

    // 3. If polygon didn't match, use Nominatim
    if (!result || !result.mahalle) {
      try {
        const nominatimResult = await reverseGeocodeNominatim(numericLat, numericLng);
        if (nominatimResult) {
          result = {
            mahalle: nominatimResult.mahalle || '',
            ilce: nominatimResult.ilce || '',
            il: nominatimResult.il || '',
            postalCode: nominatimResult.postalCode || '',
            source: nominatimResult.source,
          };
          console.log(`[LocationResolve] Nominatim resolved: ${result.mahalle}, ${result.ilce}, ${result.il}`);
        }
      } catch (err) {
        console.warn('[LocationResolve] Nominatim error:', err);
      }
    }

    // 4. Return result — always 200, even if empty (frontend handles gracefully)
    return res.status(200).json({
      success: true,
      data: {
        mahalle: result?.mahalle || '',
        ilce: result?.ilce || '',
        il: result?.il || '',
        postalCode: result?.postalCode || '',
      },
      meta: {
        source: result?.source || 'none',
        polygonCount: getPolygonCount(),
      },
    });
  } catch (error) {
    console.error('[LocationResolve] Unexpected error:', error);
    return res.status(500).json({
      success: false,
      message: 'Sunucu tarafında bir hata oluştu.',
    });
  }
};

/**
 * GET /api/location/stats — Cache and service diagnostics
 */
export const getLocationStats = (_req: Request, res: Response) => {
  try {
    const stats = getGeocodeStats();
    return res.json({
      success: true,
      data: {
        ...stats,
        polygonCount: getPolygonCount(),
      },
    });
  } catch {
    return res.json({ success: true, data: {} });
  }
};
