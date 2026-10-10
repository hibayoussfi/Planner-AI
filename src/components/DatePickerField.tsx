import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { dateKey } from '../core/planner';
import { friendlyDate, initialMonth, monthCells, monthTitle, shiftMonth } from '../core/calendar';
import { palette, s } from './ui';

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function DatePickerField({ label, value, onChange, optional = false }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => initialMonth(value));
  const today = dateKey();

  const toggle = () => {
    if (!open) setMonth(initialMonth(value));
    setOpen(!open);
  };

  const pick = (day: string) => {
    onChange(day);
    setOpen(false);
  };

  return <View style={styles.field}>
    <Text style={s.label}>{label}</Text>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}: ${friendlyDate(value)}. Choose another date` : `${label}: Choose a date`}
      accessibilityState={{ expanded: open }}
      onPress={toggle}
      style={({ pressed }) => [s.input, styles.trigger, pressed && { opacity: 0.75 }]}
    >
      <Text style={[styles.value, !value && styles.placeholder]}>{value ? friendlyDate(value) : 'Choose a date'}</Text>
      <Text style={styles.calendarIcon}>▦</Text>
    </Pressable>
    {open && <View style={styles.calendar}>
      <View style={styles.monthNavigation}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => setMonth(m => shiftMonth(m, -1))} style={styles.arrow}>
          <Text style={styles.arrowText}>‹</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.monthTitle}>{monthTitle(month)}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => setMonth(m => shiftMonth(m, 1))} style={styles.arrow}>
          <Text style={styles.arrowText}>›</Text>
        </Pressable>
      </View>
      <View style={styles.grid}>
        {weekdays.map(day => <View key={day} style={styles.cell}><Text style={styles.weekday}>{day}</Text></View>)}
        {monthCells(month).map((day, index) => day ?
          <View key={day} style={styles.cell}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Select ${friendlyDate(day)}`}
              accessibilityState={{ selected: day === value }}
              onPress={() => pick(day)}
              style={({ pressed }) => [styles.dayButton, day === today && styles.today, day === value && styles.selected, pressed && { opacity: 0.7 }]}
            >
              <Text style={[styles.dayText, day === value && styles.selectedText]}>{Number(day.slice(-2))}</Text>
            </Pressable>
          </View> : <View key={`empty-${index}`} style={styles.cell} />
        )}
      </View>
      <View style={styles.footer}>
        <Pressable accessibilityRole="button" accessibilityLabel="Select today" onPress={() => pick(today)} style={styles.footerButton}><Text style={styles.footerText}>Today</Text></Pressable>
        {optional && <Pressable accessibilityRole="button" accessibilityLabel="Clear date" onPress={() => pick('')} style={styles.footerButton}><Text style={styles.footerText}>Clear date</Text></Pressable>}
        <Pressable accessibilityRole="button" accessibilityLabel="Close calendar" onPress={() => setOpen(false)} style={styles.footerButton}><Text style={styles.footerText}>Close</Text></Pressable>
      </View>
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  trigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  value: { flex: 1, color: palette.ink, fontSize: 16 },
  placeholder: { color: '#7A8983' },
  calendarIcon: { color: palette.green, fontSize: 25, marginLeft: 12, fontWeight: '700' },
  calendar: { backgroundColor: palette.white, borderColor: palette.line, borderWidth: 1, borderRadius: 16, padding: 12, gap: 12 },
  monthNavigation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthTitle: { color: palette.ink, fontSize: 17, fontWeight: '700' },
  arrow: { minWidth: 44, minHeight: 44, borderRadius: 12, backgroundColor: palette.paper, alignItems: 'center', justifyContent: 'center' },
  arrowText: { color: palette.green, fontSize: 28, lineHeight: 32 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.2857%', minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  weekday: { color: palette.muted, fontSize: 11, fontWeight: '700' },
  dayButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  dayText: { fontSize: 14, fontWeight: '600', color: palette.ink },
  today: { borderWidth: 1, borderColor: palette.green },
  selected: { backgroundColor: palette.green, borderColor: palette.green },
  selectedText: { color: palette.white },
  footer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: palette.line },
  footerButton: { minHeight: 42, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 10, backgroundColor: palette.paper },
  footerText: { fontSize: 13, fontWeight: '700', color: palette.green },
});
