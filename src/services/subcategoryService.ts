import prisma from '../config/db';
import { AppError } from '../middleware/errorHandler';
import { normalizeStoreType, type StoreTypeKey } from '../config/storeCategories';

const slugifyTr = (input: string) =>
  String(input || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

type SeedCategory = {
  name: string;
  slug: string;
  subCategories: Array<{ name: string; slug: string }>;
};

const MARKET_MANAV_SUBCATEGORY_SEED: Array<{ name: string; slug: string }> = [
  { name: 'Sebze', slug: 'sebze' },
  { name: 'Meyve', slug: 'meyve' },
  { name: 'Yeşillikler', slug: 'yesillikler' },
  { name: 'Paketli Manav', slug: 'paketli-manav' },
  { name: 'Et, Tavuk & Balık', slug: 'et-tavuk-balik' },
  { name: 'Şarküteri', slug: 'sarkuteri' },
  { name: 'Süt & Kahvaltılık', slug: 'sut-kahvaltilik' },
  { name: 'Ekmek & Fırın', slug: 'ekmek-firin' },
  { name: 'Temel Gıda', slug: 'temel-gida' },
  { name: 'Dondurulmus Gida', slug: 'dondurulmus-gida' },
  { name: 'Atıştırmalık', slug: 'atistirmalik' },
  { name: 'İçecek', slug: 'icecek' },
  { name: 'Temizlik', slug: 'temizlik' },
  { name: 'Kağıt Ürünleri', slug: 'kagit-urunleri' },
  { name: 'Kişisel Bakım', slug: 'kisisel-bakim' },
  { name: 'Bebek', slug: 'bebek' },
  { name: 'Pet', slug: 'pet' },
];

const FIRIN_SUBCATEGORY_SEED: Array<{ name: string; slug: string }> = [
  { name: 'Ekmek', slug: 'ekmek' },
  { name: 'Kahvaltılık Fırın Ürünleri', slug: 'kahvaltilik-firin-urunleri' },
  { name: 'Hamur İşleri', slug: 'hamur-isleri' },
  { name: 'Tuzlu Atıştırmalıklar', slug: 'tuzlu-atistirmaliklar' },
  { name: 'Paketli Fırın Ürünleri', slug: 'paketli-firin-urunleri' },
];

const PASTANE_SUBCATEGORY_SEED: Array<{ name: string; slug: string }> = [
  { name: 'Yaş Pasta', slug: 'yas-pasta' },
  { name: 'Kuru Pasta', slug: 'kuru-pasta' },
  { name: 'Tatlılar', slug: 'tatlilar' },
  { name: 'Sütlü Tatlılar', slug: 'sutlu-tatlilar' },
  { name: 'Kek & Kurabiye', slug: 'kek-kurabiye' },
  { name: 'Çikolata & Özel Lezzetler', slug: 'cikolata-ozel-lezzetler' },
  { name: 'Tuzlu Pastane Ürünleri', slug: 'tuzlu-pastane-urunleri' },
];

const FIRIN_PASTANE_SUBCATEGORY_SEED: Array<{ name: string; slug: string }> = [
  ...FIRIN_SUBCATEGORY_SEED,
  ...PASTANE_SUBCATEGORY_SEED,
];

const KASAP_SUBCATEGORY_SEED: Array<{ name: string; slug: string }> = [
  { name: 'Dana Eti', slug: 'dana-eti' },
  { name: 'Kuzu Eti', slug: 'kuzu-eti' },
  { name: 'Tavuk', slug: 'tavuk' },
  { name: 'Hindi', slug: 'hindi' },
  { name: 'Kiyma', slug: 'kiyma' },
  { name: 'Kusbasi', slug: 'kusbasi' },
  { name: 'Sakatat', slug: 'sakatat' },
  { name: 'Islenmis Et Urunleri', slug: 'islenmis-et-urunleri' },
  { name: 'Sarkuteri Urunleri', slug: 'sarkuteri-urunleri' },
  { name: 'Hazir Et Urunleri', slug: 'hazir-et-urunleri' },
  { name: 'Marine Urunler', slug: 'marine-urunler' },
  { name: 'Kemik & Yardimci Urunler', slug: 'kemik-yardimci-urunler' },
  { name: 'Dondurulmus Et Urunleri', slug: 'dondurulmus-et-urunleri' },
];

const SARKUTERI_SUBCATEGORY_SEED: Array<{ name: string; slug: string }> = [
  { name: 'Peynir', slug: 'peynir' },
  { name: 'Zeytin', slug: 'zeytin' },
  { name: 'Salam', slug: 'salam' },
  { name: 'Sucuk', slug: 'sucuk' },
  { name: 'Sosis', slug: 'sosis' },
  { name: 'Fume Urunler', slug: 'fume-urunler' },
  { name: 'Kahvaltilik Urunler', slug: 'kahvaltilik-urunler' },
  { name: 'Sandiviclik Urunler', slug: 'sandiviclik-urunler' },
  { name: 'Hazir Sarkuteri Urunleri', slug: 'hazir-sarkuteri-urunleri' },
  { name: 'Paketli Sarkuteri Urunleri', slug: 'paketli-sarkuteri-urunleri' },
  { name: 'Acik / Taze Sarkuteri Urunleri', slug: 'acik-taze-sarkuteri-urunleri' },
];

const KASAP_SARKUTERI_SUBCATEGORY_SEED: Array<{ name: string; slug: string }> = [
  ...KASAP_SUBCATEGORY_SEED,
  ...SARKUTERI_SUBCATEGORY_SEED,
];

export const BASE_CATEGORY_SEED: SeedCategory[] = [
  {
    name: 'Kasap',
    slug: 'kasap',
    subCategories: KASAP_SUBCATEGORY_SEED,
  },
  {
    name: 'Manav',
    slug: 'manav',
    subCategories: [
      { name: 'Sebze', slug: 'sebze' },
      { name: 'Meyve', slug: 'meyve' },
      { name: 'Yeşillikler', slug: 'yesillikler' },
      { name: 'Paketli Manav', slug: 'paketli-manav' },
    ],
  },
  {
    name: 'Market',
    slug: 'market',
    subCategories: MARKET_MANAV_SUBCATEGORY_SEED,
  },
  {
    name: 'Market & Manav',
    slug: 'market-manav',
    subCategories: MARKET_MANAV_SUBCATEGORY_SEED,
  },
  {
    name: 'Fırın',
    slug: 'firin',
    subCategories: FIRIN_SUBCATEGORY_SEED,
  },
  {
    name: 'Pastane',
    slug: 'pastane',
    subCategories: PASTANE_SUBCATEGORY_SEED,
  },
  {
    name: 'Firin & Pastane',
    slug: 'firin-pastane',
    subCategories: FIRIN_PASTANE_SUBCATEGORY_SEED,
  },
  {
    name: 'Atistirmalik Bufe',
    slug: 'bufe',
    subCategories: [
      { name: 'Mesrubat', slug: 'mesrubat' },
      { name: 'Atistirmalik', slug: 'atistirmalik' },
      { name: 'Dondurma', slug: 'dondurma' },
      { name: 'Hazir Gida', slug: 'hazir-gida' },
      { name: 'Kahve ve Sicak Icecek', slug: 'kahve-sicak-icecek' },
    ],
  },
  {
    name: 'Kasap & Sarkuteri',
    slug: 'kasap-sarkuteri',
    subCategories: KASAP_SARKUTERI_SUBCATEGORY_SEED,
  },
  {
    name: 'Sarkuteri',
    slug: 'sarkuteri',
    subCategories: SARKUTERI_SUBCATEGORY_SEED,
  },
  {
    name: 'Su Bayi',
    slug: 'su-bayi',
    subCategories: [
      { name: 'Damacana Su', slug: 'damacana-su' },
      { name: 'Paketli Su', slug: 'paketli-su' },
      { name: 'Maden Suyu', slug: 'maden-suyu' },
      { name: 'Soda', slug: 'soda' },
      { name: 'Icecekler', slug: 'icecekler' },
    ],
  },
  {
    name: 'Balikci',
    slug: 'balikci',
    subCategories: [
      { name: 'Gunluk Balik', slug: 'gunluk-balik' },
      { name: 'Deniz Urunleri', slug: 'deniz-urunleri' },
      { name: 'Temizlenmis Fileto', slug: 'temizlenmis-fileto' },
      { name: 'Pisirmeye Hazir', slug: 'pisirmeye-hazir' },
      { name: 'Mevsim Baliklari', slug: 'mevsim-baliklari' },
    ],
  },
  {
    name: 'Tatlici',
    slug: 'tatlici',
    subCategories: [
      { name: 'Serbetli Tatlilar', slug: 'serbetli-tatlilar' },
      { name: 'Sutlu Tatlilar', slug: 'sutlu-tatlilar' },
      { name: 'Pasta', slug: 'pasta' },
      { name: 'Kek', slug: 'kek' },
      { name: 'Dondurma', slug: 'dondurma' },
      { name: 'Cikolata ve Sekerleme', slug: 'cikolata-sekerleme' },
      { name: 'Atistirmalik Tatlilar', slug: 'atistirmalik-tatlilar' },
      { name: 'Ozel Gun Tatlilari', slug: 'ozel-gun-tatlilari' },
    ],
  },
  {
    name: 'Kafe',
    slug: 'kafe-kahve-icecek',
    subCategories: [
      { name: 'Kahve', slug: 'kahve' },
      { name: 'Cay', slug: 'cay' },
      { name: 'Soguk Icecekler', slug: 'soguk-icecekler' },
      { name: 'Tatlilar', slug: 'tatlilar' },
      { name: 'Atistirmaliklar', slug: 'atistirmaliklar' },
    ],
  },
  {
    name: 'Ev & Gunluk Ihtiyac',
    slug: 'ev-gunluk-ihtiyac',
    subCategories: [
      { name: 'Temizlik Urunleri', slug: 'temizlik-urunleri' },
      { name: 'Kagit Urunleri', slug: 'kagit-urunleri' },
      { name: 'Mutfak Gerecleri', slug: 'mutfak-gerecleri' },
      { name: 'Plastik Urunler', slug: 'plastik-urunler' },
      { name: 'Banyo ve Hijyen Urunleri', slug: 'banyo-hijyen-urunleri' },
      { name: 'Ev Duzeni ve Saklama', slug: 'ev-duzeni-saklama' },
      { name: 'Elektrik ve Aydinlatma', slug: 'elektrik-aydinlatma' },
      { name: 'Nalbur ve Hirdavat', slug: 'nalbur-hirdavat' },
      { name: 'Kucuk Ev Aletleri', slug: 'kucuk-ev-aletleri' },
      { name: 'Genel Ev Ihtiyaclari', slug: 'genel-ev-ihtiyaclari' },
    ],
  },
  {
    name: 'Kuruyemisci',
    slug: 'kuruyemisci',
    subCategories: [
      { name: 'Kuru Meyve', slug: 'kuru-meyve' },
      { name: 'Karisik Urunler', slug: 'karisik-urunler' },
      { name: 'Lokum ve Sekerleme', slug: 'lokum-sekerleme' },
      { name: 'Atistirmaliklar', slug: 'atistirmaliklar' },
      { name: 'Draje ve Kaplamali Urunler', slug: 'draje-kaplamali-urunler' },
      { name: 'Cekirdek ve Cerezler', slug: 'cekirdek-cerezler' },
      { name: 'Saglikli Atistirmaliklar', slug: 'saglikli-atistirmaliklar' },
    ],
  },
  {
    name: 'Aktar',
    slug: 'aktar',
    subCategories: [
      { name: 'Baharatlar', slug: 'baharatlar' },
      { name: 'Bitki Caylari', slug: 'bitki-caylari' },
      { name: 'Kurutulmus Urunler', slug: 'kurutulmus-urunler' },
      { name: 'Kuru Meyveler', slug: 'kuru-meyveler' },
      { name: 'Dogal Urunler', slug: 'dogal-urunler' },
      { name: 'Organik Urunler', slug: 'organik-urunler' },
      { name: 'Yaglar', slug: 'yaglar' },
      { name: 'Bitkisel Yaglar', slug: 'bitkisel-yaglar' },
      { name: 'Ozler ve Ekstraktlar', slug: 'ozler-ekstraktlar' },
      { name: 'Bal ve Ari Urunleri', slug: 'bal-ari-urunleri' },
      { name: 'Sirke ve Dogal Karisimlar', slug: 'sirke-dogal-karisimlar' },
    ],
  },
  {
    name: 'Cicekci',
    slug: 'cicekci',
    subCategories: [
      { name: 'Canli Cicekler', slug: 'canli-cicekler' },
      { name: 'Buketler', slug: 'buketler' },
      { name: 'Saksi Cicekleri', slug: 'saksi-cicekleri' },
      { name: 'Aranjmanlar', slug: 'aranjmanlar' },
      { name: 'Celenk ve Ozel Tasarimlar', slug: 'celenk-ozel-tasarimlar' },
      { name: 'Yapay Cicekler', slug: 'yapay-cicekler' },
      { name: 'Hediyelik Urunler', slug: 'hediyelik-urunler' },
    ],
  },
  {
    name: 'Petshop',
    slug: 'petshop',
    subCategories: [
      { name: 'Mama', slug: 'mama' },
      { name: 'Odul Mamalari', slug: 'odul-mamalari' },
      { name: 'Kum', slug: 'kum' },
      { name: 'Aksesuar', slug: 'aksesuar' },
      { name: 'Bakim Urunleri', slug: 'bakim-urunleri' },
    ],
  },
];

export const STORE_TYPE_TO_CATEGORY_SLUG: Record<StoreTypeKey, string> = {
  market: 'market',
  manav: 'manav',
  market_manav: 'market-manav',
  firin: 'firin',
  pastane: 'pastane',
  firin_pastane: 'firin-pastane',
  kasap_sarkuteri: 'kasap-sarkuteri',
  kasap: 'kasap',
  bufe: 'bufe',
  sarkuteri: 'sarkuteri',
  su_bayi: 'su-bayi',
  balikci: 'balikci',
  tatlici: 'tatlici',
  kafe_kahve_icecek: 'kafe-kahve-icecek',
  ev_gunluk_ihtiyac: 'ev-gunluk-ihtiyac',
  kuruyemis: 'kuruyemisci',
  aktar: 'aktar',
  cicekci: 'cicekci',
  petshop: 'petshop',
  diger: 'market',
};

const SUBCATEGORY_KEYWORDS: Record<string, Record<string, string[]>> = {
  kasap: {
    'dana-eti': ['dana', 'antrikot', 'bonfile', 'biftek', 'dana eti'],
    'kuzu-eti': ['kuzu', 'pirzola', 'kuzu eti'],
    tavuk: ['tavuk', 'but', 'kanat', 'gogus'],
    hindi: ['hindi', 'hindi eti'],
    kiyma: ['kiyma', 'dana kiyma', 'kuzu kiyma'],
    kusbasi: ['kusbasi', 'et kusbasi'],
    sakatat: ['sakatat', 'ciger', 'yurek', 'bobrek'],
    'islenmis-et-urunleri': ['islenmis et', 'sucuk', 'salam', 'sosis', 'pastirma'],
    'sarkuteri-urunleri': ['sarkuteri', 'jambon', 'fume et'],
    'hazir-et-urunleri': ['hazir et', 'kofte', 'doner', 'hazir kofte'],
    'marine-urunler': ['marine', 'terbiyeli', 'soslu et'],
    'kemik-yardimci-urunler': ['kemik', 'ilikli kemik', 'et suyu', 'yardimci urun'],
    'dondurulmus-et-urunleri': ['dondurulmus et', 'donuk et', 'frozen et'],
  },
  manav: {
    meyve: ['elma', 'armut', 'muz', 'portakal', 'cilek', 'uzum', 'meyve'],
    sebze: ['domates', 'patlican', 'biber', 'patates', 'sogan', 'sebze'],
    yesillikler: ['maydanoz', 'roka', 'dereotu', 'nane', 'yesillik', 'yesillikler'],
    'paketli-manav': ['dogranmis', 'salata seti', 'hazir salata', 'paketli', 'paketli manav'],
  },
  market: {
    sebze: ['sebze', 'domates', 'patates', 'biber', 'sogan'],
    meyve: ['meyve', 'elma', 'armut', 'muz', 'portakal'],
    yesillikler: ['yesillik', 'yesillikler', 'maydanoz', 'roka', 'dereotu', 'nane'],
    'paketli-manav': ['paketli', 'hazir manav', 'dogranmis', 'paketli manav'],
    'et-tavuk-balik': ['et', 'dana', 'kuzu', 'tavuk', 'hindi', 'balik', 'deniz urunu', 'et tavuk balik'],
    sarkuteri: ['sarkuteri', 'sucuk', 'salam', 'sosis', 'jambon', 'pastirma'],
    'sut-kahvaltilik': ['sut', 'yogurt', 'peynir', 'tereyag', 'kahvalti', 'ayran', 'zeytin', 'recel'],
    'ekmek-firin': ['ekmek', 'baget', 'somun', 'firin', 'pogaca', 'borek', 'acma'],
    'temel-gida': ['pirinc', 'makarna', 'bulgur', 'un', 'bakliyat', 'temel gida'],
    'dondurulmus-gida': ['dondurulmus', 'frozen', 'hazir gida', 'hazir yemek', 'pizza'],
    atistirmalik: ['cips', 'biskuvi', 'cikolata', 'kraker', 'atistirmalik'],
    icecek: ['kola', 'meyve suyu', 'soda', 'gazoz', 'icecek', 'su', 'limonata'],
    temizlik: ['deterjan', 'camasir suyu', 'temizlik', 'yumusatici', 'dezenfektan'],
    'kagit-urunleri': ['pecete', 'kagit havlu', 'tuvalet kagidi', 'mendil'],
    'kisisel-bakim': ['sampuan', 'dus jeli', 'dis macunu', 'sabun', 'deodorant', 'kisisel bakim'],
    bebek: ['bebek', 'bez', 'islak mendil', 'bebek mamasi'],
    pet: ['kedi mamasi', 'kopek mamasi', 'pet mama', 'kedi kumu', 'pet'],
  },
  'market-manav': {
    sebze: ['sebze', 'domates', 'patates', 'biber', 'sogan'],
    meyve: ['meyve', 'elma', 'armut', 'muz', 'portakal'],
    yesillik: ['yesillik', 'maydanoz', 'roka', 'dereotu', 'nane'],
    'organik-urunler': ['organik'],
    'paketli-hazir-manav-urunleri': ['paketli', 'hazir manav', 'dogranmis'],
    'kirmizi-et': ['kirmizi et', 'dana', 'kuzu', 'bonfile', 'antrikot'],
    'beyaz-et': ['beyaz et', 'tavuk', 'hindi'],
    'balik-deniz-urunleri': ['balik', 'deniz urunu', 'karides', 'midye'],
    'islenmis-et': ['sucuk', 'salam', 'sosis', 'islenmis et'],
    'sut-urunleri': ['sut', 'yogurt', 'ayran', 'kefir'],
    kahvaltiliklar: ['kahvalti', 'zeytin', 'bal', 'recel'],
    yumurta: ['yumurta'],
    ekmek: ['ekmek', 'baget', 'somun'],
    'unlu-mamuller': ['unlu', 'pogaca', 'borek', 'acma'],
    bakliyat: ['bakliyat', 'nohut', 'mercimek', 'fasulye'],
    'makarna-tahil': ['makarna', 'tahil', 'bulgur', 'pirinc'],
    'un-seker': ['un', 'seker'],
    yaglar: ['zeytinyagi', 'aycicek yagi', 'tereyagi', 'yag'],
    soslar: ['sos', 'ketcap', 'mayonez'],
    baharatlar: ['baharat', 'kimyon', 'kekik', 'pul biber'],
    konserve: ['konserve'],
    'hazir-yemek': ['hazir yemek', 'hazir corba', 'hazir gida'],
    'dondurulmus-gida': ['dondurulmus', 'frozen'],
    'cips-kraker': ['cips', 'kraker'],
    'tatli-atistirmaliklar': ['tatli atistirmalik', 'biskuvi', 'gofret'],
    'sekerleme-cikolata': ['sekerleme', 'cikolata', 'candy'],
    kuruyemis: ['kuruyemis', 'findik', 'fistik', 'badem'],
    'kuru-meyve': ['kuru meyve', 'kuru incir', 'kuru kayisi'],
    su: ['su', 'damacana', 'pet su'],
    'gazli-icecekler': ['gazli icecek', 'kola', 'gazoz'],
    'meyve-sulari': ['meyve suyu'],
    'soguk-icecekler': ['soguk icecek', 'limonata', 'ice tea'],
    cay: ['cay'],
    kahve: ['kahve', 'turk kahvesi', 'filtre kahve'],
    'bitki-caylari': ['bitki cayi', 'ihlamur', 'rezene', 'yesil cay'],
    'camasir-urunleri': ['camasir deterjani', 'yumusatici'],
    'bulasik-urunleri': ['bulasik deterjani', 'bulasik tableti'],
    'yuzey-temizleyiciler': ['yuzey temizleyici', 'camasir suyu'],
    'tuvalet-kagidi': ['tuvalet kagidi'],
    'kagit-havlu': ['kagit havlu'],
    pecete: ['pecete'],
    'sac-bakim': ['sac bakim', 'sampuan', 'sac kremi'],
    'vucut-bakim': ['vucut bakim', 'dus jeli'],
    'agiz-bakim': ['agiz bakim', 'dis macunu', 'dis fircasi'],
    'bebek-bakim': ['bebek bakim', 'bebek bezi', 'islak mendil'],
    'bebek-beslenme': ['bebek beslenme', 'bebek mamasi'],
    'pet-mama': ['pet mama', 'kedi mamasi', 'kopek mamasi'],
    'pet-bakim': ['pet bakim', 'kedi kumu', 'tasma'],
  },
  firin: {
    ekmek: ['ekmek', 'somun', 'baget', 'lavaş', 'lavas', 'tost ekmegi'],
    'kahvaltilik-firin-urunleri': ['kahvaltilik', 'acma', 'simit', 'poğaca', 'pogaca', 'boyoz'],
    'hamur-isleri': ['hamur isi', 'borek', 'su boregi', 'kisi', 'pizza tabani'],
    'tuzlu-atistirmaliklar': ['tuzlu atistirmalik', 'galeta', 'kraker', 'mini sandvic', 'mini pizza'],
    'paketli-firin-urunleri': ['paketli firin', 'paketli ekmek', 'grissini', 'paketli kurabiye'],
  },
  pastane: {
    'yas-pasta': ['yas pasta', 'dogum gunu pastasi', 'pasta'],
    'kuru-pasta': ['kuru pasta', 'tuzlu kurabiye', 'mini kuru pasta'],
    tatlilar: ['tatli', 'serbetli', 'baklava', 'ekler'],
    'sutlu-tatlilar': ['sutlu tatli', 'sutlac', 'profiterol', 'kazandibi', 'magnolia'],
    'kek-kurabiye': ['kek', 'kurabiye', 'brownie', 'muffin'],
    'cikolata-ozel-lezzetler': ['cikolata', 'truf', 'pralin', 'ozel lezzet'],
    'tuzlu-pastane-urunleri': ['tuzlu pastane', 'kanepe', 'kisirlik', 'tart', 'kisi'],
  },
  'firin-pastane': {
    ekmek: ['ekmek', 'somun', 'baget', 'lavaş', 'lavas', 'tost ekmegi'],
    'kahvaltilik-firin-urunleri': ['kahvaltilik', 'acma', 'simit', 'poğaca', 'pogaca', 'boyoz'],
    'hamur-isleri': ['hamur isi', 'borek', 'su boregi', 'kisi', 'pizza tabani'],
    'tuzlu-atistirmaliklar': ['tuzlu atistirmalik', 'galeta', 'kraker', 'mini sandvic', 'mini pizza'],
    'paketli-firin-urunleri': ['paketli firin', 'paketli ekmek', 'grissini', 'paketli kurabiye'],
    'yas-pasta': ['yas pasta', 'dogum gunu pastasi', 'pasta'],
    'kuru-pasta': ['kuru pasta', 'tuzlu kurabiye', 'mini kuru pasta'],
    tatlilar: ['tatli', 'serbetli', 'baklava', 'ekler'],
    'sutlu-tatlilar': ['sutlu tatli', 'sutlac', 'profiterol', 'kazandibi', 'magnolia'],
    'kek-kurabiye': ['kek', 'kurabiye', 'brownie', 'muffin'],
    'cikolata-ozel-lezzetler': ['cikolata', 'truf', 'pralin', 'ozel lezzet'],
    'tuzlu-pastane-urunleri': ['tuzlu pastane', 'kanepe', 'kisirlik', 'tart', 'kisi'],
  },
  bufe: {
    mesrubat: ['mesrubat', 'kola', 'soda', 'gazoz'],
    atistirmalik: ['cips', 'kraker', 'gofret'],
    dondurma: ['dondurma'],
    'hazir-gida': ['sandvic', 'hazir'],
  },
  sarkuteri: {
    peynir: ['peynir', 'kasar', 'lor'],
    zeytin: ['zeytin'],
    salam: ['salam'],
    sucuk: ['sucuk'],
    sosis: ['sosis'],
    'fume-urunler': ['fume', 'füme', 'smoked', 'pastirma'],
    'kahvaltilik-urunler': ['kahvaltilik', 'kahvalti', 'bal', 'recel', 'tereyag'],
    'sandiviclik-urunler': ['sandvic', 'sandviç', 'tost', 'toast'],
    'hazir-sarkuteri-urunleri': ['hazir', 'hazir paket', 'dilimli'],
    'paketli-sarkuteri-urunleri': ['paketli', 'vakumlu'],
    'acik-taze-sarkuteri-urunleri': ['acik', 'taze', 'tezgah', 'acik taze'],
  },
  'su-bayi': {
    'damacana-su': ['damacana'],
    'paketli-su': ['pet su', 'sise su', 'paketli su'],
    'maden-suyu': ['maden suyu'],
    soda: ['soda'],
    icecekler: ['icecek', 'mesrubat', 'kola', 'gazoz', 'meyve suyu'],
  },
  balikci: {
    'gunluk-balik': ['hamsi', 'levrek', 'cupra', 'palamut'],
    'deniz-urunleri': ['karides', 'midye', 'kalamar'],
    'temizlenmis-fileto': ['fileto', 'temizlenmis'],
    'pisirmeye-hazir': ['marine', 'pisirmeye hazir'],
  },
  tatlici: {
    'serbetli-tatlilar': ['baklava', 'kadayif', 'soguk baklava', 'serbetli'],
    'sutlu-tatlilar': ['sutlac', 'kazandibi', 'profiterol', 'sutlu tatli'],
    pasta: ['pasta', 'yas pasta', 'cheesecake'],
    kek: ['kek', 'brownie', 'muffin', 'islak kek'],
    dondurma: ['dondurma'],
    'cikolata-sekerleme': ['cikolata', 'sekerleme', 'truf', 'bonbon', 'draje'],
    'atistirmalik-tatlilar': ['atistirmalik tatli', 'kurabiye', 'cupcake', 'donut'],
    'ozel-gun-tatlilari': ['ozel gun', 'dogum gunu', 'nisan', 'soz', 'kutlama'],
  },
  'kafe-kahve-icecek': {
    kahve: ['kahve', 'espresso', 'latte', 'filtre kahve', 'americano'],
    cay: ['cay', 'salep', 'sicak cikolata'],
    'soguk-icecekler': ['soguk icecek', 'limonata', 'frappe', 'smoothie'],
    tatlilar: ['tatli', 'pasta', 'brownie', 'cheesecake', 'cookie'],
    atistirmaliklar: ['atistirmalik', 'sandvic', 'wrap', 'croissant'],
  },
  'ev-gunluk-ihtiyac': {
    'temizlik-urunleri': ['deterjan', 'temizlik'],
    'kagit-urunleri': ['tuvalet kagidi', 'pecete', 'kagit havlu'],
    'mutfak-gerecleri': ['tabak', 'bardak', 'mutfak'],
    'plastik-urunler': ['plastik', 'cop poseti', 'saklama kabi'],
    'banyo-hijyen-urunleri': ['sabun', 'sampuan', 'hijyen', 'banyo'],
    'ev-duzeni-saklama': ['saklama', 'kutu', 'duzenleyici', 'raf'],
    'elektrik-aydinlatma': ['ampul', 'pil', 'uzatma kablosu', 'aydinlatma'],
    'nalbur-hirdavat': ['nalbur', 'vida', 'civi', 'hirdavat', 'yapi market'],
    'kucuk-ev-aletleri': ['kettle', 'blender', 'tost makinesi', 'kucuk ev aleti'],
    'genel-ev-ihtiyaclari': ['ev ihtiyaci', 'genel ihtiyac', 'yardimci urun'],
  },
  kuruyemisci: {
    'kuru-meyve': ['kuru incir', 'kuru kayisi', 'kuru uzum'],
    'karisik-urunler': ['karisik urun', 'karisik kuruyemis', 'lux', 'kokteyl'],
    'lokum-sekerleme': ['lokum', 'cezerye', 'sekerleme', 'akide'],
    atistirmaliklar: ['atistirmalik', 'cips', 'kraker'],
    'draje-kaplamali-urunler': ['draje', 'kaplamali', 'cikolata kapli', 'bonibon'],
    'cekirdek-cerezler': ['cekirdek', 'cerez', 'kabak cekirdegi', 'ay cekirdegi'],
    'saglikli-atistirmaliklar': ['granola', 'bar', 'protein', 'saglikli atistirmalik'],
  },
  aktar: {
    baharatlar: ['kimyon', 'nane', 'pul biber', 'baharat'],
    'bitki-caylari': ['ihlamur', 'yesil cay', 'rezene', 'bitki cayi'],
    'kurutulmus-urunler': ['kurutulmus', 'kurutma', 'dehidre'],
    'kuru-meyveler': ['kuru incir', 'kuru kayisi', 'kuru uzum', 'kuru meyve'],
    'dogal-urunler': ['dogal sabun', 'dogal urun', 'katkisiz'],
    'organik-urunler': ['organik'],
    yaglar: ['yag', 'susam yagi', 'zeytinyagi'],
    'bitkisel-yaglar': ['bitkisel yag', 'ucucu yag', 'aromaterapi yagi'],
    'ozler-ekstraktlar': ['oz', 'ekstrakt', 'extract', 'damla'],
    'bal-ari-urunleri': ['bal', 'polen', 'propolis', 'ari sutu'],
    'sirke-dogal-karisimlar': ['sirke', 'dogal karisim', 'karisim'],
  },
  cicekci: {
    'canli-cicekler': ['canli cicek', 'gul', 'lale', 'orkide', 'papatya'],
    buketler: ['buket', 'gul buketi', 'cicek buketi'],
    'saksi-cicekleri': ['saksi', 'saksi cicegi', 'menekse'],
    aranjmanlar: ['aranjman', 'ozel gun aranjman', 'sevgililer gunu', 'anneler gunu'],
    'celenk-ozel-tasarimlar': ['celenk', 'ozel tasarim', 'cicek sepeti'],
    'yapay-cicekler': ['yapay cicek', 'dekoratif cicek'],
    'hediyelik-urunler': ['hediyelik', 'pelus', 'cikolata kutusu', 'hediye'],
  },
  petshop: {
    mama: ['kedi mamasi', 'kopek mamasi', 'mama', 'kus yemi', 'balik yemi'],
    'odul-mamalari': ['odul mamasi', 'odul cubugu', 'treat'],
    kum: ['kedi kumu', 'kum'],
    aksesuar: ['oyuncak', 'tasma', 'aksesuar', 'tasima cantasi'],
    'bakim-urunleri': ['vitamin', 'bakim spreyi', 'sampuan', 'tarak', 'bakim'],
  },
};

const mapBusinessTypeToCategorySlug = (businessType?: string | null): string => {
  const text = slugifyTr(String(businessType || ''));

  const hasMarket = text.includes('market');
  const hasManav = text.includes('manav');
  const hasKasap = text.includes('kasap');
  const hasSarkuteri = text.includes('sarkuteri');

  if (hasMarket && hasManav) return 'market-manav';
  if (hasKasap && hasSarkuteri) return 'kasap-sarkuteri';
  if (hasManav) return 'manav';
  if (hasMarket) return 'market';
  if (hasKasap) return 'kasap';
  if (hasSarkuteri) return 'sarkuteri';
  if (text.includes('balik')) return 'balikci';
  if (text.includes('kuruyemis')) return 'kuruyemisci';
  if (text.includes('aktar')) return 'aktar';
  if (text.includes('cicek')) return 'cicekci';
  if (text.includes('pet')) return 'petshop';
  if (text.includes('bufe')) return 'bufe';

  const normalizedStoreType = normalizeStoreType(businessType);
  return STORE_TYPE_TO_CATEGORY_SLUG[normalizedStoreType] || 'market';
};

const buildVendorCategorySlug = (vendorId: string, categorySlug: string) =>
  `vendor-${vendorId}-${String(categorySlug || 'category').trim()}`;

const isSeedBackedVendorCategory = (category: { name?: string | null; slug?: string | null }) => {
  const normalizedName = slugifyTr(String(category?.name || ''));
  const slug = String(category?.slug || '').trim();

  return BASE_CATEGORY_SEED.some(
    (seed) => normalizedName === slugifyTr(seed.name) || slug.endsWith(`-${seed.slug}`)
  );
};

const syncCategorySubCategories = async (
  categoryId: string,
  subCategories: Array<{ name: string; slug: string }>
) => {
  const desiredRows = [...subCategories];

  for (const sub of desiredRows) {
    await (prisma as any).subCategory.upsert({
      where: {
        categoryId_slug: {
          categoryId,
          slug: sub.slug,
        },
      },
      update: {
        name: sub.name,
        isActive: true,
      },
      create: {
        name: sub.name,
        slug: sub.slug,
        categoryId,
        isActive: true,
      },
    });
  }

  const desiredSlugs = desiredRows.map((row) => row.slug);
  await (prisma as any).subCategory.updateMany({
    where: {
      categoryId,
      slug: { notIn: desiredSlugs },
      isActive: true,
    },
    data: {
      isActive: false,
    },
  });
};

export const ensureVendorPrimaryCategory = async (vendor: {
  id: string;
  businessType: string;
  categoryId?: string | null;
}) => {
  await ensureBaseCategorySystem();

  const expectedSlug = mapBusinessTypeToCategorySlug(vendor.businessType);
  const categorySeed =
    BASE_CATEGORY_SEED.find((item) => item.slug === expectedSlug) ||
    BASE_CATEGORY_SEED.find((item) => item.slug === 'market') ||
    BASE_CATEGORY_SEED[0];

  if (!categorySeed) {
    throw new AppError(400, 'Varsayilan kategori bulunamadi');
  }

  const vendorCategories = await prisma.category.findMany({
    where: { vendorId: vendor.id, isActive: true },
    include: {
      subCategories: {
        where: { isActive: true },
        orderBy: { name: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  } as any);

  let primary = vendorCategories.find((item) => String(item.id) === String(vendor.categoryId || '').trim());

  if (!primary) {
    primary = vendorCategories.find((item) => String(item.slug || '').endsWith(`-${expectedSlug}`));
  }

  if (!primary) {
    primary = vendorCategories.find(
      (item) => slugifyTr(String(item.name || '')) === slugifyTr(categorySeed.name)
    );
  }

  if (!primary) {
    primary = vendorCategories[0];
  }

  if (!primary) {
    const slug = buildVendorCategorySlug(vendor.id, categorySeed.slug);
    primary = await prisma.category.create({
      data: {
        vendorId: vendor.id,
        storeType: normalizeStoreType(vendor.businessType),
        name: categorySeed.name,
        slug,
        icon: 'shape-outline',
        image: 'market.jpg',
        isCustom: true,
        isActive: true,
      },
      include: {
        subCategories: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
        },
      },
    });
  }

  const expectedVendorSlug = buildVendorCategorySlug(vendor.id, categorySeed.slug);
  const expectedStoreType = normalizeStoreType(vendor.businessType);

  if (
    primary &&
    isSeedBackedVendorCategory(primary) &&
    (
      String(primary.name || '').trim() !== categorySeed.name ||
      String(primary.slug || '').trim() !== expectedVendorSlug ||
      String(primary.storeType || '').trim() !== expectedStoreType
    )
  ) {
    primary = await prisma.category.update({
      where: { id: primary.id },
      data: {
        name: categorySeed.name,
        slug: expectedVendorSlug,
        storeType: expectedStoreType,
        isActive: true,
      },
      include: {
        subCategories: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
        },
      },
    });
  }

  await syncCategorySubCategories(primary.id, categorySeed.subCategories);

  if (String(vendor.categoryId || '').trim() !== String(primary.id)) {
    await (prisma as any).vendorProfile.update({
      where: { id: vendor.id },
      data: { categoryId: primary.id },
    });
  }

  return prisma.category.findFirst({
    where: { id: primary.id },
    select: { id: true, slug: true, name: true },
  });
};

export const resolveCategoryIdForBusinessType = async (businessType?: string | null) => {
  await ensureBaseCategorySystem();
  const slug = mapBusinessTypeToCategorySlug(businessType);
  const category = await prisma.category.findFirst({
    where: { slug, isActive: true },
    select: { id: true },
  });
  if (!category) {
    throw new AppError(400, 'Varsayilan kategori bulunamadi');
  }
  return category.id;
};

export const ensureBaseCategorySystem = async () => {
  const desiredBaseSlugs = BASE_CATEGORY_SEED.map((category) => category.slug);

  for (const categorySeed of BASE_CATEGORY_SEED) {
    const category = await prisma.category.upsert({
      where: { slug: categorySeed.slug },
      update: {
        name: categorySeed.name,
        isActive: true,
        isCustom: false,
        vendorId: null,
      },
      create: {
        name: categorySeed.name,
        slug: categorySeed.slug,
        isActive: true,
        isCustom: false,
      },
    });

    await syncCategorySubCategories(category.id, categorySeed.subCategories);
  }

  const removedBaseCategories = await prisma.category.findMany({
    where: {
      vendorId: null,
      isCustom: false,
      isActive: true,
      slug: { notIn: desiredBaseSlugs },
    },
    select: { id: true },
  });

  if (removedBaseCategories.length > 0) {
    const removedBaseCategoryIds = removedBaseCategories.map((category) => category.id);

    await (prisma as any).subCategory.updateMany({
      where: {
        categoryId: { in: removedBaseCategoryIds },
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    await prisma.category.updateMany({
      where: {
        id: { in: removedBaseCategoryIds },
      },
      data: {
        isActive: false,
      },
    });
  }
};

const findVendorCategory = async (vendor: { id: string; businessType: string; categoryId?: string | null }) => {
  const primary = await ensureVendorPrimaryCategory(vendor);
  if (!primary) {
    throw new AppError(400, 'Vendor ana kategorisi bulunamadi');
  }
  return primary;
};

const findSubCategoryByKeyword = async (categorySlug: string, categoryId: string, productName: string) => {
  const normalizedName = slugifyTr(productName).replace(/-/g, ' ');
  const keywordMap = SUBCATEGORY_KEYWORDS[categorySlug] || {};

  let matchedSlug: string | null = null;
  for (const [subSlug, keywords] of Object.entries(keywordMap)) {
    if (keywords.some((keyword) => normalizedName.includes(slugifyTr(keyword).replace(/-/g, ' ')))) {
      matchedSlug = subSlug;
      break;
    }
  }

  if (!matchedSlug) return null;

  const subCategory = await (prisma as any).subCategory.findFirst({
    where: { categoryId, slug: matchedSlug, isActive: true },
    select: { id: true, slug: true, name: true, categoryId: true },
  });

  if (subCategory) return subCategory;

  return null;
};

export const resolveVendorScopedCategoryMeta = async (
  vendor: { id: string; businessType: string; categoryId?: string | null },
  data: any,
  required: boolean
) => {
  const rawCategoryId = String(data.categoryId || '').trim();
  const rawCategoryName = String(data.categoryName || '').trim();
  let category: any = undefined;

  if (rawCategoryId) {
    category = await prisma.category.findFirst({
      where: {
        vendorId: vendor.id,
        isActive: true,
        OR: [{ id: rawCategoryId }, { slug: rawCategoryId }],
      },
      select: { id: true, slug: true, name: true },
    });

    if (!category) {
      throw new AppError(400, 'Secilen kategori saticiya ait degil');
    }
  }

  if (!category && rawCategoryName) {
    category = await prisma.category.findFirst({
      where: {
        vendorId: vendor.id,
        isActive: true,
        name: rawCategoryName,
      },
      select: { id: true, slug: true, name: true },
    });
  }

  if (!category) {
    category = await findVendorCategory(vendor);
  }

  const rawSubCategoryId = String(data.subCategoryId || data.subcategoryId || '').trim();
  const rawSubCategoryName = String(data.subCategoryName || '').trim();

  if (rawSubCategoryId) {
    const subCategory = await (prisma as any).subCategory.findFirst({
      where: {
        categoryId: category.id,
        isActive: true,
        OR: [{ id: rawSubCategoryId }, { slug: rawSubCategoryId }],
      },
      select: { id: true, slug: true, name: true, categoryId: true },
    });

    if (!subCategory) {
      throw new AppError(400, 'Secilen alt kategori saticinin ana kategorisine uygun degil');
    }

    return { category, subCategory };
  }

  if (rawSubCategoryName) {
    const candidates = await (prisma as any).subCategory.findMany({
      where: {
        categoryId: category.id,
        isActive: true,
      },
      select: { id: true, slug: true, name: true, categoryId: true },
    });

    const subCategory = candidates.find(
      (x: any) => slugifyTr(String(x.name || '')) === slugifyTr(rawSubCategoryName)
    );

    if (subCategory) {
      return { category, subCategory };
    }
  }

  const named = String(data.name || '').trim();
  if (named) {
    const matched = await findSubCategoryByKeyword(category.slug, category.id, named);
    if (matched) {
      return { category, subCategory: matched };
    }
  }

  if (required) {
    throw new AppError(400, 'Alt kategori zorunludur');
  }

  return {
    category,
    subCategory: null,
  };
};
