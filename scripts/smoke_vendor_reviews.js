/* eslint-disable no-console */

const BASE_URL = 'http://127.0.0.1:4000/api';

async function requestJson(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  if (!res.ok) {
    const message = typeof data === 'object' ? JSON.stringify(data) : text;
    throw new Error(`${method} ${path} -> ${res.status} ${message}`);
  }

  return data;
}

async function main() {
  const login = await requestJson('/auth/login', {
    method: 'POST',
    body: {
      email: 'vendor@demo.com',
      password: 'Vendor123!',
    },
  });

  const token = login?.data?.accessToken;
  if (!token) {
    throw new Error('Vendor token not found in login response');
  }

  const productsRes = await requestJson('/vendor/products?limit=20', { token });
  const products = productsRes?.data?.products || [];
  if (!Array.isArray(products) || products.length === 0) {
    throw new Error('No vendor products found for smoke test');
  }

  const productId = String(products[0].id);

  const reviewsRes = await requestJson(`/vendor/products/${productId}/reviews`, { token });
  const reviews = Array.isArray(reviewsRes?.data) ? reviewsRes.data : [];

  let repliedReviewId = null;
  if (reviews.length > 0) {
    const target = reviews.find((r) => !r?.vendorReply) || reviews[0];
    const replyText = `Smoke yanıtı ${Date.now()}`;

    const replyRes = await requestJson(`/vendor/products/${productId}/reviews/${target.id}/reply`, {
      method: 'POST',
      token,
      body: { reply: replyText },
    });

    if (!replyRes?.data?.vendorReply) {
      throw new Error('Reply saved but vendorReply missing in response');
    }

    const verifyRes = await requestJson(`/vendor/products/${productId}/reviews`, { token });
    const verifyList = Array.isArray(verifyRes?.data) ? verifyRes.data : [];
    const updated = verifyList.find((r) => r.id === target.id);
    if (!updated || !updated.vendorReply) {
      throw new Error('Reply verification failed: vendorReply not persisted');
    }
    repliedReviewId = target.id;
  }

  const campaignsRes = await requestJson('/vendor/campaigns', { token });
  const campaigns = Array.isArray(campaignsRes?.data) ? campaignsRes.data : [];

  console.log('VENDOR_REVIEW_SMOKE_OK', {
    productId,
    reviewCount: reviews.length,
    repliedReviewId,
    campaignCount: campaigns.length,
  });
}

main().catch((error) => {
  console.error('VENDOR_REVIEW_SMOKE_FAIL', error?.message || error);
  process.exit(1);
});
