import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { progressKey } from './progress';
import { supabase } from './supabase';

// The Feed: the team's workouts, newest first, with reactions and comments.
//
// These read the tables directly. Row-level security in the database decides
// what comes back, so a query can only ever return your own team's sessions.

export const feedKey = ['feed'] as const;
const PAGE_SIZE = 20;

// Everything a feed card or the session screen shows, in one request.
const SESSION_FIELDS =
  'id, team_id, athlete_id, session_date, duration_seconds, distance_meters, credits, notes, ' +
  'custom_label, logged_by, created_at, ' +
  'activity_type_id, intensity_id, ' +
  'activity:activity_types(name), intensity:intensities(name), ' +
  'athlete:profiles!sessions_athlete_id_fkey(name), ' +
  'photos:session_photos(storage_path), reactions(emoji, user_id), comments(count)';

export type FeedSession = {
  id: string;
  team_id: string;
  athlete_id: string;
  session_date: string;
  duration_seconds: number;
  distance_meters: number | null;
  credits: number;
  notes: string | null;
  custom_label: string | null;
  // The photo check. Only filled in for your own workouts, or for all of them
  // if you're an admin; null means "not yours to know".
  verification_status: 'not_needed' | 'pending' | 'passed' | 'flagged' | 'rejected' | null;
  verification_note: string | null;
  logged_by: string | null;
  created_at: string;
  activity_type_id: string;
  intensity_id: string | null;
  activity: { name: string } | null;
  intensity: { name: string } | null;
  athlete: { name: string } | null;
  photos: { storage_path: string }[];
  reactions: { emoji: string; user_id: string }[];
  comments: { count: number }[];
};

// Whose workouts to show.
export type FeedFilter =
  | { kind: 'everyone' }
  | { kind: 'mine' }
  | { kind: 'people'; ids: string[] };

type FeedOptions = {
  teamId: string | undefined;
  userId: string | undefined;
  isAdmin: boolean;
  filter: FeedFilter;
};

// Verification details can't be read from the sessions table. The database
// hands them out separately, and only for workouts you're allowed to know
// about (your own, or everyone's if you're an admin). It also hides rejected
// workouts from everyone but their athlete and admins.
async function withVerification(sessions: FeedSession[]): Promise<FeedSession[]> {
  if (sessions.length === 0) return sessions;
  const { data, error } = await supabase.rpc('session_verifications', {
    session_ids: sessions.map((session) => session.id),
  });
  if (error) throw error;
  const byId = new Map(data.map((row) => [row.session_id, row]));
  return sessions.map((session) => ({
    ...session,
    verification_status: byId.get(session.id)?.status ?? null,
    verification_note: byId.get(session.id)?.note ?? null,
  }));
}

// Loads the feed a page at a time ("Load more" asks for the next one).
export function useFeed({ teamId, userId, isAdmin, filter }: FeedOptions) {
  return useInfiniteQuery({
    queryKey: [...feedKey, 'list', teamId, userId, isAdmin, filter],
    enabled: !!teamId && !!userId,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      let query = supabase
        .from('sessions')
        .select(SESSION_FIELDS)
        .eq('team_id', teamId!)
        .order('session_date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1);

      if (filter.kind === 'mine') query = query.eq('athlete_id', userId!);
      if (filter.kind === 'people') query = query.in('athlete_id', filter.ids);

      const { data, error } = await query;
      if (error) throw error;
      return withVerification(data as unknown as FeedSession[]);
    },
    // A full page means there may be more.
    getNextPageParam: (lastPage, pages) =>
      lastPage.length === PAGE_SIZE ? pages.length * PAGE_SIZE : undefined,
  });
}

