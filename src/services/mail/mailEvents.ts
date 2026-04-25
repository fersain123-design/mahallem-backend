export enum MailEvents {
  USER_REGISTERED = 'USER_REGISTERED',
  ORDER_DELIVERED = 'ORDER_DELIVERED',
  SELLER_APPLICATION = 'SELLER_APPLICATION',
  SELLER_APPROVED = 'SELLER_APPROVED',
  NEW_ORDER = 'NEW_ORDER',
  PAYMENT_REQUESTED = 'PAYMENT_REQUESTED',
  PAYMENT_COMPLETED = 'PAYMENT_COMPLETED',
}

export type UserRegisteredMailData = {
  email: string;
  name?: string;
};

export type OrderDeliveredMailData = {
  email: string;
  name: string;
  orderId?: string;
};

export type SellerApplicationMailData = {
  email: string;
  firstName?: string;
  lastName?: string;
  documents?: string[];
};

export type SellerApprovedMailData = {
  email: string;
  name?: string;
};

export type NewOrderMailData = {
  email: string;
  orderId?: string;
  items?: Array<{
    name: string;
    quantity: number;
    unit?: string;
    unitPrice?: number;
    subtotal?: number;
  }>;
  productTotal?: number;
  deliveryFee?: number;
  totalPrice?: number;
};

export type PaymentRequestedMailData = {
  email: string;
  amount?: number | string;
};

export type PaymentCompletedMailData = {
  email: string;
  amount?: number | string;
};

export type MailEventDataMap = {
  [MailEvents.USER_REGISTERED]: UserRegisteredMailData;
  [MailEvents.ORDER_DELIVERED]: OrderDeliveredMailData;
  [MailEvents.SELLER_APPLICATION]: SellerApplicationMailData;
  [MailEvents.SELLER_APPROVED]: SellerApprovedMailData;
  [MailEvents.NEW_ORDER]: NewOrderMailData;
  [MailEvents.PAYMENT_REQUESTED]: PaymentRequestedMailData;
  [MailEvents.PAYMENT_COMPLETED]: PaymentCompletedMailData;
};
