-- Rules for changing workouts after they're logged, and how far back
-- athletes can log or change them.
--
-- 1. An athlete edits the numbers of a workout that has been through the
--    photo check → it goes to the coaches' list as "Corrected by athlete".
-- 2. An admin edits someone's workout → it's verified.
-- 3. Each team sets two windows for its athletes:
--      log window:  how old a workout can be when it's logged
--      edit window: how old a workout can be and still be changed or deleted
--    Admins are never limited.
--
-- All of this is enforced here, in the database, so it holds no matter what
-- the app does.

create type public.time_window as enum (
  'forever',  -- no limit
  'days',     -- today and the last N days
  'week',     -- this week only (Monday to Sunday)
  'month'     -- this calendar month only
);

alter table public.teams
  add column log_window public.time_window not null default 'forever',
  add column log_window_days smallint check (log_window_days between 0 and 365),
  add column edit_window public.time_window not null default 'forever',
  add column edit_window_days smallint check (edit_window_days between 0 and 365),
  add check (log_window <> 'days' or log_window_days is not null),
  add check (edit_window <> 'days' or edit_window_days is not null);

grant update (log_window, log_window_days, edit_window, edit_window_days)
  on public.teams to authenticated;

-- Is day `d` still inside the window, when today is `today`?
create function public.date_in_window(
  w public.time_window,
  days smallint,
  today date,
  d date
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case w
    when 'forever' then true
    when 'days' then d >= today - days
    when 'week' then d >= public.week_monday(today)
    when 'month' then d >= date_trunc('month', today)::date
  end;
$$;

revoke execute on function public.date_in_window(public.time_window, smallint, date, date)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The sessions trigger, with the new rules added
-- ---------------------------------------------------------------------------

create or replace function public.prepare_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.teams;
  activity public.activity_types;
  rule public.credit_rules;
  -- Who is doing this. Empty for the photo-check worker and for seeding.
  actor uuid := (select auth.uid());
  actor_is_admin boolean;
  today date;
  -- The numbers that decide credits, or the day.
  numbers_changed boolean := false;
  -- Anything the app can edit, including notes.
  anything_changed boolean := false;
begin
  select * into t from public.teams where id = new.team_id;
  select * into activity from public.activity_types where id = new.activity_type_id;
  today := (now() at time zone t.time_zone)::date;
  actor_is_admin := actor is not null and public.is_team_admin(new.team_id);

  if tg_op = 'INSERT' then
    new.logged_by := coalesce(actor, new.logged_by, new.athlete_id);
    -- Admins logging for someone else: verified automatically.
    new.verification_status := case
      when new.logged_by <> new.athlete_id then 'passed'::public.verification_status
      else 'not_needed'::public.verification_status
    end;
    if activity.archived_at is not null then
      raise exception 'This activity type has been archived';
    end if;
  else
    numbers_changed :=
      new.activity_type_id is distinct from old.activity_type_id
      or new.intensity_id is distinct from old.intensity_id
      or new.duration_seconds is distinct from old.duration_seconds
      or new.distance_meters is distinct from old.distance_meters
      or new.session_date is distinct from old.session_date;
    anything_changed := numbers_changed
      or new.notes is distinct from old.notes
      or new.custom_label is distinct from old.custom_label
      or new.calendar_event_id is distinct from old.calendar_event_id;
  end if;

  if new.session_date > today then
    raise exception 'Sessions can''t be logged in the future';
  end if;

  -- The team's windows. Only athletes are limited, never admins.
  if actor is not null and not actor_is_admin then
    if tg_op = 'UPDATE' and anything_changed
       and not public.date_in_window(t.edit_window, t.edit_window_days, today, old.session_date) then
      raise exception 'This workout is too old to change. Ask a coach to change it.';
    end if;
    if (tg_op = 'INSERT' or new.session_date is distinct from old.session_date)
       and not public.date_in_window(t.log_window, t.log_window_days, today, new.session_date) then
      raise exception 'That day is too far back to log. Ask a coach to add it.';
    end if;
  end if;

  if not activity.is_custom then
    new.custom_label := null;
  end if;

  if tg_op = 'INSERT'
     or new.activity_type_id is distinct from old.activity_type_id
     or new.intensity_id is distinct from old.intensity_id
     or new.duration_seconds is distinct from old.duration_seconds
     or new.distance_meters is distinct from old.distance_meters then
    rule := public.find_credit_rule(new.activity_type_id, new.intensity_id);
    if rule.id is null then
      new.credits := 0;
      new.rule_used := null;
    else
      new.credits := public.calculate_credits(rule, new.duration_seconds, new.distance_meters);
      new.rule_used := jsonb_build_object(
        'kind', rule.kind,
        'credits', rule.credits,
        'per_minutes', rule.per_minutes,
        'per_meters', rule.per_meters,
        'intensity_specific', rule.intensity_id is not null
      );
    end if;
  end if;

  if tg_op = 'UPDATE' then
    new.updated_at := now();

    -- Who changed the numbers decides what happens to the verification.
    if numbers_changed and actor is not null then
      if actor_is_admin and actor <> new.athlete_id then
        -- An admin's word counts: verified.
        new.verification_status := 'passed';
        new.reviewed_by := actor;
        new.reviewed_at := now();
      elsif actor = new.athlete_id and old.verification_status <> 'not_needed' then
        -- The athlete changed a workout that had been through a check (or a
        -- coach's review): back to the coaches, marked as corrected.
        new.verification_status := 'flagged';
        new.verification_note := case
          when old.verification_status = 'flagged' then old.verification_note
          else 'Changed by the athlete after it was checked.'
        end;
        new.athlete_response := 'corrected';
        new.athlete_responded_at := now();
        new.reviewed_by := null;
        new.reviewed_at := null;
        new.review_note := null;
      end if;
    end if;
  end if;

  return new;
end;
$$;

-- Deleting follows the edit window too.
create function public.guard_session_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.teams;
  actor uuid := (select auth.uid());
begin
  if actor is null or public.is_team_admin(old.team_id) then
    return old;
  end if;
  select * into t from public.teams where id = old.team_id;
  -- The team itself is being deleted: nothing to guard.
  if not found then
    return old;
  end if;
  if not public.date_in_window(
    t.edit_window, t.edit_window_days, (now() at time zone t.time_zone)::date, old.session_date
  ) then
    raise exception 'This workout is too old to delete. Ask a coach to delete it.';
  end if;
  return old;
end;
$$;

create trigger guard_session_delete
  before delete on public.sessions
  for each row execute function public.guard_session_delete();

-- ---------------------------------------------------------------------------
-- "Fix it" on a flagged workout now follows the same rule as any edit: the
-- trigger marks it corrected and keeps it with the coaches. (It used to send
-- the photos through the check again.)
-- ---------------------------------------------------------------------------

create or replace function public.correct_flagged_session(
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
  s := public.own_flagged_session(session);

  if exists (
    select 1 from public.activity_types a
    where a.id = new_activity_type_id and a.archived_at is not null
      and a.id <> s.activity_type_id
  ) then
    raise exception 'This activity type has been archived';
  end if;

  update public.sessions
  set activity_type_id = new_activity_type_id,
      intensity_id = new_intensity_id,
      duration_seconds = new_duration_seconds,
      distance_meters = new_distance_meters,
      -- Also set here, in case the athlete saved without changing a number.
      athlete_response = 'corrected',
      athlete_responded_at = now(),
      athlete_response_note = nullif(trim(note), '')
  where id = session;
end;
$$;
