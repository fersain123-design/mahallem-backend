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

  const dash = await requestJson(`${base}/admin/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  console.log(
    JSON.stringify(
      {
        totalUsers: dash.data.totalUsers,
        totalProducts: dash.data.totalProducts,
        totalOrders: dash.data.totalOrders,
        totalRevenue: dash.data.totalRevenue,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e.data || e);
  process.exit(1);
});
