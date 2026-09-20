const express = require('express');
const env = require('../config/env');
const ContactMessage = require('../models/ContactMessage');
const logger = require('../utils/logger');
const mailer = require('../services/mailer');
const { validate } = require('../middleware/validate');
const S = require('../validators/schemas');
const { contactLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

/**
 * PHASE 37.
 *
 * The old form did `await new Promise(r => setTimeout(r, 800))` and then showed
 * "Message sent!" — nothing was stored and nobody was notified. This persists
 * the message first and only reports success once the write has committed.
 */
router.post('/', contactLimiter, validate({ body: S.contactBody }), async (req, res, next) => {
  try {
    const record = await ContactMessage.create({
      name: req.body.name,
      email: req.body.email || undefined,
      phone: req.body.phone || undefined,
      message: req.body.message,
      ip: req.ip,
      status: 'new',
    });

    // Email notification is best-effort and reported honestly: the message is
    // safely stored either way, so a mail outage does not lose the enquiry.
    let emailDelivered = false;
    if (mailer.isEnabled() && env.smtp.supportInbox) {
      try {
        await mailer.send({
          to: env.smtp.supportInbox,
          replyTo: req.body.email || undefined,
          subject: `Website enquiry from ${req.body.name}`,
          text: `Name: ${req.body.name}\nEmail: ${req.body.email || '—'}\nPhone: ${req.body.phone || '—'}\n\n${req.body.message}`,
        });
        emailDelivered = true;
      } catch (mailErr) {
        logger.error('Contact notification email failed', { error: mailErr.message });
        record.emailError = mailErr.message;
      }
    }

    record.emailDelivered = emailDelivered;
    await record.save();

    res.status(201).json({
      success: true,
      message: 'Thanks — your message has been received. We usually reply within one working day.',
      data: { referenceId: record._id },
    });
  } catch (err) { next(err); }
});

module.exports = router;
