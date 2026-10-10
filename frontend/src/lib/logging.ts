import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Database } from './database.types';
import { requestVerification, uploadSessionPhotos, type WorkoutPhoto } from './photos';
import { progressKey } from './progress';
import { supabase } from './supabase';

// Everything the "Log a workout" form needs: what a team lets you log, how
// many credits it's worth, and saving the session.

type Tables = Database['public']['Tables'];
export type ActivityType = Tables['activity_types']['Row'];
export type Intensity = Tables['intensities']['Row'];
export type CreditRule = Tables['credit_rules']['Row'];

// The team's activity types, intensities and credit rules (archived ones left out).
export function useLoggingOptions(teamId: string | undefined) {
  return useQuery({
    queryKey: ['logging_options', teamId],
    enabled: !!teamId,
    queryFn: async () => {
      const [types, intensities, rules] = await Promise.all([
        supabase
          .from('activity_types')
          .select('*')
          .eq('team_id', teamId!)
          .is('archived_at', null)
          .order('sort_order'),
        supabase
          .from('intensities')
          .select('*')
          .eq('team_id', teamId!)
          .is('archived_at', null)
          .order('sort_order'),
        supabase.from('credit_rules').select('*').eq('team_id', teamId!),
      ]);
      const error = types.error ?? intensities.error ?? rules.error;
      if (error) throw error;
      return { types: types.data!, intensities: intensities.data!, rules: rules.data! };
    },
  });
}

// The athletes a coach or admin can log for: active members with the athlete
// role, by name. Pass enabled = false for everyone else.
export function useTeamAthletes(teamId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['team_athletes', teamId],
    enabled: !!teamId && enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('memberships')
        .select('user_id, grace_until, profiles(name)')
        .eq('team_id', teamId!)
        .eq('role', 'athlete');
      if (error) throw error;
      const now = Date.now();
      return data
        // Members locked out of the team (email grace period over) can't be logged for.
        .filter((member) => !member.grace_until || new Date(member.grace_until).getTime() > now)
        .map((member) => ({ id: member.user_id, name: member.profiles?.name || 'Unnamed' }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
  });
}

// A random id shared by the sessions of one group log. It only groups rows,
// so it doesn't need to be unguessable.
function randomUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export type NewSession = {
  teamId: string;
  // One id to log for yourself or one athlete; several for a group log
  // (coaches and admins only). Everyone gets the same workout.
  athleteIds: string[];
  activityTypeId: string;
  intensityId: string | null;
  customLabel: string | null;
  // 'YYYY-MM-DD' in the team's time zone.
  date: string;
  durationSeconds: number;
  distanceMeters: number | null;
  notes: string | null;
  photos: WorkoutPhoto[];
};

// Saves a session (one per athlete) and its photos. The database works out
// the credits, and marks sessions logged for someone else as verified;
// afterwards every goal card and leaderboard reloads.
export function useLogSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (session: NewSession) => {
      const groupLogId = session.athleteIds.length > 1 ? randomUuid() : null;
      // One insert for all rows: either everyone's session is saved or nobody's.
      const { data: saved, error } = await supabase
        .from('sessions')
        .insert(
          session.athleteIds.map((athleteId) => ({
            team_id: session.teamId,
            athlete_id: athleteId,
            activity_type_id: session.activityTypeId,
            intensity_id: session.intensityId,
            custom_label: session.customLabel,
            session_date: session.date,
            duration_seconds: session.durationSeconds,
            distance_meters: session.distanceMeters,
            notes: session.notes,
            group_log_id: groupLogId,
          })),
        )
        .select('id, credits');
      const data = saved?.[0];
      if (!error && !data) throw new Error('Nothing was saved');
      if (error || !data) throw error;

      // Photos belong to a single session (your own).
      if (session.photos.length && session.athleteIds.length === 1) {
        try {
          await uploadSessionPhotos(session.teamId, data.id, session.photos);
        } catch (uploadError) {
          // Don't leave a session behind without its photos: remove it so
          // saving again doesn't log the workout twice.
          await supabase.from('sessions').delete().eq('id', data.id);
          throw uploadError;
        }
        requestVerification(data.id);
      }
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: progressKey }),
  });
}

// ---------------------------------------------------------------------------
// Credits preview
// ---------------------------------------------------------------------------

// Same choice the database makes: the rule for this exact type + intensity,
// otherwise the type's default rule.
export function findCreditRule(
  rules: CreditRule[],
  activityTypeId: string,
  intensityId: string | null,
): CreditRule | null {
  const forType = rules.filter((rule) => rule.activity_type_id === activityTypeId);
  return (
    forType.find((rule) => intensityId !== null && rule.intensity_id === intensityId) ??
    forType.find((rule) => rule.intensity_id === null) ??
    null
  );
}

// A preview only: the database calculates the real number when saving.
// Floored to one decimal, like everywhere else (2.57 → 2.5).
export function estimateCredits(
  rule: CreditRule | null,
  durationSeconds: number | null,
  distanceMeters: number | null,
): number | null {
  if (!rule) return 0;
  let credits: number;
  if (rule.kind === 'per_session') {
    credits = rule.credits;
  } else if (rule.kind === 'per_time') {
    if (durationSeconds === null) return null;
    credits = (rule.credits * (durationSeconds / 60)) / rule.per_minutes!;
  } else {
    credits = distanceMeters === null ? 0 : (rule.credits * distanceMeters) / rule.per_meters!;
  }
  // The tiny nudge stops 4.5 turning into 4.4 through floating-point error.
  return Math.floor(credits * 10 + 1e-9) / 10;
}

