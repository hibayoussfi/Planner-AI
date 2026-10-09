import { useState } from 'react';
import { Body, Button, Card, Field, Heading, Notice, Page } from '../components/ui';
import { newId } from '../core/id';
import { validateTask, type Task } from '../core/planner';
import { extractTasks, apiUrl, supabase } from '../state/cloud';
import { usePlanner } from '../state/PlannerProvider';
export default function Assistant() {
  const { update } = usePlanner();
  const [text, setText] = useState(''), [drafts, setDrafts] = useState<Task[]>([]), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const extract = async () => {
    setBusy(true); setMessage(''); setDrafts([]);
    try {
      const result = await extractTasks(text);
      if (!Array.isArray(result.tasks) || result.tasks.length > 20) throw new Error('AI returned an invalid task list.');
      const tasks = result.tasks.map(t => ({ ...t, id: newId(), done: false })); tasks.forEach(validateTask); setDrafts(tasks);
      if (!tasks.length) setMessage('No actionable tasks found. Try a clearer description or add one manually.');
    } catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
  };
  return <Page eyebrow="THOUGHTS → TASKS → TIME" title="Untangle your week." subtitle="Turn notes or an email into task drafts, then decide what belongs in your plan.">
    {!apiUrl || !supabase ? <Card><Heading>AI setup required</Heading><Body>The optional backend needs Supabase sign-in and an OpenAI API key on the server. Manual tasks and weekly planning already work.</Body></Card> : null}
    <Card><Heading>What’s on your mind?</Heading><Field label="Notes or pasted email text" multiline maxLength={12000} value={text} onChangeText={setText} placeholder="I need to prepare a presentation by Friday, and make time for two workouts…" /><Body>Only this text is sent to the configured backend and OpenAI when you tap below. Remove details you don’t need to share. No inbox is connected.</Body><Button title={busy ? 'Creating drafts…' : 'Send text to AI · create drafts'} disabled={busy || text.trim().length < 3 || !apiUrl || !supabase} onPress={extract} /></Card>
    {!!message && <Notice text={message} />}
    {drafts.map(task => <Card key={task.id}><Heading>Review task draft</Heading><Field label="Task title" value={task.title} maxLength={160} onChangeText={value => setDrafts(ds => ds.map(d => d.id === task.id ? { ...d, title: value } : d))} /><Field label="Duration (minutes)" keyboardType="number-pad" value={String(task.minutes)} onChangeText={v => setDrafts(ds => ds.map(d => d.id === task.id ? { ...d, minutes: Number(v) } : d))} /><Field label="Deadline (YYYY-MM-DD, optional)" value={task.deadline ?? ''} onChangeText={v => setDrafts(ds => ds.map(d => d.id === task.id ? { ...d, deadline: v || null } : d))} /><Body>{task.category} · Priority {task.priority}/3. Durations and priorities are estimates; check them before adding.</Body><Button title="Approve · add to tasks" onPress={() => { try { validateTask(task); update(st => ({ ...st, tasks: [...st.tasks, task] })); setDrafts(ds => ds.filter(d => d.id !== task.id)); setMessage('Added to Tasks. Generate a weekly proposal to schedule it.'); } catch (e) { setMessage((e as Error).message); } }} /><Button secondary title="Discard" onPress={() => setDrafts(ds => ds.filter(d => d.id !== task.id))} /></Card>)}
    <Card><Heading>Email & Wellpass</Heading><Body>Gmail and Google Calendar connection: planned, not connected. For now, paste email text here and enter appointments in Week.</Body><Body>Wellpass: add fitness tasks manually, including travel and changing time. Book classes separately in Wellpass. No automatic bookings or account access.</Body></Card>
  </Page>;
}
