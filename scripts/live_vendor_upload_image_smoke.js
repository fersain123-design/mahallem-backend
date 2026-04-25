/* eslint-disable no-console */

const sharp = require('sharp');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4000';

async function createSmokeImageBuffer() {
  // Use a deterministic, quality-gate-safe fixture for realistic upload validation.
  return sharp({
    create: {
      width: 800,
      height: 800,
      channels: 4,
      background: { r: 245, g: 245, b: 245, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
}

async function http(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, options);
  const text = await response.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }

  if (!response.ok) {
    throw new Error(`${path} => ${response.status}: ${text}`);
  }

  return body;
}

async function run() {
  const loginRes = await http('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'vendor@demo.com', password: 'Vendor123!' }),
  });

  const token = loginRes?.data?.accessToken;
  if (!token) {
    throw new Error('Vendor token not found');
  }

  const fileBuffer = await createSmokeImageBuffer();

  const form = new FormData();
  form.append('file', new Blob([fileBuffer], { type: 'image/png' }), 'smoke-quality-safe.png');

  const uploadRes = await http('/api/vendor/upload-image', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  const imageUrl = uploadRes?.data?.url || uploadRes?.data?.imageUrl || null;

  console.log(
    JSON.stringify(
      {
        baseUrl: BASE_URL,
        uploadOk: Boolean(imageUrl),
        imageUrl,
      },
      null,
      2
    )
  );

  if (!imageUrl) {
    process.exit(1);
  }
}

run().catch((error) => {
  console.error('LIVE_VENDOR_UPLOAD_IMAGE_SMOKE_FAILED');
  console.error(error?.stack || String(error));
  process.exit(1);
});
