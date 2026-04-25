import '../src/config/env';
import { handleMailEvent } from '../src/services/mail/mailHandler';
import { MailEvents } from '../src/services/mail/mailEvents';

const to = String(process.env.TEST_MAIL_TO || '').trim();

if (!to) {
  throw new Error('Missing TEST_MAIL_TO. Set TEST_MAIL_TO in environment variables.');
}

const run = async () => {
  const timestamp = Date.now();
  const customerName = String(process.env.TEST_CUSTOMER_NAME || 'Ahmet Yilmaz').trim();
  const sellerFirstName = String(process.env.TEST_SELLER_FIRST_NAME || 'Mehmet').trim();
  const sellerLastName = String(process.env.TEST_SELLER_LAST_NAME || 'Kaya').trim();

  await handleMailEvent(MailEvents.USER_REGISTERED, {
    email: to,
    name: customerName,
  });

  await handleMailEvent(MailEvents.ORDER_DELIVERED, {
    email: to,
    name: customerName,
    orderId: `ORD-${timestamp}-1`,
  });

  await handleMailEvent(MailEvents.SELLER_APPLICATION, {
    email: to,
    firstName: sellerFirstName,
    lastName: sellerLastName,
    documents: ['Kimlik Fotokopisi', 'Vergi Levhasi', 'IBAN Belgesi'],
  });

  await handleMailEvent(MailEvents.SELLER_APPROVED, {
    email: to,
    name: 'Mahallem Satıcısı',
  });

  await handleMailEvent(MailEvents.NEW_ORDER, {
    email: to,
    orderId: `ORD-${timestamp}-2`,
  });

  await handleMailEvent(MailEvents.PAYMENT_REQUESTED, {
    email: to,
    amount: '1.250,00 TL',
  });

  await handleMailEvent(MailEvents.PAYMENT_COMPLETED, {
    email: to,
    amount: '1.250,00 TL',
  });

  console.log('Tum mail eventleri basariyla gonderildi.');
};

run().catch((error) => {
  console.error('Toplu mail gonderimi basarisiz:', error instanceof Error ? error.message : error);
  process.exit(1);
});
