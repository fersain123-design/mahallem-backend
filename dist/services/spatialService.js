"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.spatialService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const rbush_1 = __importDefault(require("rbush"));
const bbox_1 = __importDefault(require("@turf/bbox"));
const boolean_point_in_polygon_1 = __importDefault(require("@turf/boolean-point-in-polygon"));
const helpers_1 = require("@turf/helpers");
class SpatialService {
    constructor() {
        this.isLoaded = false;
        // 9 node'luk bir R-Tree oluşturuyoruz (Performans için ideal default değer)
        this.tree = new rbush_1.default(9);
    }
    /**
     * Server başlarken GeoJSON dosyasını belleğe alır ve R-Tree indeksini oluşturur.
     */
    loadGeoJSON(fileName) {
        try {
            console.log('[SpatialService] GeoJSON yükleniyor...');
            const filePath = path_1.default.join(__dirname, '../data', fileName);
            const rawData = fs_1.default.readFileSync(filePath, 'utf8');
            const geojson = JSON.parse(rawData);
            // R-Tree için item'ları hazırlıyoruz
            const items = geojson.features.map((feature) => {
                // Turf.js bbox fonksiyonu [minX, minY, maxX, maxY] döner.
                // GeoJSON formatında X = Longitude (Boylam), Y = Latitude (Enlem)
                const [minX, minY, maxX, maxY] = (0, bbox_1.default)(feature);
                return {
                    minX,
                    minY,
                    maxX,
                    maxY,
                    feature // Orijinal poligon verisini referans olarak tutuyoruz
                };
            });
            // Tüm veriyi tek seferde R-Tree'ye yüklüyoruz (Bulk insert çok daha hızlıdır)
            this.tree.load(items);
            this.isLoaded = true;
            console.log(`[SpatialService] Başarıyla ${items.length} mahalle indekslendi.`);
        }
        catch (error) {
            console.error('[SpatialService] GeoJSON yükleme hatası:', error);
            throw error;
        }
    }
    /**
     * Verilen Lat/Lng koordinatına göre mahalleyi bulur.
     */
    resolveNeighborhood(lat, lng) {
        if (!this.isLoaded) {
            throw new Error('Spatial index henüz yüklenmedi.');
        }
        // 1. ADIM: Bounding Box Ön Filtreleme (O(log N) hızında)
        // Noktasal arama yaptığımız için min ve max değerleri aynıdır.
        // Dikkat: R-Tree X ve Y ekseni ile çalışır. X = Lng, Y = Lat
        const searchBox = {
            minX: lng,
            minY: lat,
            maxX: lng,
            maxY: lat
        };
        const candidates = this.tree.search(searchBox);
        // Eğer bounding box içine düşen hiçbir aday yoksa, direkt null dön.
        if (candidates.length === 0) {
            return null;
        }
        // 2. ADIM: Kesin Geometrik Kontrol (Point-in-Polygon)
        // GeoJSON standardı her zaman [longitude, latitude] sırasını kullanır!
        const searchPoint = (0, helpers_1.point)([lng, lat]);
        for (const candidate of candidates) {
            // Turf.js hem Polygon hem de MultiPolygon tiplerini otomatik destekler
            const isInside = (0, boolean_point_in_polygon_1.default)(searchPoint, candidate.feature);
            if (isInside) {
                // Eşleşme bulundu! Sadece ihtiyacımız olan property'leri dönüyoruz.
                const props = candidate.feature.properties;
                return {
                    mahalle: props.mahalle_adi || props.mahalle || props.name || props.MAHALLE,
                    ilce: props.ilce_adi || props.ilce || props.district || props.ILCE,
                    il: props.il_adi || props.il || props.city || props.IL
                };
            }
        }
        // Adayların bounding box'ına düştü ama tam poligonun içine düşmediyse
        return null;
    }
}
// Singleton pattern ile export ediyoruz
exports.spatialService = new SpatialService();
