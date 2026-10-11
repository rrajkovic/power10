-- Athletes answer flags on their own workouts.
--
-- When the photo check flags a session, the athlete can look at it and either
--   * confirm it ("it's logged correctly"), or
--   * correct it (fix the time, distance, activity or intensity).
--
-- Confirming leaves the session flagged, but coaches see that the athlete
-- stands by it. Correcting sends it through the photo check again. Either
-- way a coach still has the final word (review_session).
--
-- These columns can't be written by the app directly (they aren't in the
-- column grants on sessions); only the functions below set them.

create type public.athlete_response as enum ('confirmed', 'corrected');

alter table public.sessions
  add column athlete_response public.athlete_response,
  add column athlete_responded_at timestamptz,
  add column athlete_response_note text check (length(athlete_response_note) <= 500);

-- The storage paths of a session's photos, oldest first.
create function public.session_photo_paths(session uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(p.storage_path order by p.created_at), '{}')
  from public.session_photos p
  where p.session_id = session;
$$;

revoke execute on function public.session_photo_paths(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Athlete: my flagged workouts that still need my answer
-- ---------------------------------------------------------------------------

create function public.my_flagged_sessions(team uuid)
returns table (
  id uuid,
  session_date date,
  activity_type_id uuid,
  activity_name text,
  intensity_id uuid,
  intensity_name text,
  custom_label text,
  duration_seconds integer,
  distance_meters integer,
  credits numeric,
  -- Why it was flagged.
  flag_note text,
  -- 'corrected' if you already fixed it once and it was flagged again.
  athlete_response public.athlete_response,
  photo_paths text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.session_date, s.activity_type_id, a.name, s.intensity_id, i.name,
         s.custom_label, s.duration_seconds, s.distance_meters, s.credits,
         s.verification_note, s.athlete_response, public.session_photo_paths(s.id)
  from public.sessions s
  join public.activity_types a on a.id = s.activity_type_id
  left join public.intensities i on i.id = s.intensity_id
  where s.team_id = team
    and s.athlete_id = (select auth.uid())
    and public.is_team_member(team)
    and s.verification_status = 'flagged'
    and s.reviewed_at is null
    and s.athlete_response is distinct from 'confirmed'
  order by s.session_date desc, s.created_at desc;
$$;

-- Shared check: the session is yours, flagged, and no coach has settled it.
create function public.own_flagged_session(session uuid)
returns public.sessions
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.sessions;
begin
  select * into s from public.sessions where id = session;
  if not found
     or s.athlete_id is distinct from (select auth.uid())
     or not public.is_team_member(s.team_id) then
    raise exception 'You can only answer flags on your own workouts';
  end if;
  if s.verification_status <> 'flagged' or s.reviewed_at is not null then
    raise exception 'This workout isn''t waiting for your answer';
  end if;
  return s;
end;
$$;

revoke execute on function public.own_flagged_session(uuid) from public, anon, authenticated;

-- "It's logged correctly." Stays flagged; coaches see you confirmed it.
create function public.confirm_flagged_session(session uuid, note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.own_flagged_session(session);

  update public.sessions
  set athlete_response = 'confirmed',
      athlete_responded_at = now(),
      athlete_response_note = nullif(trim(note), '')
  where id = session;
end;
$$;

-- "It was wrong, here's the fix." Saves the new values (credits are
-- recalculated by the sessions trigger) and queues a fresh photo check.
create function public.correct_flagged_session(
  session uuid,
  new_activity_type_id uuid,
  new_intensity_id uuid,
  new_duration_seconds integer,
  new_distance_meters integer,
  note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.sessions;
  has_photos boolean;
begin
  s := public.own_flagged_session(session);

  if exists (
    select 1 from public.activity_types a
    where a.id = new_activity_type_id and a.archived_at is not null
      and a.id <> s.activity_type_id
  ) then
    raise exception 'This activity type has been archived';
  end if;

  has_photos := exists (select 1 from public.session_photos p where p.session_id = session);

  update public.sessions
  set activity_type_id = new_activity_type_id,
      intensity_id = new_intensity_id,
      duration_seconds = new_duration_seconds,
      distance_meters = new_distance_meters,
      athlete_response = 'corrected',
      athlete_responded_at = now(),
      athlete_response_note = nullif(trim(note), ''),
      -- With photos it's checked again; without, it stays flagged for a coach.
      verification_status = case when has_photos then 'pending' else 'flagged' end::public.verification_status,
      verification_note = case when has_photos then null else verification_note end
  where id = session;

  if has_photos then
    insert into public.verification_checks (team_id, session_id)
    values (s.team_id, session);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Coaches and admins: every flagged workout on the team
-- ---------------------------------------------------------------------------

create function public.flagged_sessions(team uuid)
returns table (
  id uuid,
  athlete_id uuid,
  athlete_name text,
  session_date date,
  activity_name text,
  intensity_name text,
  custom_label text,
  duration_seconds integer,
  distance_meters integer,
  credits numeric,
  flag_note text,
  -- null: the athlete hasn't answered yet.
  athlete_response public.athlete_response,
  athlete_response_note text,
  athlete_responded_at timestamptz,
  photo_paths text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_team_admin(team) then
    raise exception 'Only coaches and admins can see flagged workouts';
  end if;

  return query
  select s.id, s.athlete_id, p.name, s.session_date, a.name, i.name, s.custom_label,
         s.duration_seconds, s.distance_meters, s.credits, s.verification_note,
         s.athlete_response, s.athlete_response_note, s.athlete_responded_at,
         public.session_photo_paths(s.id)
  from public.sessions s
  join public.profiles p on p.id = s.athlete_id
  join public.activity_types a on a.id = s.activity_type_id
  left join public.intensities i on i.id = s.intensity_id
  where s.team_id = team
    and s.verification_status = 'flagged'
    and s.reviewed_at is null
  -- Ones the athlete has answered first: they're ready for a decision.
  order by s.athlete_response is null, s.session_date desc, s.created_at desc;
end;
$$;

revoke execute on function
  public.my_flagged_sessions(uuid),
  public.confirm_flagged_session(uuid, text),
  public.correct_flagged_session(uuid, uuid, uuid, integer, integer, text),
  public.flagged_sessions(uuid)
from public, anon;
grant execute on function
  public.my_flagged_sessions(uuid),
  public.confirm_flagged_session(uuid, text),
  public.correct_flagged_session(uuid, uuid, uuid, integer, integer, text),
  public.flagged_sessions(uuid)
to authenticated;
