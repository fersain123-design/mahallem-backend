import crypto from 'crypto';

export const generateIyzicoAuthorizationHeader = (args: {
  apiKey: string;
  secretKey: string;
  uriPath: string;
  requestBody: string;
  randomKey?: string;
}): { randomKey: string; authorization: string; signature: string } => {
  const randomKey =
    args.randomKey || `${Date.now()}${Math.random().toString(16).slice(2, 8)}`;

  const payload = `${randomKey}${args.uriPath}${args.requestBody}`;
  const signature = crypto
    .createHmac('sha256', args.secretKey)
    .update(payload)
    .digest('hex');

  const authValue = `apiKey:${args.apiKey}&randomKey:${randomKey}&signature:${signature}`;
  const authorization = `IYZWSv2 ${Buffer.from(authValue).toString('base64')}`;

  return { randomKey, authorization, signature };
};
