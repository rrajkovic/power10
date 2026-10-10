-- Local demo data. Runs automatically after `supabase db reset`, on your Mac
-- only (it's never applied to a real database).
--
-- Sign in with either account (password for both: localtest123):
--   coach@power10.test     Casey Coach, coach and admin
--   athlete@power10.test   Alex Athlete, athlete
--
-- Creates "Demo Rowing" (navy and crimson, weekly target 12 credits, max 30)
-- with 12 more athletes and six weeks of workouts.

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------

create function pg_temp.demo_user(user_id uuid, user_email text, user_name text)
returns void
language plpgsql
as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', user_id, 'authenticated', 'authenticated',
    user_email, extensions.crypt('localtest123', extensions.gen_salt('bf')), now(),
    '{"provider": "email", "providers": ["email"]}', jsonb_build_object('name', user_name),
    now(), now(), '', '', '', ''
  );
  insert into auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at)
  values (
    gen_random_uuid(), user_id, user_id::text, 'email',
    jsonb_build_object('sub', user_id::text, 'email', user_email, 'email_verified', true),
    now(), now()
  );
end;
$$;

select pg_temp.demo_user('d0000000-0000-0000-0000-00000000000c', 'coach@power10.test', 'Casey Coach');
select pg_temp.demo_user('d0000000-0000-0000-0000-00000000000a', 'athlete@power10.test', 'Alex Athlete');

create temp table demo_athletes (n int, id uuid, name text, effort numeric);
insert into demo_athletes values
  (1,  'd0000000-0000-0000-0000-000000000001', 'Jordan Reyes',     4.5),
  (2,  'd0000000-0000-0000-0000-000000000002', 'Sam Okafor',       1.6),
  (3,  'd0000000-0000-0000-0000-000000000003', 'Taylor Brooks',    1.25),
  (4,  'd0000000-0000-0000-0000-000000000004', 'Riley Chen',       1.15),
  (5,  'd0000000-0000-0000-0000-000000000005', 'Morgan Ellis',     1.05),
  (6,  'd0000000-0000-0000-0000-000000000006', 'Avery Novak',      1.0),
  (7,  'd0000000-0000-0000-0000-000000000007', 'Quinn Haddad',     0.95),
  (8,  'd0000000-0000-0000-0000-000000000008', 'Jamie Lindqvist',  0.85),
  (9,  'd0000000-0000-0000-0000-000000000009', 'Drew Castillo',    0.75),
  (10, 'd0000000-0000-0000-0000-000000000010', 'Parker Moss',      0.6),
  (11, 'd0000000-0000-0000-0000-000000000011', 'Rowan Fischer',    0.45),
  (12, 'd0000000-0000-0000-0000-000000000012', 'Emerson Vale',     0.0),
  (13, 'd0000000-0000-0000-0000-00000000000a', 'Alex Athlete',     0.9);

select pg_temp.demo_user(id, lower(replace(name, ' ', '.')) || '@power10.test', name)
from demo_athletes where n <= 12;

-- ---------------------------------------------------------------------------
-- Team (created as the coach, so it gets the defaults: activity types,
-- invites, first season and the 12-credit target)
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub": "d0000000-0000-0000-0000-00000000000c"}', true);
create temp table demo_team as
  select public.create_team('Demo Rowing', 'America/New_York', 'coach') as id;
select set_config('request.jwt.claims', '', true);

update public.teams
set accent_primary = '#011F5B', accent_secondary = '#990000'
where id = (select id from demo_team);

-- "Today" in the team's time zone (current_date is UTC and can be a day ahead).
create temp table demo_today as select public.team_today((select id from demo_team)) as d;

-- The season started six weeks ago (so there's history), with a max of 30.
update public.seasons
set start_date = public.week_monday((select d from demo_today)) - 42,
    end_date = public.week_monday((select d from demo_today)) - 42 + 364
where team_id = (select id from demo_team);
update public.targets set max_credits = 30 where team_id = (select id from demo_team);

insert into public.memberships (team_id, user_id, role, joined_at)
select (select id from demo_team), id, 'athlete', now() - interval '60 days'
from demo_athletes;
update public.memberships set joined_at = now() - interval '61 days'
where user_id = 'd0000000-0000-0000-0000-00000000000c';

-- ---------------------------------------------------------------------------
-- Six weeks of workouts. Deterministic "randomness" from hashing, so every
-- reset gives the same data. `effort` scales how much each athlete trains.
-- ---------------------------------------------------------------------------

insert into public.sessions (team_id, athlete_id, activity_type_id, intensity_id, session_date,
                             duration_seconds, distance_meters)
select
  (select id from demo_team),
  a.id,
  t.id,
  case when abs(hashtext(a.name || d::text || 'i')) % 4 = 0 then hard.id else steady.id end,
  d,
  (30 + abs(hashtext(a.name || d::text || 'm')) % 50) * 60,
  case when t.name in ('Erg', 'Row', 'Run', 'Bike', 'Berg')
       then (30 + abs(hashtext(a.name || d::text || 'm')) % 50) * 230 end
from demo_athletes a
cross join generate_series(public.week_monday((select d from demo_today)) - 42, (select d from demo_today), interval '1 day') d
cross join lateral (
  select at.id, at.name from public.activity_types at
  where at.team_id = (select id from demo_team) and at.name in ('Erg', 'Run', 'Bike', 'Lift')
  order by abs(hashtext(a.name || d::text || at.name))
  limit 1
) t
cross join (select id from public.intensities where team_id = (select id from demo_team) and name = 'Hard') hard
cross join (select id from public.intensities where team_id = (select id from demo_team) and name = 'Steady state') steady
-- Roughly 2–4 sessions a week, more for higher effort.
where abs(hashtext(a.name || d::text)) % 100 < 28 * a.effort;

-- The coach logs a couple of ergs this week.
insert into public.sessions (team_id, athlete_id, activity_type_id, session_date, duration_seconds, distance_meters)
select (select id from demo_team), 'd0000000-0000-0000-0000-00000000000c', at.id,
       public.week_monday((select d from demo_today)), 45 * 60, 10000
from public.activity_types at
where at.team_id = (select id from demo_team) and at.name = 'Erg';

-- One athlete over the max this week (shows the orange caution to admins).
insert into public.sessions (team_id, athlete_id, activity_type_id, session_date, duration_seconds, distance_meters)
select (select id from demo_team), 'd0000000-0000-0000-0000-000000000001', at.id,
       (select d from demo_today), 90 * 60, 21000
from public.activity_types at
where at.team_id = (select id from demo_team) and at.name = 'Erg';
