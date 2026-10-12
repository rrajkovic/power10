-- Run with: supabase test db
-- Everything happens in a transaction that is rolled back at the end.
begin;

create extension if not exists pgtap with schema extensions;

select plan(38);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function pg_temp.new_user(user_id uuid, user_email text)
returns void language sql as $$
  insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, aud, role)
  values (user_id, user_email, now(), '{}'::jsonb, 'authenticated', 'authenticated');
$$;

-- Act as a signed-in user for the following statements.
create function pg_temp.act_as(user_id uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

-- "Today" for the Penn test team (New York). current_date is UTC, which can
-- already be tomorrow there, and sessions can't be logged in the future.
create temp table today_ny on commit drop as
  select (now() at time zone 'America/New_York')::date as d;
grant select on today_ny to authenticated;

-- coach, athlete (Penn), outsider (another team)
select pg_temp.new_user('00000000-0000-0000-0000-00000000000c', 'coach@upenn.edu');
select pg_temp.new_user('00000000-0000-0000-0000-00000000000a', 'athlete@gmail.com');
select pg_temp.new_user('00000000-0000-0000-0000-00000000000b', 'second@gmail.com');
select pg_temp.new_user('00000000-0000-0000-0000-00000000000f', 'outsider@gmail.com');

-- ---------------------------------------------------------------------------
-- Sign-up
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::int from public.profiles where id::text like '00000000-0000-0000-0000-%'),
  4, 'Every sign-up gets a profile'
);
select is(
  (select email from public.user_emails
   where user_id = '00000000-0000-0000-0000-00000000000c' and kind = 'primary'),
  'coach@upenn.edu', 'Every sign-up gets its primary email row'
);

-- ---------------------------------------------------------------------------
-- Creating a team
-- ---------------------------------------------------------------------------

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
create temp table penn on commit drop as
  select public.create_team('Penn LWT', 'America/New_York', 'coach') as id;
grant select on penn to authenticated;

select is(
  (select role::text || '/' || is_admin from public.memberships
   where team_id = (select id from penn)),
  'coach/true', 'The creator is a coach and an admin'
);
select is(
  (select count(*)::int from public.activity_types where team_id = (select id from penn)),
  7, 'New teams get the 7 default activity types'
);
select is(
  (select count(*)::int from public.intensities where team_id = (select id from penn)),
  2, 'New teams get the default intensities'
);
select is(
  (select count(*)::int from public.credit_rules where team_id = (select id from penn)),
  7, 'Every default type gets a default credit rule'
);
select is(
  (select count(*)::int from public.invites where team_id = (select id from penn)),
  2, 'New teams get an athlete invite and a coach invite'
);
reset role;

create temp table codes on commit drop as
  select role, code from public.invites where team_id = (select id from penn);
grant select on codes to authenticated;

-- ---------------------------------------------------------------------------
-- Joining
-- ---------------------------------------------------------------------------

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select lives_ok(
  $$ select public.join_team((select code from codes where role = 'athlete')) $$,
  'An athlete can join with the athlete code'
);
select is(
  (select role::text || '/' || is_admin from public.memberships
   where team_id = (select id from penn) and user_id = '00000000-0000-0000-0000-00000000000a'),
  'athlete/false', 'Joining with the athlete code makes you a plain athlete'
);
select throws_ok(
  $$ select public.join_team('NOTACODE') $$,
  'This invite is invalid or has been reset'
);
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select public.join_team((select code from codes where role = 'athlete'));
reset role;

-- ---------------------------------------------------------------------------
-- Isolation between teams
-- ---------------------------------------------------------------------------

select pg_temp.act_as('00000000-0000-0000-0000-00000000000f');
select public.create_team('Other club', 'Europe/Belgrade', 'athlete');
select is(
  (select count(*)::int from public.teams),
  1, 'An outsider only sees their own team'
);
select is(
  (select count(*)::int from public.memberships where team_id = (select id from penn)),
  0, 'An outsider sees no Penn memberships'
);
select is(
  (select count(*)::int from public.profiles),
  1, 'An outsider only sees their own profile'
);
select throws_ok(
  $$ insert into public.sessions (team_id, athlete_id, activity_type_id, session_date, duration_seconds)
     values ((select id from penn), '00000000-0000-0000-0000-00000000000f',
             (select id from public.activity_types limit 1), (select d from today_ny), 600) $$,
  '42501', null, 'An outsider can''t log a session on another team'
);
reset role;

