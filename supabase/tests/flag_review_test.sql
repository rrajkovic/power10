-- Athletes answering flags on their own workouts, and what coaches see.
-- Run with: supabase test db
begin;

create extension if not exists pgtap with schema extensions;

select plan(17);

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
select pg_temp.new_user('00000000-0000-0000-0000-0000000000a2', 'a2@example.com', 'Ben Two');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
create temp table team on commit drop as
  select public.create_team('Flag Test', 'UTC', 'coach') as id;
grant select on team to authenticated;
reset role;

insert into public.memberships (team_id, user_id, role)
select (select id from team), u, 'athlete'
from unnest(array[
  '00000000-0000-0000-0000-0000000000a1',
  '00000000-0000-0000-0000-0000000000a2'
]::uuid[]) u;

create temp table ids on commit drop as
  select
    (select id from public.activity_types where team_id = (select id from team) and name = 'Erg') as erg,
    (select id from public.activity_types where team_id = (select id from team) and name = 'Bike') as bike,
    '00000000-0000-0000-0000-00000000e001'::uuid as s1,
    '00000000-0000-0000-0000-00000000e002'::uuid as s2,
    '00000000-0000-0000-0000-00000000e003'::uuid as s3;
grant select on ids to authenticated;

-- Ann logs three sessions (71 minutes each); Ben is just a teammate.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
insert into public.sessions (id, team_id, athlete_id, activity_type_id, session_date, duration_seconds)
select s, (select id from team), '00000000-0000-0000-0000-0000000000a1', (select erg from ids),
       (now() at time zone 'UTC')::date, 71 * 60
from unnest(array[(select s1 from ids), (select s2 from ids), (select s3 from ids)]) s;
reset role;

-- A photo on s1 and s2 (as the worker would see them), then the check flags
-- all three. s3 is flagged without a photo.
insert into public.session_photos (team_id, session_id, storage_path, source, uploaded_by)
select (select id from team), s, (select id from team) || '/' || s || '/1.jpg', 'gallery',
       '00000000-0000-0000-0000-0000000000a1'
from unnest(array[(select s1 from ids), (select s2 from ids)]) s;
update public.verification_checks set status = 'done' where team_id = (select id from team);
update public.sessions
set verification_status = 'flagged', verification_note = 'Logged 71 min, but the screen shows 59 min of work.'
where team_id = (select id from team);

-- ---------------------------------------------------------------------------
-- The athlete sees their own flags; nobody else's.
-- ---------------------------------------------------------------------------

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select is(
  (select count(*)::int from public.my_flagged_sessions((select id from team))),
  3, 'An athlete sees their own flagged workouts'
);
select is(
  (select array_length(photo_paths, 1) from public.my_flagged_sessions((select id from team)) where id = (select s1 from ids)),
  1, 'With the photos to look at'
);
select throws_ok(
  $$ select * from public.flagged_sessions((select id from team)) $$,
  'Only coaches and admins can see flagged workouts',
  'An athlete can''t see the whole team''s flags'
);
select throws_ok(
  $$ update public.sessions set athlete_response = 'confirmed' where id = (select s1 from ids) $$,
  '42501', null, 'The answer can''t be written directly, only through the functions'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a2');
select is(
  (select count(*)::int from public.my_flagged_sessions((select id from team))),
  0, 'A teammate doesn''t see them'
);
select throws_ok(
  $$ select public.confirm_flagged_session((select s1 from ids)) $$,
  'You can only answer flags on your own workouts',
  'A teammate can''t answer for someone else'
);

-- ---------------------------------------------------------------------------
-- Confirm: stays flagged, marked as confirmed by the athlete.
-- ---------------------------------------------------------------------------

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select lives_ok(
  $$ select public.confirm_flagged_session((select s1 from ids), ' It was 71 minutes of work ') $$,
  'An athlete can confirm their own flagged workout'
);
reset role;
select is(
  (select verification_status::text || ' / ' || athlete_response::text || ' / ' || athlete_response_note
   from public.sessions where id = (select s1 from ids)),
  'flagged / confirmed / It was 71 minutes of work',
  'It stays flagged, with the athlete''s confirmation and note'
);
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select is(
  (select count(*)::int from public.my_flagged_sessions((select id from team))),
  2, 'A confirmed workout leaves the athlete''s list'
);

-- ---------------------------------------------------------------------------
-- Correct: new values, new credits, checked again.
-- ---------------------------------------------------------------------------

select lives_ok(
  $$ select public.correct_flagged_session(
       (select s2 from ids), (select bike from ids), null, 59 * 60, 15000) $$,
  'An athlete can correct their own flagged workout'
);
reset role;
select is(
  (select verification_status::text || ' / ' || athlete_response::text || ' / ' || duration_seconds || ' / ' || credits
   from public.sessions where id = (select s2 from ids)),
  'pending / corrected / 3540 / 5.9',
  'The fix is saved, credits are recalculated, and it''s pending again'
);
select is(
  (select count(*)::int from public.verification_checks
   where session_id = (select s2 from ids) and status = 'queued'),
  1, 'A new photo check is queued'
);

-- Without photos there's nothing to re-check: it stays flagged for a coach.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select public.correct_flagged_session((select s3 from ids), (select erg from ids), null, 59 * 60, null);
reset role;
select is(
  (select verification_status::text || ' / ' || athlete_response::text
   from public.sessions where id = (select s3 from ids)),
  'flagged / corrected', 'A corrected workout without photos stays flagged'
);

-- ---------------------------------------------------------------------------
-- Coaches see the flags and the athlete's answer, and have the final word.
-- ---------------------------------------------------------------------------

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select is(
  (select string_agg(coalesce(athlete_response::text, 'no answer'), ', ' order by athlete_response::text)
   from public.flagged_sessions((select id from team))),
  'confirmed, corrected', 'A coach sees flagged workouts with the athlete''s answer'
);
select is(
  (select athlete_name from public.flagged_sessions((select id from team)) limit 1),
  'Ann One', 'With the athlete''s name'
);
select lives_ok(
  $$ select public.review_session((select s1 from ids), true) $$,
  'A coach can still approve it'
);
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select throws_ok(
  $$ select public.confirm_flagged_session((select s1 from ids)) $$,
  'This workout isn''t waiting for your answer',
  'Once a coach has decided, the athlete can''t answer again'
);

select * from finish();
rollback;
