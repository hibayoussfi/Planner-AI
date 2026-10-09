import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { decodeState, emptyState, type PlannerState } from '../core/storage';
const KEY = 'planner-ai.local.v1';
type Context = { state: PlannerState; ready: boolean; error: string; update: (fn: (s: PlannerState) => PlannerState) => void; reset: () => Promise<void> };
const PlannerContext = createContext<Context | null>(null);
export function PlannerProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState(emptyState), [ready, setReady] = useState(false), [error, setError] = useState('');
  const writable = useRef(false), writes = useRef(Promise.resolve());
  useEffect(() => {
    AsyncStorage.getItem(KEY).then(raw => { if (raw) setState(decodeState(raw)); writable.current = true; })
      .catch(() => setError('Saved data could not be loaded. It has not been overwritten. Reset local data in Settings to start again.'))
      .finally(() => setReady(true));
  }, []);
  useEffect(() => {
    if (!ready || !writable.current) return;
    writes.current = writes.current.then(() => AsyncStorage.setItem(KEY, JSON.stringify(state)))
      .catch(() => setError('Changes could not be saved on this device. Keep the app open and try again.'));
  }, [state, ready]);
  const update = (fn: (s: PlannerState) => PlannerState) => {
    if (!ready || !writable.current) return;
    setState(s => decodeState(JSON.stringify(fn(s))));
  };
  const reset = async () => {
    await writes.current; await AsyncStorage.removeItem(KEY);
    writable.current = true; setState(emptyState()); setError('');
  };
  return <PlannerContext.Provider value={{ state, ready, error, update, reset }}>{children}</PlannerContext.Provider>;
}
export function usePlanner() { const ctx = useContext(PlannerContext); if (!ctx) throw new Error('PlannerProvider missing'); return ctx; }
