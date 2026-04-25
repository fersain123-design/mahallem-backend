import { sendEmail } from './mailService';
import {
  MailEventDataMap,
  MailEvents,
  NewOrderMailData,
  OrderDeliveredMailData,
  PaymentCompletedMailData,
  PaymentRequestedMailData,
  SellerApplicationMailData,
  SellerApprovedMailData,
  UserRegisteredMailData,
} from './mailEvents';
import { logMail } from './mailLogger';
import { orderDeliveredTemplate } from './templates/customer/orderDelivered';
import { welcomeCustomerTemplate } from './templates/customer/welcomeCustomer';
import { newOrderTemplate } from './templates/seller/newOrder';
import { paymentCompletedTemplate } from './templates/seller/paymentCompleted';
import { paymentRequestedTemplate } from './templates/seller/paymentRequested';
import { sellerApplicationTemplate } from './templates/seller/sellerApplication';
import { sellerApprovedTemplate } from './templates/seller/sellerApproved';

type MailDispatchPayload = {
  to: string;
  subject: string;
  html: string;
};

const getDispatchPayload = <TEvent extends MailEvents>(
  event: TEvent,
  data: MailEventDataMap[TEvent]
): MailDispatchPayload => {
  const to = String(data.email || '').trim();

  if (!to) {
    throw new Error(`Missing recipient email for mail event: ${event}`);
  }

  switch (event) {
    case MailEvents.USER_REGISTERED:
      return {
        to,
        subject: 'Mahallem’e Hoş Geldin',
        html: welcomeCustomerTemplate(data as UserRegisteredMailData),
      };

    case MailEvents.ORDER_DELIVERED:
      return {
        to,
        subject: 'Siparişin Teslim Edildi',
        html: orderDeliveredTemplate(data as OrderDeliveredMailData),
      };

    case MailEvents.SELLER_APPLICATION:
      return {
        to,
        subject: 'Satıcı Başvurun Alındı',
        html: sellerApplicationTemplate(data as SellerApplicationMailData),
      };

    case MailEvents.SELLER_APPROVED:
      return {
        to,
        subject: 'Satıcı Başvurun Onaylandı',
        html: sellerApprovedTemplate(data as SellerApprovedMailData),
      };

    case MailEvents.NEW_ORDER:
      return {
        to,
        subject: 'Yeni Siparişin Var',
        html: newOrderTemplate(data as NewOrderMailData),
      };

    case MailEvents.PAYMENT_REQUESTED:
      return {
        to,
        subject: 'Ödeme Talebin Alındı',
        html: paymentRequestedTemplate(data as PaymentRequestedMailData),
      };

    case MailEvents.PAYMENT_COMPLETED:
      return {
        to,
        subject: 'Ödemen Gönderildi',
        html: paymentCompletedTemplate(data as PaymentCompletedMailData),
      };

    default:
      throw new Error(`Unsupported mail event: ${event as string}`);
  }
};

export const handleMailEvent = async <TEvent extends MailEvents>(
  event: TEvent,
  data: MailEventDataMap[TEvent]
) => {
  const payload = getDispatchPayload(event, data);

  try {
    const result = await sendEmail(payload);
    logMail({
      to: payload.to,
      subject: payload.subject,
      status: 'success',
    });

    return result;
  } catch (error) {
    logMail({
      to: payload.to,
      subject: payload.subject,
      status: 'fail',
      error,
    });

    throw error;
  }
};

// Controller usage example:
// await handleMailEvent(MailEvents.USER_REGISTERED, user);
