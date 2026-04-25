import axios, { AxiosInstance } from 'axios';
import { PaymentProvider, PaymentRecordStatus, RefundStatus, SubmerchantStatus } from '@prisma/client';
import { AppError } from '../../middleware/errorHandler';
import { getPaymentConfig } from './payment.config';
import {
  CallbackValidationResult,
  CheckoutInitializePayload,
  CheckoutInitializeResult,
  CheckoutRetrieveResult,
  NormalizedSubmerchant,
  PaymentProviderContract,
  RefundResult,
  SubmerchantUpsertPayload,
} from './payment.types';
import { generateIyzicoAuthorizationHeader } from './providers/iyzico.auth';
import { validateIyzicoSignature } from './providers/iyzico.signature';

const STATUS_MAP: Record<string, PaymentRecordStatus> = {
  success: 'PAID',
  failure: 'FAILED',
  pending: 'PENDING',
  init_threeds: 'PENDING',
  callback_three_ds: 'PENDING',
};

export class IyzicoPaymentProvider implements PaymentProviderContract {
  public readonly provider: PaymentProvider = 'IYZICO';

  private readonly client: AxiosInstance;
  private readonly config = getPaymentConfig();

  constructor() {
    this.client = axios.create({
      baseURL: this.config.iyzico.baseUrl,
      timeout: 20000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  public async createSubmerchant(
    payload: SubmerchantUpsertPayload
  ): Promise<NormalizedSubmerchant> {
    if (this.config.mockMode) {
      return {
        key: `mock_subm_${payload.vendorId}`,
        status: 'ACTIVE',
        raw: { status: 'success', subMerchantKey: `mock_subm_${payload.vendorId}` },
      };
    }

    const body = {
      locale: this.config.locale,
      conversationId: `subm-${payload.vendorId}-${Date.now()}`,
      subMerchantExternalId: payload.vendorId,
      subMerchantType: payload.merchantType || 'PRIVATE_COMPANY',
      address: payload.address,
      taxOffice: 'N/A',
      legalCompanyTitle: payload.name,
      email: payload.email,
      gsmNumber: payload.gsmNumber,
      name: payload.name,
      iban: payload.iban,
      identityNumber: payload.identityNumber,
      taxNumber: payload.taxNumber,
      contactName: payload.contactName || payload.name,
      currency: this.config.currency,
    };

    const response = await this.post('/onboarding/submerchant', body);
    const key = String(response?.subMerchantKey || '').trim();
    if (!key) {
      throw new AppError(502, 'Iyzico submerchant key could not be created');
    }

    return {
      key,
      status: String(response?.status || '').toLowerCase() === 'success' ? 'ACTIVE' : 'PENDING',
      raw: response,
    };
  }

  public async updateSubmerchant(
    subMerchantKey: string,
    payload: SubmerchantUpsertPayload
  ): Promise<NormalizedSubmerchant> {
    if (this.config.mockMode) {
      return {
        key: subMerchantKey,
        status: 'ACTIVE',
        raw: { status: 'success', subMerchantKey, vendorId: payload.vendorId },
      };
    }

    const body = {
      locale: this.config.locale,
      conversationId: `subm-update-${payload.vendorId}-${Date.now()}`,
      subMerchantKey,
      iban: payload.iban,
      address: payload.address,
      contactName: payload.contactName || payload.name,
      email: payload.email,
      gsmNumber: payload.gsmNumber,
    };

    const response = await this.post('/onboarding/submerchant', body);

    return {
      key: subMerchantKey,
      status: String(response?.status || '').toLowerCase() === 'success' ? 'ACTIVE' : 'PENDING',
      raw: response,
    };
  }

  public async initializeCheckout(
    payload: CheckoutInitializePayload
  ): Promise<CheckoutInitializeResult> {
    if (this.config.mockMode) {
      const token = `mock_tok_${payload.basketId}_${Date.now()}`;
      return {
        conversationId: payload.conversationId,
        token,
        paymentPageUrl: `https://sandbox.iyzico.mock/checkout/${token}`,
        status: 'INITIALIZED',
        raw: {
          status: 'success',
          token,
          paymentPageUrl: `https://sandbox.iyzico.mock/checkout/${token}`,
          conversationId: payload.conversationId,
        },
      };
    }

    const response = await this.post('/payment/iyzipos/checkoutform/initialize/auth/ecom', payload);

    const token = String(response?.token || '').trim();
    const paymentPageUrl = String(response?.paymentPageUrl || '').trim();
    if (!token || !paymentPageUrl) {
      throw new AppError(502, 'Iyzico initialize response is missing token or paymentPageUrl');
    }

    return {
      conversationId: String(response?.conversationId || payload.conversationId),
      token,
      paymentPageUrl,
      status: 'INITIALIZED',
      raw: response,
    };
  }

  public async retrieveCheckoutResult(
    token: string,
    conversationId?: string
  ): Promise<CheckoutRetrieveResult> {
    if (this.config.mockMode) {
      const lowered = String(token || '').toLowerCase();
      const hint = String(conversationId || '').toLowerCase();
      const mockedStatus = lowered.includes('fail') || hint.includes('fail')
        ? 'FAILED'
        : lowered.includes('review') || hint.includes('review')
          ? 'REVIEW'
          : lowered.includes('pending') || hint.includes('pending')
            ? 'PENDING'
            : 'PAID';
      const fraudStatus = mockedStatus === 'REVIEW' ? 0 : 1;

      return {
        conversationId: conversationId || `mock-retrieve-${Date.now()}`,
        token,
        providerPaymentId: `mock_pay_${Date.now()}`,
        paymentStatus: mockedStatus,
        fraudStatus,
        paidPrice: undefined,
        currency: this.config.currency,
        transactions: [],
        raw: {
          status: mockedStatus === 'FAILED' ? 'failure' : 'success',
          paymentStatus: mockedStatus.toLowerCase(),
          fraudStatus,
        },
      };
    }

    const body = {
      locale: this.config.locale,
      conversationId: conversationId || `retrieve-${Date.now()}`,
      token,
    };

    const response = await this.post('/payment/iyzipos/checkoutform/auth/ecom/detail', body);

    const transactions = Array.isArray(response?.itemTransactions)
      ? response.itemTransactions.map((item: any) => ({
          basketItemId: String(item?.itemId || ''),
          paymentTransactionId: item?.paymentTransactionId ? String(item.paymentTransactionId) : undefined,
          paidPrice:
            item?.paidPrice == null || Number.isNaN(Number(item.paidPrice))
              ? undefined
              : Number(item.paidPrice),
        }))
      : [];

    const providerStatus = String(response?.paymentStatus || response?.status || 'failure');
    const fraudStatus =
      response?.fraudStatus == null || Number.isNaN(Number(response.fraudStatus))
        ? undefined
        : Number(response.fraudStatus);

    return {
      conversationId: response?.conversationId ? String(response.conversationId) : undefined,
      token,
      providerPaymentId: response?.paymentId ? String(response.paymentId) : undefined,
      paymentStatus: this.mapProviderStatus(providerStatus, fraudStatus),
      fraudStatus,
      paidPrice:
        response?.paidPrice == null || Number.isNaN(Number(response.paidPrice))
          ? undefined
          : Number(response.paidPrice),
      currency: response?.currency ? String(response.currency) : undefined,
      transactions,
      raw: response,
    };
  }

  public async approvePaymentIfNeeded(paymentId: string): Promise<void> {
    if (this.config.mockMode) {
      return;
    }

    const body = {
      locale: this.config.locale,
      conversationId: `approve-${paymentId}-${Date.now()}`,
      paymentId,
    };

    await this.post('/payment/iyzipos/approve', body);
  }

  public async refundPayment(args: {
    paymentId: string;
    paymentTransactionId?: string;
    amount?: number;
    currency: string;
    conversationId: string;
  }): Promise<RefundResult> {
    if (this.config.mockMode) {
      return {
        status: 'SUCCEEDED',
        providerRefundId: `mock_refund_${args.paymentId}_${Date.now()}`,
        raw: { status: 'success', conversationId: args.conversationId },
      };
    }

    const body = {
      locale: this.config.locale,
      conversationId: args.conversationId,
      paymentTransactionId: args.paymentTransactionId,
      price: args.amount,
      ip: '127.0.0.1',
      currency: args.currency,
    };

    const response = await this.post('/payment/refund', body);
    const ok = String(response?.status || '').toLowerCase() === 'success';

    return {
      status: ok ? 'SUCCEEDED' : 'FAILED',
      providerRefundId: response?.paymentTransactionId
        ? String(response.paymentTransactionId)
        : undefined,
      raw: response,
    };
  }

  public async validateCallback(
    payload: unknown,
    signature?: string
  ): Promise<CallbackValidationResult> {
    if (this.config.mockMode) {
      if (!signature || signature !== 'mock-signature-ok') {
        return { isValid: false, reason: 'Invalid mock signature' };
      }
      return { isValid: true };
    }

    const valid = validateIyzicoSignature({
      payload,
      signatureHeader: signature,
      secretKey: this.config.iyzico.secretKey,
    });

    if (!valid) {
      return { isValid: false, reason: 'Invalid iyzico signature' };
    }

    return { isValid: true };
  }

  public mapProviderStatus(status: string, fraudStatus?: number): PaymentRecordStatus {
    const base = STATUS_MAP[String(status || '').toLowerCase()] || 'FAILED';
    if (base === 'PAID' && fraudStatus != null && Number(fraudStatus) !== 1) {
      return 'REVIEW';
    }
    return base;
  }

  private async post(path: string, body: unknown): Promise<any> {
    const bodyText = JSON.stringify(body || {});
    const { authorization } = generateIyzicoAuthorizationHeader({
      apiKey: this.config.iyzico.apiKey,
      secretKey: this.config.iyzico.secretKey,
      uriPath: path,
      requestBody: bodyText,
    });

    try {
      const response = await this.client.post(path, body, {
        headers: {
          Authorization: authorization,
          'x-iyzi-client-version': 'mahallem-backend-1.0',
        },
      });
      return response.data;
    } catch (error: any) {
      const message =
        String(error?.response?.data?.errorMessage || error?.message || 'Iyzico request failed');
      throw new AppError(502, `Iyzico error: ${message}`);
    }
  }
}

export const mapIyzicoSubmerchantStatus = (statusText: string): SubmerchantStatus => {
  const lowered = String(statusText || '').toLowerCase();
  if (lowered === 'active' || lowered === 'success') return 'ACTIVE';
  if (lowered === 'inactive') return 'INACTIVE';
  if (lowered === 'failed' || lowered === 'failure') return 'FAILED';
  return 'PENDING';
};

export const mapIyzicoRefundStatus = (statusText: string): RefundStatus => {
  const lowered = String(statusText || '').toLowerCase();
  if (lowered === 'success' || lowered === 'succeeded') return 'SUCCEEDED';
  if (lowered === 'failed' || lowered === 'failure') return 'FAILED';
  return 'REQUESTED';
};
