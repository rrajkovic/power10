-- Totals, targets, leaderboard, missed target, hit rate and streaks.
-- Run with: supabase test db
begin;

create extension if not exists pgtap with schema extensions;

select plan(24);

create function pg_temp.new_user(user_id uuid, user_email text, user_name text)
returns void language sql as $$
  insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, aud, role)
  values (user_id, user_email, now(), jsonb_build_object('name', user_name), 'authenticated', 'authenticated');
$$;

create function pg_temp.act_as(user_id uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

-- Coach, three athletes, and someone from another team.
select pg_temp.new_user('00000000-0000-0000-0000-0000000000c1', 'coach@example.com', 'Coach C');
select pg_temp.new_user('00000000-0000-0000-0000-0000000000a1', 'a1@example.com', 'Ann One');
select pg_temp.new_user('00000000-0000-0000-0000-0000000000a2', 'a2@example.com', 'Ben Two');
select pg_temp.new_user('00000000-0000-0000-0000-0000000000a3', 'a3@example.com', 'Cat Three');
select pg_temp.new_user('00000000-0000-0000-0000-0000000000f1', 'out@example.com', 'Out Sider');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
create temp table team on commit drop as
  select public.create_team('Progress Test', 'UTC', 'coach') as id;
grant select on team to authenticated;
reset role;

-- ---------------------------------------------------------------------------
-- New teams get a first season and a 12-credit weekly target.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::int from public.seasons where team_id = (select id from team)),
  1, 'A new team gets a first season'
);
select is(
  (select min_credits from public.targets where team_id = (select id from team) and activity_type_id is null),
  12.0::numeric, 'The first season has a weekly target of 12 credits'
);
select is(
  (select max_credits from public.targets where team_id = (select id from team) and activity_type_id is null),
  null, 'The default target has no max'
);

-- ---------------------------------------------------------------------------
-- Setup: athletes join; the season starts 3 weeks before this week (so there
-- is history); everyone joined before that.
-- ---------------------------------------------------------------------------

insert into public.memberships (team_id, user_id, role)
select (select id from team), u, 'athlete'
from unnest(array[
  '00000000-0000-0000-0000-0000000000a1',
  '00000000-0000-0000-0000-0000000000a2',
  '00000000-0000-0000-0000-0000000000a3'
]::uuid[]) u;

create temp table w on commit drop as
  select public.week_monday(current_date) as w0,
         public.week_monday(current_date) - 7 as w1,
         public.week_monday(current_date) - 14 as w2,
         public.week_monday(current_date) - 21 as w3;
grant select on w to authenticated;

update public.seasons set start_date = (select w3 from w) where team_id = (select id from team);
update public.memberships set joined_at = (select w3 from w) - 1 where team_id = (select id from team);

-- Sessions (default rule: 1 credit per 10 minutes).
--   Ann: 130 min in each of the last 3 weeks and today     → 13 credits each week
--   Ben: 130 min (w3), 60 min (w2), 130 min (w1), and a rejected 200 min today
--   Cat: nothing
--   Coach: 60 min today
create temp table erg on commit drop as
  select id from public.activity_types where team_id = (select id from team) and name = 'Erg';

insert into public.sessions (team_id, athlete_id, activity_type_id, session_date, duration_seconds)
select (select id from team), athlete::uuid, (select id from erg), day, minutes * 60
from (values
  ('00000000-0000-0000-0000-0000000000a1', (select w3 from w), 130),
  ('00000000-0000-0000-0000-0000000000a1', (select w2 from w), 130),
  ('00000000-0000-0000-0000-0000000000a1', (select w1 from w), 130),
  ('00000000-0000-0000-0000-0000000000a1', current_date, 130),
  ('00000000-0000-0000-0000-0000000000a2', (select w3 from w), 130),
  ('00000000-0000-0000-0000-0000000000a2', (select w2 from w), 60),
  ('00000000-0000-0000-0000-0000000000a2', (select w1 from w), 130),
  ('00000000-0000-0000-0000-0000000000a2', current_date, 200),
  ('00000000-0000-0000-0000-0000000000c1', current_date, 60)
) as v(athlete, day, minutes);

update public.sessions set verification_status = 'rejected'
where athlete_id = '00000000-0000-0000-0000-0000000000a2' and session_date = current_date;

-- ---------------------------------------------------------------------------
-- Periods
-- ---------------------------------------------------------------------------

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');

select is(
  (select period_start from public.team_period((select id from team), 'week')),
  (select w0 from w), 'The current week starts on Monday'
);
select is(
  (select target || '/' || is_current from public.team_period((select id from team), 'week')),
  '12.0/true', 'The current week has the 12-credit target'
);
select is(
  (select target from public.team_period((select id from team), 'month')),
  null, 'A Month view of a weekly team has no target line'
);
select is(
  (select period_start from public.team_period((select id from team), 'season')),
  (select w3 from w), 'Season view covers the season'
);

