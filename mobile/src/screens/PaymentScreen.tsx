import React, { useMemo, useState } from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NavigationProp, RouteProp } from '@react-navigation/native';
import { Banner, Button, Loading, Screen } from '../components/ui';
import { colors, font, space } from '../theme';
import { apiError } from '../api/client';
import { dispatchBooking, verifyPayment } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import type { RootStackParamList } from '../navigation/types';

/**
 * Embeds a value in an inline <script> safely. JSON.stringify output is escaped so it cannot close
 * the script tag ("<") or break the line (U+2028 / U+2029). Built from char codes on purpose.
 */
const BACKSLASH = String.fromCharCode(92);
const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);
const js = (v: unknown) =>
  JSON.stringify(v)
    .split('<').join(BACKSLASH + 'u003c')
    .split(LS).join(BACKSLASH + 'u2028')
    .split(PS).join(BACKSLASH + 'u2029');

function checkoutHtml(order: RootStackParamList['Payment']['order'], bookingId: string, prefill: Record<string, string | undefined>) {
  const base = {
    key: order.keyId,
    amount: order.amount,
    currency: order.currency || 'INR',
    name: 'Udupi Taxi',
    description: `Booking ${bookingId}`,
    order_id: order.orderId,
    prefill,
    theme: { color: '#0f1b2d' },
  };
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>html,body{margin:0;background:#fff;font-family:-apple-system,Roboto,sans-serif;color:#33415a}p{padding:24px;text-align:center}</style>
<script src="https://checkout.razorpay.com/v1/checkout.js"></script></head><body><p>Opening secure payment…</p><script>
function post(m){ window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
var options = ${js(base)};
options.handler = function (r) { post({ type: 'success', orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature }); };
options.modal = { ondismiss: function () { post({ type: 'dismissed' }); } };
window.onload = function () {
  try {
    var rzp = new Razorpay(options);
    rzp.on('payment.failed', function (r) { post({ type: 'failed', message: r && r.error && r.error.description }); });
    rzp.open();
  } catch (e) { post({ type: 'error', message: String(e) }); }
};
</script></body></html>`;
}

type Phase = 'paying' | 'verifying' | 'cancelled' | 'failed';

export default function PaymentScreen() {
  const nav = useNavigation<NavigationProp<RootStackParamList>>();
  const { params } = useRoute<RouteProp<RootStackParamList, 'Payment'>>();
  const { bookingId, order } = params;
  const { user } = useAuth();

  const [phase, setPhase] = useState<Phase>('paying');
  const [message, setMessage] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const html = useMemo(
    () => checkoutHtml(order, bookingId, { name: user?.name, email: user?.email, contact: user?.phone }),
    [order, bookingId, user]
  );

  const goToTrip = () => nav.reset({ index: 1, routes: [{ name: 'Tabs' }, { name: 'TripDetail', params: { bookingId } }] });

  const onMessage = async (e: WebViewMessageEvent) => {
    let msg: { type: string; orderId?: string; paymentId?: string; signature?: string; message?: string };
    try { msg = JSON.parse(e.nativeEvent.data); } catch { return; }

    if (msg.type === 'success' && msg.orderId && msg.paymentId && msg.signature) {
      setPhase('verifying');
      try {
        // The server re-verifies the signature, re-fetches the payment from
        // Razorpay and compares the amount before confirming anything.
        await verifyPayment({ razorpayOrderId: msg.orderId, razorpayPaymentId: msg.paymentId, razorpaySignature: msg.signature });
        try { await dispatchBooking(bookingId); } catch { /* paid and confirmed either way */ }
        goToTrip();
      } catch (err) {
        setMessage(apiError(err, 'We could not verify that payment. If money left your account, contact support with your booking ID.'));
        setPhase('failed');
      }
    } else if (msg.type === 'dismissed') {
      setMessage('Payment was cancelled. Your booking is saved and still awaiting payment.');
      setPhase('cancelled');
    } else if (msg.type === 'failed' || msg.type === 'error') {
      setMessage(msg.message || 'The payment did not go through.');
      setPhase('failed');
    }
  };

  if (Platform.OS === 'web') {
    return (
      <Screen>
        <Banner kind="warn">Online payment opens the secure Razorpay window, which is available in the phone app. Open this booking in Expo Go or the installed app to pay.</Banner>
        <Button title="View booking" onPress={goToTrip} />
      </Screen>
    );
  }

  if (phase === 'verifying') return <Screen scroll={false}><Loading label="Confirming your payment..." /></Screen>;

  if (phase !== 'paying') {
    return (
      <Screen>
        <Banner kind={phase === 'cancelled' ? 'warn' : 'error'}>{message}</Banner>
        <Text style={[font.body, { marginBottom: space.lg }]}>Booking {bookingId}</Text>
        <View style={{ gap: 10 }}>
          <Button title="Try payment again" onPress={() => { setPhase('paying'); setMessage(null); setAttempt((a) => a + 1); }} />
          <Button title="Pay later" variant="outline" onPress={goToTrip} />
        </View>
      </Screen>
    );
  }

  return (
    <View style={styles.wrap}>
      <WebView
        key={attempt}
        originWhitelist={['*']}
        source={{ html, baseUrl: 'https://checkout.razorpay.com' }}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        startInLoadingState
        renderLoading={() => <Loading label="Loading payment..." />}
        // UPI and bank apps are opened through custom URL schemes; hand those to the OS.
        onShouldStartLoadWithRequest={(req) => {
          if (/^(https?:|about:|data:)/i.test(req.url)) return true;
          Linking.openURL(req.url).catch(() => undefined);
          return false;
        }}
        style={{ flex: 1, backgroundColor: colors.white }}
      />
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { flex: 1, backgroundColor: colors.white } });
