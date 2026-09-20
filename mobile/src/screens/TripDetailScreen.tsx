import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NavigationProp, RouteProp } from '@react-navigation/native';
import { Banner, Button, Card, Field, KeyValue, Loading, Screen, Stars } from '../components/ui';
import { StatusPill } from '../components/TripCard';
import { colors, font, space } from '../theme';
import { POLL_MS } from '../config';
import { vehicleName } from '../data/catalog';
import { CANCELLABLE, STATUS_STEPS, TERMINAL_STATUS, formatDateTime, money } from '../utils/format';
import { apiError } from '../api/client';
import { confirmAction } from '../utils/confirm';
import { cancelBooking, createPaymentOrder, getBooking, submitReview } from '../api/endpoints';
import type { Booking } from '../types';
import type { RootStackParamList } from '../navigation/types';

const STATUS_ORDER = STATUS_STEPS.map((s) => s.key);
const FINISHED = ['completed', 'cancelled', 'payment_failed', 'expired'];

export default function TripDetailScreen() {
  const nav = useNavigation<NavigationProp<RootStackParamList>>();
  const { params } = useRoute<RouteProp<RootStackParamList, 'TripDetail'>>();
  const { bookingId, notice: initialNotice } = params;

  const [booking, setBooking] = useState<Booking | null>(null);
  // `error` is for the rider's actions (pay, cancel, review) and stays until the next action.
  // `loadError` is only for fetching the trip, so the background refresh cannot wipe an action error.
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(initialNotice ?? null);
  const [busy, setBusy] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [reviewed, setReviewed] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const { booking: b } = await getBooking(bookingId);
      setBooking(b);
      setLoadError(null);
    } catch (err) {
      setLoadError(apiError(err, 'We could not load this trip.'));
    }
  }, [bookingId]);

  // Live status by polling (the serverless backend has no websocket channel).
  useEffect(() => {
    load();
    timer.current = setInterval(load, POLL_MS);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [load]);

  useEffect(() => {
    if (booking && FINISHED.includes(booking.status) && timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, [booking]);

  const payNow = async () => {
    setBusy(true);
    setError(null);
    try {
      const order = await createPaymentOrder(bookingId);
      nav.navigate('Payment', { bookingId, order });
    } catch (err) {
      setError(apiError(err, 'We could not open the payment.'));
    } finally {
      setBusy(false);
    }
  };

  const doCancel = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await cancelBooking(bookingId);
      setBooking(result.booking);
      const parts = [result.policy, result.refundDue ? `Refund due: ${money(result.refundDue)}` : ''].filter(Boolean);
      setNotice(parts.join(' ') || 'Booking cancelled.');
    } catch (err) {
      setError(apiError(err, 'We could not cancel this booking.'));
    } finally {
      setBusy(false);
    }
  };

  const confirmCancel = () =>
    confirmAction('Cancel this booking?', 'A cancellation fee may apply depending on how close the pickup is.', 'Cancel booking', doCancel);

  const sendReview = async () => {
    setBusy(true);
    setError(null);
    try {
      await submitReview(bookingId, rating, comment.trim() || undefined);
      setReviewed(true);
      setNotice('Thank you for your review.');
    } catch (err) {
      setError(apiError(err, 'We could not save your review.'));
    } finally {
      setBusy(false);
    }
  };

  if (!booking) return <Screen>{loadError ? <Banner kind="error">{loadError}</Banner> : <Loading label="Loading trip..." />}</Screen>;

  const terminal = TERMINAL_STATUS[booking.status];
  const stepIndex = STATUS_ORDER.indexOf(booking.status);
  const needsPayment = booking.paymentStatus !== 'paid' && !terminal && ['pending', 'payment_pending'].includes(booking.status);
  const driver = booking.driver;

  return (
    <Screen>
      {loadError ? <Banner kind="warn">{loadError} Showing the last known status.</Banner> : null}
      {error ? <Banner kind="error">{error}</Banner> : null}
      {notice ? <Banner kind="info">{notice}</Banner> : null}

      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={font.small}>{booking.bookingId}</Text>
          <Text style={font.h2}>{booking.pickup} {'→'} {booking.drop}</Text>
        </View>
        <StatusPill status={booking.status} />
      </View>

      {terminal ? <Banner kind="error">This booking is {terminal.toLowerCase()}.</Banner> : null}
      {needsPayment ? (
        <Card style={{ backgroundColor: colors.brandSoft, borderColor: '#efd58a' }}>
          <Text style={font.h3}>Payment pending</Text>
          <Text style={[font.small, { marginVertical: 6 }]}>Pay {money(booking.fare)} to confirm this ride and request a driver.</Text>
          <Button title={`Pay ${money(booking.fare)}`} onPress={payNow} loading={busy} />
        </Card>
      ) : null}

      <Card>
        <Text style={[font.h3, { marginBottom: 8 }]}>Trip status</Text>
        {STATUS_STEPS.map((step, i) => {
          const done = stepIndex > i;
          const current = stepIndex === i;
          return (
            <View key={step.key} style={styles.step}>
              <View style={styles.rail}>
                <View style={[styles.dot, done && styles.dotDone, current && styles.dotCurrent]}>
                  <Text style={{ color: done || current ? colors.white : colors.muted, fontSize: 11, fontWeight: '800' }}>
                    {done ? '✓' : i + 1}
                  </Text>
                </View>
                {i < STATUS_STEPS.length - 1 ? <View style={[styles.line, done && { backgroundColor: colors.success }]} /> : null}
              </View>
              <View style={{ flex: 1, paddingBottom: 14 }}>
                <Text style={{ fontSize: 15, fontWeight: current || done ? '700' : '500', color: current || done ? colors.ink : colors.muted }}>{step.label}</Text>
                <Text style={font.small}>{step.desc}</Text>
              </View>
            </View>
          );
        })}
      </Card>

      <Card>
        <Text style={[font.h3, { marginBottom: 8 }]}>Your driver</Text>
        {driver ? (
          <View style={{ gap: 4 }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.ink }}>{driver.name}</Text>
            <Text style={font.small}>{[driver.carNumber, driver.carType].filter(Boolean).join(' · ')}</Text>
            {driver.rating != null ? <Text style={[font.small, { color: colors.brandDark, fontWeight: '700' }]}>{'★'} {driver.rating.toFixed(1)}</Text> : null}
            {driver.phone ? <Button title={`Call ${driver.name.split(' ')[0]}`} variant="outline" small style={{ marginTop: 8 }} onPress={() => Linking.openURL(`tel:${driver.phone}`)} /> : null}
          </View>
        ) : (
          <Text style={font.small}>A driver will be assigned once your payment is confirmed.</Text>
        )}
      </Card>

      <Card>
        <Text style={[font.h3, { marginBottom: 6 }]}>Booking details</Text>
        <KeyValue label="Pickup time" value={formatDateTime(booking.scheduledFor)} />
        <KeyValue label="Vehicle" value={vehicleName(booking.carType)} />
        <KeyValue label="Trip" value={booking.tripType === 'one-way' ? 'One way' : 'Round trip'} />
        <KeyValue label="Passengers" value={String(booking.passengerCount)} />
        <KeyValue label="Distance" value={booking.distanceKm != null ? `${booking.distanceKm} km` : '—'} />
        <KeyValue label="Fare" value={money(booking.fare)} />
        <KeyValue label="Payment" value={booking.paymentStatus} valueStyle={{ textTransform: 'capitalize' }} />
      </Card>

      {booking.status === 'completed' && !reviewed ? (
        <Card>
          <Text style={[font.h3, { marginBottom: 8 }]}>How was your ride?</Text>
          <Stars value={rating} onChange={setRating} />
          <Field style={{ marginTop: space.md }} placeholder="Tell us more (optional)" value={comment} onChangeText={setComment} multiline maxLength={1000} />
          <Button title="Submit review" disabled={rating === 0} onPress={sendReview} loading={busy} />
        </Card>
      ) : null}

      {CANCELLABLE.includes(booking.status) ? (
        <Button title="Cancel booking" variant="danger" onPress={confirmCancel} loading={busy} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: space.lg },
  step: { flexDirection: 'row', gap: 12 },
  rail: { alignItems: 'center' },
  dot: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colors.lineStrong, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  dotDone: { backgroundColor: colors.success, borderColor: colors.success },
  dotCurrent: { backgroundColor: colors.ink, borderColor: colors.ink },
  line: { width: 2, flex: 1, minHeight: 14, backgroundColor: colors.line, marginVertical: 2 },
});
