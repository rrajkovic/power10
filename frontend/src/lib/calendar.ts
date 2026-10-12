import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Database } from './database.types';
import { addDays } from './progress';
import { supabase } from './supabase';

// The team calendar: tests, races, scheduled workouts and anything else worth
// putting a date on. Everyone on the team can read it; admins write it.

export type EventKind = Database['public']['Enums']['calendar_event_kind'];

export type CalendarEvent = {
  id: string;
  team_id: string;
  kind: EventKind;
  title: string;
  description: string | null;
  // 'YYYY-MM-DD', in the team's time zone.
  event_date: string;
  // 'HH:MM:SS', or null for "no particular time".
  start_time: string | null;
  // For workouts: what to log it as.
  activity_type_id: string | null;
  intensity_id: string | null;
  activity: { name: string } | null;
  intensity: { name: string } | null;
  // Shared by the events of one repeating series; null for a one-off.
  series_id: string | null;
};

// A taper, race or test week from team settings, shown on the calendar too.
export type SpecialPeriod = {
  period_start: string;
  label: string | null;
  min_credits: number;
};

const EVENT_FIELDS =
  'id, team_id, kind, title, description, event_date, start_time, activity_type_id, intensity_id, series_id, ' +
  'activity:activity_types(name), intensity:intensities(name)';

export const calendarKey = ['calendar'] as const;

export const KIND_LABELS: Record<EventKind, string> = {
  test: 'Test',
  race: 'Race',
  workout: 'Workout',
  other: 'Other',
};

// Everything between two days (inclusive): events, and special target weeks.
export function useEventsBetween(teamId: string | undefined, from: string, to: string) {
  return useQuery({
    queryKey: [...calendarKey, 'range', teamId, from, to],
    enabled: !!teamId,
    queryFn: async () => {
      const [events, special] = await Promise.all([
        supabase
          .from('calendar_events')
          .select(EVENT_FIELDS)
          .eq('team_id', teamId!)
          .gte('event_date', from)
          .lte('event_date', to)
          .order('event_date')
          .order('start_time', { nullsFirst: true }),
        supabase
          .from('target_overrides')
          .select('period_start, label, min_credits')
          .eq('team_id', teamId!)
          .is('activity_type_id', null)
          .gte('period_start', from)
          .lte('period_start', to)
          .order('period_start'),
      ]);
      const error = events.error ?? special.error;
      if (error) throw error;
      return {
        events: events.data as unknown as CalendarEvent[],
        special: special.data as SpecialPeriod[],
      };
    },
  });
}

export function useEvent(eventId: string | undefined) {
  return useQuery({
    queryKey: [...calendarKey, 'event', eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('calendar_events')
        .select(EVENT_FIELDS)
        .eq('id', eventId!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as CalendarEvent | null;
    },
  });
}

// Who has logged a workout against this event.
export function useEventSessions(eventId: string | undefined) {
  return useQuery({
    queryKey: [...calendarKey, 'sessions', eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select('id, athlete_id, duration_seconds, athlete:profiles!sessions_athlete_id_fkey(name)')
        .eq('calendar_event_id', eventId!)
        .order('created_at');
      if (error) throw error;
      return data as unknown as {
        id: string;
        athlete_id: string;
        duration_seconds: number;
        athlete: { name: string } | null;
      }[];
    },
  });
}

// Your own workouts on a day that aren't linked to any event yet: the ones
// you could say "this was that workout" about.
export function useMyUnlinkedSessions(
  teamId: string | undefined,
  userId: string | undefined,
  day: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: [...calendarKey, 'unlinked', teamId, userId, day],
    enabled: !!teamId && !!userId && !!day && enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select('id, duration_seconds, activity:activity_types(name)')
        .eq('team_id', teamId!)
        .eq('athlete_id', userId!)
        .eq('session_date', day!)
        .is('calendar_event_id', null)
        .order('created_at');
      if (error) throw error;
      return data as unknown as { id: string; duration_seconds: number; activity: { name: string } | null }[];
    },
  });
}

// Links a workout you already logged to a scheduled workout, or (with
// eventId null) takes the link away again.
export function useLinkSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId, eventId }: { sessionId: string; eventId: string | null }) => {
      const { error } = await supabase
        .from('sessions')
        .update({ calendar_event_id: eventId })
        .eq('id', sessionId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: calendarKey }),
  });
}

export type EventValues = {
  kind: EventKind;
  title: string;
  description: string | null;
  date: string;
  startTime: string | null;
  activityTypeId: string | null;
  intensityId: string | null;
};

