import React, { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, font, radius, space } from '../theme';
import { Place, searchPlaces } from '../data/places';

/** A tappable field that opens a searchable list of places. */
export default function PlaceField({
  label, value, onSelect, placeholder,
}: { label: string; value: string; onSelect: (place: Place) => void; placeholder: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const close = () => { setOpen(false); setQuery(''); };

  return (
    <View style={{ marginBottom: space.lg }}>
      <Text style={[font.label, { marginBottom: 6 }]}>{label}</Text>
      <Pressable testID={`place-${label}`} onPress={() => setOpen(true)} style={styles.field} accessibilityRole="button">
        <Text style={value ? styles.value : styles.placeholder} numberOfLines={1}>{value || placeholder}</Text>
        <Text style={styles.chevron}>{'▾'}</Text>
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={close}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={styles.header}>
            <Text style={font.h2}>{label}</Text>
            <Pressable onPress={close} hitSlop={10}><Text style={styles.close}>Close</Text></Pressable>
          </View>
          <View style={{ paddingHorizontal: space.lg }}>
            <TextInput
              autoFocus
              value={query}
              onChangeText={setQuery}
              placeholder="Search places"
              placeholderTextColor="#98a2b3"
              style={styles.search}
            />
          </View>
          <FlatList
            data={searchPlaces(query)}
            keyExtractor={(p) => p.label}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={[font.small, { padding: space.xl, textAlign: 'center' }]}>No matching places.</Text>}
            renderItem={({ item }) => (
              <Pressable style={styles.row} onPress={() => { onSelect(item); close(); }}>
                <Text style={styles.rowText}>{item.label}</Text>
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderColor: colors.lineStrong, borderRadius: radius.sm, paddingHorizontal: 14, minHeight: 50, backgroundColor: colors.white,
  },
  value: { fontSize: 16, color: colors.ink, flex: 1 },
  placeholder: { fontSize: 16, color: '#98a2b3', flex: 1 },
  chevron: { color: colors.muted, fontSize: 14, marginLeft: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: space.lg },
  close: { color: colors.brandDark, fontWeight: '700', fontSize: 16 },
  search: { borderWidth: 1.5, borderColor: colors.lineStrong, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginBottom: space.sm },
  row: { paddingHorizontal: space.lg, paddingVertical: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  rowText: { fontSize: 16, color: colors.ink },
});
