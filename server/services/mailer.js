const env = require('../config/env');

/**
 * Outbound email.
 *
 * Provider order:
 *   1. Resend (RESEND_API_KEY)  - HTTPS API, no mail server to run. Works on
 *      serverless hosts where SMTP ports are often blocked or slow.
 *   2. SMTP  (SMTP_HOST/USER/PASS) - the previous mechanism, kept as a fallback.
 *
 * Callers must check `isEnabled()` first and decide what "not configured"
 * means for them (OTP delivery refuses in production; contact notifications
 * are best-effort).
 */

const RESEND_URL = 'https://api.resend.com/emails';

function isEnabled() {
  return env.resend.enabled || env.smtp.enabled;
}

async function sendViaResend({ to, subject, text, html, replyTo }) {
  const res = await fetch(RESEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.resend.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.emailFrom,
      to: Array.isArray(to) ? to : [to],
      subject,
      text,
      ...(html ? { html } : {}),
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    // Resend returns { name, message } describing the problem, e.g. a recipient
    // that the onboarding sender is not allowed to deliver to. The API key is
    // never included in errors or logs.
    let detail = '';
    try { detail = (await res.json()).message || ''; } catch (_) { /* non-JSON body */ }
    throw new Error(`Resend rejected the email (HTTP ${res.status})${detail ? `: ${detail}` : ''}`);
  }
  return { provider: 'resend' };
}

async function sendViaSmtp({ to, subject, text, html, replyTo }) {
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: { user: env.smtp.user, pass: env.smtp.pass },
  });
  await transporter.sendMail({ from: env.smtp.from, to, subject, text, html, replyTo });
  return { provider: 'smtp' };
}

/** Sends one email. Throws if delivery fails or no provider is configured. */
async function send(message) {
  if (env.resend.enabled) return sendViaResend(message);
  if (env.smtp.enabled) return sendViaSmtp(message);
  throw new Error('No email provider is configured');
}

module.exports = { send, isEnabled };