-- ---------------------------------------------------------------------------
-- Logging and credits
-- ---------------------------------------------------------------------------

create temp table ids on commit drop as
  select
    (select id from public.activity_types where team_id = (select id from penn) and name = 'Erg') as erg,
    (select id from public.intensities where team_id = (select id from penn) and name = 'Hard') as hard,
    (select id from public.intensities where team_id = (select id from penn) and name = 'Steady state') as steady;
grant select on ids to authenticated;

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');

-- 25.7 minutes at the default 1 credit / 10 min = 2.57 → floored to 2.5
insert into public.sessions (id, team_id, athlete_id, activity_type_id, intensity_id, session_date, duration_seconds)
values ('10000000-0000-0000-0000-000000000001', (select id from penn),
        '00000000-0000-0000-0000-00000000000a', (select erg from ids), (select steady from ids),
        (select d from today_ny) - 1, 1542);

select is(
  (select credits from public.sessions where id = '10000000-0000-0000-0000-000000000001'),
  2.5::numeric, 'Credits are floored to one decimal (2.57 → 2.5)'
);
select is(
  (select status::text from public.session_verifications(array['10000000-0000-0000-0000-000000000001'::uuid])),
  'not_needed', 'A self-logged session without photos needs no verification'
);
select throws_ok(
  $$ insert into public.sessions (team_id, athlete_id, activity_type_id, session_date, duration_seconds, credits)
     values ((select id from penn), '00000000-0000-0000-0000-00000000000a', (select erg from ids), (select d from today_ny), 600, 99) $$,
  '42501', null, 'The app can''t send credits'
);
select throws_ok(
  $$ insert into public.sessions (team_id, athlete_id, activity_type_id, session_date, duration_seconds)
     values ((select id from penn), '00000000-0000-0000-0000-00000000000b', (select erg from ids), (select d from today_ny), 600) $$,
  '42501', null, 'An athlete can''t log a session for someone else'
);
select throws_ok(
  $$ insert into public.sessions (team_id, athlete_id, activity_type_id, session_date, duration_seconds)
     values ((select id from penn), '00000000-0000-0000-0000-00000000000a', (select erg from ids), (select d from today_ny) + 2, 600) $$,
  'Sessions can''t be logged in the future'
);
select throws_ok(
  $$ update public.sessions set verification_status = 'passed'
     where id = '10000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'An athlete can''t change their own verification status'
);
select throws_ok(
  $$ insert into public.credit_rules (team_id, activity_type_id, intensity_id, kind, credits)
     values ((select id from penn), (select erg from ids), (select hard from ids), 'per_session', 50) $$,
  '42501', null, 'An athlete can''t change credit rules'
);
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');

-- Intensity-specific rule: hard Erg = 10 credits per session.
insert into public.credit_rules (team_id, activity_type_id, intensity_id, kind, credits)
values ((select id from penn), (select erg from ids), (select hard from ids), 'per_session', 10);

-- Coach logs a hard erg for the athlete.
insert into public.sessions (id, team_id, athlete_id, activity_type_id, intensity_id, session_date, duration_seconds)
values ('10000000-0000-0000-0000-000000000002', (select id from penn),
        '00000000-0000-0000-0000-00000000000a', (select erg from ids), (select hard from ids),
        (select d from today_ny), 1800);

select is(
  (select credits from public.sessions where id = '10000000-0000-0000-0000-000000000002'),
  10.0::numeric, 'The intensity-specific rule wins over the type''s default rule'
);
select is(
  (select v.status::text || '/' || (s.logged_by = '00000000-0000-0000-0000-00000000000c')
   from public.sessions s
   join public.session_verifications(array[s.id]) v on v.session_id = s.id
   where s.id = '10000000-0000-0000-0000-000000000002'),
  'passed/true', 'A session an admin logs for someone else is verified automatically'
);
select is(
  (select credits from public.sessions where id = '10000000-0000-0000-0000-000000000001'),
  2.5::numeric, 'Adding a rule doesn''t rewrite old sessions'
);

