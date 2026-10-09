import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { Body, BlockRow, Button, Card, Heading, Page, palette, s } from '../components/ui';
import { dateKey } from '../core/planner';
import { usePlanner } from '../state/PlannerProvider';
export default function Today() {
  const { state, update } = usePlanner();
  const today = dateKey(), pending = state.tasks.filter(t => !t.done);
  const blocks = [...state.fixed, ...state.approved].filter(b => b.date === today).sort((a, b) => a.start - b.start);
  const minutes = blocks.reduce((n, b) => n + b.end - b.start, 0);
  return <Page eyebrow="PLANNER AI / YOUR DAY, WITH INTENTION" title="Make room for life." subtitle={new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}>
    <Card accent><Text style={{ fontSize: 12, letterSpacing: 1.5, fontWeight: '700', color: palette.green }}>A LITTLE STRUCTURE. MORE SPACE.</Text><Heading>Your week starts with what matters.</Heading><Body>Add your priorities and appointments. Review a balanced plan before making it yours.</Body><Button title="Plan my week →" onPress={() => router.push('/week')} /></Card>
    <View style={[s.row, { justifyContent: 'space-between' }]}><View><Heading>{pending.length} open tasks</Heading><Body>Ready to find their place</Body></View><View><Heading>{(minutes / 60).toFixed(1)}h planned</Heading><Body>On today’s agenda</Body></View></View>
    <Card><Heading>Today’s rhythm</Heading>{blocks.length ? blocks.map(b => <BlockRow key={b.id} block={b} onDone={b.taskId ? () => update(st => ({ ...st, tasks: st.tasks.map(t => t.id === b.taskId ? { ...t, done: true } : t), approved: st.approved.filter(a => a.taskId !== b.taskId) })) : undefined} />) : <><Body>Your day is open. Add fixed appointments first, then let the planner find space for your tasks.</Body><Button title="Add a task" secondary onPress={() => router.push('/tasks')} /></>}</Card>
    <Body>Saved on this device · {Intl.DateTimeFormat().resolvedOptions().timeZone}. Cloud backup and AI are optional.</Body>
  </Page>;
}
