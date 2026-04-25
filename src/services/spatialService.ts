import fs from 'fs';
import path from 'path';
import RBush from 'rbush';
import bbox from '@turf/bbox';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';

class SpatialService {
  private tree: RBush<any>;
  private isLoaded: boolean = false;

  constructor() {
    // 9 node'luk bir R-Tree oluşturuyoruz (Performans için ideal default değer)
    this.tree = new RBush(9);
  }

  /**
   * Server başlarken GeoJSON dosyasını belleğe alır ve R-Tree indeksini oluşturur.
   */
  public loadGeoJSON(fileName: string) {
    try {
      console.log('[SpatialService] GeoJSON yükleniyor...');
      const filePath = path.join(__dirname, '../data', fileName);
      const rawData = fs.readFileSync(filePath, 'utf8');
      const geojson = JSON.parse(rawData);

      // R-Tree için item'ları hazırlıyoruz
      const items = geojson.features.map((feature: any) => {
        // Turf.js bbox fonksiyonu [minX, minY, maxX, maxY] döner.
        // GeoJSON formatında X = Longitude (Boylam), Y = Latitude (Enlem)
        const [minX, minY, maxX, maxY] = bbox(feature);
        
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
    } catch (error) {
      console.error('[SpatialService] GeoJSON yükleme hatası:', error);
      throw error;
    }
  }

  /**
   * Verilen Lat/Lng koordinatına göre mahalleyi bulur.
   */
  public resolveNeighborhood(lat: number, lng: number) {
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
    const searchPoint = point([lng, lat]);

    for (const candidate of candidates) {
      // Turf.js hem Polygon hem de MultiPolygon tiplerini otomatik destekler
      const isInside = booleanPointInPolygon(searchPoint, candidate.feature);
      
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
export const spatialService = new SpatialService();
