"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCategoriesByStoreType = exports.isVendorManagedStoreType = exports.normalizeStoreType = exports.STORE_TYPE_ALIASES = exports.STORE_CATEGORIES = void 0;
const sharedFoodImages = {
    produce: 'market.jpg',
    bakery: 'firin.webp',
    meat: 'kasap.jpeg',
    deli: 'sarkuteri_2.webp',
    snacks: 'bufe.jpg',
    seafood: 'balik-tezgahiaa-2373472.jpg',
    coffee: 'kafe.jpg',
    nuts: 'kuruyemisci.jpg',
    herbs: 'aktarci.webp',
    flowers: 'cicekci.jpg',
    general: 'market.jpg',
};
const MARKET_MANAV_STORE_CATEGORIES = [
    { id: 'sebze', name: 'Sebze', icon: 'carrot', image: 'manavvvv.jpg' },
    { id: 'meyve', name: 'Meyve', icon: 'food-apple', image: sharedFoodImages.produce },
    { id: 'yesillik', name: 'Yesillik', icon: 'leaf', image: sharedFoodImages.produce },
    { id: 'organik_urunler', name: 'Organik Urunler', icon: 'sprout-outline', image: sharedFoodImages.produce },
    { id: 'paketli_hazir_manav_urunleri', name: 'Paketli / Hazir Manav Urunleri', icon: 'package-variant-closed', image: sharedFoodImages.produce },
    { id: 'et_tavuk_balik', name: 'Et, Tavuk ve Balik', icon: 'food-steak', image: sharedFoodImages.meat },
    { id: 'sut_urunleri', name: 'Sut Urunleri', icon: 'cup', image: sharedFoodImages.deli },
    { id: 'kahvaltiliklar', name: 'Kahvaltiliklar', icon: 'egg-fried', image: sharedFoodImages.deli },
    { id: 'yumurta', name: 'Yumurta', icon: 'egg', image: sharedFoodImages.deli },
    { id: 'ekmek_firin_urunleri', name: 'Ekmek ve Firin Urunleri', icon: 'bread-slice', image: sharedFoodImages.bakery },
    { id: 'temel_gida', name: 'Temel Gida', icon: 'basket', image: sharedFoodImages.general },
    { id: 'bakliyat_tahil', name: 'Bakliyat ve Tahil', icon: 'grain', image: sharedFoodImages.general },
    { id: 'un_seker', name: 'Un ve Seker', icon: 'sack', image: sharedFoodImages.general },
    { id: 'yaglar', name: 'Yaglar', icon: 'oil', image: sharedFoodImages.general },
    { id: 'soslar_baharatlar', name: 'Soslar ve Baharatlar', icon: 'shaker-outline', image: sharedFoodImages.general },
    { id: 'konserve_hazir_gida', name: 'Konserve ve Hazir Gida', icon: 'food-variant', image: sharedFoodImages.general },
    { id: 'dondurulmus_gida', name: 'Dondurulmus Gida', icon: 'snowflake', image: sharedFoodImages.general },
    { id: 'atistirmaliklar', name: 'Atistirmaliklar', icon: 'food-outline', image: sharedFoodImages.snacks },
    { id: 'cips_kraker', name: 'Cips ve Kraker', icon: 'chips', image: sharedFoodImages.snacks },
    { id: 'cikolata_sekerleme', name: 'Cikolata ve Sekerleme', icon: 'candy-outline', image: sharedFoodImages.snacks },
    { id: 'kuruyemis_kuru_meyve', name: 'Kuruyemis ve Kuru Meyve', icon: 'peanut', image: sharedFoodImages.nuts },
    { id: 'icecekler', name: 'Icecekler', icon: 'cup', image: sharedFoodImages.snacks },
    { id: 'su', name: 'Su', icon: 'water', image: sharedFoodImages.general },
    { id: 'gazli_icecekler', name: 'Gazli Icecekler', icon: 'bottle-soda-outline', image: sharedFoodImages.snacks },
    { id: 'meyve_sulari', name: 'Meyve Sulari', icon: 'cup-water', image: sharedFoodImages.snacks },
    { id: 'cay_kahve', name: 'Cay ve Kahve', icon: 'coffee', image: sharedFoodImages.coffee },
    { id: 'temizlik_urunleri', name: 'Temizlik Urunleri', icon: 'spray-bottle', image: sharedFoodImages.general },
    { id: 'camasir_urunleri', name: 'Camasir Urunleri', icon: 'washing-machine', image: sharedFoodImages.general },
    { id: 'bulasik_urunleri', name: 'Bulasik Urunleri', icon: 'dishwasher', image: sharedFoodImages.general },
    { id: 'yuzey_temizleyiciler', name: 'Yuzey Temizleyiciler', icon: 'home-floor-1', image: sharedFoodImages.general },
    { id: 'kagit_urunleri', name: 'Kagit Urunleri', icon: 'toilet-paper', image: sharedFoodImages.general },
    { id: 'kisisel_bakim', name: 'Kisisel Bakim', icon: 'face-man', image: sharedFoodImages.general },
    { id: 'bebek_urunleri', name: 'Bebek Urunleri', icon: 'baby-face-outline', image: sharedFoodImages.general },
    { id: 'pet_urunleri', name: 'Pet Urunleri', icon: 'paw', image: sharedFoodImages.general },
    { id: 'genel_ihtiyac_urunleri', name: 'Genel Ihtiyac Urunleri', icon: 'storefront-outline', image: sharedFoodImages.general },
];
const FIRIN_STORE_CATEGORIES = [
    { id: 'ekmek', name: 'Ekmek', icon: 'bread-slice', image: sharedFoodImages.bakery },
    { id: 'kahvaltilik_firin_urunleri', name: 'Kahvaltılık Fırın Ürünleri', icon: 'baguette', image: sharedFoodImages.bakery },
    { id: 'hamur_isleri', name: 'Hamur İşleri', icon: 'pretzel', image: sharedFoodImages.bakery },
    { id: 'tuzlu_atistirmaliklar', name: 'Tuzlu Atıştırmalıklar', icon: 'food-variant', image: sharedFoodImages.bakery },
    { id: 'paketli_firin_urunleri', name: 'Paketli Fırın Ürünleri', icon: 'package-variant-closed', image: sharedFoodImages.bakery },
];
const PASTANE_STORE_CATEGORIES = [
    { id: 'yas_pasta', name: 'Yaş Pasta', icon: 'cake-variant', image: 'pastane.webp' },
    { id: 'kuru_pasta', name: 'Kuru Pasta', icon: 'cookie', image: 'pastane.webp' },
    { id: 'tatlilar', name: 'Tatlılar', icon: 'baklava', image: 'pastane.webp' },
    { id: 'sutlu_tatlilar', name: 'Sütlü Tatlılar', icon: 'cupcake', image: 'pastane.webp' },
    { id: 'kek_kurabiye', name: 'Kek & Kurabiye', icon: 'cake', image: 'pastane.webp' },
    { id: 'cikolata_ozel_lezzetler', name: 'Çikolata & Özel Lezzetler', icon: 'candy-outline', image: 'pastane.webp' },
    { id: 'tuzlu_pastane_urunleri', name: 'Tuzlu Pastane Ürünleri', icon: 'food-croissant', image: 'pastane.webp' },
];
const FIRIN_PASTANE_STORE_CATEGORIES = [
    ...FIRIN_STORE_CATEGORIES,
    ...PASTANE_STORE_CATEGORIES,
];
const KASAP_STORE_CATEGORIES = [
    { id: 'dana_eti', name: 'Dana Eti', icon: 'food-steak', image: sharedFoodImages.meat },
    { id: 'kuzu_eti', name: 'Kuzu Eti', icon: 'food-steak', image: sharedFoodImages.meat },
    { id: 'tavuk', name: 'Tavuk', icon: 'food-drumstick', image: sharedFoodImages.meat },
    { id: 'hindi', name: 'Hindi', icon: 'food-turkey', image: sharedFoodImages.meat },
    { id: 'kiyma', name: 'Kiyma', icon: 'food', image: sharedFoodImages.meat },
    { id: 'kusbasi', name: 'Kusbasi', icon: 'food', image: sharedFoodImages.meat },
    { id: 'sakatat', name: 'Sakatat', icon: 'food-turkey', image: sharedFoodImages.meat },
    { id: 'hazir_et_urunleri', name: 'Hazir Et Urunleri', icon: 'package-variant', image: sharedFoodImages.meat },
    { id: 'marine_urunler', name: 'Marine Urunler', icon: 'bowl-mix-outline', image: sharedFoodImages.meat },
    { id: 'islenmis_et_urunleri', name: 'Islenmis Et Urunleri', icon: 'food-variant', image: sharedFoodImages.meat },
    { id: 'kemik_yardimci_urunler', name: 'Kemik & Yardimci Urunler', icon: 'bone', image: sharedFoodImages.meat },
    { id: 'dondurulmus_et_urunleri', name: 'Dondurulmus Et Urunleri', icon: 'snowflake', image: sharedFoodImages.meat },
];
const SARKUTERI_STORE_CATEGORIES = [
    { id: 'peynir', name: 'Peynir', icon: 'cheese', image: sharedFoodImages.deli },
    { id: 'zeytin', name: 'Zeytin', icon: 'fruit-cherries', image: sharedFoodImages.deli },
    { id: 'salam', name: 'Salam', icon: 'food-drumstick-outline', image: sharedFoodImages.deli },
    { id: 'sucuk', name: 'Sucuk', icon: 'food-steak', image: sharedFoodImages.deli },
    { id: 'sosis', name: 'Sosis', icon: 'sausage', image: sharedFoodImages.deli },
    { id: 'fume_urunler', name: 'Fume Urunler', icon: 'smoke', image: sharedFoodImages.deli },
    { id: 'kahvaltilik_urunler', name: 'Kahvaltilik Urunler', icon: 'egg-fried', image: sharedFoodImages.deli },
    { id: 'sandviclik_urunler', name: 'Sandviclik Urunler', icon: 'food-outline', image: sharedFoodImages.deli },
    { id: 'hazir_sarkuteri_urunleri', name: 'Hazir Sarkuteri Urunleri', icon: 'package-variant', image: sharedFoodImages.deli },
    {
        id: 'paketli_sarkuteri_urunleri',
        name: 'Paketli Sarkuteri Urunleri',
        icon: 'package-variant-closed',
        image: sharedFoodImages.deli,
    },
    {
        id: 'acik_taze_sarkuteri_urunleri',
        name: 'Acik / Taze Sarkuteri Urunleri',
        icon: 'countertop-outline',
        image: sharedFoodImages.deli,
    },
];
const KASAP_SARKUTERI_STORE_CATEGORIES = [
    ...KASAP_STORE_CATEGORIES,
    ...SARKUTERI_STORE_CATEGORIES,
];
exports.STORE_CATEGORIES = {
    market: MARKET_MANAV_STORE_CATEGORIES,
    manav: [
        { id: 'sebze', name: 'Sebze', icon: 'carrot', image: 'manavvvv.jpg' },
        { id: 'meyve', name: 'Meyve', icon: 'food-apple', image: sharedFoodImages.produce },
        { id: 'yesillikler', name: 'Yeşillikler', icon: 'leaf', image: sharedFoodImages.produce },
        { id: 'paketli_manav', name: 'Paketli Manav', icon: 'package-variant-closed', image: sharedFoodImages.produce },
    ],
    market_manav: MARKET_MANAV_STORE_CATEGORIES,
    firin: FIRIN_STORE_CATEGORIES,
    pastane: PASTANE_STORE_CATEGORIES,
    firin_pastane: FIRIN_PASTANE_STORE_CATEGORIES,
    kasap_sarkuteri: KASAP_SARKUTERI_STORE_CATEGORIES,
    kasap: KASAP_STORE_CATEGORIES,
    bufe: [
        { id: 'mesrubat', name: 'Mesrubat', icon: 'bottle-soda', image: sharedFoodImages.snacks },
        { id: 'atistirmalik', name: 'Atistirmalik', icon: 'popcorn', image: sharedFoodImages.snacks },
        { id: 'dondurma', name: 'Dondurma', icon: 'ice-cream', image: sharedFoodImages.snacks },
    ],
    sarkuteri: SARKUTERI_STORE_CATEGORIES,
    su_bayi: [
        { id: 'damacana', name: 'Damacana Su', icon: 'water', image: sharedFoodImages.general },
        { id: 'paketli_su', name: 'Paketli Su', icon: 'cup-water', image: sharedFoodImages.general },
        { id: 'maden_suyu', name: 'Maden Suyu', icon: 'glass-pint-outline', image: sharedFoodImages.snacks },
        { id: 'soda', name: 'Soda', icon: 'bottle-soda', image: sharedFoodImages.snacks },
        { id: 'icecekler', name: 'Icecekler', icon: 'cup', image: sharedFoodImages.snacks },
    ],
    balikci: [
        { id: 'gunluk_balik', name: 'Gunluk Balik', icon: 'fish', image: sharedFoodImages.seafood },
        { id: 'deniz_urunleri', name: 'Deniz Urunleri', icon: 'shrimp', image: sharedFoodImages.seafood },
        { id: 'temizlenmis_balik', name: 'Temizlenmis Balik', icon: 'knife', image: sharedFoodImages.seafood },
    ],
    tatlici: [
        { id: 'serbetli_tatlilar', name: 'Serbetli Tatlilar', icon: 'baklava', image: 'pastane.webp' },
        { id: 'sutlu_tatlilar', name: 'Sutlu Tatlilar', icon: 'cupcake', image: 'pastane.webp' },
        { id: 'pasta', name: 'Pasta', icon: 'cake-variant', image: 'pastane.webp' },
        { id: 'kek', name: 'Kek', icon: 'cake', image: 'pastane.webp' },
        { id: 'dondurma', name: 'Dondurma', icon: 'ice-cream', image: sharedFoodImages.snacks },
        { id: 'cikolata_sekerleme', name: 'Cikolata ve Sekerleme', icon: 'candy-outline', image: sharedFoodImages.snacks },
        { id: 'atistirmalik_tatlilar', name: 'Atistirmalik Tatlilar', icon: 'cookie-outline', image: 'pastane.webp' },
        { id: 'ozel_gun_tatlilari', name: 'Ozel Gun Tatlilari', icon: 'gift-outline', image: 'pastane.webp' },
    ],
    kafe_kahve_icecek: [
        { id: 'kahve', name: 'Kahve', icon: 'coffee', image: sharedFoodImages.coffee },
        { id: 'cay', name: 'Cay', icon: 'tea', image: sharedFoodImages.coffee },
        { id: 'soguk_icecekler', name: 'Soguk Icecekler', icon: 'cup', image: sharedFoodImages.coffee },
        { id: 'sicak_icecekler', name: 'Sicak Icecekler', icon: 'coffee-outline', image: sharedFoodImages.coffee },
        { id: 'tatlilar', name: 'Tatlilar', icon: 'cupcake', image: sharedFoodImages.coffee },
        { id: 'atistirmaliklar', name: 'Atistirmaliklar', icon: 'cookie-outline', image: sharedFoodImages.coffee },
        { id: 'sandvic_hafif_yemekler', name: 'Sandvic ve Hafif Yemekler', icon: 'food-outline', image: sharedFoodImages.coffee },
        { id: 'paketli_icecekler', name: 'Paketli Icecekler', icon: 'bottle-soda-outline', image: sharedFoodImages.coffee },
    ],
    ev_gunluk_ihtiyac: [
        { id: 'temizlik_urunleri', name: 'Temizlik Urunleri', icon: 'spray-bottle', image: sharedFoodImages.general },
        { id: 'kagit_urunleri', name: 'Kagit Urunleri', icon: 'toilet-paper', image: sharedFoodImages.general },
        { id: 'mutfak_gerecleri', name: 'Mutfak Gerecleri', icon: 'silverware-fork-knife', image: sharedFoodImages.general },
        { id: 'plastik_urunler', name: 'Plastik Urunler', icon: 'package-variant-closed', image: sharedFoodImages.general },
        { id: 'banyo_hijyen_urunleri', name: 'Banyo ve Hijyen Urunleri', icon: 'shower', image: sharedFoodImages.general },
        { id: 'ev_duzeni_saklama', name: 'Ev Duzeni ve Saklama', icon: 'home-outline', image: sharedFoodImages.general },
        { id: 'elektrik_aydinlatma', name: 'Elektrik ve Aydinlatma', icon: 'lightbulb-on-outline', image: sharedFoodImages.general },
        { id: 'nalbur_hirdavat', name: 'Nalbur ve Hirdavat', icon: 'hammer-screwdriver', image: sharedFoodImages.general },
        { id: 'kucuk_ev_aletleri', name: 'Kucuk Ev Aletleri', icon: 'blender-outline', image: sharedFoodImages.general },
        { id: 'genel_ev_ihtiyaclari', name: 'Genel Ev Ihtiyaclari', icon: 'home-city-outline', image: sharedFoodImages.general },
    ],
    kuruyemis: [
        { id: 'kuru_meyve', name: 'Kuru Meyve', icon: 'fruit-grapes', image: sharedFoodImages.nuts },
        { id: 'karisik_urunler', name: 'Karisik Urunler', icon: 'nut', image: sharedFoodImages.nuts },
        { id: 'lokum_sekerleme', name: 'Lokum ve Sekerleme', icon: 'candy', image: sharedFoodImages.nuts },
        { id: 'atistirmaliklar', name: 'Atistirmaliklar', icon: 'food-variant', image: sharedFoodImages.nuts },
        { id: 'draje_kaplamali_urunler', name: 'Draje ve Kaplamali Urunler', icon: 'circle-multiple', image: sharedFoodImages.nuts },
        { id: 'cekirdek_cerezler', name: 'Cekirdek ve Cerezler', icon: 'seed-outline', image: sharedFoodImages.nuts },
        { id: 'saglikli_atistirmaliklar', name: 'Saglikli Atistirmaliklar', icon: 'leaf', image: sharedFoodImages.nuts },
    ],
    aktar: [
        { id: 'baharatlar', name: 'Baharatlar', icon: 'shaker-outline', image: sharedFoodImages.herbs },
        { id: 'bitki_caylari', name: 'Bitki Caylari', icon: 'tea', image: sharedFoodImages.herbs },
        { id: 'kurutulmus_urunler', name: 'Kurutulmus Urunler', icon: 'package-variant', image: sharedFoodImages.herbs },
        { id: 'kuru_meyveler', name: 'Kuru Meyveler', icon: 'fruit-grapes', image: sharedFoodImages.herbs },
        { id: 'dogal_urunler', name: 'Dogal Urunler', icon: 'leaf', image: sharedFoodImages.herbs },
        { id: 'organik_urunler', name: 'Organik Urunler', icon: 'sprout-outline', image: sharedFoodImages.herbs },
        { id: 'yaglar', name: 'Yaglar', icon: 'bottle-tonic-outline', image: sharedFoodImages.herbs },
        { id: 'bitkisel_yaglar', name: 'Bitkisel Yaglar', icon: 'oil', image: sharedFoodImages.herbs },
        { id: 'ozler_ekstraktlar', name: 'Ozler ve Ekstraktlar', icon: 'flask-outline', image: sharedFoodImages.herbs },
        { id: 'bal_ari_urunleri', name: 'Bal ve Ari Urunleri', icon: 'bee', image: sharedFoodImages.herbs },
        { id: 'sirke_dogal_karisimlar', name: 'Sirke ve Dogal Karisimlar', icon: 'bottle-soda-classic-outline', image: sharedFoodImages.herbs },
    ],
    cicekci: [
        { id: 'canli_cicekler', name: 'Canli Cicekler', icon: 'flower', image: sharedFoodImages.flowers },
        { id: 'buketler', name: 'Buketler', icon: 'flower-tulip', image: sharedFoodImages.flowers },
        { id: 'saksi_cicekleri', name: 'Saksi Cicekleri', icon: 'flower-pollen', image: sharedFoodImages.flowers },
        { id: 'aranjmanlar', name: 'Aranjmanlar', icon: 'flower-outline', image: sharedFoodImages.flowers },
        { id: 'celenk_ozel_tasarimlar', name: 'Celenk ve Ozel Tasarimlar', icon: 'gift-outline', image: sharedFoodImages.flowers },
        { id: 'yapay_cicekler', name: 'Yapay Cicekler', icon: 'flower-tulip-outline', image: sharedFoodImages.flowers },
        { id: 'hediyelik_urunler', name: 'Hediyelik Urunler', icon: 'gift-open-outline', image: sharedFoodImages.flowers },
    ],
    petshop: [
        { id: 'mama', name: 'Mama', icon: 'paw', image: sharedFoodImages.general },
        { id: 'odul_mamalari', name: 'Odul Mamalari', icon: 'bone', image: sharedFoodImages.general },
        { id: 'kum', name: 'Kum', icon: 'bucket-outline', image: sharedFoodImages.general },
        { id: 'aksesuar', name: 'Aksesuar', icon: 'dog-side', image: sharedFoodImages.general },
        { id: 'bakim_urunleri', name: 'Bakim Urunleri', icon: 'shower', image: sharedFoodImages.general },
    ],
    diger: [],
};
exports.STORE_TYPE_ALIASES = {
    market_manav: 'market_manav',
    market: 'market',
    manav: 'manav',
    firin_pastane: 'firin_pastane',
    firin: 'firin',
    pastane: 'pastane',
    kasap_sarkuteri: 'kasap_sarkuteri',
    kasap: 'kasap',
    bufe: 'bufe',
    sarkuteri: 'sarkuteri',
    su_bayi: 'su_bayi',
    su_bayii: 'su_bayi',
    balikci: 'balikci',
    tatlici: 'tatlici',
    kafe_kahve_icecek: 'kafe_kahve_icecek',
    kafe: 'kafe_kahve_icecek',
    kahve: 'kafe_kahve_icecek',
    icecek: 'kafe_kahve_icecek',
    ev_gunluk_ihtiyac: 'ev_gunluk_ihtiyac',
    ev_gunluk: 'ev_gunluk_ihtiyac',
    ev: 'ev_gunluk_ihtiyac',
    gunluk_ihtiyaclar: 'ev_gunluk_ihtiyac',
    kuruyemis: 'kuruyemis',
    aktar: 'aktar',
    cicekci: 'cicekci',
    petshop: 'petshop',
    diger: 'diger',
};
const normalizeLookupKey = (value) => String(value || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
const normalizeStoreType = (storeType) => {
    const normalized = normalizeLookupKey(String(storeType || ''));
    return exports.STORE_TYPE_ALIASES[normalized] || 'diger';
};
exports.normalizeStoreType = normalizeStoreType;
const isVendorManagedStoreType = (storeType) => (0, exports.normalizeStoreType)(storeType) === 'diger';
exports.isVendorManagedStoreType = isVendorManagedStoreType;
const getCategoriesByStoreType = (storeType) => {
    const normalizedType = (0, exports.normalizeStoreType)(storeType);
    return exports.STORE_CATEGORIES[normalizedType].map((category) => ({ ...category }));
};
exports.getCategoriesByStoreType = getCategoriesByStoreType;
