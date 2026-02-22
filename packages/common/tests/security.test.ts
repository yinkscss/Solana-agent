import { describe, it, expect } from 'vitest';
import { signRequest, verifySignature } from '../src/security/hmac.js';
import { sanitizeString, sanitizeObject } from '../src/security/sanitize.js';

describe('HMAC', () => {
  const secret = 'test-secret-key';
  const method = 'POST';
  const path = '/api/v1/transactions';
  const timestamp = '1700000000';
  const body = '{"amount":100}';

  it('signs a request deterministically', () => {
    const sig1 = signRequest(secret, method, path, timestamp, body);
    const sig2 = signRequest(secret, method, path, timestamp, body);
    expect(sig1).toBe(sig2);
    expect(sig1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces different signatures for different inputs', () => {
    const sig1 = signRequest(secret, method, path, timestamp, body);
    const sig2 = signRequest(secret, 'GET', path, timestamp, body);
    expect(sig1).not.toBe(sig2);
  });

  it('verifies a valid signature', () => {
    const sig = signRequest(secret, method, path, timestamp, body);
    expect(verifySignature(secret, method, path, timestamp, body, sig)).toBe(true);
  });

  it('rejects an invalid signature', () => {
    expect(
      verifySignature(secret, method, path, timestamp, body, 'a'.repeat(64)),
    ).toBe(false);
  });

  it('rejects a signature with wrong length', () => {
    expect(verifySignature(secret, method, path, timestamp, body, 'short')).toBe(
      false,
    );
  });

  it('rejects a tampered body', () => {
    const sig = signRequest(secret, method, path, timestamp, body);
    expect(
      verifySignature(secret, method, path, timestamp, '{"amount":999}', sig),
    ).toBe(false);
  });
});

describe('sanitizeString', () => {
  it('strips angle brackets', () => {
    expect(sanitizeString('<script>alert("xss")</script>')).toBe(
      'scriptalert("xss")/script',
    );
  });

  it('truncates to maxLength', () => {
    const long = 'a'.repeat(2000);
    expect(sanitizeString(long, 100)).toHaveLength(100);
  });

  it('returns short strings unchanged when no dangerous chars', () => {
    expect(sanitizeString('hello world')).toBe('hello world');
  });
});

describe('sanitizeObject', () => {
  it('sanitizes nested string values', () => {
    const input = { name: '<b>bold</b>', nested: { html: '<img src=x>' } };
    const result = sanitizeObject(input);
    expect(result).toEqual({
      name: 'bbold/b',
      nested: { html: 'img src=x' },
    });
  });

  it('strips __proto__ and constructor keys', () => {
    const input = { safe: 'ok', __proto__: 'bad', constructor: 'bad' };
    const result = sanitizeObject(Object.assign(Object.create(null), input));
    expect(result).toEqual({ safe: 'ok' });
  });

  it('sanitizes arrays of strings', () => {
    const input = { tags: ['<a>', 'safe', '<b>'] };
    const result = sanitizeObject(input);
    expect(result).toEqual({ tags: ['a', 'safe', 'b'] });
  });

  it('preserves non-string primitives', () => {
    const input = { count: 42, active: true, value: null };
    const result = sanitizeObject(input);
    expect(result).toEqual({ count: 42, active: true, value: null });
  });
});
