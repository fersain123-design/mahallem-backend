import crypto from 'crypto';

export const generateOtpCode = (): string => {
  const code = crypto.randomInt(0, 1000000);
  return code.toString().padStart(6, '0');
};

export const hashSecret = (value: string): string => {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
};

export const generateResetSessionToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

export const secureHashMatch = (incoming: string, storedHashHex: string): boolean => {
  const incomingHash = hashSecret(incoming);

  const incomingBuffer = Buffer.from(incomingHash, 'hex');
  const storedBuffer = Buffer.from(String(storedHashHex || ''), 'hex');

  if (incomingBuffer.length !== storedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(incomingBuffer, storedBuffer);
};
