const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

const base = 'http://127.0.0.1:4000/api';
const phone = '05551112233';
const email = 'otp-smoke@demo.com';
const password = 'Smoke123!';
const newPassword = 'Smoke456!';
const normalizedPhone = '+905551112233';

const requestJson = async (url, options = {}) => {
  const response = await fetch(`${base}${url}`, options);
  const bodyText = await response.text();

  let data = {};
  try {
    data = JSON.parse(bodyText);
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(`${url} ${response.status} ${bodyText}`);
  }

  return data;
};

(async () => {
  try {
    try {
      await requestJson('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Otp Smoke',
          email,
          phone,
          password,
          role: 'CUSTOMER',
        }),
      });
    } catch {
      // ignore if already registered
    }

    await requestJson('/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });

    const latestOtp = await prisma.passwordResetOtp.findFirst({
      where: { phoneSnapshot: normalizedPhone },
      orderBy: { createdAt: 'desc' },
    });

    if (!latestOtp) {
      throw new Error('OTP row not found in database');
    }

    const otpCode = '111111';
    const otpHash = crypto.createHash('sha256').update(otpCode).digest('hex');

    await prisma.passwordResetOtp.update({
      where: { id: latestOtp.id },
      data: {
        otpHash,
        status: 'PENDING',
        attempts: 0,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    const verifyResponse = await requestJson('/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otpCode }),
    });

    const resetToken = verifyResponse?.data?.resetToken || verifyResponse?.resetToken;
    if (!resetToken) {
      throw new Error('resetToken missing from verify response');
    }

    await requestJson('/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone,
        resetToken,
        newPassword,
        confirmPassword: newPassword,
      }),
    });

    const loginResponse = await requestJson('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: newPassword }),
    });

    console.log(
      JSON.stringify(
        {
          ok: true,
          userId: loginResponse?.data?.user?.id || loginResponse?.user?.id || null,
          email,
        },
        null,
        2
      )
    );
  } catch (error) {
    console.error(String(error && error.message ? error.message : error));
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
