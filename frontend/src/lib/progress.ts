import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { Database } from './database.types';
import { supabase } from './supabase';

// Data for goal cards and the leaderboard, from the database functions in
// supabase/migrations/*_create_progress_functions.sql. Dates are 'YYYY-MM-DD'
// strings; `day` null means "the period containing today".

export type PeriodKind = Database['public']['Enums']['period_kind'];
export type Metric = 'credits' | 'minutes' | 'distance';

type Functions = Database['public']['Functions'];
export type TeamPeriod = Functions['team_period']['Returns'][number];
export type LeaderboardRow = Functions['leaderboard']['Returns'][number];
export type TypeProgress = Functions['my_type_progress']['Returns'][number];
export type TargetSummary = Functions['target_summary']['Returns'][number];

// Every progress query starts with this key, so pull-to-refresh can reload
// them all at once.
export const progressKey = ['progress'] as const;

export function useTeamPeriod(teamId: string | undefined, kind: PeriodKind, day: string | null) {
  return useQuery({
    queryKey: [...progressKey, 'team_period', teamId, kind, day],
    // Keep showing the previous period while the next one loads, so the
    // list doesn't collapse (and the page doesn't jump).
    placeholderData: keepPreviousData,
    enabled: !!teamId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('team_period', {
        team: teamId!,
        kind,
        day: day ?? undefined,
      });
      if (error) throw error;
      return data[0] ?? null;
    },
  });
}

export function useLeaderboard(teamId: string | undefined, kind: PeriodKind, day: string | null) {
  return useQuery({
    queryKey: [...progressKey, 'leaderboard', teamId, kind, day],
    // Keep showing the previous period while the next one loads, so the
    // list doesn't collapse (and the page doesn't jump).
    placeholderData: keepPreviousData,
    enabled: !!teamId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('leaderboard', {
        team: teamId!,
        kind,
        day: day ?? undefined,
      });
      if (error) throw error;
      return data;
    },
  });
}

export function useMyTypeProgress(teamId: string | undefined) {
  return useQuery({
    queryKey: [...progressKey, 'my_type_progress', teamId],
    enabled: !!teamId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_type_progress', { team: teamId! });
      if (error) throw error;
      return data;
    },
  });
}

export function useTargetSummary(teamId: string | undefined, day: string | null = null) {
  return useQuery({
    queryKey: [...progressKey, 'target_summary', teamId, day],
    enabled: !!teamId,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('target_summary', {
        team: teamId!,
        day: day ?? undefined,
      });
      if (error) throw error;
      return data[0] ?? null;
    },
  });
}

// Who missed the target (or hasn't hit it yet). Coaches and admins only:
// pass enabled = false for everyone else.
export function useMissedTarget(teamId: string | undefined, day: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...progressKey, 'missed_target', teamId, day],
    enabled: !!teamId && enabled,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('missed_target', {
        team: teamId!,
        day: day ?? undefined,
      });
      if (error) throw error;
      return data;
    },
  });
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

// '2026-10-06' → Date at local midnight (avoids time-zone day shifts).
function toDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, days: number): string {
  const date = toDate(iso);
  date.setDate(date.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const monthDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const monthYear = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
const shortMonthYear = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' });

// "Oct 6 – 12", "Sep 29 – Oct 5", "October 2026", "Oct 2026 – Oct 2027".
export function periodLabel(kind: PeriodKind, start: string, end: string): string {
  const a = toDate(start);
  const b = toDate(end);
  if (kind === 'month') return monthYear.format(a);
  if (kind === 'season') return `${shortMonthYear.format(a)} – ${shortMonthYear.format(b)}`;
  return a.getMonth() === b.getMonth()
    ? `${monthDay.format(a)} – ${b.getDate()}`
    : `${monthDay.format(a)} – ${monthDay.format(b)}`;
}

// Credits always have one decimal; minutes and kilometers are rounded.
export function formatMetric(metric: Metric, value: number): string {
  if (metric === 'credits') return value.toFixed(1);
  if (metric === 'minutes') return `${Math.round(value)} min`;
  return `${(value / 1000).toFixed(1)} km`;
}

export function metricValue(row: LeaderboardRow, metric: Metric): number {
  if (metric === 'credits') return row.credits;
  if (metric === 'minutes') return row.minutes;
  return row.distance_meters;
}
