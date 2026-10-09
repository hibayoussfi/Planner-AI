import { useEffect, useState } from 'react';
import { Switch } from 'react-native';
import { router } from 'expo-router';
import { Body, Button, Card, Field, Heading, Notice, Page } from '../components/ui';
import { clock, parseTime, validatePreferences } from '../core/planner';
import { decodeState } from '../core/storage';
import { supabase } from '../state/cloud';
import { usePlanner } from '../state/PlannerProvider';
export default function Settings() {
  const { state, update, reset } = usePlanner();
  type Form = { start: string; end: string; buffer: string; budget: string; weekends: boolean };
  const [form, setForm] = useState<Form | null>(null);
  const values = form ?? { start: clock(state.prefs.start), end: clock(state.prefs.end), buffer: String(state.prefs.buffer), budget: String(state.prefs.dailyBudget), weekends: state.prefs.weekends };
  const { start, end, buffer, budget, weekends } = values;
  const setStart = (start: string) => setForm({ ...values, start });
  const setEnd = (end: string) => setForm({ ...values, end });
  const setBuffer = (buffer: string) => setForm({ ...values, buffer });
  const setBudget = (budget: string) => setForm({ ...values, budget });
  const setWeekends = (weekends: boolean) => setForm({ ...values, weekends });
  const [message, setMessage] = useState(''), [email, setEmail] = useState(''), [password, setPassword] = useState(''), [signedIn, setSignedIn] = useState('');
  const [busy, setBusy] = useState(false), [confirm, setConfirm] = useState<'reset' | 'restore' | null>(null);
  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(session?.user.email ?? ''));
    supabase.auth.getSession().then(({ data }) => setSignedIn(data.session?.user.email ?? ''));
    return () => subscription.unsubscribe();
  }, []);
  const run = async (fn: () => Promise<void>) => { setBusy(true); setMessage(''); try { await fn(); } catch (e) { setMessage((e as Error).message); } finally { setBusy(false); } };
  const authenticate = (signup: boolean) => run(async () => {
    if (!supabase) return;
    const { error } = signup ? await supabase.auth.signUp({ email: email.trim(), password }) : await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error; setPassword(''); setMessage(signup ? 'Account created. If confirmation is enabled, check your email, confirm, then sign in here.' : 'Signed in. Local planner data stays on this device until you save a backup.');
  });
  const backup = () => run(async () => {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser(); if (!user) throw new Error('Sign in first.');
    const { error } = await supabase.from('planner_backups').insert({ user_id: user.id, payload: state });
    if (error) throw error; setMessage('A new cloud backup was saved. Previous backups were preserved.');
  });
  const restore = () => run(async () => {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser(); if (!user) throw new Error('Sign in first.');
    const { data, error } = await supabase.from('planner_backups').select('payload').eq('user_id', user.id).order('id', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error; if (!data) throw new Error('No cloud backup found.');
    const next = decodeState(JSON.stringify(data.payload)); update(() => next); setForm(null); setConfirm(null); setMessage('Latest backup restored on this device.');
  });
  return <Page eyebrow="BUILT AROUND YOU" title="Your boundaries." subtitle="A useful plan needs limits. Decide how much of your day you want to fill.">
    {!!message && <Notice text={message} />}
    <Card><Heading>Planning preferences</Heading><Field label="Earliest start (HH:MM)" value={start} onChangeText={setStart} /><Field label="Latest finish (HH:MM)" value={end} onChangeText={setEnd} /><Field label="Buffer between blocks (minutes)" value={buffer} onChangeText={setBuffer} keyboardType="number-pad" /><Field label="Maximum flexible task minutes per day" value={budget} onChangeText={setBudget} keyboardType="number-pad" /><Body>Allow tasks on weekends</Body><Switch accessibilityLabel="Allow tasks on weekends" value={weekends} onValueChange={setWeekends} /><Button title="Save preferences" onPress={() => { try { const prefs = { start: parseTime(start), end: parseTime(end), buffer: Number(buffer), dailyBudget: Number(budget), weekends }; validatePreferences(prefs); update(st => ({ ...st, prefs })); setForm(null); setMessage('Preferences saved. Regenerate your week to use them.'); } catch (e) { setMessage((e as Error).message); } }} /><Body>Times follow this device’s timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}. Fixed appointments and breaks are outside the flexible-task budget. Existing plans stay unchanged until you regenerate them.</Body></Card>
    <Card><Heading>{signedIn ? `Account · ${signedIn}` : 'Optional account'}</Heading>{!supabase ? <Body>Supabase is not configured. All planning works locally; cloud backup and AI require setup described in the README.</Body> : signedIn ? <><Body>Backups contain task titles, appointments and preferences. They are sent only when you save a backup. This is manual backup, not automatic sync.</Body><Button title="Save a cloud backup" onPress={backup} disabled={busy} /><Button secondary title="Restore latest backup…" onPress={() => setConfirm('restore')} disabled={busy} /><Button secondary title="Sign out" disabled={busy} onPress={() => run(async () => { const { error } = await supabase!.auth.signOut(); if (error) throw error; setMessage('Signed out. Local planner data remains; reset it before sharing this device.'); })} /></> : <><Field label="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} /><Field label="Password" secureTextEntry value={password} onChangeText={setPassword} /><Button title="Sign in" disabled={busy || !email || !password} onPress={() => authenticate(false)} /><Button secondary title="Create account" disabled={busy || !email || password.length < 8} onPress={() => authenticate(true)} /><Body>Use at least 8 characters. Sessions are not saved between app restarts in this version.</Body></>}</Card>
    <Card><Heading>Connections</Heading><Body>Connect Google for Gmail + Google Calendar, or Microsoft for Outlook Mail + Outlook Calendar. Provider access is read-only in this version and is managed separately from your Planner AI sign-in.</Body><Button title="Manage app connections" onPress={() => router.push('/connections')} /><Body>EGYM Wellpass remains manual until an approved member-facing API path is available.</Body></Card>
    <Card><Heading>Your data</Heading><Body>Tasks and appointments are saved in local app storage, which is not encrypted by this app. Pasted AI source text is not saved in the planner. Reset removes local tasks, appointments and preferences; cloud backups remain.</Body><Button secondary title="Reset local planner…" onPress={() => setConfirm('reset')} /></Card>
    {confirm && <Card><Heading>{confirm === 'reset' ? 'Remove all local planner data?' : 'Replace local data with your latest backup?'}</Heading><Body>This will replace your current tasks, appointments, approved plans and preferences on this device.</Body><Button title={confirm === 'reset' ? 'Yes, reset local data' : 'Yes, restore latest backup'} disabled={busy} onPress={confirm === 'reset' ? () => run(async () => { await reset(); setForm(null); setConfirm(null); setMessage('Local planner reset.'); }) : restore} /><Button secondary title="Cancel" onPress={() => setConfirm(null)} /></Card>}
  </Page>;
}
