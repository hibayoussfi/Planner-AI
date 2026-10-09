import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { dateKey } from '../core/planner';
// Sessions intentionally stay in memory in v0.1. Never store email passwords or provider tokens in planner data.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const supabase = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false } }) : null;
export const apiUrl = process.env.EXPO_PUBLIC_API_URL;
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
