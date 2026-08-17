const logger = require('../../utils/logger');

describe('Structured logger redaction (PHASE 55)', () => {
  it.each([
    'password', 'otp', 'token', 'accessToken', 'refreshToken',
    'razorpaySignature', 'authorization', 'cookie', 'secret', 'cvv',
  ])('redacts the %s field', (field) => {
    const out = logger.redact({ [field]: 'sensitive-value' });
    expect(out[field]).toBe('[REDACTED]');
  });

  it('is case-insensitive about field names', () => {
    const out = logger.redact({ PassWord: 'hunter2', OTP: '123456' });
    expect(out.PassWord).toBe('[REDACTED]');
    expect(out.OTP).toBe('[REDACTED]');
  });

  it('redacts nested structures', () => {
    const out = logger.redact({ body: { user: { password: 'hunter2' } } });
    expect(out.body.user.password).toBe('[REDACTED]');
  });

  it('redacts inside arrays', () => {
    const out = logger.redact({ items: [{ token: 'abc' }, { token: 'def' }] });
    expect(out.items[0].token).toBe('[REDACTED]');
    expect(out.items[1].token).toBe('[REDACTED]');
  });

  it('leaves non-sensitive fields intact', () => {
    const out = logger.redact({ bookingId: 'UDX-ABC123', fare: 1000 });
    expect(out.bookingId).toBe('UDX-ABC123');
    expect(out.fare).toBe(1000);
  });

  it('does not blow up on cyclic or deep input', () => {
    const deep = { a: { b: { c: { d: { e: { f: { g: { password: 'x' } } } } } } } };
    expect(() => logger.redact(deep)).not.toThrow();
  });

  it('handles null and undefined safely', () => {
    expect(logger.redact(null)).toBeNull();
    expect(logger.redact(undefined)).toBeUndefined();
  });
});
