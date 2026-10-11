-- Coaches don't have to wait for the athlete.
--
-- At any point a coach or admin can approve or reject a flagged workout
-- (review_session, already there). This adds a third option: fix the numbers
-- themselves and approve in one step. Whatever the athlete had or hadn't
-- answered no longer matters once a coach has decided.
--
-- flagged_sessions also returns the activity and intensity ids now, so the
-- app can start the coach's fix from what was logged.

drop function if exists public.flagged_sessions(uuid);
drop function if exists public.correct_and_approve_session(uuid, uuid, uuid, integer, integer, text);

-- Every flagged workout on the team (coaches and admins only).
create function public.flagged_sessions(team uuid)
returns table (
  id uuid,
  athlete_id uuid,
  athlete_name text,
  session_date date,
  activity_type_id uuid,
  activity_name text,
  intensity_id uuid,
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
  select s.id, s.athlete_id, p.name, s.session_date, s.activity_type_id, a.name,
         s.intensity_id, i.name, s.custom_label,
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

-- A coach or admin fixes the numbers and approves, in one step. Works whether
-- or not the athlete has answered. Never on your own session.
create function public.correct_and_approve_session(
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
begin
  select * into s from public.sessions where id = session;
  if not found or not public.is_team_admin(s.team_id) then
    raise exception 'Only admins can review sessions';
  end if;
  if s.athlete_id = (select auth.uid()) then
    raise exception 'You can''t review your own session';
  end if;

  update public.sessions
  set activity_type_id = new_activity_type_id,
      intensity_id = new_intensity_id,
      duration_seconds = new_duration_seconds,
      distance_meters = new_distance_meters,
      verification_status = 'passed',
      reviewed_by = (select auth.uid()),
      reviewed_at = now(),
      review_note = nullif(trim(note), '')
  where id = session;
end;
$$;

revoke execute on function
  public.flagged_sessions(uuid),
  public.correct_and_approve_session(uuid, uuid, uuid, integer, integer, text)
from public, anon;
grant execute on function
  public.flagged_sessions(uuid),
  public.correct_and_approve_session(uuid, uuid, uuid, integer, integer, text)
to authenticated;
