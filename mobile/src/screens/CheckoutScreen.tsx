import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NavigationProp, RouteProp } from '@react-navigation/native';
import { Banner, Button, Card, Field, KeyValue, Screen } from '../components/ui';
import { colors, font, radius, space } from '../theme';
import { vehicleName } from '../data/catalog';
import { formatDateTime, money } from '../utils/format';
import { apiError } from '../api/client';
import { createBooking, createPaymentOrder } from '../api/endpoints';
import type { RootStackParamList } from '../navigation/types';

/** Random unique id, sent as an Idempotency-Key so a retried tap never double-books. */
const newKey = () => `mob-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export default function CheckoutScreen() {
  const nav = useNavigation<NavigationProp<RootStackParamList>>();
  const { params } = useRoute<RouteProp<RootStackParamList, 'Checkout'>>();
  const { trip, quote } = params;

  const [notes, setNotes] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Generated once per screen: re-submitting after a network wobble returns the
  // original booking instead of creating a second one.
  const idempotencyKey = useRef(newKey()).current;

  const confirm = async () => {
    setError(null);
    if (!agreed) { setError('Please accept the terms to continue.'); return; }
    setLoading(true);
    try {
      // No amount is sent: the server charges the fare it calculated itself.
      const { booking } = await createBooking({ ...trip, ...(notes.trim() ? { notes: notes.trim() } : {}) }, idempotencyKey);
      try {
        const order = await createPaymentOrder(booking.bookingId);
        nav.reset({ index: 1, routes: [{ name: 'Tabs' }, { name: 'Payment', params: { bookingId: booking.bookingId, order } }] });
      } catch (payErr) {
        // The booking exists but a payment order could not be opened. Send the
        // rider to the trip, where "Pay now" can be retried.
        const notice = `Your booking is saved. ${apiError(payErr, 'We could not open the payment.')} You can pay from here when ready.`;
        nav.reset({ index: 1, routes: [{ name: 'Tabs' }, { name: 'TripDetail', params: { bookingId: booking.bookingId, notice } }] });
      }
    } catch (err) {
      setError(apiError(err, 'We could not create your booking.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      {error ? <Banner kind="error">{error}</Banner> : null}

      <Card>
        <Text style={[font.h3, { marginBottom: 6 }]}>Trip summary</Text>
        <KeyValue label="From" value={trip.pickup} />
        <KeyValue label="To" value={trip.drop} />
        <KeyValue label="Vehicle" value={vehicleName(trip.carType)} />
        <KeyValue label="Trip" value={trip.tripType === 'one-way' ? 'One way' : 'Round trip'} />
        <KeyValue label="Pickup" value={formatDateTime(trip.scheduledFor)} />
        <KeyValue label="Passengers" value={String(trip.passengerCount)} />
        <KeyValue label="Distance" value={`${quote.distanceKm} km`} />
        <View style={styles.total}>
          <Text style={font.h3}>Total fare</Text>
          <Text style={styles.totalValue}>{money(quote.fare)}</Text>
        </View>
      </Card>

      <Field label="Notes for the driver (optional)" value={notes} onChangeText={setNotes} placeholder="Luggage, landmark, flight number..." multiline maxLength={500} />

      <Pressable onPress={() => setAgreed((a) => !a)} style={styles.terms} accessibilityRole="checkbox" accessibilityState={{ checked: agreed }}>
        <View style={[styles.box, agreed && styles.boxOn]}>{agreed ? <Text style={styles.tick}>{'✓'}</Text> : null}</View>
        <Text style={[font.body, { flex: 1 }]}>I agree to the terms. Fare may vary based on actual distance and waiting time.</Text>
      </Pressable>

      <Button testID="confirm-pay" title="Confirm & pay" onPress={confirm} loading={loading} />
      <Text style={[font.small, { textAlign: 'center', marginTop: space.md }]}>Payments are processed securely by Razorpay.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  total: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: space.md },
  totalValue: { fontSize: 24, fontWeight: '800', color: colors.ink },
  terms: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: space.lg },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  boxOn: { backgroundColor: colors.ink, borderColor: colors.ink, borderRadius: radius.sm - 2 },
  tick: { color: colors.white, fontWeight: '800', fontSize: 14 },
});
