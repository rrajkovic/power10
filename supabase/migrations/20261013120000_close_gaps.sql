-- Three loose ends.
--
-- 1. Verification details are private. Until now any teammate could read a
--    session's photo-check status straight from the table, even though the
--    app never showed it. Now those columns can't be read from the table at
--    all; a function hands them out only to the session's athlete and to
--    admins. Rejected sessions are hidden from other athletes entirely.
-- 2. A daily allowance for AI photo reads, per person.
-- 3. Photo fingerprints are filled in by the photo-check worker, so a reused
--    photo file can be caught (see handle_new_session_photo for the old,
--    app-supplied path, which stays).

-- ---------------------------------------------------------------------------
-- 1. Private verification details
-- ---------------------------------------------------------------------------

-- Column permissions: take away "read everything", give back every column
-- except the verification ones. (Functions marked `security definer` are
-- not affected: leaderboards and reviews still read what they need.)
revoke select on public.sessions from authenticated;
grant select (
  id, team_id, athlete_id, activity_type_id, intensity_id, custom_label,
  session_date, duration_seconds, distance_meters, notes, credits, rule_used,
  calendar_event_id, logged_by, group_log_id, created_at, updated_at
) on public.sessions to authenticated;

-- A rejected session is only visible to its athlete and to admins.
drop policy "Members can read team sessions" on public.sessions;
create policy "Members can read team sessions"
  on public.sessions for select to authenticated
  using (
    athlete_id = (select auth.uid())
    or (
      public.is_team_member(team_id)
      and public.is_active_member(team_id, athlete_id)
      and (verification_status <> 'rejected' or public.is_team_admin(team_id))
    )
  );

-- The photo-check state of the given sessions, for the ones you're allowed
-- to know about: your own, and any on a team you admin. Others are left out.
create function public.session_verifications(session_ids uuid[])
returns table (
  session_id uuid,
  status public.verification_status,
  note text,
  athlete_response public.athlete_response
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.verification_status, s.verification_note, s.athlete_response
  from public.sessions s
  where s.id = any (session_ids)
    and (
      (s.athlete_id = (select auth.uid()) and public.is_team_member(s.team_id))
      or public.is_team_admin(s.team_id)
    );
$$;

revoke execute on function public.session_verifications(uuid[]) from public, anon;
grant execute on function public.session_verifications(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Photo-read allowance
-- ---------------------------------------------------------------------------

-- One row each time someone has the AI read photos for the logging form.
-- Only the Edge Function (service role) reads and writes this.
create table public.photo_reads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  photo_count smallint not null check (photo_count between 1 and 20),
  created_at timestamptz not null default now()
);

create index photo_reads_user_time_idx on public.photo_reads (user_id, created_at);

alter table public.photo_reads enable row level security;
revoke all on public.photo_reads from authenticated, anon;
