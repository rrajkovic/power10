begin;

create extension if not exists pgtap with schema extensions;

select plan(5);

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, aud, role)
values
  ('00000000-0000-0000-0000-00000000000c', 'coach@example.com', now(), '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000a', 'athlete@example.com', now(), '{}', 'authenticated', 'authenticated');

create function pg_temp.act_as(user_id uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
create temp table team on commit drop as select public.create_team('Colors', 'UTC', 'coach') as id;
grant select on team to authenticated;
reset role;

create temp table athlete_code on commit drop as
  select code from public.invites where team_id = (select id from team) and role = 'athlete';
grant select on athlete_code to authenticated;

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select public.join_team((select code from athlete_code));
reset role;

select is(
  (select accent_primary || '/' || coalesce(accent_secondary, 'none') from public.teams where id = (select id from team)),
  '#0033A0/none', 'New teams get the default primary color and no secondary'
);

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select lives_ok(
  $$ update public.teams set accent_primary = '#011F5B', accent_secondary = '#990000'
     where id = (select id from team) $$,
  'Admins can set both accent colors'
);
select throws_ok(
  $$ update public.teams set accent_primary = 'blue' where id = (select id from team) $$,
  '23514', null, 'Colors must be hex codes like #011F5B'
);
select throws_ok(
  $$ update public.teams set accent_primary = null where id = (select id from team) $$,
  '23502', null, 'The primary color is required'
);
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
update public.teams set accent_primary = '#FF0000' where id = (select id from team);
reset role;
select is(
  (select accent_primary from public.teams where id = (select id from team)),
  '#011F5B', 'Athletes can''t change the team colors'
);

select * from finish();
rollback;