export function useFeedSession(sessionId: string | undefined) {
  return useQuery({
    queryKey: [...feedKey, 'session', sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select(SESSION_FIELDS)
        .eq('id', sessionId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return (await withVerification([data as unknown as FeedSession]))[0];
    },
  });
}

// Everyone on the team, by name: for the "People" filter.
export function useTeamMembers(teamId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['team_members', teamId],
    enabled: !!teamId && enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('memberships')
        .select('user_id, profiles(name)')
        .eq('team_id', teamId!);
      if (error) throw error;
      return data
        .map((member) => ({ id: member.user_id, name: member.profiles?.name || 'Unnamed' }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
  });
}

// ---------------------------------------------------------------------------
// Live updates
// ---------------------------------------------------------------------------

// While this is mounted, the app is told when anyone on the team logs or
// changes a workout, comments or reacts, and reloads what's on screen. (The
// message only says "something changed"; the data is then fetched the normal
// way, so the same access rules apply.)
//
// One limit: when someone else DELETES something, others only see it go after
// their next refresh.
export function useLiveUpdates(teamId: string | undefined) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!teamId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Several changes in a row (a group log, a burst of reactions) cause one reload.
    const reload = (totalsToo: boolean) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: feedKey });
        if (totalsToo) queryClient.invalidateQueries({ queryKey: progressKey });
      }, 400);
    };
    const filter = `team_id=eq.${teamId}`;
    const channel = supabase
      .channel(`team-${teamId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions', filter }, () => reload(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter }, () => reload(false))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reactions', filter }, () => reload(false))
      .subscribe();
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [teamId, queryClient]);
}

// ---------------------------------------------------------------------------
// Reactions
// ---------------------------------------------------------------------------

// Tapping an emoji adds your reaction, or removes it if it's already yours.
export function useToggleReaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (reaction: {
      session: FeedSession;
      userId: string;
      emoji: string;
    }) => {
      const { session, userId, emoji } = reaction;
      const mine = session.reactions.some((r) => r.user_id === userId && r.emoji === emoji);
      const { error } = mine
        ? await supabase
            .from('reactions')
            .delete()
            .eq('session_id', session.id)
            .eq('user_id', userId)
            .eq('emoji', emoji)
        : await supabase
            .from('reactions')
            .insert({ team_id: session.team_id, session_id: session.id, emoji });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: feedKey }),
  });
}

// "👏 3, 🔥 1": each emoji once, with how many people used it and whether
// you're one of them. Most used first.
export function groupReactions(reactions: FeedSession['reactions'], userId: string | undefined) {
  const groups = new Map<string, { emoji: string; count: number; mine: boolean }>();
  for (const reaction of reactions) {
    const group = groups.get(reaction.emoji) ?? { emoji: reaction.emoji, count: 0, mine: false };
    group.count += 1;
    if (reaction.user_id === userId) group.mine = true;
    groups.set(reaction.emoji, group);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export type Comment = {
  id: string;
  body: string;
  created_at: string;
  // Set when the author has changed it.
  edited_at: string | null;
  author_id: string;
  author: { name: string } | null;
};

export function useComments(sessionId: string | undefined) {
  return useQuery({
    queryKey: [...feedKey, 'comments', sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comments')
        .select(
          'id, body, created_at, edited_at, author_id, author:profiles!comments_author_id_fkey(name)',
        )
        .eq('session_id', sessionId!)
        .order('created_at');
      if (error) throw error;
      return data as unknown as Comment[];
    },
  });
}

export function useAddComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (comment: { session: FeedSession; body: string }) => {
      const { error } = await supabase.from('comments').insert({
        team_id: comment.session.team_id,
        session_id: comment.session.id,
        body: comment.body.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: feedKey }),
  });
}

// Only the author can change a comment; the database marks it as edited.
export function useEditComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (edit: { commentId: string; body: string }) => {
      const { error } = await supabase
        .from('comments')
        .update({ body: edit.body.trim() })
        .eq('id', edit.commentId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: feedKey }),
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase.from('comments').delete().eq('id', commentId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: feedKey }),
  });
}

// ---------------------------------------------------------------------------
// Editing and deleting a session (its athlete, or an admin)
// ---------------------------------------------------------------------------

// Changing a workout changes credits, so totals reload too.
function useReloadAll() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: feedKey }),
      queryClient.invalidateQueries({ queryKey: progressKey }),
    ]);
}

export type SessionEdit = {
  sessionId: string;
  activityTypeId: string;
  intensityId: string | null;
  durationSeconds: number;
  distanceMeters: number | null;
  date: string;
  notes: string | null;
};

export function useUpdateSession() {
  const reload = useReloadAll();
  return useMutation({
    mutationFn: async (edit: SessionEdit) => {
      // The database recalculates the credits.
      const { error } = await supabase
        .from('sessions')
        .update({
          activity_type_id: edit.activityTypeId,
          intensity_id: edit.intensityId,
          duration_seconds: edit.durationSeconds,
          distance_meters: edit.distanceMeters,
          session_date: edit.date,
          notes: edit.notes,
        })
        .eq('id', edit.sessionId);
      if (error) throw error;
    },
    onSuccess: reload,
  });
}

export function useDeleteSession() {
  const reload = useReloadAll();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      // Done by a server function so the photo files are removed too.
      const { error } = await supabase.functions.invoke('delete-session', {
        body: { session_id: sessionId },
      });
      if (error) {
        const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
        throw new Error(typeof body?.error === 'string' ? body.error : 'Couldn’t delete the workout');
      }
    },
    onSuccess: reload,
  });
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

// "just now", "5 min ago", "3 h ago", "2 d ago", then the date.
export function timeAgo(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d ago`;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(iso));
}

// What to say about the photo check. Only the athlete and admins see this.
export function verificationLabel(status: FeedSession['verification_status']): string | null {
  if (status === null) return null;
  if (status === 'passed') return 'Verified ✓';
  if (status === 'pending') return 'Checking photo…';
  if (status === 'flagged') return 'Flagged for review';
  if (status === 'rejected') return 'Rejected: doesn’t count';
  return null;
}
