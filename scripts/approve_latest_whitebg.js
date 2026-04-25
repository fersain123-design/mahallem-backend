(async () => {
  const base = 'http://127.0.0.1:4000';
  const j = async (u, o = {}) => {
    const r = await fetch(base + u, o);
    const t = await r.text();
    let d = {};
    try { d = JSON.parse(t); } catch {}
    if (!r.ok) throw new Error(u + ' ' + r.status + ' ' + t);
    return d;
  };

  const adminLogin = await j('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@demo.com', password: 'Admin123!' }),
  });
  const token = adminLogin?.data?.accessToken;
  if (!token) throw new Error('admin token missing');
  const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };

  const pending = await j('/api/admin/products?search=WhiteBg%20Smoke&approvalStatus=PENDING&limit=20', { headers });
  const list = pending?.data?.products || [];
  list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const product = list[0];
  if (!product) {
    console.log(JSON.stringify({ approved: false, reason: 'pending WhiteBg Smoke product not found' }));
    return;
  }

  await j('/api/admin/products/' + product.id + '/active', {
    method: 'PUT',
    headers,
    body: JSON.stringify({ isActive: true }),
  });

  const pub = await j('/api/products?search=WhiteBg%20Smoke&limit=50');
  const visible = (pub?.data?.products || []).some((p) => p.id === product.id);

  console.log(JSON.stringify({
    approved: true,
    approvedProductId: product.id,
    approvedProductName: product.name,
    customer_now_has_whitebg: visible,
  }));
})().catch((e) => {
  console.error(String(e?.message || e));
  process.exit(1);
});
