const base = 'http://127.0.0.1:4000/api';
const phone = '05551112233';

const requestJson = async (url, options = {}) => {
  const response = await fetch(`${base}${url}`, options);
  const bodyText = await response.text();

  let data = {};
  try {
    data = JSON.parse(bodyText);
  } catch {
    data = {};
  }

  return { ok: response.ok, status: response.status, data, raw: bodyText };
};

(async () => {
  try {
    const first = await requestJson('/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });

    const second = await requestJson('/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });

    const attempts = [];
    for (let index = 1; index <= 3; index += 1) {
      const verify = await requestJson('/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otpCode: '000000' }),
      });
      attempts.push({ index, status: verify.status, ok: verify.ok, message: verify.data?.message });
    }

    const locked = attempts[2]?.status === 423;
    const cooldownWorks = second.status === 429;

    console.log(
      JSON.stringify(
        {
          firstForgotStatus: first.status,
          secondForgotStatus: second.status,
          cooldownWorks,
          attempts,
          locked,
        },
        null,
        2
      )
    );

    if (!cooldownWorks || !locked) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(String(error && error.message ? error.message : error));
    process.exitCode = 1;
  }
})();
