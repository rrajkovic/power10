import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Database } from './database.types';
import { progressKey } from './progress';
import { supabase } from './supabase';

// Flagged workouts: ones the photo check wasn't happy with.
//
// The athlete answers first (confirm it's right, or correct it); a coach or
// admin then approves or rejects. The rules live in the database
// (supabase/migrations/*_athlete_flag_review.sql).

type Functions = Database['public']['Functions'];
export type MyFlaggedSession = Functions['my_flagged_sessions']['Returns'][number];
export type FlaggedSession = Functions['flagged_sessions']['Returns'][number];
export type AthleteResponse = Database['public']['Enums']['athlete_response'];

const reviewKey = ['review'] as const;

// Your own flagged workouts that still need your answer.
export function useMyFlaggedSessions(teamId: string | undefined) {
  return useQuery({
    queryKey: [...reviewKey, 'mine', teamId],
    enabled: !!teamId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_flagged_sessions', { team: teamId! });
      if (error) throw error;
      return data;
    },
  });
}

// Every flagged workout on the team. Coaches and admins only: pass
// enabled = false for everyone else.
export function useFlaggedSessions(teamId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: [...reviewKey, 'team', teamId],
    enabled: !!teamId && enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('flagged_sessions', { team: teamId! });
      if (error) throw error;
      return data;
    },
  });
}

// After any answer or decision, reload the lists and every total (a
// correction changes credits; a rejection stops a workout counting).
function useReload() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: reviewKey }),
      queryClient.invalidateQueries({ queryKey: progressKey }),
      queryClient.invalidateQueries({ queryKey: ['feed'] }),
    ]);
}

// Athlete: "it's logged correctly".
export function useConfirmFlagged() {
  const reload = useReload();
  return useMutation({
    mutationFn: async ({ sessionId, note }: { sessionId: string; note: string }) => {
      const { error } = await supabase.rpc('confirm_flagged_session', {
        session: sessionId,
        note: note.trim() || undefined,
      });
      if (error) throw error;
    },
    onSuccess: reload,
  });
}

export type Correction = {
  sessionId: string;
  activityTypeId: string;
  intensityId: string | null;
  durationSeconds: number;
  distanceMeters: number | null;
  note: string;
};

// Athlete: "it was wrong, here's the fix". It stays with the coaches, marked
// as corrected.
export function useCorrectFlagged() {
  const reload = useReload();
  return useMutation({
    mutationFn: async (fix: Correction) => {
      const { error } = await supabase.rpc('correct_flagged_session', {
        session: fix.sessionId,
        new_activity_type_id: fix.activityTypeId,
        // The generated types don't mark these as optional, but the database
        // accepts "no intensity" and "no distance".
        new_intensity_id: fix.intensityId as string,
        new_duration_seconds: fix.durationSeconds,
        new_distance_meters: fix.distanceMeters as number,
        note: fix.note.trim() || undefined,
      });
      if (error) throw error;
    },
    onSuccess: reload,
  });
}

// Coach or admin: approve (it counts, verified) or reject (it stops counting).
export function useReviewSession() {
  const reload = useReload();
  return useMutation({
    mutationFn: async ({ sessionId, approve }: { sessionId: string; approve: boolean }) => {
      const { error } = await supabase.rpc('review_session', { session: sessionId, approve });
      if (error) throw error;
    },
    onSuccess: reload,
  });
}

// Coach or admin: fix the numbers and approve, in one step. Doesn't wait for
// the athlete's answer.
export function useCorrectAndApprove() {
  const reload = useReload();
  return useMutation({
    mutationFn: async (fix: Correction) => {
      const { error } = await supabase.rpc('correct_and_approve_session', {
        session: fix.sessionId,
        new_activity_type_id: fix.activityTypeId,
        new_intensity_id: fix.intensityId as string,
        new_duration_seconds: fix.durationSeconds,
        new_distance_meters: fix.distanceMeters as number,
        note: fix.note.trim() || undefined,
      });
      if (error) throw error;
    },
    onSuccess: reload,
  });
}

// Temporary links for showing private photos (they stop working after an hour).
export function usePhotoUrls(paths: string[]) {
  return useQuery({
    queryKey: ['photo_urls', ...paths],
    enabled: paths.length > 0,
    staleTime: 30 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from('session-photos').createSignedUrls(paths, 3600);
      if (error) throw error;
      return data.flatMap((item) => (item.signedUrl ? [item.signedUrl] : []));
    },
  });
}

// What coaches see next to a flagged workout.
export function responseLabel(response: AthleteResponse | null): string {
  if (response === 'confirmed') return 'Confirmed by athlete';
  if (response === 'corrected') return 'Corrected by athlete';
  return 'Waiting for athlete';
}
