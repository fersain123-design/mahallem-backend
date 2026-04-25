import '../src/config/env';
import { sendOTPEmail } from '../src/services/emailOtpService';
import { handleMailEvent } from '../src/services/mail/mailHandler';
import { MailEvents } from '../src/services/mail/mailEvents';

const run = async () => {
  const to = String(process.argv[2] || process.env.TEST_MAIL_TO || '').trim().toLowerCase();

  if (!to) {
    throw new Error('Recipient email is required. Usage: npx ts-node scripts/test_all_mails.ts <email>');
  }

  const sent: string[] = [];

  await handleMailEvent(MailEvents.USER_REGISTERED, {
    email: to,
    name: 'Fer Test',
  });
  sent.push(MailEvents.USER_REGISTERED);

  await handleMailEvent(MailEvents.ORDER_DELIVERED, {
    email: to,
    name: 'Fer Test',
    orderId: 'ORD-TEST-20260330-001',
  });
  sent.push(MailEvents.ORDER_DELIVERED);

  await handleMailEvent(MailEvents.SELLER_APPLICATION, {
    email: to,
    firstName: 'Fer',
    lastName: 'Test',
  });
  sent.push(MailEvents.SELLER_APPLICATION);

  await handleMailEvent(MailEvents.SELLER_APPROVED, {
    email: to,
    name: 'Fer Test',
  });
  sent.push(MailEvents.SELLER_APPROVED);

  await handleMailEvent(MailEvents.NEW_ORDER, {
    email: to,
    orderId: 'ORD-TEST-20260330-002',
  });
  sent.push(MailEvents.NEW_ORDER);

  await handleMailEvent(MailEvents.PAYMENT_REQUESTED, {
    email: to,
    amount: '549.90 TL',
  });
  sent.push(MailEvents.PAYMENT_REQUESTED);

  await handleMailEvent(MailEvents.PAYMENT_COMPLETED, {
    email: to,
    amount: '549.90 TL',
  });
  sent.push(MailEvents.PAYMENT_COMPLETED);

  await sendOTPEmail(to, '472915');
  sent.push('OTP_PASSWORD_RESET');

  console.log('All test emails sent successfully.');
  console.log('Recipient:', to);
  console.log('Sent count:', sent.length);
  console.log('Sent events:', sent.join(', '));
};

run().catch((error) => {
  console.error('Bulk mail test failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});