import React from 'react';
import { Image, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { Button, Card, Screen } from '../components/ui';
import { colors, font, space } from '../theme';
import { TOURS } from '../data/catalog';
import type { RootStackParamList } from '../navigation/types';

export default function ToursScreen() {
  const nav = useNavigation<NavigationProp<RootStackParamList>>();
  return (
    <Screen>
      <Text style={[font.body, { marginBottom: space.lg }]}>Ready-made itineraries with a driver who knows the roads. Prices are per vehicle.</Text>
      {TOURS.map((t) => (
        <Card key={t.name} style={{ padding: 0, overflow: 'hidden' }}>
          {t.image ? <Image source={t.image} style={{ width: '100%', height: 150 }} resizeMode="cover" /> : null}
          <View style={{ padding: space.lg }}>
            <Text style={font.small}>{t.duration}</Text>
            <Text style={font.h2}>{t.name}</Text>
            <Text style={[font.body, { marginVertical: 6 }]}>{t.desc}</Text>
            {t.highlights.map((h) => (
              <Text key={h} style={{ color: colors.ink2, fontSize: 14, marginBottom: 2 }}>{'✓'}  {h}</Text>
            ))}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.md }}>
              <Text style={font.h2}>{t.price}</Text>
              <Button title="Enquire" variant="dark" small onPress={() => nav.navigate('Contact')} />
            </View>
          </View>
        </Card>
      ))}
    </Screen>
  );
}
