import { AppError } from '../../middleware/errorHandler';

export interface PaymentConfig {
  currency: string;
  locale: string;
  mockMode: boolean;
  iyzico: {
    enabled: boolean;
    apiKey: string;
    secretKey: string;
    baseUrl: string;
    callbackUrl: string;
    webhookUrl: string;
    merchantName: string;
  };
}

const read = (key: string, fallback = ''): string => String(process.env[key] || fallback).trim();

export const getPaymentConfig = (): PaymentConfig => {
  const enabled = read('IYZICO_ENABLED', 'true') !== 'false';
  const config: PaymentConfig = {
    currency: read('PAYMENT_CURRENCY', 'TRY'),
    locale: read('PAYMENT_DEFAULT_LOCALE', 'tr'),
    mockMode: read('IYZICO_MOCK_MODE', '0') === '1',
    iyzico: {
      enabled,
      apiKey: read('IYZICO_API_KEY'),
      secretKey: read('IYZICO_SECRET_KEY'),
      baseUrl: read('IYZICO_BASE_URL', 'https://sandbox-api.iyzipay.com'),
      callbackUrl: read('IYZICO_CALLBACK_URL'),
      webhookUrl: read('IYZICO_WEBHOOK_URL'),
      merchantName: read('IYZICO_MERCHANT_NAME', 'Mahallem'),
    },
  };

  if (enabled && !config.mockMode) {
    const missing: string[] = [];
    if (!config.iyzico.apiKey) missing.push('IYZICO_API_KEY');
    if (!config.iyzico.secretKey) missing.push('IYZICO_SECRET_KEY');
    if (!config.iyzico.callbackUrl) missing.push('IYZICO_CALLBACK_URL');
    if (!config.iyzico.webhookUrl) missing.push('IYZICO_WEBHOOK_URL');

    if (missing.length > 0) {
      throw new AppError(500, `Missing payment env values: ${missing.join(', ')}`);
    }
  }

  return config;
};

export const redactSecret = (value: string): string => {
  if (!value) return '';
  if (value.length <= 6) return '***';
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
};
