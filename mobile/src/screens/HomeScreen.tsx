import React from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { Button, Card, SectionTitle } from '../components/ui';
import { colors, font, radius, space } from '../theme';
import { POPULAR_ROUTES } from '../data/places';
import { TOURS, VEHICLES } from '../data/catalog';
import { SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_TEL } from '../config';
import { useAuth } from '../context/AuthContext';
import type { RootStackParamList } from '../navigation/types';

const POINTS = ['See your fare before you book', 'Available 24 hours, 7 days a week', 'Serving Udupi since 2010', 'Secure online payment'];

export default function HomeScreen() {
  const nav = useNavigation<NavigationProp<RootStackParamList>>();
  const { user } = useAuth();

  const book = (params?: { pickup?: string; drop?: string; carType?: (typeof VEHICLES)[number]['id'] }) =>
    nav.navigate('Tabs', { screen: 'Book', params });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.ink }} edges={['top']}>
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>UDUPI, KARNATAKA</Text>
          <Text style={styles.heroTitle}>
            {user ? `Hi ${user.name.split(' ')[0]},\n` : ''}Reliable taxi service for every journey
          </Text>
          <Text style={styles.heroLead}>Local rides, airport transfers and outstation trips at clear per-km rates.</Text>
          <View style={{ gap: 10, marginTop: space.lg }}>
            <Button title="Book a ride" onPress={() => book()} />
            <Pressable onPress={() => Linking.openURL(SUPPORT_PHONE_TEL)} style={styles.callBtn} accessibilityRole="button">
              <Text style={styles.callText}>Call {SUPPORT_PHONE_DISPLAY}</Text>
            </Pressable>
          </View>
        </View>

        <View style={{ padding: space.lg }}>
          {POINTS.map((p) => (
            <View key={p} style={styles.point}>
              <Text style={styles.tick}>{'✓'}</Text>
              <Text style={font.body}>{p}</Text>
            </View>
          ))}

          <SectionTitle title="Popular routes" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {POPULAR_ROUTES.map((r) => (
              <Pressable key={r.label} style={styles.route} onPress={() => book({ pickup: r.pickup, drop: r.drop })}>
                <Text style={styles.routeText}>{r.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <SectionTitle title="Our fleet" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 4 }}>
            {VEHICLES.map((v) => (
              <Card key={v.id} style={styles.vehicle}>
                <View style={styles.vehicleImg}>
                  <Image source={v.image} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                </View>
                <Text style={font.h3}>{v.name}</Text>
                <Text style={[font.small, { marginTop: 2 }]}>{v.seats} seats · {v.luggage}</Text>
                <Text style={[font.small, { color: colors.ink, fontWeight: '700', marginTop: 6 }]}>{v.rate} · min {v.minFare}</Text>
                <Button title="Book" variant="dark" small style={{ marginTop: 10 }} onPress={() => book({ carType: v.id })} />
              </Card>
            ))}
          </ScrollView>

          <SectionTitle title="Tour packages" action="See all" onAction={() => nav.navigate('Tours')} />
          {TOURS.slice(0, 2).map((t) => (
            <Card key={t.name} style={{ padding: 0, overflow: 'hidden' }}>
              {t.image ? <Image source={t.image} style={{ width: '100%', height: 130 }} resizeMode="cover" /> : null}
              <View style={{ padding: space.lg }}>
                <Text style={font.small}>{t.duration}</Text>
                <Text style={font.h3}>{t.name}</Text>
                <Text style={[font.small, { marginTop: 4 }]}>{t.desc}</Text>
                <Text style={[font.h3, { marginTop: 8 }]}>{t.price}<Text style={font.small}> per vehicle</Text></Text>
              </View>
            </Card>
          ))}

          <Card style={{ backgroundColor: colors.brandSoft, borderColor: '#efd58a', marginTop: space.md }}>
            <Text style={font.h3}>Questions or a custom trip?</Text>
            <Text style={[font.small, { marginVertical: 6 }]}>Call us or send a message and we will get back to you.</Text>
            <Button title="Contact us" variant="dark" small onPress={() => nav.navigate('Contact')} />
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.ink, padding: space.xl, paddingTop: space.lg, paddingBottom: space.xxl, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  eyebrow: { color: colors.brand, fontWeight: '700', fontSize: 12, letterSpacing: 1.2, marginBottom: 8 },
  heroTitle: { color: colors.white, fontSize: 30, fontWeight: '800', lineHeight: 36, letterSpacing: -0.5 },
  heroLead: { color: '#c5cddc', fontSize: 15, lineHeight: 22, marginTop: 10 },
  callBtn: { minHeight: 50, borderRadius: radius.sm, borderWidth: 1.5, borderColor: '#3a4a63', alignItems: 'center', justifyContent: 'center' },
  callText: { color: colors.white, fontWeight: '700', fontSize: 16 },
  point: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  tick: { color: colors.success, fontWeight: '800', fontSize: 16 },
  route: { borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9, marginRight: 8, backgroundColor: colors.white },
  routeText: { color: colors.ink2, fontWeight: '600', fontSize: 14 },
  vehicle: { width: 200, marginRight: 12 },
  vehicleImg: { height: 84, backgroundColor: colors.bgSoft, borderRadius: radius.sm, marginBottom: 10, padding: 6 },
});
