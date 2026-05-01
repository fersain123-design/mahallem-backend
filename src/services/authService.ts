import prisma from '../config/db';
import { hashPassword, comparePassword } from '../utils/passwordUtils';
import { generateToken } from '../utils/jwtUtils';
import { AppError } from '../middleware/errorHandler';
import {
  RegisterInput,
  LoginInput,
  RequestLoginOtpInput,
  VerifyLoginOtpInput,
  ForgotPasswordInput,
  VerifyOtpInput,
  ResetPasswordInput,
} from '../utils/validationSchemas';
import { OAuth2Client } from 'google-auth-library';
import { buildPhoneLookupCandidates, normalizePhoneToE164 } from '../utils/phoneUtils';
import { generateOtpCode, generateResetSessionToken, hashSecret, secureHashMatch } from '../utils/otpUtils';
import { sendLoginOtpSms } from './smsService';
import { sendOTPEmail } from './emailOtpService';
import { resolveCategoryIdForBusinessType } from './subcategoryService';
import { handleMailEvent } from './mail/mailHandler';
import { MailEvents } from './mail/mailEvents';

const googleClientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
const googleClient = new OAuth2Client(googleClientId || undefined);

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 3;
const PASSWORD_RESET_OTP_MAX_ATTEMPTS = 5;
const RESET_SESSION_TTL_MS = 10 * 60 * 1000;
const ACCOUNT_SUSPEND_REASON_PREFIX = '[SUSPENDED]';
const SUSPENDED_ACCOUNT_MESSAGE =
  'Hesabınız kötüye kullanıldığı için askıya alınmıştır. Size bir e-posta gönderdik.';

const supabaseUrl = String(
  process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || ''
).trim().replace(/\/+$/, '');
const supabaseApiKey = String(
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    ''
).trim();

const isSqliteDatabase = () => {
  const raw = String(process.env.DATABASE_URL || '').trim().toLowerCase();
  return raw.startsWith('file:') || raw.startsWith('sqlite:');
};

