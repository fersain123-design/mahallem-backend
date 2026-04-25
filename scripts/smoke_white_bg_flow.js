(async () => {
  const fs = require('fs');
  const path = require('path');

  const health = async (base) => {
    try {
      const response = await fetch(base + '/health');
      const body = await response.text();
      return { ok: response.ok, status: response.status, body };
    } catch (error) {
      return { ok: false, status: 0, body: String(error && error.message ? error.message : error) };
    }
  };

  const backendHealth = await health('http://127.0.0.1:4000');
  const cleanerHealth = await health('http://127.0.0.1:8000');

  const result = {
    health4000: backendHealth,
    health8000: cleanerHealth,
  };

  if (!backendHealth.ok) {
    console.log(JSON.stringify({ ...result, ok: false, step: 'backend-health-failed' }, null, 2));
    process.exit(1);
  }

  const base = 'http://127.0.0.1:4000';
  const request = async (path, options = {}) => {
    const response = await fetch(base + path, options);
    const text = await response.text();
    let data = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = {};
    }
    if (!response.ok) {
      throw new Error(path + ' ' + response.status + ' ' + text);
    }
    return data;
  };

  const vendorLogin = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'vendor@demo.com', password: 'Vendor123!' }),
  });

  const token = vendorLogin && vendorLogin.data ? vendorLogin.data.accessToken : null;
  if (!token) {
    throw new Error('vendor token missing');
  }

  const sampleImagePath = path.resolve(__dirname, '..', '..', '_runlogs', 'cleaned_test.png');
  const transparentPng = fs.readFileSync(sampleImagePath);

  const formData = new FormData();
  formData.append('file', new Blob([transparentPng], { type: 'image/png' }), 'smoke-input.png');

  const uploadResponse = await fetch(base + '/api/vendor/upload-image', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token },
    body: formData,
  });

  const uploadText = await uploadResponse.text();
  let uploadJson = {};
  try {
    uploadJson = JSON.parse(uploadText);
  } catch {
    uploadJson = {};
  }

  if (!uploadResponse.ok) {
    console.log(
      JSON.stringify(
        {
          ...result,
          ok: false,
          step: 'upload-failed',
          uploadStatus: uploadResponse.status,
          uploadBody: uploadText,
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  const imageUrl =
    uploadJson && uploadJson.data
      ? uploadJson.data.url || uploadJson.data.imageUrl || null
      : null;

  if (!imageUrl) {
    throw new Error('image url missing');
  }

  const productName = 'WhiteBg Smoke ' + Date.now();
  const created = await request('/api/vendor/products', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      name: productName,
      price: 11.5,
      stock: 5,
      unit: 'adet',
      categoryName: 'Diğer',
      images: [imageUrl],
      status: 'active',
      submissionSource: 'ADVANCED',
    }),
  });

  const productId = created && created.data ? created.data.id : null;

  const publicList = await request('/api/products?search=' + encodeURIComponent(productName) + '&limit=20');
  const products = publicList && publicList.data && Array.isArray(publicList.data.products) ? publicList.data.products : [];
  const found = products.find((p) => p && (p._id === productId || p.id === productId || p.name === productName));

  console.log(
    JSON.stringify(
      {
        ...result,
        ok: true,
        productId,
        imageUrl,
        foundInCustomer: Boolean(found),
        customerImages: found && Array.isArray(found.images) ? found.images : [],
      },
      null,
      2
    )
  );
})().catch((error) => {
  console.error(String(error && error.message ? error.message : error));
  process.exit(1);
});
