/* eslint-disable no-console */

async function requestJson(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });

  const data = await res.json();
  if (!res.ok) {
    const err = new Error('Request failed');
    err.data = data;
    err.status = res.status;
    throw err;
  }
  return data;
}

async function main() {
  const base = 'http://localhost:4001/api';

  const login = await requestJson(`${base}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({
      email: 'admin@demo.com',
      password: 'Admin123!',
    }),
  });

  const token = login.data.accessToken;
  const headers = { Authorization: `Bearer ${token}` };

  const list = await requestJson(`${base}/admin/products`, { headers });
  const first = list.data.products[0];

  console.log('products:', list.data.products.length);
  if (!first) return;

  console.log('first:', { id: first.id, name: first.name, isActive: first.isActive });

  const toggled = await requestJson(`${base}/admin/products/${first.id}/toggle-active`, {
    method: 'PUT',
    headers,
  });

  console.log('toggled:', { id: toggled.data.id, isActive: toggled.data.isActive });
}

main().catch((e) => {
  console.error(e.data || e);
  process.exit(1);
});