-- ---------------------------------------------------------------------------
-- Leaderboard
-- ---------------------------------------------------------------------------

select is(
  (select string_agg(name || '=' || credits, ', ' order by credits desc, name)
   from public.leaderboard((select id from team), 'week')),
  'Ann One=13.0, Coach C=6.0, Ben Two=0, Cat Three=0',
  'This week: athletes always appear, the coach because she logged, rejected sessions don''t count'
);
select is(
  (select minutes from public.leaderboard((select id from team), 'week')
   where name = 'Ann One'),
  130.0::numeric, 'Minutes are totalled'
);
select is(
  (select string_agg(name || '=' || credits, ', ' order by credits desc, name)
   from public.leaderboard((select id from team), 'week', (select w1 from w))),
  'Ann One=13.0, Ben Two=13.0, Cat Three=0',
  'Last week: the coach logged nothing, so she isn''t listed'
);

-- ---------------------------------------------------------------------------
-- Team goal card and missed target
-- ---------------------------------------------------------------------------

select is(
  (select athletes || '/' || on_target from public.target_summary((select id from team))),
  '3/1', 'This week: 1 of 3 athletes on target (coaches don''t count)'
);
select is(
  (select athletes || '/' || on_target from public.target_summary((select id from team), (select w2 from w))),
  '3/1', 'Two weeks ago: only Ann hit 12'
);
select throws_ok(
  $$ select * from public.missed_target((select id from team)) $$,
  'Only coaches and admins can see who missed the target'
);
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select is(
  (select string_agg(name, ', ') from public.missed_target((select id from team))),
  'Ben Two, Cat Three',
  'Coaches see who is behind this week, and athletes with no sessions come last'
);
select is(
  (select name || ' short ' || short_by from public.missed_target((select id from team), (select w2 from w))
   where name = 'Ben Two'),
  'Ben Two short 6.0', 'Missed target shows how far short someone was'
);
reset role;

-- ---------------------------------------------------------------------------
-- Hit rate and streaks
-- ---------------------------------------------------------------------------

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a2');
select is(
  (select string_agg(on_target || '/' || athletes, ' ' order by period_start)
   from public.target_hit_rate((select id from team))),
  '2/3 1/3 2/3 1/3', 'Hit rate per week this season'
);
select is(
  (select string_agg(name || '=' || streak, ', ' order by streak desc, name)
   from public.streaks((select id from team))),
  'Ann One=4, Ben Two=1, Cat Three=0',
  'Streaks: Ann 4 (this week already hit), Ben 1 (week not over yet doesn''t break it), Cat 0'
);
reset role;

-- ---------------------------------------------------------------------------
-- Per-type requirements and overrides
-- ---------------------------------------------------------------------------

insert into public.targets (team_id, season_id, activity_type_id, min_credits)
select (select id from team), s.id, a.id, 3
from public.seasons s, public.activity_types a
where s.team_id = (select id from team) and a.team_id = (select id from team) and a.name = 'Lift';

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select is(
  (select name || ' ' || credits || '/' || min_credits from public.my_type_progress((select id from team))),
  'Lift 0/3.0', 'Your per-type progress shows the Lift requirement'
);
select is(
  (select on_target from public.target_summary((select id from team))),
  0, 'Missing a per-type minimum means not on target'
);
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select is(
  (select missing_types from public.missed_target((select id from team)) where name = 'Ann One'),
  array['Lift'], 'Missed target shows which type was missing'
);
reset role;

-- A taper week: override this week's total target down to 6.
delete from public.targets where activity_type_id is not null;
insert into public.target_overrides (team_id, season_id, period_start, min_credits, label)
select (select id from team), s.id, (select w0 from w), 6, 'Taper'
from public.seasons s where s.team_id = (select id from team);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select is(
  (select target from public.team_period((select id from team), 'week')),
  6.0::numeric, 'A week override replaces the season target'
);
reset role;

-- ---------------------------------------------------------------------------
-- Two-week periods and access
-- ---------------------------------------------------------------------------

update public.teams set target_period = 'two_weeks' where id = (select id from team);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select is(
  (select period_start from public.team_period((select id from team), 'two_weeks')),
  (select w1 from w), 'Two-week periods count from the Monday of the season''s first week'
);
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000f1');
select throws_ok(
  $$ select * from public.leaderboard((select id from team), 'week') $$,
  'Not a member of this team'
);
select throws_ok(
  $$ select * from public.target_summary((select id from team)) $$,
  'Not a member of this team'
);
reset role;

select * from finish();
rollback;
