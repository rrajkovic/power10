-- Totals, targets and rankings, calculated from sessions on demand (nothing
-- stored). All dates are in the team's time zone; weeks run Monday–Sunday.
-- Rejected sessions never count. Targets apply to athletes only.
--
-- Called by the app:
--   team_period(team, kind, day)        bounds and target of a period
--   leaderboard(team, kind, day)         everyone's totals in a period
--   my_type_progress(team, day)          your per-type requirements this period
--   target_summary(team, day)            "14 / 22 athletes on track"
--   missed_target(team, day)             who missed it (coaches and admins only)
--   target_hit_rate(team)                % on target per period, this season
--   streaks(team)                        periods in a row on target, per athlete

create type public.period_kind as enum ('week', 'two_weeks', 'month', 'season');

-- ---------------------------------------------------------------------------
-- Building blocks (internal: not callable from the app)
-- ---------------------------------------------------------------------------

-- Monday of the week containing d.
create function public.week_monday(d date)
returns date
language sql
immutable
set search_path = ''
as $$
  select date_trunc('week', d)::date;
$$;

-- Today, in the team's time zone.
create function public.team_today(team uuid)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select (now() at time zone t.time_zone)::date from public.teams t where t.id = team;
$$;

-- The season containing a day (the latest-starting one if seasons overlap).
create function public.season_at(team uuid, d date)
returns public.seasons
language sql
stable
security definer
set search_path = ''
as $$
  select s.* from public.seasons s
  where s.team_id = team and d between s.start_date and s.end_date
  order by s.start_date desc
  limit 1;
$$;

