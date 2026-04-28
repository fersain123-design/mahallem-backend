"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapBarcodeProductToMahallemCategory = void 0;
const FALLBACK_CATEGORY = 'Genel Ihtiyac Urunleri';
const CATEGORY_RULES = [
    { category: 'Sut Urunleri', keywords: ['sut', 'ayran', 'yogurt', 'kefir', 'krema', 'peynir', 'labne', 'kaymak'] },
    {
        category: 'Kahvaltiliklar',
        keywords: ['zeytin', 'recel', 'bal', 'tahin', 'pekmez', 'findik kremasi', 'cikolata kremasi', 'kahvaltilik sos'],
    },
    {
        category: 'Temel Gida',
        keywords: ['makarna', 'pirinc', 'bulgur', 'un', 'seker', 'tuz', 'irmik', 'nisasta', 'galeta unu'],
    },
    {
        category: 'Bakliyat ve Tahil',
        keywords: ['mercimek', 'nohut', 'fasulye', 'barbunya', 'bugday', 'yulaf', 'misir'],
    },
    {
        category: 'Yaglar',
        keywords: ['aycicek yagi', 'zeytinyagi', 'misirozu yagi', 'findik yagi', 'tereyagi', 'margarin'],
    },
    {
        category: 'Soslar ve Baharatlar',
        keywords: ['ketcap', 'mayonez', 'hardal', 'aci sos', 'nar eksisi', 'sirke', 'baharat', 'karabiber', 'pul biber', 'kekik', 'nane', 'kimyon'],
    },
    {
        category: 'Konserve ve Hazir Gida',
        keywords: ['konserve', 'ton baligi', 'hazir corba', 'noodle', 'hazir yemek', 'salca', 'tursu'],
    },
    {
        category: 'Dondurulmus Gida',
        keywords: ['dondurulmus', 'pizza', 'milfoy', 'patates kizartmasi', 'nugget', 'manti'],
    },
    {
        category: 'Atistirmaliklar',
        keywords: ['biskuvi', 'gofret', 'kraker', 'kek', 'cikolata', 'seker', 'sakiz', 'cips', 'kuruyemis', 'bar'],
    },
    { category: 'Cips ve Kraker', keywords: ['cips', 'kraker', 'patlamis misir'] },
    { category: 'Cikolata ve Sekerleme', keywords: ['cikolata', 'sekerleme', 'jelibon', 'lokum', 'draje', 'gofret'] },
    {
        category: 'Kuruyemis ve Kuru Meyve',
        keywords: ['findik', 'fistik', 'badem', 'ceviz', 'kaju', 'leblebi', 'kuru uzum', 'kuru kayisi', 'kuru incir'],
    },
    { category: 'Icecekler', keywords: ['icecek', 'mesrubat', 'soda', 'enerji icecegi', 'soguk cay'] },
    { category: 'Su', keywords: ['su', 'dogal kaynak suyu', 'damacana'] },
    { category: 'Gazli Icecekler', keywords: ['kola', 'gazoz', 'gazli icecek', 'tonic', 'tonik'] },
    { category: 'Meyve Sulari', keywords: ['meyve suyu', 'nektar', 'limonata'] },
    {
        category: 'Cay ve Kahve',
        keywords: ['cay', 'kahve', 'turk kahvesi', 'filtre kahve', 'espresso', 'cappuccino', 'latte', 'bitki cayi'],
    },
    {
        category: 'Temizlik Urunleri',
        keywords: ['deterjan', 'camasir suyu', 'yuzey temizleyici', 'bulasik deterjani', 'temizlik spreyi', 'kirec cozucu'],
    },
    { category: 'Kagit Urunleri', keywords: ['tuvalet kagidi', 'kagit havlu', 'pecete', 'mendil'] },
    {
        category: 'Kisisel Bakim',
        keywords: ['sampuan', 'sabun', 'dus jeli', 'dis macunu', 'deodorant', 'tiras kopugu', 'pamuk', 'islak mendil'],
    },
    {
        category: 'Bebek Urunleri',
        keywords: ['bebek bezi', 'bebek mamasi', 'bebek sampuani', 'bebek islak mendil'],
    },
    { category: 'Pet Urunleri', keywords: ['kedi mamasi', 'kopek mamasi', 'kum', 'odul mamasi'] },
    {
        category: 'Genel Ihtiyac Urunleri',
        keywords: ['pil', 'ampul', 'cakmak', 'bant', 'poset', 'strec film', 'aluminyum folyo'],
    },
];
const normalizeText = (value) => {
    return String(value ?? '')
        .toLocaleLowerCase('tr-TR')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};
const mapBarcodeProductToMahallemCategory = (product) => {
    const contexts = [
        { text: normalizeText(product.product_name), weight: 1, source: 'name' },
        { text: normalizeText(product.generic_name), weight: 0.85, source: 'generic_name' },
        { text: normalizeText(product.brands), weight: 0.35, source: 'brands' },
        { text: normalizeText(product.categories), weight: 0.55, source: 'categories' },
        { text: normalizeText(Array.isArray(product.category_tags) ? product.category_tags.join(' ') : ''), weight: 0.5, source: 'category_tags' },
        { text: normalizeText(product.ingredients_text), weight: 0.4, source: 'ingredients_text' },
        { text: normalizeText(product.quantity), weight: 0.2, source: 'quantity' },
        { text: normalizeText(product.barcode), weight: 0.1, source: 'barcode' },
    ];
    let winningCategory = FALLBACK_CATEGORY;
    let winningScore = 0;
    let winningMatches = [];
    let winningNameHit = false;
    let winningTagHit = false;
    for (const rule of CATEGORY_RULES) {
        let score = 0;
        const matchedKeywords = new Set();
        let hasNameHit = false;
        let hasTagHit = false;
        for (const keywordRaw of rule.keywords) {
            const keyword = normalizeText(keywordRaw);
            if (!keyword)
                continue;
            for (const context of contexts) {
                if (!context.text)
                    continue;
                if (!context.text.includes(keyword))
                    continue;
                score += context.weight;
                matchedKeywords.add(keywordRaw);
                if (context.source === 'name' || context.source === 'generic_name') {
                    hasNameHit = true;
                }
                if (context.source === 'categories' || context.source === 'category_tags') {
                    hasTagHit = true;
                }
            }
        }
        if (score > winningScore) {
            winningScore = score;
            winningCategory = rule.category;
            winningMatches = Array.from(matchedKeywords);
            winningNameHit = hasNameHit;
            winningTagHit = hasTagHit;
        }
    }
    let confidence = 0.32;
    if (winningScore > 0) {
        if (winningNameHit) {
            confidence = Math.min(0.96, 0.75 + winningScore * 0.06);
        }
        else if (winningTagHit) {
            confidence = Math.min(0.78, 0.58 + winningScore * 0.05);
        }
        else {
            confidence = Math.min(0.68, 0.48 + winningScore * 0.04);
        }
    }
    return {
        category: winningCategory,
        confidence: Number(confidence.toFixed(2)),
        matchedKeywords: winningMatches,
        source: 'local-category-mapper',
    };
};
exports.mapBarcodeProductToMahallemCategory = mapBarcodeProductToMahallemCategory;
