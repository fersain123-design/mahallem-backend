import {
  PaymentProvider,
  PaymentRecordStatus,
  RefundStatus,
  SubmerchantStatus,
} from '@prisma/client';

export type Money = number;

export interface PaymentBasketItem {
  id: string;
  name: string;
  category1: string;
  itemType: 'PHYSICAL' | 'VIRTUAL';
  price: string;
  subMerchantKey: string;
  subMerchantPrice: string;
}

export interface SubmerchantUpsertPayload {
  vendorId: string;
  merchantType?: string;
  contactName?: string;
  iban: string;
  identityNumber?: string;
  taxNumber?: string;
  email?: string;
  gsmNumber?: string;
  name: string;
  address: string;
}

export interface CheckoutInitializePayload {
  conversationId: string;
  price: string;
  paidPrice: string;
  currency: string;
  basketId: string;
  paymentGroup: 'PRODUCT';
  callbackUrl: string;
  locale: string;
  buyer: {
    id: string;
    name: string;
    surname: string;
    gsmNumber?: string;
    email: string;
    registrationAddress: string;
    city?: string;
    country: string;
    zipCode?: string;
    identityNumber?: string;
    ip?: string;
  };
  shippingAddress: {
    contactName: string;
    city?: string;
    country: string;
    address: string;
    zipCode?: string;
  };
  billingAddress: {
    contactName: string;
    city?: string;
    country: string;
    address: string;
    zipCode?: string;
  };
  basketItems: PaymentBasketItem[];
}

export interface CheckoutInitializeResult {
  conversationId: string;
  token: string;
  paymentPageUrl: string;
  status: PaymentRecordStatus;
  raw: unknown;
}

export interface CheckoutRetrieveResult {
  conversationId?: string;
  token?: string;
  providerPaymentId?: string;
  paymentStatus: PaymentRecordStatus;
  fraudStatus?: number;
  paidPrice?: Money;
  currency?: string;
  transactions: Array<{
    basketItemId: string;
    paymentTransactionId?: string;
    paidPrice?: Money;
  }>;
  raw: unknown;
}

export interface RefundResult {
  status: RefundStatus;
  providerRefundId?: string;
  raw: unknown;
}

export interface CallbackValidationResult {
  isValid: boolean;
  reason?: string;
}

export interface NormalizedSubmerchant {
  key: string;
  status: SubmerchantStatus;
  raw: unknown;
}

export interface PaymentProviderContract {
  provider: PaymentProvider;
  createSubmerchant(payload: SubmerchantUpsertPayload): Promise<NormalizedSubmerchant>;
  updateSubmerchant(subMerchantKey: string, payload: SubmerchantUpsertPayload): Promise<NormalizedSubmerchant>;
  initializeCheckout(payload: CheckoutInitializePayload): Promise<CheckoutInitializeResult>;
  retrieveCheckoutResult(token: string, conversationId?: string): Promise<CheckoutRetrieveResult>;
  approvePaymentIfNeeded(paymentId: string): Promise<void>;
  refundPayment(args: {
    paymentId: string;
    paymentTransactionId?: string;
    amount?: Money;
    currency: string;
    conversationId: string;
  }): Promise<RefundResult>;
  validateCallback(payload: unknown, signature?: string): Promise<CallbackValidationResult>;
  mapProviderStatus(status: string, fraudStatus?: number): PaymentRecordStatus;
}
