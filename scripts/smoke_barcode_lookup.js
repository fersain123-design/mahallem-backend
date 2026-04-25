/*
 * Smoke test for vendor barcode lookup endpoint.
 * Usage:
 *   node scripts/smoke_barcode_lookup.js
 */

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4000/api';
const VENDOR_EMAIL = process.env.VENDOR_EMAIL || 'vendor@demo.com';
const VENDOR_PASSWORD = process.env.VENDOR_PASSWORD || 'Vendor123!';
const KNOWN_BARCODE = process.env.KNOWN_BARCODE || '8690570542100';
const UNKNOWN_BARCODE = process.env.UNKNOWN_BARCODE || '0000000000000';

const requestJson = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  const parsed = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`);
    error.data = parsed;
    throw error;
  }

  return parsed;
};

const assertEnvelope = (payload, label) => {
  if (
    !payload ||
    payload.success !== true ||
    !payload.data ||
    typeof payload.data.found !== 'boolean' ||
    typeof payload.data.source !== 'string'
  ) {
    throw new Error(`${label}: invalid response envelope`);
  }
};

const lookupBarcode = async (token, barcode) =>
  requestJson(`${BASE_URL}/vendor/products/lookup-barcode`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ barcode }),
  });

(async () => {
  try {
    const login = await requestJson(`${BASE_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email: VENDOR_EMAIL, password: VENDOR_PASSWORD }),
    });

    const token =
      login?.data?.accessToken ||
      login?.data?.access_token ||
      login?.accessToken ||
      login?.access_token;

    if (!token) {
      throw new Error('Login token not found in response');
    }

    const known = await lookupBarcode(token, KNOWN_BARCODE);
    assertEnvelope(known, 'known barcode lookup');

    const repeatedKnown = await lookupBarcode(token, KNOWN_BARCODE);
    assertEnvelope(repeatedKnown, 'repeated known barcode lookup');

    const unknown = await lookupBarcode(token, UNKNOWN_BARCODE);
    assertEnvelope(unknown, 'unknown barcode lookup');

    console.log('PASS smoke_barcode_lookup');
    console.log(
      JSON.stringify(
        {
          knownFound: known.data.found,
          knownSource: known.data.source,
          knownProductName: known.data.product?.name || null,
          repeatedKnownFound: repeatedKnown.data.found,
          repeatedKnownSource: repeatedKnown.data.source,
          unknownFound: unknown.data.found,
          unknownSource: unknown.data.source,
        },
        null,
        2
      )
    );
  } catch (error) {
    console.error('FAIL smoke_barcode_lookup');
    console.error(error?.message || error);
    if (error?.data) {
      console.error(JSON.stringify(error.data, null, 2));
    }
    process.exitCode = 1;
  }
})();
