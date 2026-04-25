const base = 'http://localhost:4001/api';

async function j(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  if (!res.ok) {
    const err = new Error('HTTP ' + res.status);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

(async () => {
  const health = await fetch('http://localhost:4001/health');
  console.log('health', health.status, await health.text());

  const login = await j(base + '/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@demo.com', password: 'Admin123!' }),
  });

  const token = login.data.accessToken;
  const auth = { Authorization: 'Bearer ' + token };

  const orders = await j(base + '/admin/orders', { headers: auth });
  const first = orders.data.orders[0];
  console.log('firstOrder', first.id, 'status', first.status);

  const upd = await j(base + '/admin/orders/' + first.id + '/status', {
    method: 'PUT',
    headers: auth,
    body: JSON.stringify({ status: 'PREPARING' }),
  });
  console.log('updated', upd.data.id, upd.data.status);
})().catch((e) => {
  console.error('FAIL', e.status, e.data || e.message);
  process.exit(1);
});
