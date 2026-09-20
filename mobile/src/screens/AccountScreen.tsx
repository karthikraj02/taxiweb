import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { Button, Card, Loading, Screen, SectionTitle } from '../components/ui';
import { colors, font, radius, space } from '../theme';
import { SUPPORT_EMAIL, SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_TEL } from '../config';
import { useAuth } from '../context/AuthContext';
import { useDriver } from '../context/DriverContext';
import type { RootStackParamList } from '../navigation/types';

function Row({ title, sub, onPress }: { title: string; sub?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.row} accessibilityRole="button">
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {sub ? <Text style={font.small}>{sub}</Text> : null}
      </View>
      <Text style={styles.chevron}>{'›'}</Text>
    </Pressable>
  );
}

export default function AccountScreen() {
  const nav = useNavigation<NavigationProp<RootStackParamList>>();
  const { user, loading, logout } = useAuth();
  const { isDriverAuthenticated } = useDriver();

  if (loading) return <Loading />;

  return (
    <Screen>
      {user ? (
        <Card>
          <View style={styles.avatar}><Text style={styles.avatarText}>{user.name.charAt(0).toUpperCase()}</Text></View>
          <Text style={font.h2}>{user.name}</Text>
          {user.email ? <Text style={font.small}>{user.email}</Text> : null}
          {user.phone ? <Text style={font.small}>{user.phone}</Text> : null}
          <Button title="Log out" variant="outline" small style={{ marginTop: space.md, alignSelf: 'flex-start' }} onPress={logout} />
        </Card>
      ) : (
        <Card>
          <Text style={font.h2}>Welcome</Text>
          <Text style={[font.small, { marginVertical: 6 }]}>Log in to book rides, pay online and track your trips.</Text>
          <Button testID="account-login" title="Log in or sign up" onPress={() => nav.navigate('Auth')} />
        </Card>
      )}

      <SectionTitle title="Explore" />
      <Card style={{ paddingVertical: 4 }}>
        <Row title="Tour packages" sub="Day trips across Karnataka" onPress={() => nav.navigate('Tours')} />
        <Row title="Contact us" sub="Send a message to our team" onPress={() => nav.navigate('Contact')} />
        <Row title={`Call ${SUPPORT_PHONE_DISPLAY}`} sub="Open 24 hours, 7 days a week" onPress={() => Linking.openURL(SUPPORT_PHONE_TEL)} />
        <Row title="Email us" sub={SUPPORT_EMAIL} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} />
      </Card>

      <SectionTitle title="Drivers" />
      <Card>
        <Text style={font.body}>Drive with Udupi Taxi: register, get approved and accept ride requests near you.</Text>
        <Button
          testID="driver-portal"
          title={isDriverAuthenticated ? 'Open driver dashboard' : 'Driver portal'}
          variant="dark"
          small
          style={{ marginTop: space.md, alignSelf: 'flex-start' }}
          onPress={() => nav.navigate(isDriverAuthenticated ? 'DriverDashboard' : 'DriverAuth')}
        />
      </Card>

      <Text style={[font.small, { textAlign: 'center', marginTop: space.lg }]}>Udupi Taxi · Serving Udupi since 2010</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  avatarText: { fontSize: 22, fontWeight: '800', color: '#7a5600' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line, gap: 10 },
  rowTitle: { fontSize: 16, fontWeight: '600', color: colors.ink },
  chevron: { fontSize: 24, color: colors.muted, marginTop: -2, borderRadius: radius.sm },
});
