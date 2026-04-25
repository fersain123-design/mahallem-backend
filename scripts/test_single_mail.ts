import '../src/config/env';
import { handleMailEvent } from '../src/services/mail/mailHandler';
import { MailEvents } from '../src/services/mail/mailEvents';

const run = async () => {
  const to = String(process.argv[2] || '').trim().toLowerCase();

  if (!to) {
    throw new Error('Usage: npx ts-node scripts/test_single_mail.ts <email>');
  }

  await handleMailEvent(MailEvents.USER_REGISTERED, {
    email: to,
    name: 'Fer Test',
  });

  console.log('SINGLE_MAIL_SENT');
  console.log('Recipient:', to);
  console.log('Event:', MailEvents.USER_REGISTERED);
};

run().catch((error) => {
  console.error('Single mail test failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});