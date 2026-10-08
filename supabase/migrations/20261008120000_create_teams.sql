-- Teams and who belongs to them.
-- Membership changes (create, join, roles, admin, leave, remove, delete) go
-- through the functions below, which enforce the rules in docs/DECISIONS.md.
-- Users can't insert/update/delete memberships directly.

create type public.member_role as enum ('coach', 'athlete');
create type public.target_period as enum ('week', 'two_weeks', 'month');

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  logo_path text,
  time_zone text not null default 'UTC',
  -- ISO day numbers: 1 = Monday … 7 = Sunday.
  week_start_day smallint not null default 1 check (week_start_day between 1 and 7),
  target_period public.target_period not null default 'week',
  require_email_domain boolean not null default false,
  allowed_domains text[] not null default '{}',
  created_at timestamptz not null default now(),
  check (not require_email_domain or cardinality(allowed_domains) > 0)
);

create table public.memberships (
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.member_role not null default 'athlete',
  is_admin boolean not null default false,
  joined_at timestamptz not null default now(),
  -- Set when the member no longer meets the team's email requirement.
  -- Once it has passed, the member is locked out (see is_locked_out).
  grace_until timestamptz,
  primary key (team_id, user_id),
  -- Coaches are always admins.
  check (role <> 'coach' or is_admin)
);

create index memberships_user_id_idx on public.memberships (user_id);

alter table public.teams enable row level security;
alter table public.memberships enable row level security;

-- ---------------------------------------------------------------------------
-- Helper checks. security definer so policies can call them without
-- recursing into memberships' own RLS.
-- ---------------------------------------------------------------------------

create function public.is_locked_out(m public.memberships)
returns boolean
language sql
stable
set search_path = ''
as $$
  select m.grace_until is not null and m.grace_until < now();
$$;

-- Active member of the team (joined and not locked out).
create function public.is_team_member(team uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.team_id = team
      and m.user_id = (select auth.uid())
      and not public.is_locked_out(m)
  );
$$;

create function public.is_team_admin(team uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.team_id = team
      and m.user_id = (select auth.uid())
      and m.is_admin
      and not public.is_locked_out(m)
  );
$$;

-- Coach rights: you're a coach, or you're an admin on a team with no coach.
create function public.has_coach_rights(team uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.team_id = team
      and m.user_id = (select auth.uid())
      and not public.is_locked_out(m)
      and (
        m.role = 'coach'
        or (
          m.is_admin
          and not exists (
            select 1 from public.memberships c
            where c.team_id = team and c.role = 'coach'
          )
        )
      )
  );
$$;

-- Do you and this user share a team where you're both active?
create function public.shares_team_with(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships mine
    join public.memberships theirs on theirs.team_id = mine.team_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = other
      and not public.is_locked_out(mine)
      and not public.is_locked_out(theirs)
  );
$$;

revoke execute on function
  public.is_team_member(uuid),
  public.is_team_admin(uuid),
  public.has_coach_rights(uuid),
  public.shares_team_with(uuid)
from public, anon;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

create policy "Members can read their teams"
  on public.teams for select
  to authenticated
  using (public.is_team_member(id));

create policy "Admins can update team settings"
  on public.teams for update
  to authenticated
  using (public.is_team_admin(id))
  with check (public.is_team_admin(id));

revoke update on public.teams from authenticated;
grant update (
  name, logo_path, time_zone, week_start_day, target_period,
  require_email_domain, allowed_domains
) on public.teams to authenticated;

-- Your own membership is always visible (so a locked-out member can see why).
-- Other memberships are visible to active teammates, except locked-out ones.
create policy "Members can read team memberships"
  on public.memberships for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (public.is_team_member(team_id) and not public.is_locked_out(memberships))
  );

revoke insert, update, delete on public.memberships from authenticated, anon;

create policy "Teammates can read each other's profiles"
  on public.profiles for select
  to authenticated
  using (public.shares_team_with(id));

-- ---------------------------------------------------------------------------
-- Membership actions
-- ---------------------------------------------------------------------------

