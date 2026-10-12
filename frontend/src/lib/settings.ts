import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Database } from './database.types';
import { todayInTimeZone } from './logging';
import { addDays, progressKey } from './progress';
import { supabase } from './supabase';
import { useTeams, type MyTeam } from './teams';

// Team settings: what admins can change about how their team works.
//
// Every write goes straight to the tables. Row-level security only lets
// admins change them, and only the columns that are meant to be editable.

type Tables = Database['public']['Tables'];
export type ActivityType = Tables['activity_types']['Row'];
export type Intensity = Tables['intensities']['Row'];
export type CreditRule = Tables['credit_rules']['Row'];
export type Season = Tables['seasons']['Row'];
export type Target = Tables['targets']['Row'];
export type TargetOverride = Tables['target_overrides']['Row'];
export type RuleKind = Database['public']['Enums']['credit_rule_kind'];

const setupKey = ['team_setup'] as const;

// Everything the settings screen shows, in one go.
export function useTeamSetup(team: MyTeam | null) {
  return useQuery({
    queryKey: [...setupKey, team?.id],
    enabled: !!team,
    queryFn: async () => {
      const teamId = team!.id;
      const [types, intensities, rules, seasons] = await Promise.all([
        supabase
          .from('activity_types')
          .select('*')
          .eq('team_id', teamId)
          .is('archived_at', null)
          .order('sort_order'),
        supabase
          .from('intensities')
          .select('*')
          .eq('team_id', teamId)
          .is('archived_at', null)
          .order('sort_order'),
        supabase.from('credit_rules').select('*').eq('team_id', teamId),
        supabase.from('seasons').select('*').eq('team_id', teamId).order('start_date', { ascending: false }),
      ]);
      const error = types.error ?? intensities.error ?? rules.error ?? seasons.error;
      if (error) throw error;

      // The season that contains today, otherwise the most recent one.
      const today = todayInTimeZone(team!.timeZone);
      const season =
        seasons.data!.find((s) => s.start_date <= today && today <= s.end_date) ??
        seasons.data![0] ??
        null;

      let targets: Target[] = [];
      // Special weeks (taper, race, …): a different target for one period.
      let overrides: TargetOverride[] = [];
      if (season) {
        const [found, special] = await Promise.all([
          supabase.from('targets').select('*').eq('season_id', season.id),
          supabase.from('target_overrides').select('*').eq('season_id', season.id),
        ]);
        if (found.error ?? special.error) throw found.error ?? special.error;
        targets = found.data!;
        overrides = special.data!;
      }

      return {
        types: types.data!,
        intensities: intensities.data!,
        rules: rules.data!,
        season,
        targets,
        overrides,
      };
    },
  });
}

// After a change: reload the settings, the logging form's options, and every
// total (targets and credit rules change what the cards show). Team-level
// fields (name, colors, …) live in the teams list, so that reloads too.
function useAfterChange() {
  const queryClient = useQueryClient();
  const { refresh } = useTeams();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: setupKey }),
      queryClient.invalidateQueries({ queryKey: ['logging_options'] }),
      queryClient.invalidateQueries({ queryKey: progressKey }),
      refresh(),
    ]);
  };
}

// Turns a database error into something a person can act on.
function friendly(error: { code?: string; message: string }): Error {
  if (error.code === '23505') return new Error('That name is already in use');
  if (error.code === '23514') return new Error('That value isn’t allowed');
  return new Error(error.message);
}

// One hook for all the small saves on the settings screen. `run` does the
// write; the lists reload afterwards.
export function useSettingsChange() {
  const afterChange = useAfterChange();
  return useMutation({
    mutationFn: async (run: () => PromiseLike<{ error: { code?: string; message: string } | null }>) => {
      const { error } = await run();
      if (error) throw friendly(error);
    },
    onSuccess: afterChange,
  });
}

// ---------------------------------------------------------------------------
// The writes. Each returns the query to run, for useSettingsChange.
// ---------------------------------------------------------------------------

export const teamWrites = {
  update: (teamId: string, changes: Tables['teams']['Update']) => () =>
    supabase.from('teams').update(changes).eq('id', teamId),
};

export const activityWrites = {
  add: (teamId: string, name: string, sortOrder: number) => async () => {
    // A new activity starts with the usual rule, so it's worth something
    // straight away: 1 credit per 10 minutes.
    const created = await supabase
      .from('activity_types')
      .insert({ team_id: teamId, name: name.trim(), sort_order: sortOrder })
      .select('id')
      .single();
    if (created.error) return { error: created.error };
    return supabase.from('credit_rules').insert({
      team_id: teamId,
      activity_type_id: created.data.id,
      kind: 'per_time',
      credits: 1,
      per_minutes: 10,
    });
  },
  rename: (id: string, name: string) => () =>
    supabase.from('activity_types').update({ name: name.trim() }).eq('id', id),
  setRequiresPhoto: (id: string, requiresPhoto: boolean) => () =>
    supabase.from('activity_types').update({ requires_photo: requiresPhoto }).eq('id', id),
  // "Deleting" hides it from the logging form; old workouts keep it.
  archive: (id: string) => () =>
    supabase.from('activity_types').update({ archived_at: new Date().toISOString() }).eq('id', id),
};

