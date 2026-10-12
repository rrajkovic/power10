import type { Database } from './database.types';
import { addDays } from './progress';

// How far back athletes may log a workout, or change one. Each team sets its
// own; admins are never limited. The database enforces this (see
// supabase/migrations/*_edit_rules_and_time_windows.sql); the app uses the
// same rules so it can explain them instead of showing an error.

export type TimeWindow = Database['public']['Enums']['time_window'];
export type WindowSetting = { window: TimeWindow; days: number | null };

// The oldest day still inside the window, or null if there's no limit.
// Dates are 'YYYY-MM-DD'; `today` is today in the team's time zone.
export function earliestAllowed(setting: WindowSetting, today: string): string | null {
  if (setting.window === 'forever') return null;
  if (setting.window === 'days') return addDays(today, -(setting.days ?? 0));
  const [y, m, d] = today.split('-').map(Number);
  if (setting.window === 'month') return `${today.slice(0, 8)}01`;
  // This week's Monday. getDay(): Sunday = 0, Monday = 1, …
  const weekday = new Date(y, m - 1, d).getDay();
  return addDays(today, -((weekday + 6) % 7));
}

export function isInWindow(setting: WindowSetting, today: string, day: string): boolean {
  const earliest = earliestAllowed(setting, today);
  // ISO dates compare correctly as text.
  return earliest === null || day >= earliest;
}

// "any time", "this week only", "today and the 3 days before".
export function describeWindow(setting: WindowSetting): string {
  if (setting.window === 'forever') return 'any time';
  if (setting.window === 'week') return 'this week only';
  if (setting.window === 'month') return 'this month only';
  const days = setting.days ?? 0;
  if (days === 0) return 'the same day only';
  return days === 1 ? 'today and the day before' : `today and the ${days} days before`;
}
