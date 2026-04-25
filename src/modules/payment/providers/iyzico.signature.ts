import crypto from 'crypto';

export const validateIyzicoSignature = (args: {
  payload: unknown;
  signatureHeader?: string;
  secretKey: string;
}): boolean => {
  const signature = String(args.signatureHeader || '').trim();
  if (!signature) return false;

  const normalized = JSON.stringify(args.payload || {});
  const expected = crypto
    .createHmac('sha256', args.secretKey)
    .update(normalized)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
};
