const { app, request, Driver } = require('./helpers');

describeDb('Driver registration (integration)', () => {
  const body = {
    name: 'New Driver',
    email: 'new.driver@example.com',
    phone: '9731470096',
    address: 'Udupi',
    carType: 'dzire',
    carNumber: 'ka 20 zx1989',
  };

  // Regression: drivers were created with currentLocation = { type: 'Point' }
  // (no coordinates). With the 2dsphere index in place MongoDB rejects that
  // insert ("Can't extract geo keys"), so EVERY registration returned a 500.
  it('registers a driver who has not shared a location yet', async () => {
    const res = await request(app).post('/api/driver-auth/register').send(body);

    expect(res.status).toBe(201);
    expect(res.body.data.approvalStatus).toBe('pending_documents');

    const saved = await Driver.findOne({ email: body.email });
    expect(saved).not.toBeNull();
    expect(saved.currentLocation?.coordinates).toBeUndefined();
  });

  it('registers several drivers without a location (no index collision)', async () => {
    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post('/api/driver-auth/register')
        .send({ ...body, email: `driver${i}@example.com` });
      expect(res.status).toBe(201);
    }
    expect(await Driver.countDocuments()).toBe(3);
  });

  it('rejects a duplicate email with 409, not 500', async () => {
    await request(app).post('/api/driver-auth/register').send(body);
    const res = await request(app).post('/api/driver-auth/register').send(body);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DRIVER_EXISTS');
  });
});
