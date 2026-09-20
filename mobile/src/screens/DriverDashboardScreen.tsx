import React, { useCallback, useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { Banner, Button, Card, Empty, Loading, Screen, SectionTitle } from '../components/ui';
import { colors, font, space } from '../theme';
import { POLL_MS } from '../config';
import { vehicleName } from '../data/catalog';
import { formatDateTime, money } from '../utils/format';
import { apiError } from '../api/client';
import { acceptRequest, advanceRide, declineRequest, getDriverRequests, getDriverStats, setAvailability } from '../api/endpoints';
import { useDriver } from '../context/DriverContext';
import { useDriverLocation } from '../hooks/useDriverLocation';
import type { AssignedRide, RideRequest } from '../types';
import type { RootStackParamList } from '../navigation/types';

/** The next action available at each stage of a ride. */
const NEXT_ACTION: Record<string, { action: 'en_route' | 'arrived' | 'start' | 'complete'; label: string }> = {
  driver_assigned: { action: 'en_route', label: 'Start driving to pickup' },
  driver_en_route: { action: 'arrived', label: 'I have arrived' },
  driver_arrived: { action: 'start', label: 'Start trip' },
  in_progress: { action: 'complete', label: 'Complete trip' },
};

export default function DriverDashboardScreen() {
  const nav = useNavigation<NavigationProp<RootStackParamList>>();
  const { driver, loading: driverLoading, canAcceptRides, logoutDriver, refreshDriver } = useDriver();

  const [availability, setAvail] = useState<string>(driver?.availability ?? 'offline');
  const [requests, setRequests] = useState<RideRequest[]>([]);
  const [reason, setReason] = useState<string | null>(null);
  const [stats, setStats] = useState<{ totalRides: number; totalEarnings: number } | null>(null);
  const [activeRide, setActiveRide] = useState<AssignedRide | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isOnline = availability === 'online' || availability === 'on_trip' || availability === 'busy';
  const { position, error: gpsError, sharing, captureOnce } = useDriverLocation(isOnline);

  // Not signed in as a driver: go to the portal.
  useEffect(() => {
    if (!driverLoading && !driver) nav.reset({ index: 1, routes: [{ name: 'Tabs' }, { name: 'DriverAuth' }] });
  }, [driverLoading, driver, nav]);

  const loadStats = useCallback(async () => {
    try {
      const s = await getDriverStats();
      setStats({ totalRides: s.totalRides, totalEarnings: s.totalEarnings });
      setActiveRide(s.activeRide);
      setAvail(s.availability);
    } catch (err) {
      setError(apiError(err, 'Could not load your stats.'));
    }
  }, []);

  const loadRequests = useCallback(async () => {
    try {
      const r = await getDriverRequests();
      setRequests(r.requests);
      setReason(r.reason ?? null);
    } catch {
      /* transient; the next poll retries */
    }
  }, []);

  useFocusEffect(useCallback(() => {
    if (!canAcceptRides) {
      // Waiting for admin approval: re-check periodically so the dashboard unlocks by itself.
      refreshDriver();
      const t = setInterval(refreshDriver, POLL_MS);
      return () => clearInterval(t);
    }
    loadStats();
    loadRequests();
    const t = setInterval(() => { loadRequests(); loadStats(); }, POLL_MS);
    return () => clearInterval(t);
  }, [canAcceptRides, loadStats, loadRequests, refreshDriver]));

  const toggleOnline = async () => {
    setError(null);
    setBusy('availability');
    try {
      if (isOnline) {
        await setAvailability('offline');
        setAvail('offline');
        setRequests([]);
      } else {
        // The server refuses to put a driver online without a known position.
        if (!(await captureOnce())) return;
        await setAvailability('online');
        setAvail('online');
        loadRequests();
      }
    } catch (err) {
      setError(apiError(err, 'Could not change your availability.'));
    } finally {
      setBusy(null);
    }
  };

  const accept = async (id: string) => {
    setBusy(id);
    setError(null);
    try {
      const { booking } = await acceptRequest(id);
      setActiveRide(booking);
      setRequests((r) => r.filter((x) => x.bookingId !== id));
      loadStats();
    } catch (err) {
      // Losing a race to another driver is normal.
      setError(apiError(err, 'Could not accept that ride.'));
      setRequests((r) => r.filter((x) => x.bookingId !== id));
    } finally {
      setBusy(null);
    }
  };

  const decline = async (id: string) => {
    setBusy(id);
    try { await declineRequest(id); } catch { /* remove it either way */ }
    setRequests((r) => r.filter((x) => x.bookingId !== id));
    setBusy(null);
  };

  const advance = async () => {
    if (!activeRide) return;
    const next = NEXT_ACTION[activeRide.status];
    if (!next) return;
    setBusy('advance');
    setError(null);
    try {
      const { booking } = await advanceRide(activeRide.bookingId, next.action);
      setActiveRide(next.action === 'complete' ? null : booking);
      loadStats();
    } catch (err) {
      setError(apiError(err, 'Could not update the ride.'));
    } finally {
      setBusy(null);
    }
  };

  const signOut = async () => {
    await logoutDriver();
    nav.reset({ index: 0, routes: [{ name: 'Tabs' }] });
  };

  if (driverLoading || !driver) return <Loading />;

  return (
    <Screen>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={font.h2}>{driver.name}</Text>
          <Text style={font.small}>{[vehicleName(driver.carType ?? ''), driver.carNumber].filter(Boolean).join(' · ')}</Text>
        </View>
        <Button title="Log out" variant="outline" small onPress={signOut} />
      </View>

      {error ? <Banner kind="error">{error}</Banner> : null}

      {!canAcceptRides ? (
        <Banner kind="warn">
          Account under review. Status: {driver.approvalStatus.replace(/_/g, ' ')}.
          {driver.approvalStatus === 'pending_documents'
            ? ' Upload your licence, RC and insurance on the Udupi Taxi website so an admin can verify your account.'
            : ' An admin is reviewing your account. You can accept rides once it is approved.'}
          {driver.rejectionReason ? ` Reason: ${driver.rejectionReason}` : ''}
        </Banner>
      ) : (
        <>
          <Card style={styles.presence}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.dot, isOnline && { backgroundColor: colors.success }]} />
                <Text style={font.h3}>{isOnline ? 'Online' : 'Offline'}</Text>
              </View>
              <Text style={[font.small, { marginTop: 2 }]}>
                {gpsError
                  ? gpsError
                  : sharing && position
                    ? `Sharing location · ${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}`
                    : isOnline ? 'Acquiring GPS...' : 'Go online to receive ride requests'}
              </Text>
            </View>
            <Button
              testID="toggle-online"
              title={availability === 'on_trip' ? 'On a trip' : isOnline ? 'Go offline' : 'Go online'}
              variant={isOnline ? 'outline' : 'primary'}
              small
              disabled={availability === 'on_trip'}
              loading={busy === 'availability'}
              onPress={toggleOnline}
            />
          </Card>

          {activeRide && NEXT_ACTION[activeRide.status] ? (
            <Card style={{ backgroundColor: '#f6fcf9', borderColor: '#b6e0cc' }}>
              <Text style={[font.small, { color: colors.success, fontWeight: '800' }]}>CURRENT RIDE · {activeRide.bookingId}</Text>
              <Text style={[font.h3, { marginTop: 4 }]}>{activeRide.pickup} {'→'} {activeRide.drop}</Text>
              <Text style={[font.small, { marginVertical: 6 }]}>{activeRide.distanceKm} km · {money(activeRide.fare)}</Text>
              {activeRide.customer?.phone ? (
                <Button title={`Call ${activeRide.customer.name?.split(' ')[0] || 'customer'}`} variant="outline" small style={{ marginBottom: 10 }} onPress={() => Linking.openURL(`tel:${activeRide.customer?.phone}`)} />
              ) : null}
              <Button title={NEXT_ACTION[activeRide.status].label} variant="dark" onPress={advance} loading={busy === 'advance'} />
            </Card>
          ) : null}

          <View style={styles.stats}>
            <Card style={styles.stat}><Text style={styles.statValue}>{stats ? stats.totalRides : '—'}</Text><Text style={font.small}>Completed rides</Text></Card>
            <Card style={styles.stat}><Text style={styles.statValue}>{stats ? money(stats.totalEarnings) : '—'}</Text><Text style={font.small}>Earned</Text></Card>
          </View>

          <SectionTitle title="Ride requests" action="Refresh" onAction={loadRequests} />
          {activeRide ? (
            <Text style={font.small}>Finish your current ride to see new requests.</Text>
          ) : requests.length === 0 ? (
            <Empty title={isOnline ? 'No requests right now' : 'You are offline'} body={reason ?? (isOnline ? 'New requests near you appear here automatically.' : 'Go online to receive ride requests.')} />
          ) : (
            requests.map((r) => (
              <Card key={r.bookingId}>
                <Text style={font.small}>{r.bookingId} · {vehicleName(r.carType)} · {r.tripType}</Text>
                <Text style={[font.h3, { marginTop: 4 }]}>{r.pickup} {'→'} {r.drop}</Text>
                <Text style={[font.small, { marginTop: 4 }]}>
                  {[r.scheduledFor ? formatDateTime(r.scheduledFor) : null, r.distanceKm != null ? `${r.distanceKm} km` : null, r.distanceToPickupKm != null ? `${r.distanceToPickupKm} km to pickup` : null].filter(Boolean).join(' · ')}
                </Text>
                {r.fare != null ? <Text style={[font.h3, { color: colors.success, marginTop: 6 }]}>{money(r.fare)}</Text> : null}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                  <Button title="Decline" variant="outline" small style={{ flex: 1 }} onPress={() => decline(r.bookingId)} disabled={busy === r.bookingId} />
                  <Button title="Accept" small style={{ flex: 1 }} onPress={() => accept(r.bookingId)} loading={busy === r.bookingId} />
                </View>
              </Card>
            ))
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: space.lg },
  presence: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.lineStrong },
  stats: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1, marginBottom: 0 },
  statValue: { fontSize: 24, fontWeight: '800', color: colors.ink },
});
