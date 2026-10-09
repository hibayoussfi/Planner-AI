export type Category = 'work' | 'personal' | 'fitness';
export type Task = {
  id: string; title: string; minutes: number; priority: 1 | 2 | 3;
  deadline: string | null; category: Category; done: boolean;
};
export type Block = {
  id: string; title: string; date: string; start: number; end: number;
  kind: 'fixed' | 'task'; taskId?: string; category: Category;
};
export type Preferences = { start: number; end: number; buffer: number; dailyBudget: number; weekends: boolean };
export type Plan = { blocks: Block[]; unscheduled: { task: Task; reason: string }[]; warnings: string[] };
export const defaults: Preferences = { start: 9 * 60, end: 20 * 60, buffer: 15, dailyBudget: 240, weekends: true };

export function dateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && dateKey(new Date(`${value}T12:00:00`)) === value;
}
export function addDays(value: string, amount: number): string {
  const d = new Date(`${value}T12:00:00`); d.setDate(d.getDate() + amount); return dateKey(d);
}
export function monday(value = dateKey()): string {
  const day = new Date(`${value}T12:00:00`).getDay(); return addDays(value, -((day + 6) % 7));
}
export const clock = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
export function parseTime(value: string): number {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error('Use a time such as 09:30.');
  const [h, m] = value.split(':').map(Number); return h * 60 + m;
}
export function validateTask(t: Task): void {
  if (!t.id || !t.title.trim() || t.title.length > 160) throw new Error('Add a title of 1–160 characters.');
  if (!Number.isInteger(t.minutes) || t.minutes < 15 || t.minutes > 480) throw new Error('Duration must be 15–480 minutes.');
  if (![1, 2, 3].includes(t.priority) || !['work', 'personal', 'fitness'].includes(t.category) || typeof t.done !== 'boolean') throw new Error('Invalid task.');
  if (t.deadline !== null && !validDate(t.deadline)) throw new Error('Use a valid deadline: YYYY-MM-DD.');
}
export function validateBlock(b: Block): void {
  if (!b.id || !b.title.trim() || b.title.length > 160 || !validDate(b.date) || !Number.isInteger(b.start) || !Number.isInteger(b.end) || b.start < 0 || b.end > 1440 || b.end <= b.start || !['fixed', 'task'].includes(b.kind) || !['work', 'personal', 'fitness'].includes(b.category)) throw new Error('Check the appointment title, date and start/end times.');
}
export function validatePreferences(p: Preferences): void {
  if (![p.start, p.end, p.buffer, p.dailyBudget].every(Number.isInteger) || p.start < 0 || p.end > 1440 || p.start >= p.end || p.buffer < 0 || p.buffer > 120 || p.dailyBudget < 15 || p.dailyBudget > 720 || typeof p.weekends !== 'boolean') throw new Error('Check your planning hours, buffer (0–120 min) and daily budget (15–720 min).');
}

/** Pure, deterministic scheduler. Dates and minutes are wall-clock values in the device timezone. */
export function proposePlan(tasks: Task[], fixed: Block[], week: string, prefs: Preferences, now = new Date()): Plan {
  validatePreferences(prefs);
  if (!validDate(week) || monday(week) !== week) throw new Error('The week must start on Monday.');
  tasks.forEach(validateTask); fixed.forEach(validateBlock);
  if (new Set(tasks.map(t => t.id)).size !== tasks.length) throw new Error('Duplicate task IDs.');
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const blocks = fixed.filter(b => b.kind === 'fixed' && days.includes(b.date)).map(b => ({ ...b }));
  const warnings: string[] = [];
  for (let i = 0; i < blocks.length; i++) for (let j = i + 1; j < blocks.length; j++) {
    const a = blocks[i], b = blocks[j];
    if (a.date === b.date && a.start < b.end && b.start < a.end) warnings.push(`Fixed appointments overlap on ${a.date}: ${a.title} / ${b.title}.`);
  }
  const pending = tasks.filter(t => !t.done).sort((a, b) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999') || b.priority - a.priority || a.id.localeCompare(b.id));
  const unscheduled: Plan['unscheduled'] = [];
  const today = dateKey(now), currentMinute = now.getHours() * 60 + now.getMinutes() + (now.getSeconds() ? 1 : 0);
  for (const task of pending) {
    let placed = false;
    for (const day of days) {
      const weekday = new Date(`${day}T12:00:00`).getDay();
      if (day < today || (task.deadline && day > task.deadline) || (!prefs.weekends && [0, 6].includes(weekday))) continue;
      const busy = blocks.filter(b => b.date === day);
      if (busy.filter(b => b.kind === 'task').reduce((n, b) => n + b.end - b.start, 0) + task.minutes > prefs.dailyBudget) continue;
      // Spread workouts over the week; fixed fitness appointments count as a workout too.
      if (task.category === 'fitness' && busy.some(b => b.category === 'fitness')) continue;
      const earliest = Math.max(prefs.start, day === today ? currentMinute : 0);
      for (let start = Math.ceil(earliest / 15) * 15; start + task.minutes <= prefs.end; start += 15) {
        const end = start + task.minutes;
        if (busy.some(b => start < b.end + prefs.buffer && end + prefs.buffer > b.start)) continue;
        blocks.push({ id: `plan-${task.id}-${day}`, title: task.title, taskId: task.id, date: day, start, end, category: task.category, kind: 'task' });
        placed = true; break;
      }
      if (placed) break;
    }
    if (!placed) unscheduled.push({ task, reason: task.deadline && task.deadline < today ? 'Deadline has passed. Choose a new deadline.' : 'No available slot before the deadline within your hours, buffers and daily budget.' });
  }
  return { blocks: blocks.sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start), unscheduled, warnings };
}
