import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { Banner, Button, Empty, Loading } from '../components/ui';
import TripCard from '../components/TripCard';
import { colors, space } from '../theme';
import { apiError } from '../api/client';
import { listBookings } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import type { Booking } from '../types';
import type { RootStackParamList } from '../navigation/types';

export default function TripsScreen() {
  const nav = useNavigation<NavigationProp<RootStackParamList>>();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [trips, setTrips] = useState<Booking[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setTrips((await listBookings(1, 50)).bookings);
    } catch (err) {
      setError(apiError(err, 'We could not load your trips.'));
    }
  }, []);

  // Reload whenever the tab is focused, so a booking just made shows up.
  useFocusEffect(useCallback(() => { if (isAuthenticated) load(); }, [isAuthenticated, load]));

  if (authLoading) return <Loading />;

  if (!isAuthenticated) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: space.xl, gap: 12 }}>
        <Empty title="Log in to see your trips" body="Your bookings, payments and receipts appear here." />
        <Button title="Log in or sign up" onPress={() => nav.navigate('Auth')} />
      </View>
    );
  }

  return (
    <FlatList
      data={trips ?? []}
      keyExtractor={(b) => b.bookingId}
      contentContainerStyle={{ padding: space.lg, flexGrow: 1 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={colors.ink}
          onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
        />
      }
      ListHeaderComponent={error ? <Banner kind="error">{error}</Banner> : null}
      ListEmptyComponent={
        trips === null && !error ? <Loading /> : (
          <Empty title="No trips yet" body="When you book a ride it will show up here." />
        )
      }
      renderItem={({ item }) => <TripCard booking={item} onPress={() => nav.navigate('TripDetail', { bookingId: item.bookingId })} />}
    />
  );
}
