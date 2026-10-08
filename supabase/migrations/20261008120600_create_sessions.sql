-- Logged training. One row per athlete per workout (a group log creates one
-- row per athlete, sharing group_log_id).
--
-- The app sends only raw facts. The backend sets credits (floored to one
-- decimal), the rule used, who logged it and the verification status.
-- Every session counts unless its status is 'rejected'.

create type public.verification_status as enum (
  'not_needed', 'pending', 'passed', 'flagged', 'rejected'
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  activity_type_id uuid not null,
  intensity_id uuid,
  -- Only for the Custom type.
  custom_label text check (length(custom_label) <= 60),
  -- In the team's time zone.
  session_date date not null,
  duration_seconds integer not null check (duration_seconds between 1 and 86400),
  distance_meters integer check (distance_meters between 1 and 1000000),
  notes text check (length(notes) <= 2000),
  credits numeric(6, 1) not null default 0,
  -- Copy of the credit rule applied, so later rule changes don't rewrite history.
  rule_used jsonb,
  calendar_event_id uuid,
  logged_by uuid references public.profiles (id) on delete set null,
  group_log_id uuid,
  verification_status public.verification_status not null default 'not_needed',
  -- The AI's reason when it flags a session.
  verification_note text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  review_note text check (length(review_note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, team_id),
  foreign key (activity_type_id, team_id)
    references public.activity_types (id, team_id),
  foreign key (intensity_id, team_id)
    references public.intensities (id, team_id),
  foreign key (calendar_event_id, team_id)
    references public.calendar_events (id, team_id)
    on delete set null (calendar_event_id)
);

create index sessions_team_date_idx on public.sessions (team_id, session_date);
create index sessions_athlete_date_idx on public.sessions (athlete_id, session_date);
create index sessions_group_log_idx on public.sessions (group_log_id) where group_log_id is not null;

alter table public.sessions enable row level security;

-- ---------------------------------------------------------------------------
-- Credits
-- ---------------------------------------------------------------------------

-- Credits for one session under one rule, floored to one decimal (2.57 → 2.5).
create function public.calculate_credits(
  rule public.credit_rules,
  duration_seconds integer,
  distance_meters integer
)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select floor(
    case rule.kind
      when 'per_session' then rule.credits
      when 'per_time' then rule.credits * (duration_seconds / 60.0) / rule.per_minutes
      when 'per_distance' then coalesce(rule.credits * distance_meters / rule.per_meters::numeric, 0)
    end * 10
  ) / 10;
$$;

-- Exact type + intensity rule first, otherwise the type's default rule.
create function public.find_credit_rule(activity_type uuid, intensity uuid)
returns public.credit_rules
language sql
stable
security definer
set search_path = ''
as $$
  select r.* from public.credit_rules r
  where r.activity_type_id = activity_type
    and (r.intensity_id = intensity or r.intensity_id is null)
  order by r.intensity_id is null
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Backend-controlled fields
-- ---------------------------------------------------------------------------

create function public.prepare_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.teams;
  activity public.activity_types;
  rule public.credit_rules;
begin
  select * into t from public.teams where id = new.team_id;
  select * into activity from public.activity_types where id = new.activity_type_id;

  if tg_op = 'INSERT' then
    new.logged_by := coalesce((select auth.uid()), new.logged_by, new.athlete_id);
    -- Admins logging for someone else: verified automatically.
    new.verification_status := case
      when new.logged_by <> new.athlete_id then 'passed'::public.verification_status
      else 'not_needed'::public.verification_status
    end;
    if activity.archived_at is not null then
      raise exception 'This activity type has been archived';
    end if;
  end if;

  if new.session_date > (now() at time zone t.time_zone)::date then
    raise exception 'Sessions can''t be logged in the future';
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
  end if;

  return new;
end;
$$;

create trigger prepare_session
  before insert or update on public.sessions
  for each row execute function public.prepare_session();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

create function public.is_active_member(team uuid, member uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.team_id = team and m.user_id = member and not public.is_locked_out(m)
  );
$$;

-- Your own session as an active member, or any session on a team you admin.
create function public.can_edit_session(session uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.sessions s
    where s.id = session
      and (
        (s.athlete_id = (select auth.uid()) and public.is_team_member(s.team_id))
        or public.is_team_admin(s.team_id)
      )
  );
$$;

revoke execute on function
  public.find_credit_rule(uuid, uuid),
  public.is_active_member(uuid, uuid),
  public.can_edit_session(uuid)
from public, anon;

-- Locked-out members' sessions are hidden from the team (they still see their own).
create policy "Members can read team sessions"
  on public.sessions for select to authenticated
  using (
    athlete_id = (select auth.uid())
    or (public.is_team_member(team_id) and public.is_active_member(team_id, athlete_id))
  );

create policy "Athletes log their own sessions; admins log for members"
  on public.sessions for insert to authenticated
  with check (
    public.is_team_member(team_id)
    and (
      athlete_id = (select auth.uid())
      or (public.is_team_admin(team_id) and public.is_active_member(team_id, athlete_id))
    )
  );

create policy "Own sessions or admins can edit"
  on public.sessions for update to authenticated
  using (
    (athlete_id = (select auth.uid()) and public.is_team_member(team_id))
    or public.is_team_admin(team_id)
  )
  with check (
    (athlete_id = (select auth.uid()) and public.is_team_member(team_id))
    or public.is_team_admin(team_id)
  );

create policy "Own sessions or admins can delete"
  on public.sessions for delete to authenticated
  using (
    (athlete_id = (select auth.uid()) and public.is_team_member(team_id))
    or public.is_team_admin(team_id)
  );

-- The app may only send raw facts.
revoke insert, update on public.sessions from authenticated, anon;
grant insert (
  id, team_id, athlete_id, activity_type_id, intensity_id, custom_label,
  session_date, duration_seconds, distance_meters, notes, calendar_event_id,
  group_log_id
) on public.sessions to authenticated;
grant update (
  activity_type_id, intensity_id, custom_label, session_date,
  duration_seconds, distance_meters, notes, calendar_event_id
) on public.sessions to authenticated;

-- ---------------------------------------------------------------------------
-- Admin review (override the AI). Never on your own session.
-- ---------------------------------------------------------------------------

create function public.review_session(session uuid, approve boolean, note text default null)
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
  set verification_status = case when approve then 'passed' else 'rejected' end::public.verification_status,
      reviewed_by = (select auth.uid()),
      reviewed_at = now(),
      review_note = note
  where id = session;
end;
$$;

revoke execute on function public.review_session(uuid, boolean, text) from public, anon;
grant execute on function public.review_session(uuid, boolean, text) to authenticated;
