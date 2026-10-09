import { useEffect, useState } from 'react';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { Body, Button, Card, Heading, Notice, Page } from '../components/ui';
import { addDays, dateKey, type Block } from '../core/planner';
import { beginIntegration, disconnectIntegration, fetchCalendarEvents, listIntegrations, type IntegrationEvent, type IntegrationProvider, type IntegrationStatus } from '../state/cloud';
import { usePlanner } from '../state/PlannerProvider';

function eventBlocks(provider: IntegrationProvider, events: IntegrationEvent[]): Block[] {
  const blocks: Block[] = [];
  const title = (value: string) => (value.trim() || 'Busy').slice(0, 160);
  for (const event of events) {
    if (event.allDay && event.startDate && event.endDate) {
      for (let day = event.startDate; day < event.endDate; day = addDays(day, 1)) {
        blocks.push({ id: `ext-${provider}-${event.providerId}-${day}`, title: title(event.title), date: day, start: 0, end: 1440, kind: 'fixed', category: 'personal' });
      }
      continue;
    }
    if (!event.start || !event.end) continue;
    const start = new Date(event.start), end = new Date(event.end);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) continue;
    const startDay = dateKey(start), lastDay = dateKey(new Date(end.getTime() - 1));
    for (let day = startDay; day <= lastDay; day = addDays(day, 1)) {
      const startMinute = day === startDay ? start.getHours() * 60 + start.getMinutes() : 0;
      const endDay = dateKey(end);
      const endMinute = day === endDay ? end.getHours() * 60 + end.getMinutes() : 1440;
      if (endMinute > startMinute) blocks.push({ id: `ext-${provider}-${event.providerId}-${day}`, title: title(event.title), date: day, start: startMinute, end: endMinute, kind: 'fixed', category: 'personal' });
    }
  }
  return blocks;
}

export default function Connections() {
  const { update } = usePlanner();
  const params = useLocalSearchParams<{ connected?: string; error?: string; provider?: string }>();
  const [statuses, setStatuses] = useState<IntegrationStatus[]>([]);
  const [busy, setBusy] = useState<string>(''), [message, setMessage] = useState('');

  const refresh = async () => {
    setBusy('refresh'); setMessage('');
    try { setStatuses(await listIntegrations()); } catch (e) { setMessage((e as Error).message); } finally { setBusy(''); }
  };
  useEffect(() => { refresh(); }, []);
  useEffect(() => {
    if (params.connected) { setMessage(`${params.connected === 'google' ? 'Google' : 'Microsoft'} connected. You can now import calendar events or load recent email in AI.`); refresh(); }
    if (params.error) setMessage(`Connection was not completed: ${params.error}`);
  }, [params.connected, params.error]);

  const connect = async (provider: IntegrationProvider) => {
    setBusy(provider); setMessage('');
    try {
      const { authorizeUrl } = await beginIntegration(provider);
      await Linking.openURL(authorizeUrl);
    } catch (e) { setMessage((e as Error).message); setBusy(''); }
  };
  const disconnect = async (provider: IntegrationProvider) => {
    setBusy(provider); setMessage('');
    try { await disconnectIntegration(provider); await refresh(); setMessage('Connection removed from Planner AI.'); } catch (e) { setMessage((e as Error).message); } finally { setBusy(''); }
  };
  const importCalendar = async (provider: IntegrationProvider) => {
    setBusy(`${provider}-calendar`); setMessage('');
    try {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const end = new Date(start); end.setDate(end.getDate() + 14);
      const { events } = await fetchCalendarEvents(provider, start.toISOString(), end.toISOString());
      const blocks = eventBlocks(provider, events);
      const from = dateKey(start), until = dateKey(end), prefix = `ext-${provider}-`;
      update(st => ({ ...st, fixed: [...st.fixed.filter(b => !(b.id.startsWith(prefix) && b.date >= from && b.date < until)), ...blocks] }));
      setMessage(`Imported ${events.length} calendar event${events.length === 1 ? '' : 's'} for the next 14 days. Regenerate affected weeks so flexible tasks avoid them.`);
    } catch (e) { setMessage((e as Error).message); } finally { setBusy(''); }
  };

  const status = (provider: IntegrationProvider) => statuses.find(x => x.provider === provider);
  const providerCard = (provider: IntegrationProvider, name: string, services: string) => {
    const item = status(provider);
    return <Card key={provider}>
      <Heading>{name}</Heading>
      <Body>{services}</Body>
      <Body>{item?.connected ? `Connected${item.accountEmail ? ` · ${item.accountEmail}` : ''}` : item?.configured ? 'Ready to connect' : 'Server setup required'}</Body>
      {item?.connected
        ? <><Button title={busy === `${provider}-calendar` ? 'Importing…' : 'Import next 14 days of calendar'} disabled={!!busy} onPress={() => importCalendar(provider)} /><Button secondary title="Disconnect" disabled={!!busy} onPress={() => disconnect(provider)} /></>
        : <Button title={busy === provider ? 'Opening sign-in…' : `Connect ${name}`} disabled={!!busy || item?.configured === false} onPress={() => connect(provider)} />}
      {provider === 'google' && <Body>Google permission covers read-only Calendar plus Gmail reading. Gmail access uses a restricted Google scope, so a public release needs Google’s verification/security requirements.</Body>}
      {provider === 'microsoft' && <Body>Microsoft permission is delegated and read-only for Outlook mail and calendar. Planner AI does not get your Microsoft password.</Body>}
    </Card>;
  };

  return <Page eyebrow="YOUR DATA SOURCES" title="Connections." subtitle="Bring fixed commitments and actionable messages into one planning workflow without handing Planner AI your account passwords.">
    {!!message && <Notice text={message} danger={Boolean(params.error)} />}
    {providerCard('google', 'Google', 'Gmail · Google Calendar')}
    {providerCard('microsoft', 'Microsoft', 'Outlook Mail · Outlook Calendar')}
    <Card><Heading>EGYM Wellpass</Heading><Body>Direct member scheduling is not enabled. EGYM’s published Wellpass APIs are partner-oriented, so Planner AI will not ask for or scrape your Wellpass credentials. Keep workout time in the planner and complete booking/check-in in Wellpass until an approved member integration is available.</Body><Button secondary title="Add a fitness task" onPress={() => router.push('/tasks')} /></Card>
    <Card><Heading>Control</Heading><Body>Calendar imports become fixed blocks. Email is not imported automatically: in AI, you explicitly load recent messages into the review box, then decide whether to send that text to the AI extractor.</Body><Button secondary title={busy === 'refresh' ? 'Refreshing…' : 'Refresh connection status'} disabled={!!busy} onPress={refresh} /><Button secondary title="Back to settings" onPress={() => router.push('/settings')} /></Card>
  </Page>;
}