-- First and last day of the period of a given kind that contains `day`.
-- Two-week periods count from the Monday of the season's first week (or of
-- the week the team was created, if no season covers the day).
create function public.period_bounds(
  team uuid,
  kind public.period_kind,
  day date,
  out period_start date,
  out period_end date
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.seasons;
  anchor date;
begin
  case kind
    when 'week' then
      period_start := public.week_monday(day);
      period_end := period_start + 6;
    when 'month' then
      period_start := date_trunc('month', day)::date;
      period_end := (period_start + interval '1 month' - interval '1 day')::date;
    when 'two_weeks' then
      s := public.season_at(team, day);
      anchor := public.week_monday(
        coalesce(s.start_date, (select t.created_at::date from public.teams t where t.id = team))
      );
      period_start := anchor + 14 * floor((public.week_monday(day) - anchor) / 14.0)::int;
      period_end := period_start + 13;
    when 'season' then
      s := public.season_at(team, day);
      period_start := s.start_date;
      period_end := s.end_date;
  end case;
end;
$$;

-- Required and maximum credits for a target period starting on p_start:
-- a special-week override if there is one, otherwise the season's target.
-- activity_type null = the total. Both null = no target.
create function public.period_target(
  team uuid,
  p_start date,
  activity_type uuid default null,
  out min_credits numeric,
  out max_credits numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.seasons := public.season_at(team, p_start);
  o public.target_overrides;
  t public.targets;
begin
  if s.id is null then
    return;
  end if;

  select * into o from public.target_overrides
  where season_id = s.id
    and period_start = p_start
    and activity_type_id is not distinct from activity_type;
  if found then
    min_credits := o.min_credits;
    max_credits := o.max_credits;
    return;
  end if;

  select * into t from public.targets
  where season_id = s.id and activity_type_id is not distinct from activity_type;
  if found then
    min_credits := t.min_credits;
    max_credits := t.max_credits;
  end if;
end;
$$;

-- Every active member's totals in a date range.
create function public.member_totals(team uuid, p_start date, p_end date)
returns table (
  user_id uuid,
  role public.member_role,
  credits numeric,
  minutes numeric,
  distance_meters bigint,
  sessions integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    m.user_id,
    m.role,
    coalesce(sum(s.credits), 0),
    coalesce(floor(sum(s.duration_seconds) / 6.0) / 10, 0),
    coalesce(sum(s.distance_meters), 0)::bigint,
    count(s.id)::integer
  from public.memberships m
  left join public.sessions s
    on s.team_id = m.team_id
    and s.athlete_id = m.user_id
    and s.session_date between p_start and p_end
    and s.verification_status <> 'rejected'
  where m.team_id = team
    and not public.is_locked_out(m)
  group by m.user_id, m.role;
$$;

-- Did each athlete meet the target of the target period [p_start, p_end]?
-- Met = total at least the target AND every per-type minimum reached.
-- Only athletes who had joined by the end of the period are included.
create function public.period_results(team uuid, p_start date, p_end date)
returns table (
  user_id uuid,
  credits numeric,
  sessions integer,
  target numeric,
  met boolean,
  short_by numeric,
  missing_types text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  with goal as (
    select * from public.period_target(team, p_start)
  ),
  athletes as (
    select tot.*
    from public.member_totals(team, p_start, p_end) tot
    join public.memberships m on m.team_id = team and m.user_id = tot.user_id
    where tot.role = 'athlete' and m.joined_at::date <= p_end
  ),
  type_goals as (
    select a.id as activity_type_id, a.name, pt.min_credits
    from public.activity_types a
    cross join lateral public.period_target(team, p_start, a.id) pt
    where a.team_id = team and pt.min_credits > 0
  ),
  -- Per-type minimums each athlete hasn't reached yet.
  type_shortfalls as (
    select at.user_id, tg.name
    from athletes at
    cross join type_goals tg
    left join public.sessions s
      on s.team_id = team
      and s.athlete_id = at.user_id
      and s.activity_type_id = tg.activity_type_id
      and s.session_date between p_start and p_end
      and s.verification_status <> 'rejected'
    group by at.user_id, tg.activity_type_id, tg.name, tg.min_credits
    having coalesce(sum(s.credits), 0) < tg.min_credits
  ),
  missing_by_user as (
    select ts.user_id, array_agg(ts.name order by ts.name) as missing
    from type_shortfalls ts
    group by ts.user_id
  )
  select
    at.user_id,
    at.credits,
    at.sessions,
    goal.min_credits,
    goal.min_credits is not null
      and at.credits >= goal.min_credits
      and mbu.missing is null,
    greatest(coalesce(goal.min_credits, 0) - at.credits, 0),
    coalesce(mbu.missing, '{}')
  from athletes at
  cross join goal
  left join missing_by_user mbu on mbu.user_id = at.user_id;
$$;

-- The team's target periods in the current season, up to today.
create function public.season_target_periods(team uuid)
returns table (period_start date, period_end date)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  today date := public.team_today(team);
  s public.seasons := public.season_at(team, today);
  kind public.period_kind := (select t.target_period::text::public.period_kind from public.teams t where t.id = team);
  first_start date;
  step interval;
begin
  if s.id is null then
    return;
  end if;
  first_start := (public.period_bounds(team, kind, s.start_date)).period_start;
  step := case kind when 'month' then interval '1 month' when 'two_weeks' then interval '14 days' else interval '7 days' end;

  return query
  select g::date, (public.period_bounds(team, kind, g::date)).period_end
  from generate_series(first_start, today, step) g;
end;
$$;

revoke execute on function
  public.team_today(uuid),
  public.season_at(uuid, date),
  public.period_bounds(uuid, public.period_kind, date),
  public.period_target(uuid, date, uuid),
  public.member_totals(uuid, date, date),
  public.period_results(uuid, date, date),
  public.season_target_periods(uuid)
from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Called by the app. Every function checks you're an active team member.
-- `day` defaults to today; pass another day to look at an earlier period.
-- ---------------------------------------------------------------------------

-- Bounds of the period, and its target if this kind is the team's target
-- period (a Month view of a weekly team has no target line).
create function public.team_period(
  team uuid,
  kind public.period_kind,
  day date default null
)
returns table (
  period_start date,
  period_end date,
  is_current boolean,
  target numeric,
  max_credits numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  today date;
  bounds record;
  goal_min numeric;
  goal_max numeric;
begin
  if not public.is_team_member(team) then
    raise exception 'Not a member of this team';
  end if;
  today := public.team_today(team);
  bounds := public.period_bounds(team, kind, coalesce(day, today));

  if bounds.period_start is null then
    return; -- e.g. Season view with no season covering that day
  end if;

  if kind::text = (select t.target_period::text from public.teams t where t.id = team) then
    select pt.min_credits, pt.max_credits into goal_min, goal_max
    from public.period_target(team, bounds.period_start) pt;
  end if;

  return query
  select
    bounds.period_start,
    bounds.period_end,
    today between bounds.period_start and bounds.period_end,
    goal_min,
    goal_max;
end;
$$;

-- Everyone's totals in the period. Athletes always appear (even with
-- nothing logged); coaches only if they logged something.
create function public.leaderboard(
  team uuid,
  kind public.period_kind,
  day date default null
)
returns table (
  user_id uuid,
  name text,
  avatar_path text,
  role public.member_role,
  credits numeric,
  minutes numeric,
  distance_meters bigint,
  sessions integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  bounds record;
begin
  if not public.is_team_member(team) then
    raise exception 'Not a member of this team';
  end if;
  bounds := public.period_bounds(team, kind, coalesce(day, public.team_today(team)));
  if bounds.period_start is null then
    return;
  end if;

  return query
  select tot.user_id, p.name, p.avatar_path, tot.role, tot.credits, tot.minutes,
         tot.distance_meters, tot.sessions
  from public.member_totals(team, bounds.period_start, bounds.period_end) tot
  join public.profiles p on p.id = tot.user_id
  where tot.role = 'athlete' or tot.sessions > 0
  order by tot.credits desc, p.name;
end;
$$;

-- Your credits per activity type in the current target period, for types
-- that have a requirement or a cap (e.g. "Lift 3 / 6").
create function public.my_type_progress(team uuid, day date default null)
returns table (
  activity_type_id uuid,
  name text,
  credits numeric,
  min_credits numeric,
  max_credits numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  kind public.period_kind;
  bounds record;
begin
  if not public.is_team_member(team) then
    raise exception 'Not a member of this team';
  end if;
  kind := (select t.target_period::text::public.period_kind from public.teams t where t.id = team);
  bounds := public.period_bounds(team, kind, coalesce(day, public.team_today(team)));

  return query
  select a.id, a.name, coalesce(sum(s.credits), 0), pt.min_credits, pt.max_credits
  from public.activity_types a
  cross join lateral public.period_target(team, bounds.period_start, a.id) pt
  left join public.sessions s
    on s.team_id = team
    and s.athlete_id = (select auth.uid())
    and s.activity_type_id = a.id
    and s.session_date between bounds.period_start and bounds.period_end
    and s.verification_status <> 'rejected'
  where a.team_id = team
    and (pt.min_credits > 0 or pt.max_credits is not null)
  group by a.id, a.name, a.sort_order, pt.min_credits, pt.max_credits
  order by a.sort_order;
end;
$$;

-- "14 / 22 athletes on track" for the team's target period containing `day`.
-- on_target is null when there's no target.
create function public.target_summary(team uuid, day date default null)
returns table (
  period_start date,
  period_end date,
  athletes integer,
  on_target integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  kind public.period_kind;
  bounds record;
begin
  if not public.is_team_member(team) then
    raise exception 'Not a member of this team';
  end if;
  kind := (select t.target_period::text::public.period_kind from public.teams t where t.id = team);
  bounds := public.period_bounds(team, kind, coalesce(day, public.team_today(team)));

  return query
  select
    bounds.period_start,
    bounds.period_end,
    count(*)::integer,
    case when bool_or(r.target is not null) then (count(*) filter (where r.met))::integer end
  from public.period_results(team, bounds.period_start, bounds.period_end) r;
end;
$$;

-- Athletes who missed (or, in the current period, haven't yet hit) the
-- target. Coaches and admins only.
create function public.missed_target(team uuid, day date default null)
returns table (
  user_id uuid,
  name text,
  avatar_path text,
  credits numeric,
  target numeric,
  short_by numeric,
  sessions integer,
  missing_types text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  kind public.period_kind;
  bounds record;
begin
  if not public.is_team_admin(team) then
    raise exception 'Only coaches and admins can see who missed the target';
  end if;
  kind := (select t.target_period::text::public.period_kind from public.teams t where t.id = team);
  bounds := public.period_bounds(team, kind, coalesce(day, public.team_today(team)));

  return query
  select r.user_id, p.name, p.avatar_path, r.credits, r.target, r.short_by, r.sessions,
         r.missing_types
  from public.period_results(team, bounds.period_start, bounds.period_end) r
  join public.profiles p on p.id = r.user_id
  where r.target is not null and not r.met
  -- Furthest behind first; people with no sessions at the very end.
  order by (r.sessions = 0), r.short_by desc, p.name;
end;
$$;

-- Share of athletes on target, per target period this season (up to today).
create function public.target_hit_rate(team uuid)
returns table (
  period_start date,
  period_end date,
  athletes integer,
  on_target integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_team_member(team) then
    raise exception 'Not a member of this team';
  end if;

  return query
  select p.period_start, p.period_end, count(r.user_id)::integer,
         (count(*) filter (where r.met))::integer
  from public.season_target_periods(team) p
  left join lateral public.period_results(team, p.period_start, p.period_end) r on true
  group by p.period_start, p.period_end
  order by p.period_start;
end;
$$;

-- Target periods in a row on target, counting back from the most recent
-- finished one. The current period only counts once the target is hit, so a
-- streak isn't broken just because the week isn't over yet.
create function public.streaks(team uuid)
returns table (
  user_id uuid,
  name text,
  avatar_path text,
  streak integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  today date;
begin
  if not public.is_team_member(team) then
    raise exception 'Not a member of this team';
  end if;
  today := public.team_today(team);

  return query
  with results as (
    select p.period_start, r.user_id, r.met
    from public.season_target_periods(team) p
    cross join lateral public.period_results(team, p.period_start, p.period_end) r
    where p.period_end < today or r.met
  ),
  ordered as (
    select res.user_id, res.met,
      count(*) filter (where not res.met)
        over (partition by res.user_id order by res.period_start desc
              rows between unbounded preceding and current row) as misses_so_far
    from results res
  )
  select o.user_id, p.name, p.avatar_path,
         (count(*) filter (where o.misses_so_far = 0))::integer
  from ordered o
  join public.profiles p on p.id = o.user_id
  group by o.user_id, p.name, p.avatar_path
  order by 4 desc, p.name;
end;
$$;

revoke execute on function
  public.team_period(uuid, public.period_kind, date),
  public.leaderboard(uuid, public.period_kind, date),
  public.my_type_progress(uuid, date),
  public.target_summary(uuid, date),
  public.missed_target(uuid, date),
  public.target_hit_rate(uuid),
  public.streaks(uuid)
from public, anon;

grant execute on function
  public.team_period(uuid, public.period_kind, date),
  public.leaderboard(uuid, public.period_kind, date),
  public.my_type_progress(uuid, date),
  public.target_summary(uuid, date),
  public.missed_target(uuid, date),
  public.target_hit_rate(uuid),
  public.streaks(uuid)
to authenticated;
