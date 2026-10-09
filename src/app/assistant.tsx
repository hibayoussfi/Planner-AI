import { useState } from 'react';
import { router } from 'expo-router';
import { Body, Button, Card, Field, Heading, Notice, Page } from '../components/ui';
import { newId } from '../core/id';
import { validateTask, type Task } from '../core/planner';
import { extractTasks, fetchMailDigest, apiUrl, supabase, type IntegrationProvider } from '../state/cloud';
import { usePlanner } from '../state/PlannerProvider';

export default function Assistant() {
  const { update } = usePlanner();
  const [text, setText] = useState(''), [drafts, setDrafts] = useState<Task[]>([]), [busy, setBusy] = useState(false), [mailBusy, setMailBusy] = useState<IntegrationProvider | null>(null), [message, setMessage] = useState('');
  const extract = async () => {
    setBusy(true); setMessage(''); setDrafts([]);
    try {
      const result = await extractTasks(text);
      if (!Array.isArray(result.tasks) || result.tasks.length > 20) throw new Error('AI returned an invalid task list.');
      const tasks = result.tasks.map(t => ({ ...t, id: newId(), done: false })); tasks.forEach(validateTask); setDrafts(tasks);
      if (!tasks.length) setMessage('No actionable tasks found. Try a clearer description or add one manually.');
    } catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
  };
  const loadMail = async (provider: IntegrationProvider) => {
    setMailBusy(provider); setMessage(''); setDrafts([]);
    try {
      const result = await fetchMailDigest(provider);
      setText(result.text);
      setMessage(result.count ? `Loaded ${result.count} recent ${provider === 'google' ? 'Gmail' : 'Outlook'} message previews. Review or remove anything you do not want to send to AI.` : 'No recent messages were returned.');
    } catch (e) { setMessage((e as Error).message); } finally { setMailBusy(null); }
  };
  return <Page eyebrow="THOUGHTS → TASKS → TIME" title="Untangle your week." subtitle="Turn notes or selected inbox context into task drafts, then decide what belongs in your plan.">
    {!apiUrl || !supabase ? <Card><Heading>AI setup required</Heading><Body>The optional backend needs Supabase sign-in and an OpenAI API key on the server. Manual tasks and weekly planning already work.</Body></Card> : null}
    <Card><Heading>Inbox sources</Heading><Body>Connected email is never converted into tasks automatically. Load recent message previews into the box first, inspect them, then explicitly send only the text you want to the AI extractor.</Body><Button secondary title={mailBusy === 'google' ? 'Loading Gmail…' : 'Load recent Gmail'} disabled={!!mailBusy || busy || !apiUrl || !supabase} onPress={() => loadMail('google')} /><Button secondary title={mailBusy === 'microsoft' ? 'Loading Outlook…' : 'Load recent Outlook mail'} disabled={!!mailBusy || busy || !apiUrl || !supabase} onPress={() => loadMail('microsoft')} /><Button secondary title="Manage connections" onPress={() => router.push('/connections')} /></Card>
    <Card><Heading>What’s on your mind?</Heading><Field label="Notes or reviewed email text" multiline maxLength={12000} value={text} onChangeText={setText} placeholder="I need to prepare a presentation by Friday, and make time for two workouts…" /><Body>Only the text currently visible in this box is sent to the configured backend and OpenAI when you tap below. Remove private details you do not need to share.</Body><Button title={busy ? 'Creating drafts…' : 'Send text to AI · create drafts'} disabled={busy || !!mailBusy || text.trim().length < 3 || !apiUrl || !supabase} onPress={extract} /></Card>
    {!!message && <Notice text={message} />}
    {drafts.map(task => <Card key={task.id}><Heading>Review task draft</Heading><Field label="Task title" value={task.title} maxLength={160} onChangeText={value => setDrafts(ds => ds.map(d => d.id === task.id ? { ...d, title: value } : d))} /><Field label="Duration (minutes)" keyboardType="number-pad" value={String(task.minutes)} onChangeText={v => setDrafts(ds => ds.map(d => d.id === task.id ? { ...d, minutes: Number(v) } : d))} /><Field label="Deadline (YYYY-MM-DD, optional)" value={task.deadline ?? ''} onChangeText={v => setDrafts(ds => ds.map(d => d.id === task.id ? { ...d, deadline: v || null } : d))} /><Body>{task.category} · Priority {task.priority}/3. Durations and priorities are estimates; check them before adding.</Body><Button title="Approve · add to tasks" onPress={() => { try { validateTask(task); update(st => ({ ...st, tasks: [...st.tasks, task] })); setDrafts(ds => ds.filter(d => d.id !== task.id)); setMessage('Added to Tasks. Generate a weekly proposal to schedule it.'); } catch (e) { setMessage((e as Error).message); } }} /><Button secondary title="Discard" onPress={() => setDrafts(ds => ds.filter(d => d.id !== task.id))} /></Card>)}
    <Card><Heading>Wellpass</Heading><Body>Keep fitness sessions as planner tasks and make the actual class booking/check-in in EGYM Wellpass. Planner AI does not collect Wellpass credentials or scrape the app.</Body></Card>
  </Page>;
}