// How a new event repeats.
export type Repeat = { every: 'never' } | { every: 'day' | 'week' | 'two_weeks'; until: string };

// The most events one repeating series can create.
export const MAX_REPEATS = 100;

// The dates a repeating event lands on, starting with `start`.
export function repeatDates(start: string, repeat: Repeat): string[] {
  if (repeat.every === 'never') return [start];
  const step = repeat.every === 'day' ? 1 : repeat.every === 'week' ? 7 : 14;
  const dates: string[] = [];
  for (let day = start; day <= repeat.until && dates.length < MAX_REPEATS; day = addDays(day, step)) {
    dates.push(day);
  }
  return dates.length ? dates : [start];
}

// A random id shared by the events of one series. It only groups rows.
function randomUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

type SaveEvent =
  | { teamId: string; userId: string; eventId: null; values: EventValues; repeat: Repeat }
  | { eventId: string; values: EventValues };

export function useSaveEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (save: SaveEvent) => {
      const v = save.values;
      const row = {
        kind: v.kind,
        title: v.title.trim(),
        description: v.description,
        event_date: v.date,
        start_time: v.startTime,
        // Only workouts suggest what to log.
        activity_type_id: v.kind === 'workout' ? v.activityTypeId : null,
        intensity_id: v.kind === 'workout' ? v.intensityId : null,
      };
      if (save.eventId !== null) {
        const { error } = await supabase.from('calendar_events').update(row).eq('id', save.eventId);
        if (error) throw error;
        return;
      }
      // A repeating event is one row per date, saved together.
      const dates = repeatDates(v.date, save.repeat);
      const seriesId = dates.length > 1 ? randomUuid() : null;
      const { error } = await supabase.from('calendar_events').insert(
        dates.map((date) => ({
          ...row,
          event_date: date,
          team_id: save.teamId,
          created_by: save.userId,
          series_id: seriesId,
        })),
      );
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: calendarKey }),
  });
}

// Deletes one event, or (for a repeating one) this one and every later one.
export function useDeleteEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ event, andLater }: { event: CalendarEvent; andLater: boolean }) => {
      const { error } =
        andLater && event.series_id
          ? await supabase
              .from('calendar_events')
              .delete()
              .eq('series_id', event.series_id)
              .gte('event_date', event.event_date)
          : await supabase.from('calendar_events').delete().eq('id', event.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: calendarKey }),
  });
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, '0');

// '2026-10-14' → '2026-10'
export const monthOf = (day: string) => day.slice(0, 7);

// '2026-10' + 1 → '2026-11'; '2026-12' + 1 → '2027-01'
export function addMonths(month: string, count: number): string {
  const [y, m] = month.split('-').map(Number);
  const date = new Date(y, m - 1 + count, 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function monthTitle(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1));
}

// The days to draw for a month: whole weeks, Monday first, so the first and
// last rows can include days from the months either side.
export function monthGrid(month: string): string[] {
  const [y, m] = month.split('-').map(Number);
  const first = `${month}-01`;
  // getDay(): Sunday = 0. Days since Monday:
  const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(y, m, 0).getDate();
  const cells = Math.ceil((lead + daysInMonth) / 7) * 7;
  const start = addDays(first, -lead);
  return Array.from({ length: cells }, (_, i) => addDays(start, i));
}

// "Wed, Oct 14"
export function longDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(
    new Date(y, m - 1, d),
  );
}

// '06:30:00' → '6:30 AM'
export function formatTime(time: string): string {
  const [h, min] = time.split(':').map(Number);
  const suffix = h < 12 ? 'AM' : 'PM';
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(min)} ${suffix}`;
}

// Reads a typed time: "6:30", "06:30", "6:30 am", "6pm", "18:30", "630".
// Returns 'HH:MM' or null if it isn't a time.
export function parseTime(text: string): string | null {
  const match = text.trim().toLowerCase().match(/^(\d{1,2})(?::?(\d{2}))?\s*(am|pm|a|p)?$/);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  const half = match[3]?.[0];
  if (half) {
    if (hour < 1 || hour > 12) return null;
    if (half === 'p' && hour !== 12) hour += 12;
    if (half === 'a' && hour === 12) hour = 0;
  }
  if (hour > 23 || minute > 59) return null;
  return `${pad(hour)}:${pad(minute)}`;
}

// "today", "tomorrow", "in 5 days", "3 days ago"
export function daysAway(day: string, today: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  const diff = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86_400_000);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  return diff > 0 ? `in ${diff} days` : `${-diff} days ago`;
}