-- Create a team. The creator picks coach or athlete and is an admin either way.
create function public.create_team(
  team_name text,
  team_time_zone text default 'UTC',
  creator_role public.member_role default 'coach'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_team_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Not signed in';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = team_time_zone) then
    raise exception 'Unknown time zone: %', team_time_zone;
  end if;

  insert into public.teams (name, time_zone)
  values (team_name, team_time_zone)
  returning id into new_team_id;

  insert into public.memberships (team_id, user_id, role, is_admin)
  values (new_team_id, (select auth.uid()), creator_role, true);

  return new_team_id;
end;
$$;

-- Make someone a coach or an athlete. Needs coach rights.
-- A coach can also step down to athlete themselves.
-- A demoted coach stays an admin; remove that separately if wanted.
create function public.set_member_role(
  team uuid,
  member uuid,
  new_role public.member_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if not public.has_coach_rights(team)
     and not (member = me and new_role = 'athlete') then
    raise exception 'Only coaches can change roles';
  end if;

  update public.memberships
  set role = new_role,
      is_admin = case when new_role = 'coach' then true else is_admin end
  where team_id = team and user_id = member;

  if not found then
    raise exception 'Not a member of this team';
  end if;
end;
$$;

-- Grant or remove admin. Needs coach rights. Coaches always stay admins.
create function public.set_member_admin(
  team uuid,
  member uuid,
  make_admin boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.memberships;
begin
  if not public.has_coach_rights(team) then
    raise exception 'Only coaches can grant or remove admin';
  end if;

  select * into target from public.memberships
  where team_id = team and user_id = member;
  if not found then
    raise exception 'Not a member of this team';
  end if;
  if target.role = 'coach' and not make_admin then
    raise exception 'Coaches are always admins';
  end if;
  if not make_admin and not exists (
    select 1 from public.memberships
    where team_id = team and is_admin and user_id <> member
  ) then
    raise exception 'A team needs at least one admin';
  end if;

  update public.memberships set is_admin = make_admin
  where team_id = team and user_id = member;
end;
$$;

-- Remove someone else from the team.
-- Admins can remove athletes; only coach rights can remove coaches.
create function public.remove_member(team uuid, member uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.memberships;
begin
  if member = (select auth.uid()) then
    raise exception 'Use leave_team to leave';
  end if;

  select * into target from public.memberships
  where team_id = team and user_id = member;
  if not found then
    raise exception 'Not a member of this team';
  end if;

  if target.role = 'coach' then
    if not public.has_coach_rights(team) then
      raise exception 'Only coaches can remove coaches';
    end if;
  elsif not public.is_team_admin(team) then
    raise exception 'Only admins can remove members';
  end if;

  delete from public.memberships where team_id = team and user_id = member;
end;
$$;

-- Leave a team.
-- - Last member: the team is deleted.
-- - Last admin who is a coach: must make someone else admin first.
-- - Last admin who is an athlete: admin passes to the earliest-joined member.
create function public.leave_team(team uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  mine public.memberships;
  heir uuid;
begin
  select * into mine from public.memberships
  where team_id = team and user_id = me
  for update;
  if not found then
    raise exception 'Not a member of this team';
  end if;

  if not exists (
    select 1 from public.memberships where team_id = team and user_id <> me
  ) then
    delete from public.teams where id = team;
    return;
  end if;

  if mine.is_admin and not exists (
    select 1 from public.memberships
    where team_id = team and is_admin and user_id <> me
  ) then
    if mine.role = 'coach' then
      raise exception 'Make someone else an admin before leaving';
    end if;

    select user_id into heir from public.memberships
    where team_id = team and user_id <> me
    order by joined_at, user_id
    limit 1;

    update public.memberships set is_admin = true
    where team_id = team and user_id = heir;
  end if;

  delete from public.memberships where team_id = team and user_id = me;
end;
$$;

create function public.delete_team(team uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_coach_rights(team) then
    raise exception 'Only coaches can delete the team';
  end if;
  delete from public.teams where id = team;
end;
$$;

revoke execute on function
  public.create_team(text, text, public.member_role),
  public.set_member_role(uuid, uuid, public.member_role),
  public.set_member_admin(uuid, uuid, boolean),
  public.remove_member(uuid, uuid),
  public.leave_team(uuid),
  public.delete_team(uuid)
from public, anon;

grant execute on function
  public.create_team(text, text, public.member_role),
  public.set_member_role(uuid, uuid, public.member_role),
  public.set_member_admin(uuid, uuid, boolean),
  public.remove_member(uuid, uuid),
  public.leave_team(uuid),
  public.delete_team(uuid)
to authenticated;
