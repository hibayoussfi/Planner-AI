import { defaults, validateBlock, validatePreferences, validateTask } from './planner';
import type { Task, Block, Preferences } from './planner';
export type PlannerState = { version: 1; tasks: Task[]; fixed: Block[]; approved: Block[]; prefs: Preferences };
export const emptyState = (): PlannerState => ({ version: 1, tasks: [], fixed: [], approved: [], prefs: { ...defaults } });
export function decodeState(raw: string): PlannerState {
  const s = JSON.parse(raw);
  if (s.version !== 1 || !Array.isArray(s.tasks) || !Array.isArray(s.fixed) || !Array.isArray(s.approved) || s.tasks.length > 1000 || s.fixed.length > 2000 || s.approved.length > 2000) throw new Error('Unsupported or damaged saved data.');
  s.tasks.forEach(validateTask); s.fixed.forEach(validateBlock); s.approved.forEach(validateBlock); validatePreferences(s.prefs);
  if (s.fixed.some((b: Block) => b.kind !== 'fixed') || s.approved.some((b: Block) => b.kind !== 'task') || new Set(s.tasks.map((t: Task) => t.id)).size !== s.tasks.length) throw new Error('Inconsistent saved planner data.');
  return s;
}