const getVendorProfileCompat = async (userId: string) => {
  if (isSqliteDatabase()) {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT
        id, userId, shopName, iban, bankName, status, businessType,
        address, country, city, district, neighborhood, addressLine,
        deliveryCoverage, deliveryMode, isActive, categoryId,
        storeAbout, openingTime, closingTime, storeCoverImageUrl, storeLogoImageUrl,
        deliveryMinutes, minimumOrderAmount, flatDeliveryFee, freeOverAmount,
        storeOpenOverride, preparationMinutes
      FROM VendorProfile
      WHERE userId = ?
      LIMIT 1`,
      userId
    )) as any[];

    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  }

  return prisma.vendorProfile.findUnique({
    where: { userId },
  });
};

const buildLoginResponse = async (userId: string) => {
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!currentUser) {
    throw new AppError(404, 'User not found');
  }

  const currentVendorProfile = await getVendorProfileCompat(userId);

  if (currentUser?.role === 'VENDOR' && !currentVendorProfile) {
    const categoryId = await resolveCategoryIdForBusinessType('diger');
    await (prisma as any).vendorProfile.create({
      data: {
        userId,
        shopName: currentUser.name || 'Mağaza',
        iban: 'TR000000000000000000000000',
        bankName: 'Bilinmiyor',
        businessType: 'diger',
        categoryId,
        deliveryCoverage: 'PLATFORM',
        deliveryMode: 'PLATFORM',
        status: 'APPROVED',
      },
    });
  }

  if (currentUser?.role === 'CUSTOMER') {
    const addressCount = await prisma.customerAddress.count({
      where: { userId },
    });

    if (addressCount === 0) {
      await prisma.customerAddress.create({
        data: {
          userId,
          title: 'Ev',
          fullName: currentUser.name || 'Müşteri',
          phone: currentUser.phone || '5555555555',
          country: 'Türkiye',
          city: 'İstanbul',
          district: 'Kadıköy',
          neighborhood: 'Merkez',
          addressLine: 'Mahallem Sokak No: 1',
          isDefault: true,
        },
      });
    }
  }

  const userWithProfile = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!userWithProfile) {
    throw new AppError(404, 'User not found');
  }

  const vendorProfile = await getVendorProfileCompat(userId);

  const token = generateToken({
    userId,
    role: userWithProfile.role as 'CUSTOMER' | 'VENDOR' | 'ADMIN',
  });

  return {
    accessToken: token,
    user: {
      id: userWithProfile.id,
      name: userWithProfile.name,
      email: userWithProfile.email,
      phone: userWithProfile.phone,
      role: userWithProfile.role,
      vendorProfile,
    },
  };
};

const findOrCreateCustomerFromOAuthProfile = async (profile: {
  email: string;
  name?: string | null;
  phone?: string | null;
  providerId?: string | null;
  authProvider?: 'GOOGLE';
}) => {
  const email = String(profile.email || '').trim().toLowerCase();
  if (!email) {
    throw new AppError(400, 'OAuth profile does not contain an email');
  }

  const name =
    String(profile.name || '').trim() ||
    String(email.split('@')[0] || '').trim() ||
    'Müşteri';
  const phone = String(profile.phone || '').trim() || null;
  const providerId = String(profile.providerId || '').trim() || null;
  const authProvider = profile.authProvider || 'GOOGLE';

  let user = providerId
    ? await prisma.user.findUnique({
        where: { providerId },
        include: { vendorProfile: true },
      })
    : null;

  if (!user) {
    user = await prisma.user.findUnique({
      where: { email },
      include: { vendorProfile: true },
    });
  }

  if (!user) {
    const createdUser = await prisma.user.create({
      data: {
        name,
        email,
        phone,
        authProvider,
        providerId,
        passwordHash: await hashPassword(generateRandomPassword()),
        role: 'CUSTOMER',
        isActive: true,
      },
      include: { vendorProfile: true },
    });

    await prisma.cart.create({
      data: {
        userId: createdUser.id,
      },
    });

    user = createdUser;
  } else {
    const updateData: Record<string, any> = {};

    if (providerId && !user.providerId) {
      updateData.providerId = providerId;
    }

    if (name && String(user.name || '').trim() !== name) {
      updateData.name = name;
    }

    if (phone && !String(user.phone || '').trim()) {
      updateData.phone = phone;
    }

    if (Object.keys(updateData).length > 0) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: updateData,
        include: { vendorProfile: true },
      });
    }
  }

  if (!user) {
    throw new AppError(500, 'User could not be created');
  }

  if (user.isActive === false) {
    throw new AppError(403, 'Account is deactivated');
  }

  if (user.role !== 'CUSTOMER') {
    throw new AppError(
      403,
      'This email is already registered as a seller or admin account. Please use a different Google account for customer login.'
    );
  }

  return buildLoginResponse(user.id);
};

export const registerUser = async (data: RegisterInput) => {
  const phoneNormalized = data.phone ? normalizePhoneToE164(data.phone) : null;
  const tcKimlikNormalized = data.tcKimlik
    ? String(data.tcKimlik).replace(/\D/g, '').trim()
    : null;

  if (data.phone && !phoneNormalized) {
    throw new AppError(400, 'Invalid phone number');
  }

  if (tcKimlikNormalized && tcKimlikNormalized.length !== 11) {
    throw new AppError(400, 'TC Kimlik must be 11 digits');
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (existingUser) {
    throw new AppError(400, 'Email already registered');
  }

  if (phoneNormalized) {
    const existingPhone = await prisma.user.findUnique({
      where: { phoneNormalized },
      select: { id: true },
    });

    if (existingPhone) {
      throw new AppError(400, 'Phone number already registered');
    }
  }

  if (data.role === 'VENDOR' && tcKimlikNormalized) {
    const existingTcKimlik = await prisma.vendorProfile.findFirst({
      where: { tcKimlik: tcKimlikNormalized },
      select: { id: true },
    });

    if (existingTcKimlik) {
      throw new AppError(400, 'TC Kimlik already registered');
    }
  }

  const passwordHash = await hashPassword(data.password);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      phoneNormalized,
      passwordHash,
      role: data.role,
    },
  });

  // If vendor, create vendor profile
  if (data.role === 'VENDOR') {
    const initialDeliveryCoverage =
      data.deliveryCoverage === 'SELF' || data.deliveryCoverage === 'PLATFORM'
        ? data.deliveryCoverage
        : 'PLATFORM';
    const categoryId = await resolveCategoryIdForBusinessType(data.businessType || 'diger');

    await (prisma as any).vendorProfile.create({
      data: {
        userId: user.id,
        shopName: '',
        iban: '',
        bankName: '',
        ...(tcKimlikNormalized ? { tcKimlik: tcKimlikNormalized } : {}),
        businessType: data.businessType || 'diger',
        categoryId,
        deliveryCoverage: initialDeliveryCoverage,
        deliveryMode: initialDeliveryCoverage === 'PLATFORM' ? 'PLATFORM' : 'SELLER',
        status: 'PENDING',
      },
    });

    // Create notification for admins
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
    });

    for (const admin of admins) {
      await prisma.notification.create({
        data: {
          userId: admin.id,
          type: 'ACCOUNT_UPDATE',
          title: 'Yeni Satıcı Başvurusu',
          message: `${data.name} adlı kullanıcı satıcı olmak için başvurdu. Onay bekliyor.`,
        },
      });
    }

    try {
      const nameParts = String(data.name || '').trim().split(/\s+/).filter(Boolean);
      const firstName = nameParts[0] || undefined;
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : undefined;

      await handleMailEvent(MailEvents.SELLER_APPLICATION, {
        email: data.email,
        firstName,
        lastName,
      });
    } catch (error) {
      console.warn('[authService] seller application mail failed:', error);
    }
  }

  // Create empty cart for customers
  if (data.role === 'CUSTOMER') {
    await prisma.cart.create({
      data: {
        userId: user.id,
      },
    });

    try {
      await handleMailEvent(MailEvents.USER_REGISTERED, {
        email: data.email,
        name: data.name,
      });
    } catch (error) {
      console.warn('[authService] customer welcome mail failed:', error);
    }
  }

  const token = generateToken({
    userId: user.id,
    role: user.role as 'CUSTOMER' | 'VENDOR' | 'ADMIN',
  });

  const createdUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: { vendorProfile: true },
  });

  return {
    accessToken: token,
    user: {
      id: createdUser!.id,
      name: createdUser!.name,
      email: createdUser!.email,
      phone: createdUser!.phone,
      role: createdUser!.role,
      vendorProfile: createdUser!.vendorProfile,
    },
  };
};

export const loginUser = async (data: LoginInput) => {
  const identifier = String(data.email || '').trim();

  const user = identifier.includes('@')
    ? await prisma.user.findUnique({
        where: { email: identifier.toLowerCase() },
      })
    : await (async () => {
        const normalizedPhone = normalizePhoneToE164(identifier);
        if (normalizedPhone) {
          const matchByNormalized = await prisma.user.findUnique({
            where: { phoneNormalized: normalizedPhone },
          });

          if (matchByNormalized) {
            return matchByNormalized;
          }
        }

        const phoneCandidates = buildPhoneLookupCandidates(identifier);
        if (phoneCandidates.length === 0) return null;

        const fallback = await prisma.user.findFirst({
          where: {
            phone: {
              in: phoneCandidates,
            },
          },
        });

        if (fallback?.id && normalizedPhone && !fallback.phoneNormalized) {
          await prisma.user.update({
            where: { id: fallback.id },
            data: { phoneNormalized: normalizedPhone },
          });
        }

        return fallback;
      })();

  if (!user) {
    throw new AppError(401, 'Invalid credentials');
  }

  const isPasswordValid = await comparePassword(data.password, user.passwordHash);

  if (!isPasswordValid) {
    throw new AppError(401, 'Invalid credentials');
  }

  if (user.isActive === false) {
    const reason = String((user as any)?.deactivationReason || '').trim();
    if (reason.startsWith(ACCOUNT_SUSPEND_REASON_PREFIX)) {
      throw new AppError(403, SUSPENDED_ACCOUNT_MESSAGE);
    }
    throw new AppError(403, 'Account is deactivated');
  }

  return buildLoginResponse(user.id);
};

export const requestLoginOtp = async (
  data: RequestLoginOtpInput,
  meta?: { ip?: string; userAgent?: string }
) => {
  const { user, normalizedPhone } = await findUserByResetPhone(data.phone);

  if (!user) {
    throw new AppError(404, 'Bu telefon numarası ile kayıtlı kullanıcı bulunamadı');
  }

  if (user.isActive === false) {
    throw new AppError(403, 'Hesap pasif durumda');
  }

  if (user.authProvider !== 'EMAIL') {
    throw new AppError(400, 'Bu hesap için OTP giriş kapalı. Google ile giriş yapın.');
  }

  const latestOtp = await prisma.loginOtp.findFirst({
    where: {
      userId: user.id,
      status: 'PENDING',
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  const now = Date.now();

  if (latestOtp) {
    const elapsedMs = now - latestOtp.lastSentAt.getTime();
    if (elapsedMs < OTP_RESEND_COOLDOWN_MS) {
      const retryAfterSeconds = Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsedMs) / 1000);
      throw new AppError(429, `Kodu tekrar göndermek için ${retryAfterSeconds} saniye bekleyin`);
    }
  }

  await prisma.loginOtp.updateMany({
    where: {
      userId: user.id,
      status: 'PENDING',
    },
    data: {
      status: 'EXPIRED',
    },
  });

  const otpCode = generateOtpCode();
  const otpHash = hashSecret(otpCode);

  await prisma.loginOtp.create({
    data: {
      userId: user.id,
      phoneSnapshot: normalizedPhone,
      otpHash,
      status: 'PENDING',
      attempts: 0,
      maxAttempts: OTP_MAX_ATTEMPTS,
      expiresAt: new Date(now + OTP_TTL_MS),
      lastSentAt: new Date(now),
      requestIp: meta?.ip || null,
      userAgent: meta?.userAgent || null,
    },
  });

  await sendLoginOtpSms({
    phone: normalizedPhone,
    otpCode,
    expiresMinutes: 5,
  });

  return {
    message: 'Doğrulama kodu telefonunuza gönderildi',
    resendAvailableInSeconds: 60,
  };
};

export const verifyLoginOtp = async (data: VerifyLoginOtpInput) => {
  const { user } = await findUserByResetPhone(data.phone);

  if (!user) {
    throw new AppError(404, 'Bu telefon numarası ile kayıtlı kullanıcı bulunamadı');
  }

  if (user.isActive === false) {
    throw new AppError(403, 'Hesap pasif durumda');
  }

  if (user.authProvider !== 'EMAIL') {
    throw new AppError(400, 'Bu hesap için OTP giriş kapalı. Google ile giriş yapın.');
  }

  const latestOtp = await prisma.loginOtp.findFirst({
    where: {
      userId: user.id,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  if (!latestOtp || latestOtp.status !== 'PENDING') {
    throw new AppError(400, 'Doğrulama kodu bulunamadı veya geçersiz');
  }

  const now = Date.now();

  if (latestOtp.expiresAt.getTime() <= now) {
    await prisma.loginOtp.update({
      where: { id: latestOtp.id },
      data: { status: 'EXPIRED' },
    });
    throw new AppError(400, 'Doğrulama kodunun süresi doldu');
  }

  if (latestOtp.attempts >= latestOtp.maxAttempts) {
    await prisma.loginOtp.update({
      where: { id: latestOtp.id },
      data: { status: 'LOCKED' },
    });
    throw new AppError(423, 'Çok fazla hatalı deneme. İşlem kilitlendi');
  }

  const isValid = secureHashMatch(data.otpCode, latestOtp.otpHash);
  if (!isValid) {
    const nextAttempts = latestOtp.attempts + 1;
    const willLock = nextAttempts >= latestOtp.maxAttempts;

    await prisma.loginOtp.update({
      where: { id: latestOtp.id },
      data: {
        attempts: {
          increment: 1,
        },
        status: willLock ? 'LOCKED' : 'PENDING',
      },
    });

    if (willLock) {
      throw new AppError(423, 'Çok fazla hatalı deneme. İşlem kilitlendi');
    }

    throw new AppError(400, 'Doğrulama kodu hatalı');
  }

  await prisma.loginOtp.update({
    where: { id: latestOtp.id },
    data: {
      status: 'CONSUMED',
      consumedAt: new Date(now),
    },
  });

  await prisma.loginOtp.updateMany({
    where: {
      userId: user.id,
      id: {
        not: latestOtp.id,
      },
      status: 'PENDING',
    },
    data: {
      status: 'EXPIRED',
    },
  });

  return buildLoginResponse(user.id);
};

export const getCurrentUser = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError(404, 'User not found');
  }

  const vendorProfile = await getVendorProfileCompat(userId);

  const defaultAddress =
    user.role === 'CUSTOMER'
      ? await prisma.customerAddress.findFirst({
          where: { userId, isDefault: true },
        })
      : null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    vendorProfile,
    defaultAddress,
  };
};

export const loginWithGoogle = async (googleToken: string) => {
  const token = String(googleToken || '').trim();
  if (!token) {
    throw new AppError(400, 'Google token is required');
  }

  let payload: any = null;

  try {
    // First try strict audience validation when a client id is configured.
    if (googleClientId) {
      const ticket = await googleClient.verifyIdToken({
        idToken: token,
        audience: googleClientId,
      });
      payload = ticket.getPayload();
    } else {
      const ticket = await googleClient.verifyIdToken({
        idToken: token,
      });
      payload = ticket.getPayload();
    }
  } catch (_verifyError) {
    try {
      // Supabase/Expo flows may issue a Google ID token with a different audience.
      // Verify signature/issuer without audience before trying access-token endpoints.
      const idTokenTicket = await googleClient.verifyIdToken({
        idToken: token,
      });
      payload = idTokenTicket.getPayload();
    } catch (_idTokenFallbackError) {
      // Not a usable ID token, continue with Google access-token fallback.
    }

    if (!payload) {
      try {
        const tokenInfoResponse = await fetch(
          `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`
        );

        if (!tokenInfoResponse.ok) {
          throw new Error('tokeninfo_failed');
        }

        const tokenInfo = (await tokenInfoResponse.json()) as Record<string, any>;
        const expiresIn = Number(tokenInfo?.expires_in || 0);
        if (!Number.isFinite(expiresIn) || expiresIn <= 0) {
          throw new Error('token_expired');
        }

        const userInfoResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!userInfoResponse.ok) {
          throw new Error('userinfo_failed');
        }

        const userInfo = (await userInfoResponse.json()) as Record<string, any>;
        if (String(userInfo?.email || '').trim() === '') {
          throw new Error('email_missing');
        }

        payload = {
          email: userInfo?.email,
          name: userInfo?.name,
          given_name: userInfo?.given_name,
          family_name: userInfo?.family_name,
          sub: userInfo?.sub,
        };
      } catch (_accessTokenFallbackError) {
        throw new AppError(401, 'Invalid Google token');
      }
    }
  }

  if (!payload || !payload.email) {
    throw new AppError(400, 'Google profile does not contain an email');
  }

  return findOrCreateCustomerFromOAuthProfile({
    email: String(payload.email).toLowerCase(),
    name: payload.name || `${payload.given_name || ''} ${payload.family_name || ''}`.trim(),
    providerId: payload.sub ? String(payload.sub).trim() : null,
    authProvider: 'GOOGLE',
  });
};

export const loginWithSupabaseAccessToken = async (supabaseAccessToken: string) => {
  const token = String(supabaseAccessToken || '').trim();
  if (!token) {
    throw new AppError(400, 'Supabase token is required');
  }

  if (!supabaseUrl || !supabaseApiKey) {
    throw new AppError(500, 'Supabase auth environment is not configured on backend');
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: supabaseApiKey,
    },
  });

  if (!response.ok) {
    throw new AppError(401, 'Invalid Supabase session');
  }

  const userData = (await response.json()) as Record<string, any>;
  const email = String(userData?.email || '').trim().toLowerCase();
  if (!email) {
    throw new AppError(400, 'Supabase profile does not contain an email');
  }

  const metadata = (userData?.user_metadata || {}) as Record<string, any>;
  const identities = Array.isArray(userData?.identities) ? userData.identities : [];
  const googleIdentity = identities.find((identity: any) => String(identity?.provider || '').toLowerCase() === 'google');
  const identityData = (googleIdentity?.identity_data || {}) as Record<string, any>;

  return findOrCreateCustomerFromOAuthProfile({
    email,
    name:
      String(metadata?.name || metadata?.full_name || identityData?.name || identityData?.full_name || '').trim() ||
      null,
    phone: String(metadata?.phone || userData?.phone || '').trim() || null,
    providerId:
      String(googleIdentity?.id || identityData?.sub || userData?.id || '').trim() || null,
    authProvider: 'GOOGLE',
  });
};

const upsertNormalizedPhoneForSingleUser = async (rawPhone: string, normalizedPhone: string) => {
  const phoneCandidates = buildPhoneLookupCandidates(rawPhone);
  if (phoneCandidates.length === 0) return null;

  const matches = await prisma.user.findMany({
    where: {
      phone: {
        in: phoneCandidates,
      },
    },
    select: {
      id: true,
      phoneNormalized: true,
      authProvider: true,
      isActive: true,
      phone: true,
    },
    take: 2,
  });

  if (matches.length !== 1) {
    return null;
  }

  const user = matches[0];
  if (user.phoneNormalized === normalizedPhone) {
    return user;
  }

  if (!user.phoneNormalized) {
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { phoneNormalized: normalizedPhone },
      });

      return {
        ...user,
        phoneNormalized: normalizedPhone,
      };
    } catch {
      return null;
    }
  }

  return null;
};

const findUserByResetPhone = async (rawPhone: string) => {
  const inputPhone = String(rawPhone || '').trim();
  const normalizedPhone = normalizePhoneToE164(inputPhone);
  if (!normalizedPhone) {
    throw new AppError(400, 'Invalid phone number');
  }

  const exactMatches = await prisma.user.findMany({
    where: { phone: inputPhone },
    select: {
      id: true,
      phone: true,
      phoneNormalized: true,
      authProvider: true,
      isActive: true,
    },
    take: 2,
  });

  if (exactMatches.length === 1) {
    const exact = exactMatches[0];

    if (!exact.phoneNormalized) {
      try {
        await prisma.user.update({
          where: { id: exact.id },
          data: { phoneNormalized: normalizedPhone },
        });

        return {
          user: {
            ...exact,
            phoneNormalized: normalizedPhone,
          },
          normalizedPhone,
        };
      } catch {
        // If normalized phone is already used by another account,
        // fall through to ambiguity checks below.
      }
    }

    return {
      user: exact,
      normalizedPhone,
    };
  }

  if (exactMatches.length > 1) {
    throw new AppError(409, 'Telefon numarası birden fazla hesaba bağlı. Lütfen destek ile iletişime geçin.');
  }

  const phoneCandidates = buildPhoneLookupCandidates(inputPhone);
  if (phoneCandidates.length > 0) {
    const candidateMatches = await prisma.user.findMany({
      where: {
        phone: {
          in: phoneCandidates,
        },
      },
      select: {
        id: true,
        phone: true,
        phoneNormalized: true,
        authProvider: true,
        isActive: true,
      },
      take: 3,
    });

    if (candidateMatches.length === 1) {
      const onlyMatch = candidateMatches[0];
      if (!onlyMatch.phoneNormalized) {
        try {
          await prisma.user.update({
            where: { id: onlyMatch.id },
            data: { phoneNormalized: normalizedPhone },
          });

          return {
            user: {
              ...onlyMatch,
              phoneNormalized: normalizedPhone,
            },
            normalizedPhone,
          };
        } catch {
          // Continue to direct lookup by normalized phone.
        }
      }

      return {
        user: onlyMatch,
        normalizedPhone,
      };
    }

    if (candidateMatches.length > 1) {
      throw new AppError(409, 'Telefon numarası birden fazla hesaba bağlı. Lütfen destek ile iletişime geçin.');
    }
  }

  const direct = await prisma.user.findUnique({
    where: { phoneNormalized: normalizedPhone },
    select: {
      id: true,
      phone: true,
      phoneNormalized: true,
      authProvider: true,
      isActive: true,
    },
  });

  if (direct) {
    return {
      user: direct,
      normalizedPhone,
    };
  }

  const backfilled = await upsertNormalizedPhoneForSingleUser(inputPhone, normalizedPhone);

  return {
    user: backfilled,
    normalizedPhone,
  };
};

const findUserByResetEmail = async (rawEmail: string) => {
  const email = String(rawEmail || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    throw new AppError(400, 'Invalid email address');
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      authProvider: true,
      isActive: true,
    },
  });

  return { user, email };
};

export const forgotPassword = async (
  data: ForgotPasswordInput,
  meta?: { ip?: string; userAgent?: string }
) => {
  const { user, email } = await findUserByResetEmail(data.email);

  if (!user) {
    throw new AppError(404, 'Bu e-posta adresi ile kayıtlı kullanıcı bulunamadı');
  }

  if (user.isActive === false) {
    throw new AppError(403, 'Hesap pasif durumda');
  }

  if (user.authProvider !== 'EMAIL') {
    throw new AppError(400, 'Bu hesap için şifre sıfırlama kapalı. Google ile giriş yapın.');
  }

  const latestOtp = await prisma.passwordResetOtp.findFirst({
    where: {
      userId: user.id,
      status: 'PENDING',
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  const now = Date.now();

  if (latestOtp) {
    const elapsedMs = now - latestOtp.lastSentAt.getTime();
    if (elapsedMs < OTP_RESEND_COOLDOWN_MS) {
      const retryAfterSeconds = Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsedMs) / 1000);
      throw new AppError(429, `Kodu tekrar göndermek için ${retryAfterSeconds} saniye bekleyin`);
    }
  }

  await prisma.passwordResetOtp.updateMany({
    where: {
      userId: user.id,
      status: {
        in: ['PENDING', 'VERIFIED'],
      },
    },
    data: {
      status: 'EXPIRED',
    },
  });

  const otpCode = generateOtpCode();
  const otpHash = hashSecret(otpCode);
  const nowDate = new Date(now);
  const expiresAt = new Date(now + OTP_TTL_MS);

  await prisma.passwordResetOtp.create({
    data: {
      userId: user.id,
      phoneSnapshot: email,
      otpHash,
      status: 'PENDING',
      attempts: 0,
      maxAttempts: PASSWORD_RESET_OTP_MAX_ATTEMPTS,
      resendCount: latestOtp ? latestOtp.resendCount + 1 : 0,
      expiresAt,
      lastSentAt: nowDate,
      requestIp: meta?.ip || null,
      userAgent: meta?.userAgent || null,
    },
  });

  await sendOTPEmail(email, otpCode);

  return {
    message: 'Dogrulama kodu gonderildiyse kisa sure icinde e-posta adresinize ulasacaktir.',
    resendAvailableInSeconds: 60,
  };
};

export const verifyPasswordResetOtp = async (data: VerifyOtpInput) => {
  const { user } = await findUserByResetEmail(data.email);

  if (!user || user.isActive === false) {
    throw new AppError(400, 'Kod doğrulanamadı');
  }

  if (user.authProvider !== 'EMAIL') {
    throw new AppError(400, 'Bu hesap için şifre sıfırlama kapalı. Google ile giriş yapın.');
  }

  const latestOtp = await prisma.passwordResetOtp.findFirst({
    where: {
      userId: user.id,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  if (!latestOtp || latestOtp.status !== 'PENDING') {
    throw new AppError(400, 'Doğrulama kodu bulunamadı veya geçersiz');
  }

  const now = Date.now();

  if (latestOtp.expiresAt.getTime() <= now) {
    await prisma.passwordResetOtp.update({
      where: { id: latestOtp.id },
      data: { status: 'EXPIRED' },
    });
    throw new AppError(400, 'Doğrulama kodunun süresi doldu');
  }

  if (latestOtp.attempts >= latestOtp.maxAttempts) {
    await prisma.passwordResetOtp.update({
      where: { id: latestOtp.id },
      data: { status: 'LOCKED' },
    });
    throw new AppError(423, 'Çok fazla hatalı deneme. İşlem kilitlendi');
  }

  const isValid = secureHashMatch(data.otpCode, latestOtp.otpHash);

  if (!isValid) {
    const nextAttempts = latestOtp.attempts + 1;
    const willLock = nextAttempts >= latestOtp.maxAttempts;

    await prisma.passwordResetOtp.update({
      where: { id: latestOtp.id },
      data: {
        attempts: {
          increment: 1,
        },
        status: willLock ? 'LOCKED' : 'PENDING',
      },
    });

    if (willLock) {
      throw new AppError(423, 'Çok fazla hatalı deneme. İşlem kilitlendi');
    }

    throw new AppError(400, 'Doğrulama kodu hatalı');
  }

  const resetToken = generateResetSessionToken();
  const resetTokenHash = hashSecret(resetToken);
  const resetTokenExpiresAt = new Date(now + RESET_SESSION_TTL_MS);

  await prisma.passwordResetOtp.updateMany({
    where: {
      userId: user.id,
      id: {
        not: latestOtp.id,
      },
      status: {
        in: ['PENDING', 'VERIFIED'],
      },
    },
    data: {
      status: 'EXPIRED',
    },
  });

  await prisma.passwordResetOtp.update({
    where: { id: latestOtp.id },
    data: {
      status: 'VERIFIED',
      verifiedAt: new Date(now),
      resetSessionTokenHash: resetTokenHash,
      resetSessionExpiresAt: resetTokenExpiresAt,
    },
  });

  return {
    resetToken,
    resetTokenExpiresInSeconds: Math.floor(RESET_SESSION_TTL_MS / 1000),
  };
};

export const resetPassword = async (data: ResetPasswordInput) => {
  const { user } = await findUserByResetEmail(data.email);

  if (!user || user.isActive === false) {
    throw new AppError(400, 'Şifre güncelleme oturumu geçersiz');
  }

  if (user.authProvider !== 'EMAIL') {
    throw new AppError(400, 'Bu hesap için şifre sıfırlama kapalı. Google ile giriş yapın.');
  }

  const latestVerified = await prisma.passwordResetOtp.findFirst({
    where: {
      userId: user.id,
      status: 'VERIFIED',
      consumedAt: null,
      resetSessionTokenHash: {
        not: null,
      },
      resetSessionExpiresAt: {
        not: null,
      },
    },
    orderBy: {
      verifiedAt: 'desc',
    },
  });

  if (!latestVerified || !latestVerified.resetSessionTokenHash || !latestVerified.resetSessionExpiresAt) {
    throw new AppError(400, 'Şifre güncelleme oturumu geçersiz');
  }

  const now = Date.now();
  if (latestVerified.resetSessionExpiresAt.getTime() <= now) {
    await prisma.passwordResetOtp.update({
      where: { id: latestVerified.id },
      data: { status: 'EXPIRED' },
    });

    throw new AppError(400, 'Şifre güncelleme oturumunun süresi doldu');
  }

  const tokenMatches = secureHashMatch(data.resetToken, latestVerified.resetSessionTokenHash);
  if (!tokenMatches) {
    throw new AppError(400, 'Şifre güncelleme oturumu geçersiz');
  }

  const passwordHash = await hashPassword(data.newPassword);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
    },
  });

  await prisma.passwordResetOtp.update({
    where: { id: latestVerified.id },
    data: {
      status: 'CONSUMED',
      consumedAt: new Date(now),
      resetSessionTokenHash: null,
    },
  });

  await prisma.passwordResetOtp.updateMany({
    where: {
      userId: user.id,
      id: {
        not: latestVerified.id,
      },
      status: {
        in: ['PENDING', 'VERIFIED'],
      },
    },
    data: {
      status: 'EXPIRED',
    },
  });

  return {
    message: 'Şifreniz başarıyla güncellendi',
  };
};

const generateRandomPassword = () => {
  return Math.random().toString(36).slice(-10) + 'A1!';
};
