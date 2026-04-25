(async () => {
  const base = 'http://127.0.0.1:4000/api';
  const phone = '05343138558';
  const res = await fetch(base + '/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone })
  });
  const txt = await res.text();
  console.log(JSON.stringify({ status: res.status, body: txt }, null, 2));
})();
