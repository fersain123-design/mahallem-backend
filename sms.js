const axios = require('axios');
require('dotenv').config();

const API_URL = 'https://api.vatansms.net/sms/send';

const normalizePhone = (rawPhone) => {
  const digits = String(rawPhone || '').replace(/\D/g, '');
  if (digits.startsWith('90') && digits.length === 12) return digits;
  if (digits.startsWith('0') && digits.length === 11) return `9${digits}`;
  if (digits.length === 10) return `90${digits}`;
  return digits;
};

const assertConfig = () => {
  const missing = ['VATANSMS_USER', 'VATANSMS_PASS', 'VATANSMS_HEADER'].filter(
    (key) => !String(process.env[key] || '').trim()
  );
  if (missing.length > 0) {
    throw new Error(`VatanSMS config missing: ${missing.join(', ')}`);
  }
};

const sendSMS = async (phone, code) => {
  assertConfig();

  const gsm = normalizePhone(phone);
  if (!/^90\d{10}$/.test(gsm)) {
    throw new Error(`Invalid Turkish phone format: ${phone}. Expected 905XXXXXXXXX.`);
  }

  const message = `Kodunuz: ${String(code || '').trim()}`;
  if (!String(code || '').trim()) {
    throw new Error('OTP code is required.');
  }

  try {
    const response = await axios.get(API_URL, {
      params: {
        user: process.env.VATANSMS_USER,
        password: process.env.VATANSMS_PASS,
        gsm,
        message,
        sender: process.env.VATANSMS_HEADER,
      },
      timeout: 15000,
    });

    console.log('SMS gonderildi:', {
      provider: 'vatansms',
      gsm,
      response: response.data,
    });

    return response.data;
  } catch (error) {
    const errorPayload = error?.response?.data || error?.message || String(error);
    console.error('SMS hatasi:', errorPayload);
    throw new Error(`VatanSMS send failed: ${typeof errorPayload === 'string' ? errorPayload : JSON.stringify(errorPayload)}`);
  }
};

module.exports = sendSMS;
