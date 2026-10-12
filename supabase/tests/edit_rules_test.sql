-- Who can change a workout when, and what an edit does to its verification.
-- Run with: supabase test db
begin;

create extension if not exists pgtap with schema extensions;

select plan(22);

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

select pg_temp.new_user('00000000-0000-0000-0000-0000000000c1', 'coach@example.com', 'Coach C');
select pg_temp.new_user('00000000-0000-0000-0000-0000000000a1', 'a1@example.com', 'Ann One');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
create temp table team on commit drop as
  select public.create_team('Rules Test', 'UTC', 'coach') as id;
grant select on team to authenticated;
reset role;

insert into public.memberships (team_id, user_id, role)
values ((select id from team), '00000000-0000-0000-0000-0000000000a1', 'athlete');

create temp table ids on commit drop as
  select
    (select id from public.activity_types where team_id = (select id from team) and name = 'Erg') as erg,
    (now() at time zone 'UTC')::date as today,
    '00000000-0000-0000-0000-00000000e001'::uuid as plain,
    '00000000-0000-0000-0000-00000000e002'::uuid as verified,
    '00000000-0000-0000-0000-00000000e003'::uuid as old_one,
    '00000000-0000-0000-0000-00000000e004'::uuid as for_delete;
grant select on ids to authenticated;

-- Ann logs: two today, and two 40 days ago (no limits yet).
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
insert into public.sessions (id, team_id, athlete_id, activity_type_id, session_date, duration_seconds)
values
  ((select plain from ids), (select id from team), '00000000-0000-0000-0000-0000000000a1', (select erg from ids), (select today from ids), 1800),
  ((select verified from ids), (select id from team), '00000000-0000-0000-0000-0000000000a1', (select erg from ids), (select today from ids), 1800),
  ((select old_one from ids), (select id from team), '00000000-0000-0000-0000-0000000000a1', (select erg from ids), (select today from ids) - 40, 1800),
  ((select for_delete from ids), (select id from team), '00000000-0000-0000-0000-0000000000a1', (select erg from ids), (select today from ids) - 40, 1800);
reset role;
-- One of today's has passed the photo check.
update public.sessions set verification_status = 'passed' where id = (select verified from ids);

-- ---------------------------------------------------------------------------
-- What an edit does to verification
-- ---------------------------------------------------------------------------

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
update public.sessions set duration_seconds = 2400 where id = (select plain from ids);
update public.sessions set notes = 'felt good' where id = (select verified from ids);
reset role;
select is(
  (select verification_status::text from public.sessions where id = (select plain from ids)),
  'not_needed', 'Editing a workout that was never checked changes nothing else'
);
select is(
  (select verification_status::text from public.sessions where id = (select verified from ids)),
  'passed', 'Editing only the notes of a verified workout keeps it verified'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
update public.sessions set duration_seconds = 3600 where id = (select verified from ids);
reset role;
select is(
  (select verification_status::text || ' / ' || athlete_response::text || ' / ' || credits
   from public.sessions where id = (select verified from ids)),
  'flagged / corrected / 6.0',
  'An athlete changing the numbers of a verified workout sends it to the coaches as corrected'
);
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select is(
  (select count(*)::int from public.flagged_sessions((select id from team))),
  1, 'It shows up in the coaches'' list'
);

update public.sessions set duration_seconds = 3000 where id = (select verified from ids);
reset role;
select is(
  (select verification_status::text || ' / ' || (reviewed_by = '00000000-0000-0000-0000-0000000000c1')::text || ' / ' || credits
   from public.sessions where id = (select verified from ids)),
  'passed / true / 5.0',
  'An admin changing the numbers verifies it'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
update public.sessions set duration_seconds = 3060 where id = (select verified from ids);
reset role;
select is(
  (select verification_status::text || ' / ' || coalesce(reviewed_at::text, 'not reviewed')
   from public.sessions where id = (select verified from ids)),
  'flagged / not reviewed',
  'If the athlete changes it again after that, it goes back to the coaches'
);

-- ---------------------------------------------------------------------------
-- The edit window
-- ---------------------------------------------------------------------------

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
-- Row-level security silently skips rows you may not change.
update public.teams set edit_window = 'week' where id = (select id from team);
select is(
  (select edit_window::text from public.teams where id = (select id from team)),
  'forever', 'An athlete can''t change the team''s windows'
);
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select lives_ok(
  $$ update public.teams set edit_window = 'days', edit_window_days = 3 where id = (select id from team) $$,
  'An admin can set the edit window'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select lives_ok(
  $$ update public.sessions set notes = 'still fine' where id = (select plain from ids) $$,
  'Inside the window an athlete can still edit'
);
select throws_ok(
  $$ update public.sessions set notes = 'too late' where id = (select old_one from ids) $$,
  'This workout is too old to change. Ask a coach to change it.',
  'Outside the window an athlete can''t edit'
);
select throws_ok(
  $$ delete from public.sessions where id = (select for_delete from ids) $$,
  'This workout is too old to delete. Ask a coach to delete it.',
  'Or delete'
);
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select lives_ok(
  $$ update public.sessions set notes = 'coach note' where id = (select old_one from ids) $$,
  'An admin can always edit'
);
select lives_ok(
  $$ delete from public.sessions where id = (select for_delete from ids) $$,
  'And always delete'
);

-- ---------------------------------------------------------------------------
-- The log window
-- ---------------------------------------------------------------------------

select lives_ok(
  $$ update public.teams set log_window = 'days', log_window_days = 2 where id = (select id from team) $$,
  'An admin can set the log window'
);
select throws_ok(
  $$ update public.teams set log_window = 'days', log_window_days = null where id = (select id from team) $$,
  '23514', null, 'A window in days needs a number of days'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select lives_ok(
  $$ insert into public.sessions (team_id, athlete_id, activity_type_id, session_date, duration_seconds)
     values ((select id from team), '00000000-0000-0000-0000-0000000000a1', (select erg from ids), (select today from ids) - 2, 1800) $$,
  'An athlete can log inside the window'
);
select throws_ok(
  $$ insert into public.sessions (team_id, athlete_id, activity_type_id, session_date, duration_seconds)
     values ((select id from team), '00000000-0000-0000-0000-0000000000a1', (select erg from ids), (select today from ids) - 3, 1800) $$,
  'That day is too far back to log. Ask a coach to add it.',
  'But not further back'
);
select throws_ok(
  $$ update public.sessions set session_date = (select today from ids) - 3 where id = (select plain from ids) $$,
  'That day is too far back to log. Ask a coach to add it.',
  'And can''t move a workout to a day outside it'
);
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select lives_ok(
  $$ insert into public.sessions (team_id, athlete_id, activity_type_id, session_date, duration_seconds)
     values ((select id from team), '00000000-0000-0000-0000-0000000000a1', (select erg from ids), (select today from ids) - 30, 1800) $$,
  'A coach can log any day for an athlete'
);

-- ---------------------------------------------------------------------------
-- Deleting the team takes everything with it, whatever the windows say.
-- ---------------------------------------------------------------------------

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select throws_ok(
  $$ select public.delete_team((select id from team)) $$,
  'Only coaches can delete the team',
  'An athlete can''t delete the team'
);
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select lives_ok(
  $$ select public.delete_team((select id from team)) $$,
  'A coach can, even with workouts too old for athletes to delete'
);
reset role;
select is(
  (select count(*)::int from public.sessions where team_id = (select id from team)),
  0, 'Its workouts go with it'
);

select * from finish();
rollback;
