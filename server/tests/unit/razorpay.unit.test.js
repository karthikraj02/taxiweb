const crypto = require('crypto');

// The service reads secrets at call time via config/env, which setup.js has
// already populated; set the payment secrets before requiring it.
process.env.RAZORPAY_KEY_ID = 'rzp_test_key';
process.env.RAZORPAY_KEY_SECRET = 'razorpay_test_secret_value';
process.env.RAZORPAY_WEBHOOK_SECRET = 'razorpay_webhook_secret_value';

jest.resetModules();
const razorpay = require('../../services/razorpay');

const SECRET = 'razorpay_test_secret_value';
const WEBHOOK_SECRET = 'razorpay_webhook_secret_value';

function signCheckout(orderId, paymentId, secret = SECRET) {
  return crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
}

describe('Razorpay signature verification (payment bypass removal)', () => {
  const orderId = 'order_ABC123';
  const paymentId = 'pay_XYZ789';

  it('accepts a correctly signed callback', () => {
    expect(razorpay.verifyCheckoutSignature({
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      razorpaySignature: signCheckout(orderId, paymentId),
    })).toBe(true);
  });

  /**
   * This is the exact payload the old "Skip Payment (Demo)" button sent. The
   * previous implementation wrapped its signature check in
   * `if (KEY_SECRET && razorpaySignature)`, so an empty signature skipped
   * verification entirely and the booking was marked paid.
   */
  it('REJECTS an empty signature — the original bypass', () => {
    expect(() => razorpay.verifyCheckoutSignature({
      razorpayOrderId: orderId,
      razorpayPaymentId: `pay_demo_${Date.now()}`,
      razorpaySignature: '',
    })).toThrow(expect.objectContaining({ code: 'INVALID_PAYMENT_SIGNATURE' }));
  });

  it.each([undefined, null, '', 0, false])(
    'rejects a falsy signature: %p',
    (sig) => {
      expect(() => razorpay.verifyCheckoutSignature({
        razorpayOrderId: orderId, razorpayPaymentId: paymentId, razorpaySignature: sig,
      })).toThrow(expect.objectContaining({ code: 'INVALID_PAYMENT_SIGNATURE' }));
    }
  );

  it('rejects a signature computed with the wrong secret', () => {
    expect(() => razorpay.verifyCheckoutSignature({
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      razorpaySignature: signCheckout(orderId, paymentId, 'attacker_guess'),
    })).toThrow(expect.objectContaining({ code: 'INVALID_PAYMENT_SIGNATURE' }));
  });

  it('rejects a valid signature replayed against a different order', () => {
    const sig = signCheckout(orderId, paymentId);
    expect(() => razorpay.verifyCheckoutSignature({
      razorpayOrderId: 'order_DIFFERENT',
      razorpayPaymentId: paymentId,
      razorpaySignature: sig,
    })).toThrow(expect.objectContaining({ code: 'INVALID_PAYMENT_SIGNATURE' }));
  });

  it('rejects a valid signature replayed with a different payment id', () => {
    const sig = signCheckout(orderId, paymentId);
    expect(() => razorpay.verifyCheckoutSignature({
      razorpayOrderId: orderId,
      razorpayPaymentId: 'pay_SUBSTITUTED',
      razorpaySignature: sig,
    })).toThrow(expect.objectContaining({ code: 'INVALID_PAYMENT_SIGNATURE' }));
  });

  it('is not fooled by a truncated or padded signature', () => {
    const sig = signCheckout(orderId, paymentId);
    for (const bad of [sig.slice(0, -1), sig + '0', sig.toUpperCase()]) {
      expect(() => razorpay.verifyCheckoutSignature({
        razorpayOrderId: orderId, razorpayPaymentId: paymentId, razorpaySignature: bad,
      })).toThrow();
    }
  });

  it('compares in constant time via timingSafeEqual', () => {
    // Equal-length inputs must not throw a length error; unequal must not leak
    // through the comparison either.
    expect(razorpay.safeEqual('abc', 'abc')).toBe(true);
    expect(razorpay.safeEqual('abc', 'abd')).toBe(false);
    expect(razorpay.safeEqual('abc', 'abcdef')).toBe(false);
  });
});

describe('Razorpay webhook signature verification', () => {
  const body = Buffer.from(JSON.stringify({ event: 'payment.captured', payload: {} }));

  it('accepts a body signed with the webhook secret', () => {
    const sig = crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
    expect(razorpay.verifyWebhookSignature(body, sig)).toBe(true);
  });

  it('rejects a missing signature header', () => {
    expect(() => razorpay.verifyWebhookSignature(body, undefined))
      .toThrow(expect.objectContaining({ code: 'INVALID_WEBHOOK_SIGNATURE' }));
  });

  it('rejects a body signed with the checkout secret instead of the webhook secret', () => {
    const sig = crypto.createHmac('sha256', SECRET).update(body).digest('hex');
    expect(() => razorpay.verifyWebhookSignature(body, sig))
      .toThrow(expect.objectContaining({ code: 'INVALID_WEBHOOK_SIGNATURE' }));
  });

  it('rejects a tampered body', () => {
    const sig = crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
    const tampered = Buffer.from(JSON.stringify({ event: 'payment.captured', payload: { amount: 1 } }));
    expect(() => razorpay.verifyWebhookSignature(tampered, sig))
      .toThrow(expect.objectContaining({ code: 'INVALID_WEBHOOK_SIGNATURE' }));
  });
});
