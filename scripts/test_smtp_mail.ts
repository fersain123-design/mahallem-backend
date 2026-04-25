import '../src/config/env';
import { sendMail } from '../src/services/mail/mailService';

const run = async () => {
  const to = String(process.env.TEST_MAIL_TO || '').trim();

  if (!to) {
    throw new Error('Missing TEST_MAIL_TO. Set TEST_MAIL_TO in environment variables.');
  }

  const result = await sendMail(
    to,
    'Mahallem SMTP Test',
    '<h2>SMTP test successful</h2><p>This email was sent from backend via Amazon SES SMTP.</p>'
  );

  console.log('SMTP test email sent successfully.');
  console.log('messageId:', result.messageId);
  console.log('accepted:', result.accepted);
  console.log('rejected:', result.rejected);
};

run().catch((error) => {
  console.error('SMTP test failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