export const intensityWrites = {
  add: (teamId: string, name: string, sortOrder: number) => () =>
    supabase.from('intensities').insert({ team_id: teamId, name: name.trim(), sort_order: sortOrder }),
  rename: (id: string, name: string) => () =>
    supabase.from('intensities').update({ name: name.trim() }).eq('id', id),
  archive: (id: string) => () =>
    supabase.from('intensities').update({ archived_at: new Date().toISOString() }).eq('id', id),
};

export type RuleValues = {
  kind: RuleKind;
  credits: number;
  perMinutes: number | null;
  perMeters: number | null;
};

export const ruleWrites = {
  // Changes the rule if there is one for this activity + intensity, otherwise adds it.
  save:
    (teamId: string, activityTypeId: string, intensityId: string | null, existing: CreditRule | null, v: RuleValues) =>
    () => {
      const values = {
        kind: v.kind,
        credits: v.credits,
        per_minutes: v.kind === 'per_time' ? v.perMinutes : null,
        per_meters: v.kind === 'per_distance' ? v.perMeters : null,
      };
      return existing
        ? supabase.from('credit_rules').update(values).eq('id', existing.id)
        : supabase.from('credit_rules').insert({
            team_id: teamId,
            activity_type_id: activityTypeId,
            intensity_id: intensityId,
            ...values,
          });
    },
  remove: (id: string) => () => supabase.from('credit_rules').delete().eq('id', id),
};

export const seasonWrites = {
  update: (id: string, changes: { name?: string; start_date?: string; end_date?: string }) => () =>
    supabase.from('seasons').update(changes).eq('id', id),
};

export const targetWrites = {
  // The target for one activity, or for the total when activityTypeId is null.
  // A minimum of 0 with no maximum means "no target", so the row is removed.
  save:
    (
      teamId: string,
      seasonId: string,
      activityTypeId: string | null,
      existing: Target | null,
      minCredits: number,
      maxCredits: number | null,
    ) =>
    () => {
      if (minCredits === 0 && maxCredits === null && activityTypeId !== null) {
        return existing
          ? supabase.from('targets').delete().eq('id', existing.id)
          : Promise.resolve({ error: null });
      }
      const values = { min_credits: minCredits, max_credits: maxCredits };
      return existing
        ? supabase.from('targets').update(values).eq('id', existing.id)
        : supabase.from('targets').insert({
            team_id: teamId,
            season_id: seasonId,
            activity_type_id: activityTypeId,
            ...values,
          });
    },
};

export const overrideWrites = {
  // A special target for the period starting on `periodStart` (the total
  // across all activities).
  save:
    (
      teamId: string,
      seasonId: string,
      periodStart: string,
      existing: TargetOverride | null,
      values: { label: string | null; minCredits: number; maxCredits: number | null },
    ) =>
    () => {
      const row = { label: values.label, min_credits: values.minCredits, max_credits: values.maxCredits };
      return existing
        ? supabase.from('target_overrides').update(row).eq('id', existing.id)
        : supabase.from('target_overrides').insert({
            team_id: teamId,
            season_id: seasonId,
            period_start: periodStart,
            activity_type_id: null,
            ...row,
          });
    },
  // Back to the usual target.
  remove: (id: string) => () => supabase.from('target_overrides').delete().eq('id', id),
};

// The current period and the ones after it, so targets can be set in advance.
export function useUpcomingPeriods(team: MyTeam | null, count: number) {
  return useQuery({
    queryKey: [...setupKey, 'periods', team?.id, team?.targetPeriod, count],
    enabled: !!team,
    queryFn: async () => {
      const periods: { start: string; end: string; isCurrent: boolean }[] = [];
      // Each period is found from the day after the previous one ends, so
      // this works the same for weeks, two-week blocks and months.
      let day: string | undefined;
      for (let i = 0; i < count; i++) {
        const { data, error } = await supabase.rpc('team_period', {
          team: team!.id,
          kind: team!.targetPeriod,
          day,
        });
        if (error) throw error;
        const period = data[0];
        if (!period?.period_start) break;
        periods.push({ start: period.period_start, end: period.period_end, isCurrent: i === 0 });
        day = addDays(period.period_end, 1);
      }
      return periods;
    },
  });
}

// ---------------------------------------------------------------------------
// Reading what's typed
// ---------------------------------------------------------------------------

// "12", "12.5" or "12,5" → a number with at most one decimal. Null if it
// isn't a sensible amount of credits.
export function parseCredits(text: string): number | null {
  const value = Number(text.trim().replace(',', '.'));
  if (!text.trim() || !Number.isFinite(value) || value < 0 || value > 9999) return null;
  return Math.floor(value * 10 + 1e-9) / 10;
}

export function isDate(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const [y, m, d] = text.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

// "#0033a0" or "0033A0" → "#0033A0". Null if it isn't a six-digit hex color.
export function parseHexColor(text: string): string | null {
  const match = text.trim().match(/^#?([0-9a-fA-F]{6})$/);
  return match ? `#${match[1].toUpperCase()}` : null;
}

export function isTimeZone(text: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: text.trim() });
    return text.trim().length > 0;
  } catch {
    return false;
  }
}
