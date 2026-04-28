const UNIT_NORMALIZERS: Array<{ regex: RegExp; replacement: string }> = [
  { regex: /(\d+)\s*GR\b/gi, replacement: '$1 g' },
  { regex: /(\d+)\s*G\b/gi, replacement: '$1 g' },
  { regex: /(\d+)\s*ML\b/gi, replacement: '$1 ml' },
  { regex: /(\d+)\s*CL\b/gi, replacement: '$1 cl' },
  { regex: /(\d+)\s*LT\b/gi, replacement: '$1 L' },
  { regex: /(\d+)\s*L\b/gi, replacement: '$1 L' },
  { regex: /(\d+)\s*KG\b/gi, replacement: '$1 kg' },
];

const titleCaseTr = (value: string): string => {
  const words = value
    .split(' ')
    .map((item) => item.trim())
    .filter(Boolean);

  return words
    .map((word) => {
      const lower = word.toLocaleLowerCase('tr-TR');
      const first = lower.charAt(0).toLocaleUpperCase('tr-TR');
      return `${first}${lower.slice(1)}`;
    })
    .join(' ');
};

const normalizeUnits = (value: string): string => {
  let next = value;
  for (const rule of UNIT_NORMALIZERS) {
    next = next.replace(rule.regex, rule.replacement);
  }
  return next.replace(/\s+/g, ' ').trim();
};

export const cleanProductName = (
  name: unknown,
  brand?: unknown
): { name: string; brand: string } => {
  const rawName = String(name || '')
    .replace(/[_|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const normalizedName = normalizeUnits(titleCaseTr(rawName));
  const normalizedBrand = titleCaseTr(String(brand || '').replace(/\s+/g, ' ').trim());

  if (!normalizedName) {
    return { name: '', brand: normalizedBrand };
  }

  if (!normalizedBrand) {
    return { name: normalizedName, brand: '' };
  }

  const startsWithBrand = normalizedName
    .toLocaleLowerCase('tr-TR')
    .startsWith(normalizedBrand.toLocaleLowerCase('tr-TR'));

  if (startsWithBrand) {
    return { name: normalizedName, brand: normalizedBrand };
  }

  return {
    name: `${normalizedBrand} ${normalizedName}`.replace(/\s+/g, ' ').trim(),
    brand: normalizedBrand,
  };
};
