"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSearchTokens = exports.buildProductGroupInfo = void 0;
const toAsciiSlug = (value) => {
    const map = {
        ç: 'c',
        ğ: 'g',
        ı: 'i',
        ö: 'o',
        ş: 's',
        ü: 'u',
        Ç: 'c',
        Ğ: 'g',
        İ: 'i',
        Ö: 'o',
        Ş: 's',
        Ü: 'u',
    };
    return String(value || '')
        .split('')
        .map((ch) => map[ch] ?? ch)
        .join('')
        .toLocaleLowerCase('tr-TR')
        .replace(/[^a-z0-9\s-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\s+/g, '-');
};
const normalizeText = (value) => {
    return toAsciiSlug(String(value || '')).replace(/-/g, ' ').trim();
};
const QUANTITY_PATTERN = /\b\d+(?:[\.,]\d+)?\s?(g|gr|kg|ml|cl|lt|l|adet|paket|koli)\b/gi;
const PRODUCT_NOISE_WORDS = new Set([
    'mini',
    'maxi',
    'buyuk',
    'kucuk',
    'orta',
    'ekonomik',
    'boy',
    'avantaj',
    'kampanya',
    'ozel',
    'yeni',
    'paket',
    'adet',
]);
const buildProductGroupInfo = (args) => {
    const normalizedName = normalizeText(args.name);
    const normalizedBrand = normalizeText(args.brand);
    const nameWithoutQty = normalizedName.replace(QUANTITY_PATTERN, ' ').replace(/\s+/g, ' ').trim();
    const tokens = nameWithoutQty
        .split(' ')
        .map((item) => item.trim())
        .filter(Boolean)
        .filter((token) => !PRODUCT_NOISE_WORDS.has(token))
        .filter((token) => !/^\d+$/.test(token));
    const filteredByBrand = tokens.filter((token) => {
        if (!normalizedBrand)
            return true;
        return !normalizedBrand.split(' ').includes(token);
    });
    const typeTokens = filteredByBrand.slice(0, 2);
    const productType = typeTokens.join(' ').trim() || filteredByBrand[0] || tokens[0] || 'urun';
    const groupKeyRaw = [normalizedBrand || 'genel', productType]
        .map((item) => item.trim())
        .filter(Boolean)
        .join(' ');
    const groupKey = toAsciiSlug(groupKeyRaw) || 'genel-urun';
    return {
        groupKey,
        productType,
        normalizedName,
        normalizedBrand,
    };
};
exports.buildProductGroupInfo = buildProductGroupInfo;
const buildTrigramTokens = (value) => {
    const text = normalizeText(value).replace(/\s+/g, '');
    if (text.length <= 3) {
        return text ? [text] : [];
    }
    const out = [];
    for (let idx = 0; idx <= text.length - 3; idx += 1) {
        out.push(text.slice(idx, idx + 3));
    }
    return out;
};
const buildSearchTokens = (args) => {
    const normalizedName = normalizeText(args.name);
    const normalizedBrand = normalizeText(args.brand);
    const normalizedCategory = normalizeText(args.category);
    const parts = [normalizedName, normalizedBrand, normalizedCategory]
        .join(' ')
        .split(' ')
        .map((item) => item.trim())
        .filter(Boolean);
    const prefixTokens = parts.flatMap((token) => {
        if (token.length <= 3)
            return [token];
        return [token, token.slice(0, 3), token.slice(0, 4)];
    });
    const triTokens = buildTrigramTokens([normalizedName, normalizedBrand].join(' '));
    const tokenSet = new Set([...parts, ...prefixTokens, ...triTokens]);
    return {
        normalizedName,
        tokens: Array.from(tokenSet),
        brand: normalizedBrand,
        category: normalizedCategory,
    };
};
exports.buildSearchTokens = buildSearchTokens;
