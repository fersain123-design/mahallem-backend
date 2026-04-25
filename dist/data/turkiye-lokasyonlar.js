"use strict";
// Türkiye İl / İlçe / Mahalle Verileri
// Tam 81 il ve ana ilçeler/mahalleler
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMahalleler = exports.getIlceler = exports.getIller = exports.IL_PLAKA_MAP = exports.TURKIYE_LOKASYONLAR = void 0;
exports.TURKIYE_LOKASYONLAR = [
    {
        id: 'adana',
        name: 'Adana',
        plaka: '01',
        ilceler: [
            { id: 'seyhan', name: 'Seyhan', mahalleler: [{ id: 'resat-bey', name: 'Reşatbey Mah.' }, { id: 'cemal-pasa', name: 'Cemalpaşa Mah.' }, { id: 'gursel', name: 'Gürsel Mah.' }] },
            { id: 'cukurova', name: 'Çukurova', mahalleler: [{ id: 'belediye-evleri', name: 'Belediye Evleri Mah.' }, { id: 'yurt', name: 'Yurt Mah.' }] },
            { id: 'yuregir', name: 'Yüreğir', mahalleler: [{ id: 'koza', name: 'Koza Mah.' }, { id: 'sinanpasa', name: 'Sinanpaşa Mah.' }] },
            { id: 'saricam', name: 'Sarıçam', mahalleler: [{ id: 'sofulu', name: 'Sofulu Mah.' }, { id: 'yunus-emre', name: 'Yunus Emre Mah.' }] },
        ]
    },
    {
        id: 'adiyaman',
        name: 'Adıyaman',
        plaka: '02',
        ilceler: [
            { id: 'merkez-adiyaman', name: 'Merkez', mahalleler: [{ id: 'siteler', name: 'Siteler Mah.' }, { id: 'ataturk', name: 'Atatürk Mah.' }] },
            { id: 'kahta', name: 'Kahta', mahalleler: [{ id: 'merkez-kahta', name: 'Merkez Mah.' }] },
            { id: 'besni', name: 'Besni', mahalleler: [{ id: 'merkez-besni', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'afyonkarahisar',
        name: 'Afyonkarahisar',
        plaka: '03',
        ilceler: [
            { id: 'merkez-afyon', name: 'Merkez', mahalleler: [{ id: 'cumhuriyet', name: 'Cumhuriyet Mah.' }, { id: 'istasyon', name: 'İstasyon Mah.' }] },
            { id: 'sandikli', name: 'Sandıklı', mahalleler: [{ id: 'merkez-sandikli', name: 'Merkez Mah.' }] },
            { id: 'bolvadin', name: 'Bolvadin', mahalleler: [{ id: 'merkez-bolvadin', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'agri',
        name: 'Ağrı',
        plaka: '04',
        ilceler: [
            { id: 'merkez-agri', name: 'Merkez', mahalleler: [{ id: 'cumhuriyet-agri', name: 'Cumhuriyet Mah.' }] },
            { id: 'dogubayazit', name: 'Doğubayazıt', mahalleler: [{ id: 'merkez-dogubayazit', name: 'Merkez Mah.' }] },
            { id: 'patnos', name: 'Patnos', mahalleler: [{ id: 'merkez-patnos', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'amasya',
        name: 'Amasya',
        plaka: '05',
        ilceler: [
            { id: 'merkez-amasya', name: 'Merkez', mahalleler: [{ id: 'dere', name: 'Dere Mah.' }, { id: 'pirler', name: 'Pirler Mah.' }] },
            { id: 'merzifon', name: 'Merzifon', mahalleler: [{ id: 'merkez-merzifon', name: 'Merkez Mah.' }] },
            { id: 'suluova', name: 'Suluova', mahalleler: [{ id: 'merkez-suluova', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'ankara',
        name: 'Ankara',
        plaka: '06',
        ilceler: [
            { id: 'cankaya', name: 'Çankaya', mahalleler: [{ id: 'kizilay', name: 'Kızılay Mah.' }, { id: 'bahcelievler-ank', name: 'Bahçelievler Mah.' }, { id: 'cebeci', name: 'Cebeci Mah.' }, { id: 'ayranci', name: 'Ayrancı Mah.' }, { id: 'dikmen', name: 'Dikmen Mah.' }, { id: 'oran', name: 'Oran Mah.' }] },
            { id: 'kecioren', name: 'Keçiören', mahalleler: [{ id: 'etlik', name: 'Etlik Mah.' }, { id: 'ovacik', name: 'Ovacık Mah.' }, { id: 'kuscagiz', name: 'Kuşcağız Mah.' }] },
            { id: 'yenimahalle', name: 'Yenimahalle', mahalleler: [{ id: 'batikent', name: 'Batıkent Mah.' }, { id: 'demetevler', name: 'Demetevler Mah.' }, { id: 'ostim', name: 'Ostim Mah.' }] },
            { id: 'mamak', name: 'Mamak', mahalleler: [{ id: 'tuzlucayir', name: 'Tuzluçayır Mah.' }, { id: 'misket', name: 'Misket Mah.' }] },
            { id: 'altindag', name: 'Altındağ', mahalleler: [{ id: 'ulus', name: 'Ulus Mah.' }, { id: 'hamamonu', name: 'Hamamönü Mah.' }] },
            { id: 'etimesgut', name: 'Etimesgut', mahalleler: [{ id: 'eryaman', name: 'Eryaman Mah.' }, { id: 'elvankent', name: 'Elvankent Mah.' }] },
            { id: 'sincan', name: 'Sincan', mahalleler: [{ id: 'fatih-sincan', name: 'Fatih Mah.' }, { id: 'ataturk-sincan', name: 'Atatürk Mah.' }] },
            { id: 'pursaklar', name: 'Pursaklar', mahalleler: [{ id: 'saray', name: 'Saray Mah.' }] },
        ]
    },
    {
        id: 'antalya',
        name: 'Antalya',
        plaka: '07',
        ilceler: [
            { id: 'muratpasa', name: 'Muratpaşa', mahalleler: [{ id: 'konyaalti-mah', name: 'Konyaaltı Mah.' }, { id: 'lara', name: 'Lara Mah.' }, { id: 'kaleici', name: 'Kaleiçi Mah.' }] },
            { id: 'kepez', name: 'Kepez', mahalleler: [{ id: 'varsak', name: 'Varsak Mah.' }, { id: 'santral', name: 'Santral Mah.' }] },
            { id: 'konyaalti', name: 'Konyaaltı', mahalleler: [{ id: 'arapsuyu', name: 'Arapsuyu Mah.' }, { id: 'hurma', name: 'Hurma Mah.' }] },
            { id: 'aksu', name: 'Aksu', mahalleler: [{ id: 'kundu', name: 'Kundu Mah.' }] },
            { id: 'alanya', name: 'Alanya', mahalleler: [{ id: 'oba', name: 'Oba Mah.' }, { id: 'tosmur', name: 'Tosmur Mah.' }] },
            { id: 'manavgat', name: 'Manavgat', mahalleler: [{ id: 'side', name: 'Side Mah.' }] },
        ]
    },
    {
        id: 'artvin',
        name: 'Artvin',
        plaka: '08',
        ilceler: [
            { id: 'merkez-artvin', name: 'Merkez', mahalleler: [{ id: 'carsibasi', name: 'Çarşıbaşı Mah.' }] },
            { id: 'hopa', name: 'Hopa', mahalleler: [{ id: 'merkez-hopa', name: 'Merkez Mah.' }] },
            { id: 'ardanuc', name: 'Ardanuç', mahalleler: [{ id: 'merkez-ardanuc', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'aydin',
        name: 'Aydın',
        plaka: '09',
        ilceler: [
            { id: 'efeler', name: 'Efeler', mahalleler: [{ id: 'cumhuriyet-aydin', name: 'Cumhuriyet Mah.' }, { id: 'ataturk-aydin', name: 'Atatürk Mah.' }] },
            { id: 'kusadasi', name: 'Kuşadası', mahalleler: [{ id: 'merkez-kusadasi', name: 'Merkez Mah.' }] },
            { id: 'didim', name: 'Didim', mahalleler: [{ id: 'altinkum', name: 'Altınkum Mah.' }] },
            { id: 'nazilli', name: 'Nazilli', mahalleler: [{ id: 'merkez-nazilli', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'balikesir',
        name: 'Balıkesir',
        plaka: '10',
        ilceler: [
            { id: 'altieylul', name: 'Altıeylül', mahalleler: [{ id: 'bahcelievler-bal', name: 'Bahçelievler Mah.' }] },
            { id: 'karesı', name: 'Karesi', mahalleler: [{ id: 'cumhuriyet-bal', name: 'Cumhuriyet Mah.' }] },
            { id: 'bandirma', name: 'Bandırma', mahalleler: [{ id: 'merkez-bandirma', name: 'Merkez Mah.' }] },
            { id: 'edremit', name: 'Edremit', mahalleler: [{ id: 'akcay', name: 'Akçay Mah.' }] },
        ]
    },
    {
        id: 'bilecik',
        name: 'Bilecik',
        plaka: '11',
        ilceler: [
            { id: 'merkez-bilecik', name: 'Merkez', mahalleler: [{ id: 'istasyon-bil', name: 'İstasyon Mah.' }] },
            { id: 'bozuyuk', name: 'Bozüyük', mahalleler: [{ id: 'merkez-bozuyuk', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'bingol',
        name: 'Bingöl',
        plaka: '12',
        ilceler: [
            { id: 'merkez-bingol', name: 'Merkez', mahalleler: [{ id: 'inonu', name: 'İnönü Mah.' }] },
            { id: 'genc', name: 'Genç', mahalleler: [{ id: 'merkez-genc', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'bitlis',
        name: 'Bitlis',
        plaka: '13',
        ilceler: [
            { id: 'merkez-bitlis', name: 'Merkez', mahalleler: [{ id: 'merkez-mah-bitlis', name: 'Merkez Mah.' }] },
            { id: 'tatvan', name: 'Tatvan', mahalleler: [{ id: 'merkez-tatvan', name: 'Merkez Mah.' }] },
            { id: 'ahlat', name: 'Ahlat', mahalleler: [{ id: 'merkez-ahlat', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'bolu',
        name: 'Bolu',
        plaka: '14',
        ilceler: [
            { id: 'merkez-bolu', name: 'Merkez', mahalleler: [{ id: 'karacasu', name: 'Karacasu Mah.' }, { id: 'seben-mah', name: 'Seben Mah.' }] },
            { id: 'gerede', name: 'Gerede', mahalleler: [{ id: 'merkez-gerede', name: 'Merkez Mah.' }] },
            { id: 'mudurnu', name: 'Mudurnu', mahalleler: [{ id: 'merkez-mudurnu', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'burdur',
        name: 'Burdur',
        plaka: '15',
        ilceler: [
            { id: 'merkez-burdur', name: 'Merkez', mahalleler: [{ id: 'bahcelievler-bur', name: 'Bahçelievler Mah.' }] },
            { id: 'bucak', name: 'Bucak', mahalleler: [{ id: 'merkez-bucak', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'bursa',
        name: 'Bursa',
        plaka: '16',
        ilceler: [
            { id: 'nilufer', name: 'Nilüfer', mahalleler: [{ id: 'fsm', name: 'FSM Mah.' }, { id: 'besevler', name: 'Beşevler Mah.' }, { id: 'gorukle', name: 'Görükle Mah.' }] },
            { id: 'osmangazi', name: 'Osmangazi', mahalleler: [{ id: 'heykel', name: 'Heykel Mah.' }, { id: 'altiparmak', name: 'Altıparmak Mah.' }, { id: 'cekirge', name: 'Çekirge Mah.' }] },
            { id: 'yildirim', name: 'Yıldırım', mahalleler: [{ id: 'esenevler', name: 'Esenevler Mah.' }] },
            { id: 'gemlik', name: 'Gemlik', mahalleler: [{ id: 'merkez-gemlik', name: 'Merkez Mah.' }] },
            { id: 'inegol', name: 'İnegöl', mahalleler: [{ id: 'merkez-inegol', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'canakkale',
        name: 'Çanakkale',
        plaka: '17',
        ilceler: [
            { id: 'merkez-canakkale', name: 'Merkez', mahalleler: [{ id: 'barbaros', name: 'Barbaros Mah.' }] },
            { id: 'biga', name: 'Biga', mahalleler: [{ id: 'merkez-biga', name: 'Merkez Mah.' }] },
            { id: 'can', name: 'Çan', mahalleler: [{ id: 'merkez-can', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'cankiri',
        name: 'Çankırı',
        plaka: '18',
        ilceler: [
            { id: 'merkez-cankiri', name: 'Merkez', mahalleler: [{ id: 'cumhuriyet-cankiri', name: 'Cumhuriyet Mah.' }] },
            { id: 'cerkes', name: 'Çerkeş', mahalleler: [{ id: 'merkez-cerkes', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'corum',
        name: 'Çorum',
        plaka: '19',
        ilceler: [
            { id: 'merkez-corum', name: 'Merkez', mahalleler: [{ id: 'ulukavak', name: 'Ulukavak Mah.' }, { id: 'gazi', name: 'Gazi Mah.' }] },
            { id: 'sungurlu', name: 'Sungurlu', mahalleler: [{ id: 'merkez-sungurlu', name: 'Merkez Mah.' }] },
            { id: 'osmancik', name: 'Osmancık', mahalleler: [{ id: 'merkez-osmancik', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'denizli',
        name: 'Denizli',
        plaka: '20',
        ilceler: [
            { id: 'merkezefendi', name: 'Merkezefendi', mahalleler: [{ id: 'sevindik', name: 'Sevindik Mah.' }, { id: 'adalet', name: 'Adalet Mah.' }] },
            { id: 'pamukkale', name: 'Pamukkale', mahalleler: [{ id: 'pelitlibag', name: 'Pelitlibağ Mah.' }] },
            { id: 'acipayam', name: 'Acıpayam', mahalleler: [{ id: 'merkez-acipayam', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'diyarbakir',
        name: 'Diyarbakır',
        plaka: '21',
        ilceler: [
            { id: 'baglar', name: 'Bağlar', mahalleler: [{ id: 'sehitlik', name: 'Şehitlik Mah.' }] },
            { id: 'kayapinar', name: 'Kayapınar', mahalleler: [{ id: 'dilan', name: 'Dilan Mah.' }] },
            { id: 'yenisehir-diyar', name: 'Yenişehir', mahalleler: [{ id: 'ofis', name: 'Ofis Mah.' }] },
            { id: 'sur', name: 'Sur', mahalleler: [{ id: 'merkez-sur', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'edirne',
        name: 'Edirne',
        plaka: '22',
        ilceler: [
            { id: 'merkez-edirne', name: 'Merkez', mahalleler: [{ id: 'sarayici', name: 'Sarayiçi Mah.' }, { id: 'yeni-imaret', name: 'Yeni İmaret Mah.' }] },
            { id: 'kesan', name: 'Keşan', mahalleler: [{ id: 'merkez-kesan', name: 'Merkez Mah.' }] },
            { id: 'uzunkopru', name: 'Uzunköprü', mahalleler: [{ id: 'merkez-uzunkopru', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'elazig',
        name: 'Elazığ',
        plaka: '23',
        ilceler: [
            { id: 'merkez-elazig', name: 'Merkez', mahalleler: [{ id: 'aksaray-elazig', name: 'Aksaray Mah.' }, { id: 'yenimahalle-elazig', name: 'Yeni Mah.' }] },
            { id: 'kovancilar', name: 'Kovancılar', mahalleler: [{ id: 'merkez-kovancilar', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'erzincan',
        name: 'Erzincan',
        plaka: '24',
        ilceler: [
            { id: 'merkez-erzincan', name: 'Merkez', mahalleler: [{ id: 'cumhuriyet-erzincan', name: 'Cumhuriyet Mah.' }] },
            { id: 'tercan', name: 'Tercan', mahalleler: [{ id: 'merkez-tercan', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'erzurum',
        name: 'Erzurum',
        plaka: '25',
        ilceler: [
            { id: 'yakutiye', name: 'Yakutiye', mahalleler: [{ id: 'cumhuriyet-erzurum', name: 'Cumhuriyet Mah.' }, { id: 'lalapaşa', name: 'Lalapaşa Mah.' }] },
            { id: 'palandoken', name: 'Palandöken', mahalleler: [{ id: 'yenisehir-erzurum', name: 'Yenişehir Mah.' }] },
            { id: 'aziziye', name: 'Aziziye', mahalleler: [{ id: 'ilica', name: 'Ilıca Mah.' }] },
        ]
    },
    {
        id: 'eskisehir',
        name: 'Eskişehir',
        plaka: '26',
        ilceler: [
            { id: 'odunpazari', name: 'Odunpazarı', mahalleler: [{ id: '71-evler', name: '71 Evler Mah.' }, { id: 'gokmeydan', name: 'Gökmeydan Mah.' }] },
            { id: 'tepebasi', name: 'Tepebaşı', mahalleler: [{ id: 'hosnudiye', name: 'Hoşnudiye Mah.' }, { id: 'ismet-inonu', name: 'İsmet İnönü Mah.' }] },
        ]
    },
    {
        id: 'gaziantep',
        name: 'Gaziantep',
        plaka: '27',
        ilceler: [
            { id: 'sahinbey', name: 'Şahinbey', mahalleler: [{ id: 'kolejtepe', name: 'Kolejtepe Mah.' }, { id: 'incirlı', name: 'İncirli Mah.' }] },
            { id: 'sehitkamil', name: 'Şehitkamil', mahalleler: [{ id: 'gunes', name: 'Güneş Mah.' }, { id: 'karataslar', name: 'Karataşlar Mah.' }] },
            { id: 'nizip', name: 'Nizip', mahalleler: [{ id: 'merkez-nizip', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'giresun',
        name: 'Giresun',
        plaka: '28',
        ilceler: [
            { id: 'merkez-giresun', name: 'Merkez', mahalleler: [{ id: 'teyyareduz', name: 'Teyyaredüzü Mah.' }] },
            { id: 'bulancak', name: 'Bulancak', mahalleler: [{ id: 'merkez-bulancak', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'gumushane',
        name: 'Gümüşhane',
        plaka: '29',
        ilceler: [
            { id: 'merkez-gumushane', name: 'Merkez', mahalleler: [{ id: 'baglarbaşı', name: 'Bağlarbaşı Mah.' }] },
            { id: 'kelkit', name: 'Kelkit', mahalleler: [{ id: 'merkez-kelkit', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'hakkari',
        name: 'Hakkari',
        plaka: '30',
        ilceler: [
            { id: 'merkez-hakkari', name: 'Merkez', mahalleler: [{ id: 'cumhuriyet-hakkari', name: 'Cumhuriyet Mah.' }] },
            { id: 'yuksekova', name: 'Yüksekova', mahalleler: [{ id: 'merkez-yuksekova', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'hatay',
        name: 'Hatay',
        plaka: '31',
        ilceler: [
            { id: 'antakya', name: 'Antakya', mahalleler: [{ id: 'aksaray-hatay', name: 'Aksaray Mah.' }, { id: 'cekmece', name: 'Çekmece Mah.' }] },
            { id: 'iskenderun', name: 'İskenderun', mahalleler: [{ id: 'cumhuriyet-hatay', name: 'Cumhuriyet Mah.' }] },
            { id: 'defne', name: 'Defne', mahalleler: [{ id: 'harbiye', name: 'Harbiye Mah.' }] },
        ]
    },
    {
        id: 'isparta',
        name: 'Isparta',
        plaka: '32',
        ilceler: [
            { id: 'merkez-isparta', name: 'Merkez', mahalleler: [{ id: 'cunur', name: 'Cunur Mah.' }, { id: 'davraz', name: 'Davraz Mah.' }] },
            { id: 'egirdir', name: 'Eğirdir', mahalleler: [{ id: 'merkez-egirdir', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'mersin',
        name: 'Mersin',
        plaka: '33',
        ilceler: [
            { id: 'yenisehir-mersin', name: 'Yenişehir', mahalleler: [{ id: 'palmiye', name: 'Palmiye Mah.' }, { id: 'pozcu', name: 'Pozcu Mah.' }] },
            { id: 'toroslar', name: 'Toroslar', mahalleler: [{ id: 'camlıyayla', name: 'Çamlıyayla Mah.' }] },
            { id: 'akdeniz', name: 'Akdeniz', mahalleler: [{ id: 'camili', name: 'Camiili Mah.' }] },
            { id: 'mezitli', name: 'Mezitli', mahalleler: [{ id: 'davultepe', name: 'Davultepe Mah.' }] },
            { id: 'tarsus', name: 'Tarsus', mahalleler: [{ id: 'merkez-tarsus', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'istanbul',
        name: 'İstanbul',
        plaka: '34',
        ilceler: [
            { id: 'kadikoy', name: 'Kadıköy', mahalleler: [{ id: 'caferaga', name: 'Caferağa Mah.' }, { id: 'moda', name: 'Moda Mah.' }, { id: 'fenerbahce', name: 'Fenerbahçe Mah.' }, { id: 'goztepe', name: 'Göztepe Mah.' }, { id: 'kozyatagi', name: 'Kozyatağı Mah.' }, { id: 'bostanci', name: 'Bostancı Mah.' }] },
            { id: 'besiktas', name: 'Beşiktaş', mahalleler: [{ id: 'levent', name: 'Levent Mah.' }, { id: 'etiler', name: 'Etiler Mah.' }, { id: 'bebek', name: 'Bebek Mah.' }, { id: 'ortakoy', name: 'Ortaköy Mah.' }] },
            { id: 'sisli', name: 'Şişli', mahalleler: [{ id: 'mecidiyekoy', name: 'Mecidiyeköy Mah.' }, { id: 'nisantasi', name: 'Nişantaşı Mah.' }, { id: 'fulya', name: 'Fulya Mah.' }, { id: 'esentepe', name: 'Esentepe Mah.' }] },
            { id: 'uskudar', name: 'Üsküdar', mahalleler: [{ id: 'cengelkoy', name: 'Çengelköy Mah.' }, { id: 'kuzguncuk', name: 'Kuzguncuk Mah.' }, { id: 'beylerbeyi', name: 'Beylerbeyi Mah.' }, { id: 'altunizade', name: 'Altunizade Mah.' }] },
            { id: 'bakirkoy', name: 'Bakırköy', mahalleler: [{ id: 'atakoy', name: 'Ataköy Mah.' }, { id: 'yesilkoy', name: 'Yeşilköy Mah.' }, { id: 'florya', name: 'Florya Mah.' }] },
            { id: 'fatih', name: 'Fatih', mahalleler: [{ id: 'sultanahmet', name: 'Sultanahmet Mah.' }, { id: 'eminonu', name: 'Eminönü Mah.' }, { id: 'aksaray-ist', name: 'Aksaray Mah.' }, { id: 'laleli', name: 'Laleli Mah.' }] },
            { id: 'beyoglu', name: 'Beyoğlu', mahalleler: [{ id: 'taksim', name: 'Taksim Mah.' }, { id: 'cihangir', name: 'Cihangir Mah.' }, { id: 'galata', name: 'Galata Mah.' }] },
            { id: 'sariyer', name: 'Sarıyer', mahalleler: [{ id: 'maslak', name: 'Maslak Mah.' }, { id: 'zekeriyakoy', name: 'Zekeriyaköy Mah.' }, { id: 'istinye', name: 'İstinye Mah.' }] },
            { id: 'maltepe', name: 'Maltepe', mahalleler: [{ id: 'altayceşme', name: 'Altayçeşme Mah.' }, { id: 'cevizli', name: 'Cevizli Mah.' }] },
            { id: 'atasehir', name: 'Ataşehir', mahalleler: [{ id: 'ataturk-atasehir', name: 'Atatürk Mah.' }, { id: 'icerenkoy', name: 'İçerenköy Mah.' }, { id: 'barbaros', name: 'Barbaros Mah.' }] },
            { id: 'pendik', name: 'Pendik', mahalleler: [{ id: 'esenyali', name: 'Esenyalı Mah.' }, { id: 'yenisehir-ist', name: 'Yenişehir Mah.' }] },
            { id: 'kartal', name: 'Kartal', mahalleler: [{ id: 'kordonboyu', name: 'Kordonboyu Mah.' }, { id: 'huzur', name: 'Huzur Mah.' }] },
            { id: 'umraniye', name: 'Ümraniye', mahalleler: [{ id: 'atasehir-umraniye', name: 'Ataşehir Mah.' }, { id: 'ihlamurkuyu', name: 'Ihlamurkuyu Mah.' }] },
            { id: 'bahcelievler-ist', name: 'Bahçelievler', mahalleler: [{ id: 'yenibosna', name: 'Yenibosna Mah.' }, { id: 'bahcelievler-mah', name: 'Bahçelievler Mah.' }] },
            { id: 'esenyurt', name: 'Esenyurt', mahalleler: [{ id: 'cumhuriyet-ist', name: 'Cumhuriyet Mah.' }, { id: 'fatih-esenyurt', name: 'Fatih Mah.' }] },
            { id: 'beylikduzu', name: 'Beylikdüzü', mahalleler: [{ id: 'yakuplu', name: 'Yakuplu Mah.' }, { id: 'adnan-kahveci', name: 'Adnan Kahveci Mah.' }] },
            { id: 'avcilar', name: 'Avcılar', mahalleler: [{ id: 'cihangir-avcilar', name: 'Cihangir Mah.' }, { id: 'denizkosku', name: 'Denizköşkler Mah.' }] },
            { id: 'kucukcekmece', name: 'Küçükçekmece', mahalleler: [{ id: 'atakent', name: 'Atakent Mah.' }, { id: 'halkali', name: 'Halkalı Mah.' }] },
            { id: 'bagcilar', name: 'Bağcılar', mahalleler: [{ id: 'merkez-bagcilar', name: 'Merkez Mah.' }, { id: 'gunesli', name: 'Güneşli Mah.' }] },
            { id: 'basaksehir', name: 'Başakşehir', mahalleler: [{ id: 'basaksehir-mah', name: 'Başakşehir Mah.' }, { id: 'bahcesehir', name: 'Bahçeşehir Mah.' }] },
            { id: 'sultanbeyli', name: 'Sultanbeyli', mahalleler: [{ id: 'battalgazi', name: 'Battalgazi Mah.' }] },
            { id: 'tuzla', name: 'Tuzla', mahalleler: [{ id: 'aydıntepe', name: 'Aydıntepe Mah.' }, { id: 'postane', name: 'Postane Mah.' }] },
        ]
    },
    {
        id: 'izmir',
        name: 'İzmir',
        plaka: '35',
        ilceler: [
            { id: 'konak', name: 'Konak', mahalleler: [{ id: 'alsancak', name: 'Alsancak Mah.' }, { id: 'kemeralti', name: 'Kemeraltı Mah.' }, { id: 'basmane', name: 'Basmane Mah.' }] },
            { id: 'karsiyaka-izmir', name: 'Karşıyaka', mahalleler: [{ id: 'bostanli', name: 'Bostanlı Mah.' }, { id: 'mavibahce', name: 'Mavibahçe Mah.' }] },
            { id: 'bornova', name: 'Bornova', mahalleler: [{ id: 'ege-uni', name: 'Ege Üniversitesi Mah.' }, { id: 'kazimdirik', name: 'Kazımdirik Mah.' }] },
            { id: 'buca', name: 'Buca', mahalleler: [{ id: 'sirin', name: 'Şirinyer Mah.' }, { id: 'kozagac', name: 'Kozağaç Mah.' }] },
            { id: 'bayrakli', name: 'Bayraklı', mahalleler: [{ id: 'ataturk-bayrakli', name: 'Atatürk Mah.' }] },
            { id: 'cigli', name: 'Çiğli', mahalleler: [{ id: 'atakent-izmir', name: 'Atakent Mah.' }] },
            { id: 'cesme', name: 'Çeşme', mahalleler: [{ id: 'alacati', name: 'Alaçatı Mah.' }] },
            { id: 'seferihisar', name: 'Seferihisar', mahalleler: [{ id: 'sigacik', name: 'Sığacık Mah.' }] },
            { id: 'urla', name: 'Urla', mahalleler: [{ id: 'merkez-urla', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'kars',
        name: 'Kars',
        plaka: '36',
        ilceler: [
            { id: 'merkez-kars', name: 'Merkez', mahalleler: [{ id: 'cumhuriyet-kars', name: 'Cumhuriyet Mah.' }] },
            { id: 'sarikamis', name: 'Sarıkamış', mahalleler: [{ id: 'merkez-sarikamis', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'kastamonu',
        name: 'Kastamonu',
        plaka: '37',
        ilceler: [
            { id: 'merkez-kastamonu', name: 'Merkez', mahalleler: [{ id: 'kuzeykent', name: 'Kuzeykent Mah.' }] },
            { id: 'inebolu', name: 'İnebolu', mahalleler: [{ id: 'merkez-inebolu', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'kayseri',
        name: 'Kayseri',
        plaka: '38',
        ilceler: [
            { id: 'kocasinan', name: 'Kocasinan', mahalleler: [{ id: 'seker', name: 'Şeker Mah.' }, { id: 'erkilet', name: 'Erkilet Mah.' }] },
            { id: 'melikgazi', name: 'Melikgazi', mahalleler: [{ id: 'kosk', name: 'Köşk Mah.' }, { id: 'danisment', name: 'Danişment Mah.' }] },
            { id: 'talas', name: 'Talas', mahalleler: [{ id: 'merkez-talas', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'kirklareli',
        name: 'Kırklareli',
        plaka: '39',
        ilceler: [
            { id: 'merkez-kirklareli', name: 'Merkez', mahalleler: [{ id: 'cumhuriyet-kirklareli', name: 'Cumhuriyet Mah.' }] },
            { id: 'luleburgaz', name: 'Lüleburgaz', mahalleler: [{ id: 'merkez-luleburgaz', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'kirsehir',
        name: 'Kırşehir',
        plaka: '40',
        ilceler: [
            { id: 'merkez-kirsehir', name: 'Merkez', mahalleler: [{ id: 'yenice', name: 'Yenice Mah.' }] },
            { id: 'mucur', name: 'Mucur', mahalleler: [{ id: 'merkez-mucur', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'kocaeli',
        name: 'Kocaeli',
        plaka: '41',
        ilceler: [
            { id: 'izmit', name: 'İzmit', mahalleler: [{ id: 'kemalpaşa-izmit', name: 'Kemalpaşa Mah.' }, { id: 'yenidogan-izmit', name: 'Yenidoğan Mah.' }] },
            { id: 'gebze', name: 'Gebze', mahalleler: [{ id: 'osman-yilmaz', name: 'Osman Yılmaz Mah.' }] },
            { id: 'darica', name: 'Darıca', mahalleler: [{ id: 'osmangazi-darica', name: 'Osmangazi Mah.' }] },
            { id: 'korfez', name: 'Körfez', mahalleler: [{ id: 'yarımca', name: 'Yarımca Mah.' }] },
        ]
    },
    {
        id: 'konya',
        name: 'Konya',
        plaka: '42',
        ilceler: [
            { id: 'selcuklu', name: 'Selçuklu', mahalleler: [{ id: 'bosna-hersek', name: 'Bosna Hersek Mah.' }, { id: 'yazir', name: 'Yazır Mah.' }] },
            { id: 'meram', name: 'Meram', mahalleler: [{ id: 'havzan', name: 'Havzan Mah.' }] },
            { id: 'karatay', name: 'Karatay', mahalleler: [{ id: 'fevzicakmak', name: 'Fevziçakmak Mah.' }] },
        ]
    },
    {
        id: 'kutahya',
        name: 'Kütahya',
        plaka: '43',
        ilceler: [
            { id: 'merkez-kutahya', name: 'Merkez', mahalleler: [{ id: 'lala-huseyin-pasa', name: 'Lala Hüseyin Paşa Mah.' }] },
            { id: 'tavsanli', name: 'Tavşanlı', mahalleler: [{ id: 'merkez-tavsanli', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'malatya',
        name: 'Malatya',
        plaka: '44',
        ilceler: [
            { id: 'battalgazi-malatya', name: 'Battalgazi', mahalleler: [{ id: 'coskun', name: 'Coşkun Mah.' }] },
            { id: 'yesilyurt', name: 'Yeşilyurt', mahalleler: [{ id: 'gedik', name: 'Gedik Mah.' }] },
        ]
    },
    {
        id: 'manisa',
        name: 'Manisa',
        plaka: '45',
        ilceler: [
            { id: 'yunusemre', name: 'Yunusemre', mahalleler: [{ id: 'laleli-manisa', name: 'Laleli Mah.' }] },
            { id: 'sehzadeler', name: 'Şehzadeler', mahalleler: [{ id: 'merkez-sehzadeler', name: 'Merkez Mah.' }] },
            { id: 'akhisar', name: 'Akhisar', mahalleler: [{ id: 'merkez-akhisar', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'kahramanmaras',
        name: 'Kahramanmaraş',
        plaka: '46',
        ilceler: [
            { id: 'onikisubat', name: 'Onikişubat', mahalleler: [{ id: 'gazi', name: 'Gazi Mah.' }] },
            { id: 'dulkadiroglu', name: 'Dulkadiroğlu', mahalleler: [{ id: 'yeni-mahalle-k', name: 'Yeni Mah.' }] },
        ]
    },
    {
        id: 'mardin',
        name: 'Mardin',
        plaka: '47',
        ilceler: [
            { id: 'artuklu', name: 'Artuklu', mahalleler: [{ id: 'nur', name: 'Nur Mah.' }] },
            { id: 'kiziltepe', name: 'Kızıltepe', mahalleler: [{ id: 'merkez-kiziltepe', name: 'Merkez Mah.' }] },
            { id: 'midyat', name: 'Midyat', mahalleler: [{ id: 'merkez-midyat', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'mugla',
        name: 'Muğla',
        plaka: '48',
        ilceler: [
            { id: 'mentese', name: 'Menteşe', mahalleler: [{ id: 'orhaniye', name: 'Orhaniye Mah.' }] },
            { id: 'bodrum', name: 'Bodrum', mahalleler: [{ id: 'konacik', name: 'Konacık Mah.' }, { id: 'turkbuku', name: 'Türkbükü Mah.' }] },
            { id: 'fethiye', name: 'Fethiye', mahalleler: [{ id: 'cumhuriyet-fethiye', name: 'Cumhuriyet Mah.' }, { id: 'oludeniz', name: 'Ölüdeniz Mah.' }] },
            { id: 'marmaris', name: 'Marmaris', mahalleler: [{ id: 'armutalan', name: 'Armutalan Mah.' }, { id: 'icmeler', name: 'İçmeler Mah.' }] },
            { id: 'dalaman', name: 'Dalaman', mahalleler: [{ id: 'merkez-dalaman', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'mus',
        name: 'Muş',
        plaka: '49',
        ilceler: [
            { id: 'merkez-mus', name: 'Merkez', mahalleler: [{ id: 'kultur', name: 'Kültür Mah.' }] },
            { id: 'malazgirt', name: 'Malazgirt', mahalleler: [{ id: 'merkez-malazgirt', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'nevsehir',
        name: 'Nevşehir',
        plaka: '50',
        ilceler: [
            { id: 'merkez-nevsehir', name: 'Merkez', mahalleler: [{ id: 'yenimahalle-nevsehir', name: 'Yeni Mah.' }] },
            { id: 'urgup', name: 'Ürgüp', mahalleler: [{ id: 'merkez-urgup', name: 'Merkez Mah.' }] },
            { id: 'avanos', name: 'Avanos', mahalleler: [{ id: 'merkez-avanos', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'nigde',
        name: 'Niğde',
        plaka: '51',
        ilceler: [
            { id: 'merkez-nigde', name: 'Merkez', mahalleler: [{ id: 'derbent', name: 'Derbent Mah.' }] },
            { id: 'bor', name: 'Bor', mahalleler: [{ id: 'merkez-bor', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'ordu',
        name: 'Ordu',
        plaka: '52',
        ilceler: [
            { id: 'altinordu', name: 'Altınordu', mahalleler: [{ id: 'bucak-ordu', name: 'Bucak Mah.' }] },
            { id: 'unye', name: 'Ünye', mahalleler: [{ id: 'merkez-unye', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'rize',
        name: 'Rize',
        plaka: '53',
        ilceler: [
            { id: 'merkez-rize', name: 'Merkez', mahalleler: [{ id: 'tophane', name: 'Tophane Mah.' }] },
            { id: 'ardesen', name: 'Ardeşen', mahalleler: [{ id: 'merkez-ardesen', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'sakarya',
        name: 'Sakarya',
        plaka: '54',
        ilceler: [
            { id: 'adapazari', name: 'Adapazarı', mahalleler: [{ id: 'cumhuriyet-sakarya', name: 'Cumhuriyet Mah.' }] },
            { id: 'serdivan', name: 'Serdivan', mahalleler: [{ id: 'bahcelievler-serdivan', name: 'Bahçelievler Mah.' }] },
            { id: 'erenler', name: 'Erenler', mahalleler: [{ id: 'erenler-merkez', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'samsun',
        name: 'Samsun',
        plaka: '55',
        ilceler: [
            { id: 'ilkadim', name: 'İlkadım', mahalleler: [{ id: 'atakum-mah', name: 'Atakum Mah.' }, { id: 'canik-mah', name: 'Canik Mah.' }] },
            { id: 'atakum', name: 'Atakum', mahalleler: [{ id: 'altinkum', name: 'Altınkum Mah.' }] },
            { id: 'canik', name: 'Canik', mahalleler: [{ id: 'gaziosmanpasa', name: 'Gaziosmanpaşa Mah.' }] },
        ]
    },
    {
        id: 'siirt',
        name: 'Siirt',
        plaka: '56',
        ilceler: [
            { id: 'merkez-siirt', name: 'Merkez', mahalleler: [{ id: 'yenimahalle-siirt', name: 'Yeni Mah.' }] },
            { id: 'kurtalan', name: 'Kurtalan', mahalleler: [{ id: 'merkez-kurtalan', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'sinop',
        name: 'Sinop',
        plaka: '57',
        ilceler: [
            { id: 'merkez-sinop', name: 'Merkez', mahalleler: [{ id: 'ada', name: 'Ada Mah.' }] },
            { id: 'boyabat', name: 'Boyabat', mahalleler: [{ id: 'merkez-boyabat', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'sivas',
        name: 'Sivas',
        plaka: '58',
        ilceler: [
            { id: 'merkez-sivas', name: 'Merkez', mahalleler: [{ id: 'dagevi', name: 'Dağevi Mah.' }, { id: 'karsiyaka-sivas', name: 'Karşıyaka Mah.' }] },
            { id: 'suşehri', name: 'Suşehri', mahalleler: [{ id: 'merkez-susehri', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'tekirdag',
        name: 'Tekirdağ',
        plaka: '59',
        ilceler: [
            { id: 'suleymanpasa', name: 'Süleymanpaşa', mahalleler: [{ id: 'hurriyet', name: 'Hürriyet Mah.' }] },
            { id: 'corlu', name: 'Çorlu', mahalleler: [{ id: 'cumhuriyet-corlu', name: 'Cumhuriyet Mah.' }] },
            { id: 'cerkezkoy', name: 'Çerkezköy', mahalleler: [{ id: 'merkez-cerkezkoy', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'tokat',
        name: 'Tokat',
        plaka: '60',
        ilceler: [
            { id: 'merkez-tokat', name: 'Merkez', mahalleler: [{ id: 'behzat', name: 'Behzat Mah.' }] },
            { id: 'erbaa', name: 'Erbaa', mahalleler: [{ id: 'merkez-erbaa', name: 'Merkez Mah.' }] },
            { id: 'turhal', name: 'Turhal', mahalleler: [{ id: 'merkez-turhal', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'trabzon',
        name: 'Trabzon',
        plaka: '61',
        ilceler: [
            { id: 'ortahisar', name: 'Ortahisar', mahalleler: [{ id: 'kemerkaya', name: 'Kemerkaya Mah.' }, { id: 'besirli', name: 'Beşirli Mah.' }] },
            { id: 'akcaabat', name: 'Akçaabat', mahalleler: [{ id: 'merkez-akcaabat', name: 'Merkez Mah.' }] },
            { id: 'yomra', name: 'Yomra', mahalleler: [{ id: 'merkez-yomra', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'tunceli',
        name: 'Tunceli',
        plaka: '62',
        ilceler: [
            { id: 'merkez-tunceli', name: 'Merkez', mahalleler: [{ id: 'cumhuriyet-tunceli', name: 'Cumhuriyet Mah.' }] },
            { id: 'pertek', name: 'Pertek', mahalleler: [{ id: 'merkez-pertek', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'sanliurfa',
        name: 'Şanlıurfa',
        plaka: '63',
        ilceler: [
            { id: 'haliliye', name: 'Haliliye', mahalleler: [{ id: 'paşabağı', name: 'Paşabağı Mah.' }] },
            { id: 'eyuupnebi', name: 'Eyyübiye', mahalleler: [{ id: 'yenimahalle-urfa', name: 'Yeni Mah.' }] },
            { id: 'karakopru', name: 'Karaköprü', mahalleler: [{ id: 'ataturk-urfa', name: 'Atatürk Mah.' }] },
        ]
    },
    {
        id: 'usak',
        name: 'Uşak',
        plaka: '64',
        ilceler: [
            { id: 'merkez-usak', name: 'Merkez', mahalleler: [{ id: 'kultur-usak', name: 'Kültür Mah.' }] },
            { id: 'banaz', name: 'Banaz', mahalleler: [{ id: 'merkez-banaz', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'van',
        name: 'Van',
        plaka: '65',
        ilceler: [
            { id: 'ipekyolu', name: 'İpekyolu', mahalleler: [{ id: 'seyrantepe', name: 'Seyrantepe Mah.' }] },
            { id: 'tusba', name: 'Tuşba', mahalleler: [{ id: 'aliseydi', name: 'Aliseydi Mah.' }] },
            { id: 'edremit-van', name: 'Edremit', mahalleler: [{ id: 'merkez-edremit-van', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'yozgat',
        name: 'Yozgat',
        plaka: '66',
        ilceler: [
            { id: 'merkez-yozgat', name: 'Merkez', mahalleler: [{ id: 'medrese', name: 'Medrese Mah.' }] },
            { id: 'sorgun', name: 'Sorgun', mahalleler: [{ id: 'merkez-sorgun', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'zonguldak',
        name: 'Zonguldak',
        plaka: '67',
        ilceler: [
            { id: 'merkez-zonguldak', name: 'Merkez', mahalleler: [{ id: 'bahcelievler-zonguldak', name: 'Bahçelievler Mah.' }] },
            { id: 'eregli-zonguldak', name: 'Ereğli', mahalleler: [{ id: 'merkez-eregli', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'aksaray',
        name: 'Aksaray',
        plaka: '68',
        ilceler: [
            { id: 'merkez-aksaray', name: 'Merkez', mahalleler: [{ id: 'zafer', name: 'Zafer Mah.' }] },
            { id: 'guzelyurt', name: 'Güzelyurt', mahalleler: [{ id: 'merkez-guzelyurt', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'bayburt',
        name: 'Bayburt',
        plaka: '69',
        ilceler: [
            { id: 'merkez-bayburt', name: 'Merkez', mahalleler: [{ id: 'sehitlik-bayburt', name: 'Şehitlik Mah.' }] },
        ]
    },
    {
        id: 'karaman',
        name: 'Karaman',
        plaka: '70',
        ilceler: [
            { id: 'merkez-karaman', name: 'Merkez', mahalleler: [{ id: 'taşkale', name: 'Taşkale Mah.' }] },
            { id: 'ermenek', name: 'Ermenek', mahalleler: [{ id: 'merkez-ermenek', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'kirikkale',
        name: 'Kırıkkale',
        plaka: '71',
        ilceler: [
            { id: 'merkez-kirikkale', name: 'Merkez', mahalleler: [{ id: 'fabrikalar', name: 'Fabrikalar Mah.' }] },
            { id: 'yahsihan', name: 'Yahşihan', mahalleler: [{ id: 'merkez-yahsihan', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'batman',
        name: 'Batman',
        plaka: '72',
        ilceler: [
            { id: 'merkez-batman', name: 'Merkez', mahalleler: [{ id: 'petek', name: 'Petek Mah.' }, { id: 'yenisehir-batman', name: 'Yenişehir Mah.' }] },
        ]
    },
    {
        id: 'sirnak',
        name: 'Şırnak',
        plaka: '73',
        ilceler: [
            { id: 'merkez-sirnak', name: 'Merkez', mahalleler: [{ id: 'cumhuriyet-sirnak', name: 'Cumhuriyet Mah.' }] },
            { id: 'cizre', name: 'Cizre', mahalleler: [{ id: 'merkez-cizre', name: 'Merkez Mah.' }] },
            { id: 'silopi', name: 'Silopi', mahalleler: [{ id: 'merkez-silopi', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'bartin',
        name: 'Bartın',
        plaka: '74',
        ilceler: [
            { id: 'merkez-bartin', name: 'Merkez', mahalleler: [{ id: 'hürriyet-bartin', name: 'Hürriyet Mah.' }] },
        ]
    },
    {
        id: 'ardahan',
        name: 'Ardahan',
        plaka: '75',
        ilceler: [
            { id: 'merkez-ardahan', name: 'Merkez', mahalleler: [{ id: 'inonu-ardahan', name: 'İnönü Mah.' }] },
            { id: 'gole', name: 'Göle', mahalleler: [{ id: 'merkez-gole', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'igdir',
        name: 'Iğdır',
        plaka: '76',
        ilceler: [
            { id: 'merkez-igdir', name: 'Merkez', mahalleler: [{ id: 'cumhuriyet-igdir', name: 'Cumhuriyet Mah.' }] },
        ]
    },
    {
        id: 'yalova',
        name: 'Yalova',
        plaka: '77',
        ilceler: [
            { id: 'merkez-yalova', name: 'Merkez', mahalleler: [{ id: 'bahcelievler-yalova', name: 'Bahçelievler Mah.' }] },
            { id: 'termal', name: 'Termal', mahalleler: [{ id: 'merkez-termal', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'karabuk',
        name: 'Karabük',
        plaka: '78',
        ilceler: [
            { id: 'merkez-karabuk', name: 'Merkez', mahalleler: [{ id: 'cumhuriyet-karabuk', name: 'Cumhuriyet Mah.' }] },
            { id: 'safranbolu', name: 'Safranbolu', mahalleler: [{ id: 'baglarbasi', name: 'Bağlarbaşı Mah.' }] },
        ]
    },
    {
        id: 'kilis',
        name: 'Kilis',
        plaka: '79',
        ilceler: [
            { id: 'merkez-kilis', name: 'Merkez', mahalleler: [{ id: 'sehitler', name: 'Şehitler Mah.' }] },
        ]
    },
    {
        id: 'osmaniye',
        name: 'Osmaniye',
        plaka: '80',
        ilceler: [
            { id: 'merkez-osmaniye', name: 'Merkez', mahalleler: [{ id: 'yavuz-selim', name: 'Yavuz Selim Mah.' }] },
            { id: 'kadirli', name: 'Kadirli', mahalleler: [{ id: 'merkez-kadirli', name: 'Merkez Mah.' }] },
        ]
    },
    {
        id: 'duzce',
        name: 'Düzce',
        plaka: '81',
        ilceler: [
            { id: 'merkez-duzce', name: 'Merkez', mahalleler: [{ id: 'aziziye', name: 'Aziziye Mah.' }, { id: 'cedidiye', name: 'Cedidiye Mah.' }] },
            { id: 'akcakoca', name: 'Akçakoca', mahalleler: [{ id: 'merkez-akcakoca', name: 'Merkez Mah.' }] },
        ]
    },
];
// İl plaka kodlarını ID ile eşleştiren yardımcı obje
exports.IL_PLAKA_MAP = {};
exports.TURKIYE_LOKASYONLAR.forEach(il => {
    exports.IL_PLAKA_MAP[il.plaka] = il.id;
});
// Yardımcı fonksiyonlar
const getIller = () => {
    return exports.TURKIYE_LOKASYONLAR.map(il => ({
        id: il.id,
        name: il.name,
        plaka: il.plaka
    }));
};
exports.getIller = getIller;
const getIlceler = (ilId) => {
    const il = exports.TURKIYE_LOKASYONLAR.find(i => i.id === ilId);
    if (!il)
        return [];
    return il.ilceler.map(ilce => ({
        id: ilce.id,
        name: ilce.name
    }));
};
exports.getIlceler = getIlceler;
const getMahalleler = (ilId, ilceId) => {
    const il = exports.TURKIYE_LOKASYONLAR.find(i => i.id === ilId);
    if (!il)
        return [];
    const ilce = il.ilceler.find(i => i.id === ilceId);
    if (!ilce)
        return [];
    return ilce.mahalleler.map(m => ({
        id: m.id,
        name: m.name
    }));
};
exports.getMahalleler = getMahalleler;
