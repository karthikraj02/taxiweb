import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, shadow, space } from '../theme';
import { vehicleName } from '../data/catalog';
import { ACTIVE_STATUSES, formatDateTime, money, statusLabel } from '../utils/format';
import type { Booking } from '../types';

export function StatusPill({ status }: { status: string }) {
  const active = ACTIVE_STATUSES.includes(status);
  const done = status === 'completed';
  const bg = done ? colors.successSoft : active ? colors.brandSoft : colors.bgSoft;
  const fg = done ? colors.success : active ? '#7a5600' : colors.muted;
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontSize: 12, fontWeight: '700' }}>{statusLabel(status)}</Text>
    </View>
  );
}

export default function TripCard({ booking, onPress }: { booking: Booking; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.card} accessibilityRole="button">
      <View style={styles.top}>
        <Text style={font.small}>{booking.bookingId}</Text>
        <StatusPill status={booking.status} />
      </View>
      <Text style={font.h3} numberOfLines={1}>{booking.pickup} {'→'} {booking.drop}</Text>
      <Text style={[font.small, { marginTop: 4 }]}>
        {formatDateTime(booking.scheduledFor)} · {vehicleName(booking.carType)}
      </Text>
      <Text style={[font.h3, { marginTop: 8 }]}>{money(booking.fare)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: space.lg, marginBottom: space.md, ...shadow.card },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  pill: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
});
