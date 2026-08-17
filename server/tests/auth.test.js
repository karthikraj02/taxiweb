const {
  app, request, makeUser, asUser, STRONG_PASSWORD, User,
} = require('./helpers');
const otpService = require('../services/otp');
const tokens = require('../services/tokens');
const RefreshToken = require('../models/RefreshToken');

describeDb('Authentication (integration)', () => {
  describe('registration', () => {
    it('creates an account and sets HttpOnly cookies', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Alice Example',
        email: 'alice@example.com',
        password: STRONG_PASSWORD,
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const cookies = res.headers['set-cookie'].join(';');
      expect(cookies).toMatch(/accessToken=/);
      expect(cookies).toMatch(/refreshToken=/);
      expect(cookies).toMatch(/HttpOnly/i);
    });

    it('never returns the password hash', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Bob Example', email: 'bob@example.com', password: STRONG_PASSWORD,
      });
      expect(JSON.stringify(res.body)).not.toMatch(/\$2[aby]\$/);
      expect(res.body.data.user.password).toBeUndefined();
    });

    it('rejects a weak password', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Weak', email: 'weak@example.com', password: 'password',
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('refuses a self-assigned admin role (mass assignment)', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Sneaky', email: 'sneaky@example.com',
        password: STRONG_PASSWORD, role: 'admin',
      });
      // .strict() rejects the unknown key outright.
      expect(res.status).toBe(400);

      const created = await User.findOne({ email: 'sneaky@example.com' });
      expect(created).toBeNull();
    });
  });

  describe('login', () => {
    it('accepts correct credentials', async () => {
      const user = await makeUser();
      const res = await request(app).post('/api/auth/login')
        .send({ email: user.email, password: STRONG_PASSWORD });
      expect(res.status).toBe(200);
      expect(res.body.data.user.id).toBe(user._id.toString());
    });

    it('rejects a wrong password with a generic message', async () => {
      const user = await makeUser();
      const res = await request(app).post('/api/auth/login')
        .send({ email: user.email, password: 'WrongPassword123' });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('does not reveal whether an account exists', async () => {
      const user = await makeUser();
      const wrongPw = await request(app).post('/api/auth/login')
        .send({ email: user.email, password: 'WrongPassword123' });
      const noAccount = await request(app).post('/api/auth/login')
        .send({ email: 'nobody@example.com', password: 'WrongPassword123' });

      expect(wrongPw.status).toBe(noAccount.status);
      expect(wrongPw.body.error.code).toBe(noAccount.body.error.code);
      expect(wrongPw.body.error.message).toBe(noAccount.body.error.message);
    });

    it('resists NoSQL operator injection in the email field', async () => {
      await makeUser();
      const res = await request(app).post('/api/auth/login')
        .send({ email: { $ne: null }, password: { $ne: null } });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('locks the account after repeated failures', async () => {
      const user = await makeUser();
      for (let i = 0; i < 8; i++) {
        await request(app).post('/api/auth/login')
          .send({ email: user.email, password: 'WrongPassword123' });
      }
      const res = await request(app).post('/api/auth/login')
        .send({ email: user.email, password: STRONG_PASSWORD });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('ACCOUNT_LOCKED');
    });
  });

  describe('OTP', () => {
    it('never returns the OTP in the response body', async () => {
      const user = await makeUser();
      const res = await request(app).post('/api/auth/request-otp')
        .send({ phone: user.phone });
      expect(res.status).toBe(200);
      expect(res.body.otp).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toMatch(/\d{6}/);
    });

    it('stores only a hash of the OTP', async () => {
      const user = await makeUser();
      await request(app).post('/api/auth/request-otp').send({ phone: user.phone });

      const stored = await User.findById(user._id).select('+otpHash');
      expect(stored.otpHash).toBeTruthy();
      expect(stored.otpHash).toMatch(/^\$2[aby]\$/);   // bcrypt, not plaintext
      expect(stored.otpHash).not.toMatch(/^\d{6}$/);
    });

    it('does not create an account for an unknown number', async () => {
      const before = await User.countDocuments({});
      const res = await request(app).post('/api/auth/request-otp')
        .send({ phone: '+919999999999' });
      expect(res.status).toBe(200);
      expect(await User.countDocuments({})).toBe(before);
    });

    it('answers identically for known and unknown numbers', async () => {
      const user = await makeUser();
      const known = await request(app).post('/api/auth/request-otp').send({ phone: user.phone });
      const unknown = await request(app).post('/api/auth/request-otp').send({ phone: '+919999999998' });
      expect(known.body).toEqual(unknown.body);
    });

    it('caps verification attempts', async () => {
      const user = await makeUser();
      const { otp, fields } = await otpService.issue(user);
      Object.assign(user, fields);
      await user.save();

      // 5 wrong guesses exhaust the allowance.
      for (let i = 0; i < 5; i++) {
        const r = await request(app).post('/api/auth/verify-otp')
          .send({ phone: user.phone, otp: '000000' });
        expect(r.status).toBe(400);
      }
      // The correct code no longer works — the code was burned.
      const res = await request(app).post('/api/auth/verify-otp')
        .send({ phone: user.phone, otp });
      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe('OTP_ATTEMPTS_EXCEEDED');
    });

    it('accepts a correct OTP exactly once', async () => {
      const user = await makeUser();
      const { otp, fields } = await otpService.issue(user);
      Object.assign(user, fields);
      await user.save();

      const first = await request(app).post('/api/auth/verify-otp')
        .send({ phone: user.phone, otp });
      expect(first.status).toBe(200);

      const replay = await request(app).post('/api/auth/verify-otp')
        .send({ phone: user.phone, otp });
      expect(replay.status).toBe(400);
      expect(replay.body.error.code).toBe('OTP_NOT_REQUESTED');
    });

    it('rejects an expired OTP', async () => {
      const user = await makeUser();
      const { otp, fields } = await otpService.issue(user);
      Object.assign(user, fields);
      user.otpExpiry = new Date(Date.now() - 1000);
      await user.save();

      const res = await request(app).post('/api/auth/verify-otp')
        .send({ phone: user.phone, otp });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('OTP_EXPIRED');
    });
  });

  describe('refresh tokens', () => {
    it('stores only a hash, never the raw token', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Carol', email: 'carol@example.com', password: STRONG_PASSWORD,
      });
      const raw = res.headers['set-cookie']
        .find(c => c.startsWith('refreshToken='))
        .split('=')[1].split(';')[0];

      const stored = await RefreshToken.findOne({});
      expect(stored.tokenHash).not.toBe(raw);
      expect(stored.tokenHash).toBe(tokens.hashToken(raw));
    });

    it('rotates on use and revokes the family when a used token is replayed', async () => {
      const reg = await request(app).post('/api/auth/register').send({
        name: 'Dave', email: 'dave@example.com', password: STRONG_PASSWORD,
      });
      const cookie = reg.headers['set-cookie'].find(c => c.startsWith('refreshToken='));

      const first = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
      expect(first.status).toBe(200);

      // Replaying the original (now rotated) token is treated as theft.
      const replay = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
      expect(replay.status).toBe(401);
      expect(replay.body.error.code).toBe('REFRESH_TOKEN_REUSED');

      // ...and the whole family is dead, including the newly issued token.
      const newCookie = first.headers['set-cookie'].find(c => c.startsWith('refreshToken='));
      const after = await request(app).post('/api/auth/refresh').set('Cookie', newCookie);
      expect(after.status).toBe(401);
    });
  });

  describe('session invalidation', () => {
    it('invalidates existing access tokens after a password change', async () => {
      const user = await makeUser();
      const cookie = asUser(user);

      const before = await request(app).get('/api/auth/me').set('Cookie', cookie);
      expect(before.status).toBe(200);

      // Tokens embed iat in seconds; make the change land in a later second.
      await new Promise(r => setTimeout(r, 1100));

      const change = await request(app).post('/api/auth/change-password')
        .set('Cookie', cookie)
        .send({ currentPassword: STRONG_PASSWORD, newPassword: 'NewStrongPass9Word' });
      expect(change.status).toBe(200);

      const after = await request(app).get('/api/auth/me').set('Cookie', cookie);
      expect(after.status).toBe(401);
      expect(after.body.error.code).toBe('SESSION_REVOKED');
    });
  });

  describe('token audience separation', () => {
    it('rejects a driver token on a customer endpoint', async () => {
      const { makeDriver, asDriver } = require('./helpers');
      const driver = await makeDriver();
      const res = await request(app).get('/api/auth/me').set('Cookie', asDriver(driver));
      expect(res.status).toBe(401);
    });
  });
});