-- Coach's own session, then reviews.
insert into public.sessions (id, team_id, athlete_id, activity_type_id, session_date, duration_seconds)
values ('10000000-0000-0000-0000-000000000003', (select id from penn),
        '00000000-0000-0000-0000-00000000000c', (select erg from ids), (select d from today_ny), 600);
select throws_ok(
  $$ select public.review_session('10000000-0000-0000-0000-000000000003', true) $$,
  'You can''t review your own session'
);
select lives_ok(
  $$ select public.review_session('10000000-0000-0000-0000-000000000001', false, 'Wrong date') $$,
  'An admin can reject a teammate''s session'
);
select is(
  (select status::text from public.session_verifications(array['10000000-0000-0000-0000-000000000001'::uuid])),
  'rejected', 'The rejection is saved'
);
reset role;

-- ---------------------------------------------------------------------------
-- Roles and admin
-- ---------------------------------------------------------------------------

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select public.set_member_admin((select id from penn), '00000000-0000-0000-0000-00000000000a', true);
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select throws_ok(
  $$ select public.set_member_admin((select id from penn), '00000000-0000-0000-0000-00000000000b', true) $$,
  'Only coaches can grant or remove admin'
);
select throws_ok(
  $$ select public.remove_member((select id from penn), '00000000-0000-0000-0000-00000000000c') $$,
  'Only coaches can remove coaches'
);
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select throws_ok(
  $$ select public.set_member_admin((select id from penn), '00000000-0000-0000-0000-00000000000c', false) $$,
  'Coaches are always admins'
);
reset role;

-- ---------------------------------------------------------------------------
-- Email requirement and grace period
-- ---------------------------------------------------------------------------

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
update public.teams
set require_email_domain = true, allowed_domains = array['upenn.edu']
where id = (select id from penn);
reset role;

select is(
  (select grace_until is null from public.memberships
   where team_id = (select id from penn) and user_id = '00000000-0000-0000-0000-00000000000c'),
  true, 'A member with a matching email gets no grace period'
);
select ok(
  (select grace_until > now() + interval '13 days' from public.memberships
   where team_id = (select id from penn) and user_id = '00000000-0000-0000-0000-00000000000b'),
  'Turning the requirement on gives non-matching members 2 weeks'
);

-- A verified school email (secondary, subdomain) clears the grace period.
insert into public.user_emails (user_id, email, kind, verified_at)
values ('00000000-0000-0000-0000-00000000000a', 'athlete@seas.upenn.edu', 'secondary', now());
select is(
  (select grace_until is null from public.memberships
   where team_id = (select id from penn) and user_id = '00000000-0000-0000-0000-00000000000a'),
  true, 'A verified subdomain secondary email satisfies the requirement'
);

-- Grace period over → locked out.
update public.memberships set grace_until = now() - interval '1 minute'
where team_id = (select id from penn) and user_id = '00000000-0000-0000-0000-00000000000b';

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select is(
  (select count(*)::int from public.teams), 0,
  'A locked-out member can''t see the team'
);
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select is(
  (select count(*)::int from public.memberships where team_id = (select id from penn)),
  2, 'The team can''t see a locked-out member'
);
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-00000000000f');
select throws_ok(
  $$ select public.join_team((select code from codes where role = 'athlete')) $$,
  'This team requires a verified email from its school domain'
);
reset role;

-- ---------------------------------------------------------------------------
-- Leaving
-- ---------------------------------------------------------------------------

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
-- Make the coach the only admin again.
select public.set_member_admin((select id from penn), '00000000-0000-0000-0000-00000000000a', false);
select throws_ok(
  $$ select public.leave_team((select id from penn)) $$,
  'Make someone else an admin before leaving'
);
reset role;

-- The outsider is the only member (an athlete admin) of their team.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000f');
select public.leave_team((select team_id from public.memberships limit 1));
reset role;
select is(
  (select count(*)::int from public.teams where name = 'Other club'),
  0, 'When the last member leaves, the team is deleted'
);

select * from finish();
rollback;
