import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { clock, type Block } from '../core/planner';
import { usePlanner } from '../state/PlannerProvider';
export const palette = { ink: '#192F2C', muted: '#697C76', green: '#216A52', lime: '#D8EE94', paper: '#F5F7F2', line: '#E1E8DE', white: '#FFFFFF', red: '#9A392E' };
export function Page({ eyebrow, title, subtitle, children }: { eyebrow: string; title: string; subtitle?: string; children: React.ReactNode }) {
  const { ready, error } = usePlanner();
  return <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}><ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
    <Text style={s.eyebrow}>{eyebrow}</Text><Text accessibilityRole="header" style={s.title}>{title}</Text>{subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
    {!!error && <Notice text={error} danger />}{ready ? children : <ActivityIndicator accessibilityLabel="Loading your planner" color={palette.green} />}
  </ScrollView></SafeAreaView>;
}
export function Card({ children, accent = false }: { children: React.ReactNode; accent?: boolean }) { return <View style={[s.card, accent && s.accent]}>{children}</View>; }
export function Heading({ children }: { children: React.ReactNode }) { return <Text accessibilityRole="header" style={s.heading}>{children}</Text>; }
export function Body({ children }: { children: React.ReactNode }) { return <Text style={s.body}>{children}</Text>; }
export function Notice({ text, danger = false }: { text: string; danger?: boolean }) { return <Text accessibilityRole="alert" style={[s.notice, danger && { color: palette.red }]}>{text}</Text>; }
export function Button({ title, onPress, secondary = false, disabled = false }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [s.button, secondary && s.secondary, (disabled || pressed) && { opacity: 0.5 }]}><Text style={[s.buttonText, secondary && { color: palette.green }]}>{title}</Text></Pressable>;
}
export function Field({ label, ...props }: TextInputProps & { label: string }) { return <View style={{ gap: 6 }}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor="#7A8983" style={[s.input, props.multiline && { minHeight: 110, textAlignVertical: 'top' }]} {...props} /></View>; }
export function Choices<T extends string>({ label, values, value, onChange }: { label: string; values: readonly T[]; value: T; onChange: (v: T) => void }) {
  return <View style={{ gap: 8 }}><Text style={s.label}>{label}</Text><View style={s.row}>{values.map(v => <Pressable key={v} accessibilityRole="button" accessibilityState={{ selected: value === v }} onPress={() => onChange(v)} style={[s.chip, value === v && s.selected]}><Text style={{ color: value === v ? 'white' : palette.green, fontWeight: '600' }}>{v}</Text></Pressable>)}</View></View>;
}
export function BlockRow({ block, onDone }: { block: Block; onDone?: () => void }) { return <View style={s.block}><View style={{ flex: 1, gap: 5 }}><Text style={s.label}>{clock(block.start)} — {clock(block.end)}</Text><Text style={s.heading}>{block.title}</Text><Body>{block.kind === 'fixed' ? 'Fixed appointment' : block.category === 'fitness' ? 'Workout · booking separate' : 'Planned task'}</Body></View>{onDone && <Pressable accessibilityRole="button" accessibilityLabel={`Complete ${block.title}`} onPress={onDone} style={s.check}><Text style={{ color: palette.green }}>✓</Text></Pressable>}</View>; }
export const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.paper }, page: { padding: 24, paddingBottom: 40, gap: 18, width: '100%', maxWidth: 820, alignSelf: 'center' },
  eyebrow: { color: palette.green, letterSpacing: 2, fontSize: 11, fontWeight: '800', marginTop: 8 }, title: { fontSize: 36, fontWeight: '700', color: palette.ink, letterSpacing: -1.4 }, subtitle: { fontSize: 15, lineHeight: 23, color: palette.muted, marginTop: -8 },
  card: { padding: 20, gap: 16, backgroundColor: palette.white, borderRadius: 24, borderWidth: 1, borderColor: palette.line }, accent: { backgroundColor: palette.lime, borderColor: palette.lime },
  heading: { fontSize: 18, fontWeight: '700', color: palette.ink }, body: { fontSize: 14, lineHeight: 22, color: palette.muted }, notice: { fontSize: 14, lineHeight: 22, color: palette.green },
  button: { minHeight: 48, backgroundColor: palette.green, borderRadius: 14, alignItems: 'center', justifyContent: 'center', padding: 12 }, secondary: { backgroundColor: '#EBF1E8' }, buttonText: { color: 'white', fontSize: 15, fontWeight: '700' },
  label: { fontSize: 12, fontWeight: '700', color: palette.muted }, input: { minHeight: 48, borderWidth: 1, borderColor: palette.line, borderRadius: 12, padding: 12, fontSize: 16, color: palette.ink, backgroundColor: '#FAFCF8' },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }, chip: { minHeight: 44, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#EBF1E8' }, selected: { backgroundColor: palette.green },
  block: { flexDirection: 'row', gap: 14, paddingVertical: 14, borderTopColor: palette.line, borderTopWidth: 1 }, check: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#EBF1E8', alignItems: 'center', justifyContent: 'center' },
});
