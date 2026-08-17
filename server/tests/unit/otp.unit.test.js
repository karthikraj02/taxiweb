const otpService = require('../../services/otp');
const bcrypt = require('bcryptjs');

/** Minimal stand-in for a Mongoose subject document. */
const makeSubject = () => ({
  otpHash: undefined, otpExpiry: undefined, otpAttempts: 0, otpLastSentAt: undefined,
});

describe('OTP service', () => {
  it('generates a 6-digit numeric code', () => {
    for (let i = 0; i < 50; i++) {
      expect(otpService.generate()).toMatch(/^\d{6}$/);
    }
  });

  it('produces high-entropy codes (not a stuck or sequential generator)', () => {
    const seen = new Set(Array.from({ length: 300 }, () => otpService.generate()));
    // 300 draws from 900k values should almost never collide heavily.
    expect(seen.size).toBeGreaterThan(290);
  });

  it('stores a bcrypt hash, never the plaintext', async () => {
    const subject = makeSubject();
    const { otp, fields } = await otpService.issue(subject);
    expect(fields.otpHash).toMatch(/^\$2[aby]\$/);
    expect(fields.otpHash).not.toContain(otp);
    expect(await bcrypt.compare(otp, fields.otpHash)).toBe(true);
  });

  it('accepts the correct code and invalidates it immediately', async () => {
    const subject = makeSubject();
    const { otp, fields } = await otpService.issue(subject);
    Object.assign(subject, fields);

    await expect(otpService.verify(subject, otp)).resolves.toBe(true);
    expect(subject.otpHash).toBeUndefined();

    await expect(otpService.verify(subject, otp))
      .rejects.toThrow(expect.objectContaining({ code: 'OTP_NOT_REQUESTED' }));
  });

  it('increments the attempt counter on each wrong guess', async () => {
    const subject = makeSubject();
    const { fields } = await otpService.issue(subject);
    Object.assign(subject, fields);

    await expect(otpService.verify(subject, '000000')).rejects.toThrow();
    expect(subject.otpAttempts).toBe(1);
    await expect(otpService.verify(subject, '000001')).rejects.toThrow();
    expect(subject.otpAttempts).toBe(2);
  });

  it('burns the code once the attempt limit is reached', async () => {
    const subject = makeSubject();
    const { otp, fields } = await otpService.issue(subject);
    Object.assign(subject, fields);

    for (let i = 0; i < 5; i++) {
      await expect(otpService.verify(subject, '999999')).rejects.toThrow();
    }
    // The genuine code is now useless — brute force cannot outlast the limit.
    await expect(otpService.verify(subject, otp))
      .rejects.toThrow(expect.objectContaining({ code: 'OTP_ATTEMPTS_EXCEEDED' }));
    expect(subject.otpHash).toBeUndefined();
  });

  it('rejects an expired code', async () => {
    const subject = makeSubject();
    const { otp, fields } = await otpService.issue(subject);
    Object.assign(subject, fields);
    subject.otpExpiry = new Date(Date.now() - 1);

    await expect(otpService.verify(subject, otp))
      .rejects.toThrow(expect.objectContaining({ code: 'OTP_EXPIRED' }));
  });

  it('rejects verification when none was requested', async () => {
    await expect(otpService.verify(makeSubject(), '123456'))
      .rejects.toThrow(expect.objectContaining({ code: 'OTP_NOT_REQUESTED' }));
  });

  it('enforces the resend cooldown when configured', async () => {
    const env = require('../../config/env');
    const original = env.otp.resendCooldownSeconds;
    env.otp.resendCooldownSeconds = 60;
    try {
      const subject = makeSubject();
      const { fields } = await otpService.issue(subject);
      Object.assign(subject, fields);
      await expect(otpService.issue(subject))
        .rejects.toThrow(expect.objectContaining({ code: 'OTP_RESEND_COOLDOWN' }));
    } finally {
      env.otp.resendCooldownSeconds = original;
    }
  });
});
