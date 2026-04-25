(async () => {
  const fs = require('fs');
  const path = require('path');

  const base = 'http://127.0.0.1:4000';

  const requestJson = async (urlPath, options = {}) => {
    const res = await fetch(base + urlPath, options);
    const text = await res.text();
    let json = {};
    try {
      json = JSON.parse(text);
    } catch {
      json = {};
    }

    if (!res.ok) {
      throw new Error(`${urlPath} ${res.status} ${text}`);
    }

    return json;
  };

  const login = await requestJson('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'vendor@demo.com', password: 'Vendor123!' }),
  });

  const token = login?.data?.accessToken;
  if (!token) {
    throw new Error('vendor token missing');
  }

  const samplePath = path.resolve(__dirname, '..', '..', '_runlogs', 'cleaned_test.png');
  const imageBuffer = fs.readFileSync(samplePath);

  const formData = new FormData();
  formData.append('file', new Blob([imageBuffer], { type: 'image/png' }), 'smoke-input.png');

  const uploadRes = await fetch(base + '/api/vendor/upload-image', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  const uploadText = await uploadRes.text();
  let uploadJson = {};
  try {
    uploadJson = JSON.parse(uploadText);
  } catch {
    uploadJson = {};
  }

  if (!uploadRes.ok) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          status: uploadRes.status,
          body: uploadText,
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        status: uploadRes.status,
        url: uploadJson?.data?.url || uploadJson?.data?.imageUrl || null,
      },
      null,
      2
    )
  );
})();
