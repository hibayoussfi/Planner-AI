import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { dateKey } from '../core/planner';

// Sessions intentionally stay in memory in this development version. Never store email passwords or provider tokens in planner data.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const supabase = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false } }) : null;
export const apiUrl = process.env.EXPO_PUBLIC_API_URL;
export type IntegrationProvider = 'google' | 'microsoft';
export type IntegrationStatus = { provider: IntegrationProvider; configured: boolean; connected: boolean; accountEmail: string | null; updatedAt: string | null };
export type IntegrationEvent = { providerId: string; title: string; allDay: boolean; start: string | null; end: string | null; startDate: string | null; endDate: string | null };

async function authedApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!supabase || !apiUrl) throw new Error('Connections need Planner AI account and backend setup first.');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sign in under Settings before connecting another app.');
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${session.access_token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${apiUrl.replace(/\/$/, '')}${path}`, {
    ...init,
    headers,
    signal: AbortSignal.timeout(45000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Connection request failed. Please try again.');
  return body as T;
}

export async function extractTasks(text: string) {
  if (!supabase || !apiUrl) throw new Error('AI is not configured yet. Add the backend and Supabase settings, or add tasks manually.');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sign in under Settings before using AI.');
  const response = await fetch(`${apiUrl.replace(/\/$/, '')}/v1/extract`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ text, today: dateKey(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
    signal: AbortSignal.timeout(45000),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'AI request failed. Please try again.');
  return body as { tasks: { title: string; minutes: number; priority: 1 | 2 | 3; category: 'work' | 'personal' | 'fitness'; deadline: string | null }[] };
}

export async function listIntegrations() {
  return (await authedApi<{ providers: IntegrationStatus[] }>('/v1/integrations')).providers;
}
export async function beginIntegration(provider: IntegrationProvider) {
  return authedApi<{ authorizeUrl: string }>(`/v1/integrations/${provider}/start`);
}
export async function disconnectIntegration(provider: IntegrationProvider) {
  return authedApi<{ disconnected: boolean }>(`/v1/integrations/${provider}`, { method: 'DELETE' });
}
export async function fetchMailDigest(provider: IntegrationProvider) {
  return authedApi<{ text: string; count: number }>(`/v1/integrations/${provider}/mail`);
}
export async function fetchCalendarEvents(provider: IntegrationProvider, startIso: string, endIso: string) {
  return authedApi<{ events: IntegrationEvent[] }>(`/v1/integrations/${provider}/calendar`, {
    method: 'POST',
    body: JSON.stringify({ startIso, endIso, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
  });
}
