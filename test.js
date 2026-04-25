require('dotenv').config();

const sendSMS = require('./sms');

const main = async () => {
  const phone = process.argv[2] || '905XXXXXXXXX';
  const code = process.argv[3] || '123456';

  try {
    const result = await sendSMS(phone, code);
    console.log('SMS test success:', result);
  } catch (error) {
    console.error('SMS test failed:', error.message || error);
    process.exit(1);
  }
};

main();
