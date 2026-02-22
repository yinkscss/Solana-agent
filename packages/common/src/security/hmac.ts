import { createHmac, timingSafeEqual } from 'crypto';

export const signRequest = (
  secret: string,
  method: string,
  path: string,
  timestamp: string,
  body: string,
): string => {
  const payload = `${method}${path}${timestamp}${body}`;
  return createHmac('sha256', secret).update(payload).digest('hex');
};

export const verifySignature = (
  secret: string,
  method: string,
  path: string,
  timestamp: string,
  body: string,
  signature: string,
): boolean => {
  const expected = signRequest(secret, method, path, timestamp, body);
  if (expected.length !== signature.length) return false;
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
};
