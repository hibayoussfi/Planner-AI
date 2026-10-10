import { dateKey, validDate } from './planner';

/** Monday-first, six-row calendar grid. Null entries are placeholders. */
export function monthCells(month: string): (string | null)[] {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Invalid calendar month.');
  const [year, number] = month.split('-').map(Number);
  const first = new Date(year, number - 1, 1);
  const offset = (first.getDay() + 6) % 7;
  const count = new Date(year, number, 0).getDate();
  return Array.from({ length: 42 }, (_, index) => {
    const day = index - offset + 1;
    return day >= 1 && day <= count ? `${month}-${String(day).padStart(2, '0')}` : null;
  });
}

export function shiftMonth(month: string, delta: number): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !Number.isInteger(delta)) throw new Error('Invalid calendar month.');
  const [year, number] = month.split('-').map(Number);
  const next = new Date(year, number - 1 + delta, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}

export function initialMonth(date: string): string {
  return validDate(date) ? date.slice(0, 7) : dateKey().slice(0, 7);
}

export function monthTitle(month: string): string {
  return new Date(`${month}-01T12:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function friendlyDate(date: string): string {
  if (!validDate(date)) return '';
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}
