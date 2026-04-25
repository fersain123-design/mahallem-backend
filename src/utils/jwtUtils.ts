import jwt, { type Secret, type SignOptions } from 'jsonwebtoken';

export interface TokenPayload {
  userId: string;
  role: 'CUSTOMER' | 'VENDOR' | 'ADMIN';
}

const JWT_SECRET: Secret = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRATION: SignOptions['expiresIn'] =
  (process.env.JWT_EXPIRATION as SignOptions['expiresIn']) || '12h';
const WEAK_JWT_SECRETS = new Set(['your-secret-key', 'dev-secret-change-me', 'changeme', 'secret']);

const assertJwtSecret = (): void => {
  const normalizedSecret = String(JWT_SECRET || '').trim();
  if (!normalizedSecret) {
    throw new Error('JWT_SECRET is missing. Set a strong secret in environment variables.');
  }

  const isWeak = normalizedSecret.length < 32 || WEAK_JWT_SECRETS.has(normalizedSecret);
  if (isWeak && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is too weak for production. Use at least 32 random characters.');
  }

  if (isWeak) {
    console.warn('Security warning: JWT_SECRET is weak. Use at least 32 random characters.');
  }
};

assertJwtSecret();

export const generateToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRATION,
  });
};

export const verifyToken = (token: string): TokenPayload => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded as TokenPayload;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};
