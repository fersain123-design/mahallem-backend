export const BARCODE_INVALID_MESSAGE =
  'Bu barkod geçerli görünmüyor. Lütfen tekrar okutun veya elle kontrol edin.';

export type BarcodeValidationResult = {
  normalizedBarcode: string;
  isValid: boolean;
  reason: 'empty' | 'invalid_format' | 'invalid_length' | 'invalid_ean13_checksum' | 'ok';
};

export const normalizeBarcodeInput = (value: unknown): string => {
  return String(value ?? '')
    .replace(/\s+/g, '')
    .trim();
};

const isSupportedBarcodeLength = (value: string): boolean => {
  const length = String(value || '').length;
  return length === 8 || length === 12 || length === 13 || length === 14;
};

export const calculateEan13CheckDigit = (firstTwelveDigits: string): number | null => {
  if (!/^\d{12}$/.test(firstTwelveDigits)) {
    return null;
  }

  let sum = 0;
  for (let idx = 0; idx < 12; idx += 1) {
    const digit = Number(firstTwelveDigits[idx]);
    sum += idx % 2 === 0 ? digit : digit * 3;
  }

  const mod = sum % 10;
  return mod === 0 ? 0 : 10 - mod;
};

export const isValidEan13Checksum = (barcode: string): boolean => {
  const normalized = normalizeBarcodeInput(barcode);
  if (!/^\d{13}$/.test(normalized)) {
    return false;
  }

  const expected = calculateEan13CheckDigit(normalized.slice(0, 12));
  if (expected === null) {
    return false;
  }

  return expected === Number(normalized[12]);
};

export const validateBarcode = (value: unknown): BarcodeValidationResult => {
  const normalizedBarcode = normalizeBarcodeInput(value);

  if (!normalizedBarcode) {
    return { normalizedBarcode, isValid: false, reason: 'empty' };
  }

  if (!/^\d+$/.test(normalizedBarcode)) {
    return { normalizedBarcode, isValid: false, reason: 'invalid_format' };
  }

  if (!isSupportedBarcodeLength(normalizedBarcode)) {
    return { normalizedBarcode, isValid: false, reason: 'invalid_length' };
  }

  if (normalizedBarcode.length === 13 && !isValidEan13Checksum(normalizedBarcode)) {
    return { normalizedBarcode, isValid: false, reason: 'invalid_ean13_checksum' };
  }

  return { normalizedBarcode, isValid: true, reason: 'ok' };
};
