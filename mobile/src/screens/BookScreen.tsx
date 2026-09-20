import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NavigationProp, RouteProp } from '@react-navigation/native';
import { Banner, Button, Card, Chip, Screen, Segmented } from '../components/ui';
import PlaceField from '../components/PlaceField';
import { colors, font, radius, space } from '../theme';
import { VEHICLES } from '../data/catalog';
import { Place, findPlace } from '../data/places';
import { money, nextDays, timeLabel, timeSlotsFor, toISO } from '../utils/format';
import { apiError, apiStatus } from '../api/client';
import { quoteTrip } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import type { CarType, Quote, TripType } from '../types';
import type { RootStackParamList, TabParamList, TripDraft } from '../navigation/types';

const LOGIN_TO_QUOTE = 'Please log in to see your fare. It only takes a moment.';

export default function BookScreen() {
  const nav = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<TabParamList, 'Book'>>();
  const { isAuthenticated } = useAuth();

  const days = useMemo(() => nextDays(14), []);
  const [tripType, setTripType] = useState<TripType>('one-way');
  const [pickup, setPickup] = useState<Place | null>(null);
  const [drop, setDrop] = useState<Place | null>(null);
  // Start on today unless every slot today has passed, then on tomorrow.
  const [date, setDate] = useState(() => (timeSlotsFor(days[0].key).length ? days[0].key : days[1].key));
  const slots = useMemo(() => timeSlotsFor(date), [date]);
  const [time, setTime] = useState(() => timeSlotsFor(date)[0] ?? '09:00');
  const [carType, setCarType] = useState<CarType>('etios');
  const [passengers, setPassengers] = useState(1);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Apply pre-filled values from Home (popular route / fleet card).
  const { pickup: pPickup, drop: pDrop, carType: pCar } = route.params ?? {};
  useEffect(() => {
    if (pPickup) setPickup(findPlace(pPickup) ?? null);
    if (pDrop) setDrop(findPlace(pDrop) ?? null);
    if (pCar) setCarType(pCar);
  }, [pPickup, pDrop, pCar]);

  // Keep the chosen time valid when the date changes (e.g. today's earlier slots vanish).
  useEffect(() => { if (!slots.includes(time)) setTime(slots[0] ?? '09:00'); }, [slots, time]);

  // Any change to the trip invalidates the quote, so a stale fare can never
  // be carried into the booking step.
  useEffect(() => { setQuote(null); }, [tripType, pickup, drop, date, time, carType, passengers]);

  const seats = VEHICLES.find((v) => v.id === carType)?.seats ?? 4;

  const draft = (): TripDraft | null => {
    if (!pickup || !drop) { setError('Choose a pickup and a drop location.'); return null; }
    if (pickup.label === drop.label) { setError('Pickup and drop must be different places.'); return null; }
    const scheduledFor = toISO(date, time);
    if (!scheduledFor) { setError('Choose a pickup date and time.'); return null; }
    if (new Date(scheduledFor).getTime() < Date.now()) { setError('That pickup time has already passed. Choose a later time.'); return null; }
    if (passengers > seats) { setError(`${VEHICLES.find((v) => v.id === carType)?.name} seats ${seats}. Choose a bigger vehicle.`); return null; }
    return {
      pickup: pickup.label, drop: drop.label,
      pickupCoords: { lat: pickup.lat, lng: pickup.lng }, dropCoords: { lat: drop.lat, lng: drop.lng },
      carType, tripType, scheduledFor, passengerCount: passengers,
    };
  };

  const getFare = async () => {
    setError(null);
    // The server prices trips for signed-in customers only, so ask up front.
    if (!isAuthenticated) { setError(LOGIN_TO_QUOTE); nav.navigate('Auth'); return; }
    const trip = draft();
    if (!trip) return;
    setLoading(true);
    try {
      setQuote(await quoteTrip(trip));
    } catch (err) {
      if (apiStatus(err) === 401) { setError(LOGIN_TO_QUOTE); nav.navigate('Auth'); }
      else setError(apiError(err, 'We could not calculate a fare for that trip.'));
      setQuote(null);
    } finally {
      setLoading(false);
    }
  };

  const proceed = () => {
    const trip = draft();
    if (trip && quote) nav.navigate('Checkout', { trip, quote });
  };

  return (
    <Screen>
      {error ? <Banner kind="error">{error}</Banner> : null}

      <Segmented
        value={tripType}
        onChange={setTripType}
        options={[{ value: 'one-way', label: 'One way' }, { value: 'round-trip', label: 'Round trip' }]}
      />
      <View style={{ height: space.lg }} />

      <PlaceField label="Pickup" value={pickup?.label ?? ''} placeholder="Where from?" onSelect={setPickup} />
      <PlaceField label="Drop" value={drop?.label ?? ''} placeholder="Where to?" onSelect={setDrop} />

      <Text style={[font.label, { marginBottom: 8 }]}>Date</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: space.lg }}>
        {days.map((d) => <Chip key={d.key} label={d.label} sub={d.sub} selected={date === d.key} onPress={() => setDate(d.key)} />)}
      </ScrollView>

      <Text style={[font.label, { marginBottom: 8 }]}>Pickup time</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: space.lg }}>
        {slots.map((t) => <Chip key={t} label={timeLabel(t)} selected={time === t} onPress={() => setTime(t)} />)}
      </ScrollView>

      <Text style={[font.label, { marginBottom: 8 }]}>Vehicle</Text>
      {VEHICLES.map((v) => (
        <Pressable key={v.id} onPress={() => setCarType(v.id)} style={[styles.vehicle, carType === v.id && styles.vehicleOn]} accessibilityRole="button">
          <Image source={v.image} style={styles.vehicleImg} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={font.h3}>{v.name}</Text>
            <Text style={font.small}>{v.seats} seats · {v.luggage}</Text>
            <Text style={[font.small, { color: colors.ink, fontWeight: '700' }]}>{v.rate} · min {v.minFare}</Text>
          </View>
          <View style={[styles.radio, carType === v.id && styles.radioOn]} />
        </Pressable>
      ))}

      <View style={styles.stepper}>
        <Text style={font.label}>Passengers</Text>
        <View style={styles.stepRow}>
          <Pressable style={styles.stepBtn} onPress={() => setPassengers((n) => Math.max(1, n - 1))} accessibilityLabel="Fewer passengers"><Text style={styles.stepTxt}>{'−'}</Text></Pressable>
          <Text style={styles.stepVal}>{passengers}</Text>
          <Pressable style={styles.stepBtn} onPress={() => setPassengers((n) => Math.min(12, n + 1))} accessibilityLabel="More passengers"><Text style={styles.stepTxt}>+</Text></Pressable>
        </View>
      </View>

      {quote ? (
        <Card style={{ backgroundColor: colors.bgSoft, marginTop: space.md }}>
          <Text style={font.small}>Estimated fare</Text>
          <Text style={styles.fare}>{money(quote.fare)}</Text>
          <Text style={font.small}>
            {quote.distanceKm} km · approx {Math.round(quote.durationMinutes)} min{tripType === 'round-trip' ? ' · round trip' : ''}
          </Text>
          {quote.breakdown ? (
            <Text style={[font.small, { marginTop: 4 }]}>
              Base {money(quote.breakdown.baseFare)} (incl. {quote.breakdown.includedKm} km)
              {quote.breakdown.chargeableKm ? ` + ${quote.breakdown.chargeableKm} km @ ${money(quote.breakdown.perKmRate)}/km` : ''}
              {quote.breakdown.nightSurcharge ? ` + ${money(quote.breakdown.nightSurcharge)} night` : ''}
              {quote.breakdown.airportSurcharge ? ` + ${money(quote.breakdown.airportSurcharge)} airport` : ''}
              {quote.breakdown.tax ? ` + ${money(quote.breakdown.tax)} tax` : ''}
            </Text>
          ) : null}
          <Text style={[font.small, { marginTop: 4 }]}>{quote.distanceEstimated ? 'Distance is an estimate.' : 'Route confirmed.'} Final fare may vary with waiting time.</Text>
        </Card>
      ) : null}

      <View style={{ gap: 10, marginTop: space.md }}>
        <Button testID="get-fare" title={quote ? 'Recalculate fare' : 'Get fare'} variant={quote ? 'outline' : 'primary'} onPress={getFare} loading={loading} />
        {quote ? <Button testID="continue" title="Continue to booking" onPress={proceed} /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  vehicle: {
    flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.md,
    padding: 10, marginBottom: 10, backgroundColor: colors.white,
  },
  vehicleOn: { borderColor: colors.ink, backgroundColor: colors.brandSoft },
  vehicleImg: { width: 84, height: 52 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.lineStrong },
  radioOn: { borderColor: colors.ink, backgroundColor: colors.ink },
  stepper: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.sm, marginBottom: space.md },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center' },
  stepTxt: { fontSize: 22, color: colors.ink, lineHeight: 24 },
  stepVal: { fontSize: 18, fontWeight: '700', color: colors.ink, minWidth: 22, textAlign: 'center' },
  fare: { fontSize: 34, fontWeight: '800', color: colors.ink, marginVertical: 2 },
});
