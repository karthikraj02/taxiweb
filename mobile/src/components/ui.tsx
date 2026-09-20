import React from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleProp, StyleSheet,
  Text, TextInput, TextInputProps, View, ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, font, radius, shadow, space } from '../theme';

// ------------------------------------------------------------------- layout

export function Screen({
  children, scroll = true, padded = true, edges = ['bottom'], contentStyle,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const inner = scroll ? (
    <ScrollView
      contentContainerStyle={[padded && styles.padded, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, padded && styles.padded, contentStyle]}>{children}</View>
  );
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {inner}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={font.h3}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={styles.link}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export const Spacer = ({ size = space.lg }: { size?: number }) => <View style={{ height: size }} />;

export function KeyValue({ label, value, valueStyle }: { label: string; value: React.ReactNode; valueStyle?: object }) {
  return (
    <View style={styles.kv}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={[styles.kvValue, valueStyle]}>{value}</Text>
    </View>
  );
}

// ------------------------------------------------------------------ actions

type ButtonVariant = 'primary' | 'dark' | 'outline' | 'ghost' | 'danger';

export function Button({
  title, onPress, variant = 'primary', loading, disabled, small, style, testID,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const v = buttonVariants[variant];
  const off = disabled || loading;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [
        styles.button, small && styles.buttonSmall,
        { backgroundColor: v.bg, borderColor: v.border },
        pressed && !off && { opacity: 0.85 },
        off && { opacity: 0.55 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <Text style={[styles.buttonText, small && { fontSize: 14 }, { color: v.fg }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const buttonVariants: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.brand, fg: colors.ink, border: colors.brand },
  dark: { bg: colors.ink, fg: colors.white, border: colors.ink },
  outline: { bg: colors.white, fg: colors.ink, border: colors.lineStrong },
  ghost: { bg: 'transparent', fg: colors.ink2, border: 'transparent' },
  danger: { bg: colors.white, fg: colors.danger, border: colors.danger },
};

export function Chip({ label, selected, onPress, sub }: { label: string; selected?: boolean; onPress?: () => void; sub?: string }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipOn]}>
      <Text style={[styles.chipText, selected && { color: colors.ink, fontWeight: '700' }]}>{label}</Text>
      {sub ? <Text style={[styles.chipSub, selected && { color: colors.ink2 }]}>{sub}</Text> : null}
    </Pressable>
  );
}

export function Segmented<T extends string>({
  options, value, onChange,
}: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => (
        <Pressable key={o.value} onPress={() => onChange(o.value)} style={[styles.segment, value === o.value && styles.segmentOn]}>
          <Text style={[styles.segmentText, value === o.value && { color: colors.ink }]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// -------------------------------------------------------------------- forms

export function Field({
  label, error, style, ...rest
}: TextInputProps & { label?: string; error?: string | null; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ marginBottom: space.lg }, style]}>
      {label ? <Text style={[font.label, { marginBottom: 6 }]}>{label}</Text> : null}
      <TextInput
        placeholderTextColor="#98a2b3"
        {...rest}
        style={[styles.input, rest.multiline && { minHeight: 96, textAlignVertical: 'top' }, error ? { borderColor: colors.danger } : null]}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

// ----------------------------------------------------------------- feedback

export function Banner({ kind = 'error', children }: { kind?: 'error' | 'success' | 'warn' | 'info'; children: React.ReactNode }) {
  const palette = {
    error: { bg: colors.dangerSoft, fg: colors.danger, border: '#f3c1bc' },
    success: { bg: colors.successSoft, fg: colors.success, border: '#b6e0cc' },
    warn: { bg: colors.brandSoft, fg: '#6b4b00', border: '#efd58a' },
    info: { bg: colors.bgSoft, fg: colors.ink2, border: colors.line },
  }[kind];
  return (
    <View accessibilityRole="alert" style={[styles.banner, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <Text style={{ color: palette.fg, fontSize: 14, lineHeight: 20 }}>{children}</Text>
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.ink} />
      {label ? <Text style={[font.small, { marginTop: 8 }]}>{label}</Text> : null}
    </View>
  );
}

export function Empty({ title, body }: { title: string; body?: string }) {
  return (
    <View style={styles.center}>
      <Text style={[font.h3, { textAlign: 'center' }]}>{title}</Text>
      {body ? <Text style={[font.small, { textAlign: 'center', marginTop: 6 }]}>{body}</Text> : null}
    </View>
  );
}

export function Stars({ value, onChange, size = 28 }: { value: number; onChange?: (n: number) => void; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} disabled={!onChange} onPress={() => onChange?.(n)} hitSlop={4}>
          <Text style={{ fontSize: size, color: n <= value ? colors.brand : colors.lineStrong }}>{'★'}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  padded: { padding: space.lg, paddingBottom: space.xxl },
  card: {
    backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line,
    padding: space.lg, marginBottom: space.md, ...shadow.card,
  },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.md, marginTop: space.sm },
  link: { color: colors.brandDark, fontWeight: '700', fontSize: 14 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', gap: space.lg, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  kvLabel: { color: colors.muted, fontSize: 14 },
  kvValue: { color: colors.ink, fontSize: 14, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  button: { minHeight: 50, borderRadius: radius.sm, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  buttonSmall: { minHeight: 40, paddingHorizontal: 14 },
  buttonText: { fontSize: 16, fontWeight: '700' },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.white, marginRight: 8, alignItems: 'center' },
  chipOn: { backgroundColor: colors.brandSoft, borderColor: colors.ink },
  chipText: { color: colors.ink2, fontSize: 14, fontWeight: '500' },
  chipSub: { color: colors.muted, fontSize: 11, marginTop: 1 },
  segmented: { flexDirection: 'row', backgroundColor: colors.bgSoft, borderRadius: radius.sm, padding: 3 },
  segment: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 6 },
  segmentOn: { backgroundColor: colors.white, ...shadow.card },
  segmentText: { color: colors.muted, fontWeight: '700', fontSize: 14 },
  input: {
    borderWidth: 1.5, borderColor: colors.lineStrong, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 16, color: colors.ink, backgroundColor: colors.white,
  },
  fieldError: { color: colors.danger, fontSize: 12, marginTop: 4 },
  banner: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 11, marginBottom: space.md },
  center: { alignItems: 'center', justifyContent: 'center', padding: space.xxl },
});
