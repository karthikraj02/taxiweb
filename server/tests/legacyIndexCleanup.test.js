const { app, request, Driver } = require('./helpers');
const mongoose = require('mongoose');
const { dropLegacyIndexes } = require('../services/maintenance');

describeDb('Legacy index cleanup (integration)', () => {
  const registerBody = (n) => ({
    name: `Rider ${n}`, email: `rider${n}@example.com`, password: 'CorrectHorse7Battery',
  });

  // Regression: the pre-rebuild schema stored a plaintext `token` field on
  // RefreshToken with a unique index. The rebuilt schema replaced it with
  // `tokenHash` and never sets `token`, but the physical Mongo index survived
  // the schema change. With the field always missing, the SECOND document
  // ever inserted collides on the implicit `{ token: null }` duplicate, so
  // every second login/register/OTP-verify failed with
  // "That token is already registered." (E11000 on refreshtokens.token_1).
  it('drops a legacy unique index so the second-ever session no longer collides', async () => {
    await mongoose.connection.collection('refreshtokens').createIndex({ token: 1 }, { unique: true, name: 'token_1' });

    const first = await request(app).post('/api/auth/register').send(registerBody('one'));
    expect(first.status).toBe(201);

    // Before cleanup, a second session creation collides on the stale index.
    const secondBeforeCleanup = await request(app).post('/api/auth/register').send(registerBody('two'));
    expect(secondBeforeCleanup.status).toBe(409);
    expect(secondBeforeCleanup.body.error.code).toBe('DUPLICATE_RESOURCE');

    await dropLegacyIndexes();

    const secondAfterCleanup = await request(app).post('/api/auth/register').send(registerBody('three'));
    expect(secondAfterCleanup.status).toBe(201);
  });

  it('is a safe no-op when there is no legacy index', async () => {
    await expect(dropLegacyIndexes()).resolves.toBeUndefined();
  });

  it('never drops indexes the current schema still defines', async () => {
    await dropLegacyIndexes();
    const indexes = await mongoose.connection.collection('refreshtokens').indexes();
    const names = indexes.map((i) => i.name);
    expect(names).toContain('tokenHash_1');
  });

  it('does not touch other collections', async () => {
    await Driver.create({ name: 'D', email: 'd@example.com', phone: '+919731470099' });
    await expect(dropLegacyIndexes()).resolves.toBeUndefined();
    expect(await Driver.countDocuments()).toBe(1);
  });
});
