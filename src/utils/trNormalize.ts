export function normalizeTrForCompare(value: unknown) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const lowered = raw.toLocaleLowerCase('tr-TR');

  // Remove common neighborhood suffixes/abbreviations to avoid mismatches:
  // "Atatürk Mahallesi" == "Atatürk" == "Atatürk Mah."
  const withoutSuffix = lowered
    .replace(/\bmahallesi\b/gi, '')
    .replace(/\bmah\.\b/gi, '')
    .replace(/\bmah\b/gi, '')
    .replace(/\bmh\.\b/gi, '')
    .replace(/\bmh\b/gi, '')
    .replace(/\bköyü\b/gi, '')
    .replace(/\bkoyu\b/gi, '')
    .replace(/\bköy\b/gi, '')
    .trim();

  // ASCII fold Turkish letters so "Acıbadem" can match "Acibadem" (seed/data variability).
  return withoutSuffix
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ü/g, 'u')
    .replace(/â|î|û/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

