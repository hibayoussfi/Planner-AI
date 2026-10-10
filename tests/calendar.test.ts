import assert from 'node:assert/strict';
import { test } from 'node:test';
import { monthCells, shiftMonth, initialMonth } from '../src/core/calendar';

test('month cells start on Monday and include February leap day', () => {
  const days = monthCells('2028-02');
  assert.equal(days.length, 42);
  assert.equal(days[0], null);
  assert.equal(days[1], '2028-02-01');
  assert.equal(days[29], '2028-02-29');
  assert.equal(days[30], null);
  assert.equal(days.filter(Boolean).length, 29);
});

test('month navigation wraps years correctly', () => {
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
  assert.equal(shiftMonth('2026-04', 12), '2027-04');
});

test('calendar starts at selected date and rejects invalid months', () => {
  assert.equal(initialMonth('2026-10-16'), '2026-10');
  assert.throws(() => monthCells('2026-13'));
  assert.throws(() => shiftMonth('2026-00', 1));
});
