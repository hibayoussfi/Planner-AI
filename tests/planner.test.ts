import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, dateKey, defaults, monday, parseTime, proposePlan, validDate, type Task, type Block } from '../src/core/planner';
import { decodeState, emptyState } from '../src/core/storage';
const week = '2026-10-12', now = new Date('2026-10-12T08:00:00');
const task = (id: string, overrides: Partial<Task> = {}): Task => ({ id, title: id, minutes: 60, priority: 2, deadline: null, category: 'work', done: false, ...overrides });
const fixed: Block = { id: 'meeting', title: 'Meeting', date: week, start: 600, end: 660, kind: 'fixed', category: 'work' };
test('preserves fixed events and reserves buffers before/after them', () => {
  const original = structuredClone(fixed);
  const plan = proposePlan([task('a'), task('b')], [fixed], week, defaults, now);
  assert.deepEqual(fixed, original); assert.deepEqual(plan.blocks.find(b => b.id === fixed.id), fixed);
  const planned = plan.blocks.filter(b => b.kind === 'task');
  assert.equal(planned[0].start, 675); assert.equal(planned[1].start, 750);
});
test('prioritises nearer deadlines, then priority and avoids completed tasks', () => {
  const plan = proposePlan([task('low', { priority: 1 }), task('high', { priority: 3 }), task('due', { deadline: week }), task('done', { done: true })], [], week, defaults, now);
  assert.deepEqual(plan.blocks.map(b => b.taskId), ['due', 'high', 'low']);
});
test('reports overload and expired deadlines without violating daily limits', () => {
  const plan = proposePlan([task('a', { deadline: week }), task('b', { deadline: week }), task('expired', { deadline: '2026-10-11' })], [], week, { ...defaults, dailyBudget: 60 }, now);
  assert.equal(plan.blocks.length, 1); assert.equal(plan.unscheduled.length, 2); assert.match(plan.unscheduled[0].reason, /passed/);
});
test('does not place tasks in past time or on disabled weekends', () => {
  const plan = proposePlan([task('a'), task('b')], [], week, { ...defaults, dailyBudget: 60, weekends: false }, new Date('2026-10-16T18:37:00'));
  assert.equal(plan.blocks[0].date, '2026-10-16'); assert.equal(plan.blocks[0].start, 1125); assert.equal(plan.unscheduled.length, 1);
});
test('spreads fitness sessions across different days', () => {
  const plan = proposePlan([task('gym1', { category: 'fitness' }), task('gym2', { category: 'fitness' })], [], week, defaults, now);
  assert.equal(new Set(plan.blocks.map(b => b.date)).size, 2);
});
test('flags fixed overlaps, never moves them', () => {
  const second = { ...fixed, id: 'other', start: 630, end: 690 };
  const plan = proposePlan([], [fixed, second], week, defaults, now);
  assert.equal(plan.warnings.length, 1); assert.deepEqual(plan.blocks, [fixed, second]);
});
test('rejects malformed inputs and duplicate IDs', () => {
  assert.throws(() => proposePlan([task('a', { minutes: -5 })], [], week, defaults, now));
  assert.throws(() => proposePlan([task('a'), task('a')], [], week, defaults, now));
  assert.throws(() => proposePlan([], [], week, { ...defaults, start: 800, end: 700 }, now));
  assert.throws(() => proposePlan([], [], '2026-10-13', defaults, now));
  assert.throws(() => parseTime('25:00')); assert.equal(validDate('2026-02-30'), false);
});
test('calendar dates stay stable across month/year and DST boundaries', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-10-24', 2), '2026-10-26');
  assert.equal(monday('2026-10-25'), '2026-10-19');
  assert.equal(dateKey(new Date('2026-10-25T12:00:00')), '2026-10-25');
});
test('restores valid state and refuses damaged or future versions', () => {
  assert.deepEqual(decodeState(JSON.stringify(emptyState())), emptyState());
  assert.throws(() => decodeState('{broken'));
  assert.throws(() => decodeState(JSON.stringify({ ...emptyState(), version: 2 })));
  assert.throws(() => decodeState(JSON.stringify({ ...emptyState(), tasks: [task('bad', { minutes: 0 })] })));
});
test('many tasks preserve no-overlap, buffer, budget and deadline invariants', () => {
  const tasks = Array.from({ length: 80 }, (_, i) => task(String(i), { minutes: 15 + (i % 8) * 15, deadline: addDays(week, i % 7) }));
  const plan = proposePlan(tasks, [fixed], week, defaults, now);
  assert.equal(plan.blocks.filter(b => b.kind === 'task').length + plan.unscheduled.length, tasks.length);
  for (let day = 0; day < 7; day++) {
    const blocks = plan.blocks.filter(b => b.date === addDays(week, day));
    assert.ok(blocks.filter(b => b.kind === 'task').reduce((n, b) => n + b.end - b.start, 0) <= defaults.dailyBudget);
    for (let i = 1; i < blocks.length; i++) assert.ok(blocks[i].start >= blocks[i - 1].end + defaults.buffer);
    for (const b of blocks.filter(b => b.kind === 'task')) { assert.ok(b.start >= defaults.start && b.end <= defaults.end); assert.ok(b.date <= tasks.find(t => t.id === b.taskId)!.deadline!); }
  }
});
