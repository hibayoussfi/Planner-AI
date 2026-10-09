import { useState } from 'react';
import { View } from 'react-native';
import { Body, BlockRow, Button, Card, Field, Heading, Notice, Page, s } from '../components/ui';
import { addDays, dateKey, monday, parseTime, proposePlan, validateBlock, type Block, type Plan } from '../core/planner';
import { newId } from '../core/id';
import { usePlanner } from '../state/PlannerProvider';
export default function Week() {
  const { state, update } = usePlanner();
  const [week, setWeek] = useState(monday()), [draft, setDraft] = useState<{ plan: Plan; source: string } | null>(null), [message, setMessage] = useState('');
  const source = JSON.stringify({ state, week });
  const proposal = draft?.source === source ? draft.plan : null;
  const setProposal = (plan: Plan | null) => setDraft(plan ? { plan, source } : null);
  const [title, setTitle] = useState(''), [date, setDate] = useState(dateKey()), [start, setStart] = useState('10:00'), [end, setEnd] = useState('11:00');
  const [showForm, setShowForm] = useState(false), [error, setError] = useState('');
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const generate = () => {
    try {
      const elsewhere = new Set(state.approved.filter(b => b.date >= dateKey() && !days.includes(b.date)).map(b => b.taskId));
      setProposal(proposePlan(state.tasks.filter(t => !elsewhere.has(t.id)), state.fixed, week, state.prefs)); setMessage(''); setError('');
    } catch (e) { setError((e as Error).message); }
  };
  const approve = () => {
    if (!proposal) return;
    const now = new Date(), today = dateKey(now), minute = now.getHours() * 60 + now.getMinutes();
    if (proposal.blocks.some(b => b.kind === 'task' && (b.date < today || (b.date === today && b.start <= minute)))) { setError('A proposed time has passed. Generate a fresh plan.'); return; }
    const nextBlocks = proposal.blocks.filter(b => b.kind === 'task');
    const rescheduled = new Set(nextBlocks.map(b => b.taskId));
    update(st => ({ ...st, approved: [...st.approved.filter(b => !days.includes(b.date) && !rescheduled.has(b.taskId)), ...nextBlocks] }));
    setProposal(null); setMessage('Plan applied on this device. No external calendar was changed.');
  };
  const addFixed = () => {
    try {
      const block: Block = { id: newId(), title: title.trim(), date, start: parseTime(start), end: parseTime(end), kind: 'fixed', category: 'personal' };
      validateBlock(block);
      if ([...state.fixed, ...state.approved].some(b => b.date === block.date && block.start < b.end && block.end > b.start)) throw new Error('This overlaps an existing block. Adjust the time or remove that block first.');
      update(st => ({ ...st, fixed: [...st.fixed, block] })); setTitle(''); setShowForm(false); setError('');
    } catch (e) { setError((e as Error).message); }
  };
  const shown = proposal ? proposal.blocks : [...state.fixed, ...state.approved].filter(b => days.includes(b.date));
  return <Page eyebrow="A WEEK THAT FITS YOUR LIFE" title="Room for what matters." subtitle="Fixed appointments stay put. Flexible tasks find a place around them.">
    <View style={[s.row, { justifyContent: 'space-between' }]}><Button secondary title="← Previous" onPress={() => { setWeek(addDays(week, -7)); setMessage(''); }} /><Heading>{new Date(`${week}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</Heading><Button secondary title="Next →" onPress={() => { setWeek(addDays(week, 7)); setMessage(''); }} /></View>
    <Button title="Generate weekly proposal" onPress={generate} /><Button secondary title={showForm ? 'Close appointment form' : '+ Fixed appointment'} onPress={() => setShowForm(!showForm)} />
    {!!error && <Notice text={error} danger />}{!!message && <Notice text={message} />}
    {showForm && <Card><Heading>Protect this time</Heading><Field label="Appointment title" value={title} onChangeText={setTitle} maxLength={160} /><Field label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} /><Field label="Starts (HH:MM)" value={start} onChangeText={setStart} /><Field label="Ends (HH:MM)" value={end} onChangeText={setEnd} /><Button title="Save fixed appointment" onPress={addFixed} /></Card>}
    {proposal && <Card accent><Heading>Review your proposal</Heading><Body>{proposal.blocks.filter(b => b.kind === 'task').length} tasks placed · {proposal.unscheduled.length} could not fit. Applying replaces flexible blocks in this week only. Tasks planned in other weeks are excluded.</Body><Body>This is a rules-based schedule. AI task extraction is in the AI tab.</Body>{proposal.warnings.map((w, i) => <Notice key={i} danger text={w} />)}{proposal.unscheduled.map(({ task, reason }) => <Body key={task.id}>{task.title}: {reason}</Body>)}<Button title="Apply this plan" onPress={approve} /><Button secondary title="Discard proposal" onPress={() => setProposal(null)} /></Card>}
    {days.map(day => <Card key={day}><Heading>{new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}{day === dateKey() ? ' · Today' : ''}</Heading>{shown.filter(b => b.date === day).length ? shown.filter(b => b.date === day).sort((a, b) => a.start - b.start).map(b => <View key={b.id}><BlockRow block={b} />{!proposal && <Button secondary title={b.kind === 'fixed' ? 'Remove appointment' : 'Unplan task'} onPress={() => update(st => b.kind === 'fixed' ? { ...st, fixed: st.fixed.filter(x => x.id !== b.id) } : { ...st, approved: st.approved.filter(x => x.id !== b.id) })} />}</View>) : <Body>Open space. Keep some for yourself.</Body>}</Card>)}
  </Page>;
}
