(async () => {
  const base = 'http://127.0.0.1:4000';

  const request = async (path, options = {}) => {
    const response = await fetch(base + path, options);
    const text = await response.text();
    let data = {};
    try {
      data = JSON.parse(text);
    } catch {
      // keep raw response
    }
    if (!response.ok) {
      throw new Error(`${path} ${response.status} ${text}`);
    }
    return data;
  };

  const stamp = Date.now();
  const email = `vendor.qgate.${stamp}@mail.com`;
  const pass = 'Vendor123!';
  const phone = '+90552' + String(stamp).slice(-7);

  await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Vendor QGate',
      email,
      password: pass,
      role: 'VENDOR',
      phone,
      businessType: 'diger',
    }),
  });

  const login = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: pass }),
  });

  const token = login?.data?.accessToken;
  if (!token) {
    throw new Error('token missing');
  }

  const tiny = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVR42mP8z8Dwn4GBgYGJAQoAHxcCAr7gY7QAAAAASUVORK5CYII=';
  const form = new FormData();
  form.append('file', new Blob([Buffer.from(tiny, 'base64')], { type: 'image/png' }), 'tiny.png');

  const up = await fetch(base + '/api/vendor/upload-image', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  const body = await up.text();
  console.log(`tiny=${up.status} ${body}`);
})().catch((err) => {
  console.error(String(err?.message || err));
  process.exit(1);
});
