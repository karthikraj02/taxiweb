const env = require('../../config/env');
const mailer = require('../../services/mailer');

const original = { resend: { ...Object.getOwnPropertyDescriptors(env.resend) }, smtp: { ...Object.getOwnPropertyDescriptors(env.smtp) } };

function setResend(apiKey) {
  Object.defineProperty(env.resend, 'apiKey', { value: apiKey, writable: true, configurable: true });
}
function setSmtp({ host = '', user = '', pass = '' }) {
  Object.defineProperty(env.smtp, 'host', { value: host, writable: true, configurable: true });
  Object.defineProperty(env.smtp, 'user', { value: user, writable: true, configurable: true });
  Object.defineProperty(env.smtp, 'pass', { value: pass, writable: true, configurable: true });
}

describe('mailer', () => {
  const realFetch = global.fetch;

  afterEach(() => {
    global.fetch = realFetch;
    setResend('');
    setSmtp({});
  });

  it('is disabled when neither Resend nor SMTP is configured', async () => {
    expect(mailer.isEnabled()).toBe(false);
    await expect(mailer.send({ to: 'a@b.co', subject: 's', text: 't' }))
      .rejects.toThrow('No email provider is configured');
  });

  it('is enabled by a Resend key alone', () => {
    setResend('re_test_key');
    expect(mailer.isEnabled()).toBe(true);
  });

  it('posts to the Resend API with bearer auth, sender and recipient', async () => {
    setResend('re_test_key');
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'x' }) });

    const result = await mailer.send({ to: 'driver@example.com', subject: 'Code', text: 'Your code is 123456', html: '<b>123456</b>', replyTo: 'r@example.com' });

    expect(result).toEqual({ provider: 'resend' });
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer re_test_key');
    const body = JSON.parse(init.body);
    expect(body.from).toBe(env.emailFrom);
    expect(body.to).toEqual(['driver@example.com']);
    expect(body.subject).toBe('Code');
    expect(body.text).toBe('Your code is 123456');
    expect(body.reply_to).toBe('r@example.com');
  });

  it('throws a readable error when Resend rejects the email, without leaking the key', async () => {
    setResend('re_super_secret_key');
    global.fetch = jest.fn().mockResolvedValue({
      ok: false, status: 403,
      json: async () => ({ message: 'You can only send testing emails to your own email address' }),
    });

    let error;
    try { await mailer.send({ to: 'other@example.com', subject: 's', text: 't' }); } catch (e) { error = e; }

    expect(error).toBeDefined();
    expect(error.message).toContain('HTTP 403');
    expect(error.message).toContain('only send testing emails');
    expect(error.message).not.toContain('re_super_secret_key');
  });

  it('prefers Resend over SMTP when both are configured', async () => {
    setResend('re_test_key');
    setSmtp({ host: 'smtp.example.com', user: 'u', pass: 'p' });
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });

    const result = await mailer.send({ to: 'a@b.co', subject: 's', text: 't' });
    expect(result.provider).toBe('resend');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