// "1 credit per 10 min", "10 credits per session", "1 credit per 2 km".
export function describeRule(rule: CreditRule | null): string {
  if (!rule) return 'No credit rule for this type yet';
  const credits = `${rule.credits} ${rule.credits === 1 ? 'credit' : 'credits'}`;
  if (rule.kind === 'per_session') return `${credits} per session`;
  if (rule.kind === 'per_time') return `${credits} per ${rule.per_minutes} min`;
  const meters = rule.per_meters!;
  return `${credits} per ${meters >= 1000 ? `${meters / 1000} km` : `${meters} m`}`;
}

// ---------------------------------------------------------------------------
// Reading what people type
// ---------------------------------------------------------------------------

// Turns typed durations into seconds: "45", "45 min", "1h", "1h 15m", "90m",
// "39m 40s", and erg-monitor style "39:40" or "1:05:20". A bare number means
// minutes. Returns null if it can't be read or is longer than a day.
export function parseDurationSeconds(input: string): number | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;
  const num = (v: string) => parseFloat(v.replace(',', '.'));
  const clamp = (total: number) => {
    const whole = Math.floor(total);
    return whole >= 1 && whole <= 86400 ? whole : null;
  };

  const hms = s.match(/^(\d{1,2}):(\d{1,2}):(\d{1,2}(?:[.,]\d+)?)$/);
  if (hms) return clamp(Number(hms[1]) * 3600 + Number(hms[2]) * 60 + num(hms[3]));
  const ms = s.match(/^(\d{1,4}):(\d{1,2}(?:[.,]\d+)?)$/);
  if (ms) return clamp(Number(ms[1]) * 60 + num(ms[2]));

  let total = 0;
  let matched = false;

  const h = s.match(/(\d+(?:[.,]\d+)?)\s*(?:h|hr|hrs|hour|hours)(?![a-z])/);
  if (h) {
    total += num(h[1]) * 3600;
    matched = true;
  }
  const m = s.match(/(\d+(?:[.,]\d+)?)\s*(?:m|min|mins|minute|minutes|')(?![a-z])/);
  if (m) {
    total += num(m[1]) * 60;
    matched = true;
  }
  const sec = s.match(/(\d+(?:[.,]\d+)?)\s*(?:s|sec|secs|second|seconds|")(?![a-z])/);
  if (sec) {
    total += num(sec[1]);
    matched = true;
  }
  if (h && !m && !sec) {
    // "1h30": a number without a unit after the hours is minutes.
    const trailing = s.slice(h.index! + h[0].length).match(/^\s*(\d+(?:[.,]\d+)?)\s*$/);
    if (trailing) total += num(trailing[1]) * 60;
  } else if (m && !sec) {
    // "39m40": a number without a unit after the minutes is seconds.
    const trailing = s.slice(m.index! + m[0].length).match(/^\s*(\d+(?:[.,]\d+)?)\s*$/);
    if (trailing) total += num(trailing[1]);
  }
  if (!matched) {
    const bare = s.match(/^(\d+(?:[.,]\d+)?)$/);
    if (bare) {
      total = num(bare[1]) * 60;
      matched = true;
    }
  }
  return matched ? clamp(total) : null;
}

// 2700 → "45 min", 3920 → "1 h 5 min 20 s".
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h ? `${h} h` : '', m ? `${m} min` : '', s ? `${s} s` : ''].filter(Boolean).join(' ');
}

// The other direction, for filling the box from a photo: 2380 → "39:40",
// 3920 → "1:05:20".
export function durationInput(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(seconds % 60)}` : `${m}:${pad(seconds % 60)}`;
}

export type DistanceUnit = 'km' | 'm' | 'mi';

// "10" km → 10000. Returns null for an empty box and NaN for something that
// isn't a sensible distance.
export function parseDistanceMeters(input: string, unit: DistanceUnit): number | null {
  const s = input.trim().replace(',', '.');
  if (!s) return null;
  const value = Number(s);
  if (!Number.isFinite(value) || value <= 0) return NaN;
  const meters = Math.round(unit === 'km' ? value * 1000 : unit === 'mi' ? value * 1609.344 : value);
  return meters >= 1 && meters <= 1_000_000 ? meters : NaN;
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

// Today's date ('YYYY-MM-DD') where the team is, not where the phone is.
export function todayInTimeZone(timeZone: string): string {
  // The Canadian format happens to be YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
}

const weekdayMonthDay = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});

// How many days `iso` is before `today` (negative if it's in the future).
export function daysBefore(iso: string, today: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(y, m - 1, d)) / 86_400_000);
}

// "Today", "Yesterday", or "Mon, Oct 5".
export function dayLabel(iso: string, today: string): string {
  const daysAgo = daysBefore(iso, today);
  if (daysAgo === 0) return 'Today';
  if (daysAgo === 1) return 'Yesterday';
  const [y, m, d] = iso.split('-').map(Number);
  return weekdayMonthDay.format(new Date(y, m - 1, d));
}
