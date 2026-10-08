-- What athletes can log (activity types, intensities) and how much each is
-- worth (credit rules). Each team owns its own; new teams get defaults.
-- "Deleting" a type or intensity sets archived_at so old sessions keep it.

create type public.credit_rule_kind as enum ('per_session', 'per_time', 'per_distance');

create table public.activity_types (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 40),
  -- The "describe it yourself" type; athletes add a label when logging.
  is_custom boolean not null default false,
  requires_photo boolean not null default false,
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, team_id)
);

create unique index activity_types_active_name_idx
  on public.activity_types (team_id, lower(name)) where archived_at is null;

create table public.intensities (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 40),
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, team_id)
);

create unique index intensities_active_name_idx
  on public.intensities (team_id, lower(name)) where archived_at is null;

-- One rule per type + intensity. An empty intensity is the type's default
-- rule, used when there's no rule for the exact intensity logged.
--   per_session:  credits for each session
--   per_time:     credits per `per_minutes` minutes
--   per_distance: credits per `per_meters` meters
create table public.credit_rules (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  activity_type_id uuid not null,
  intensity_id uuid,
  kind public.credit_rule_kind not null,
  credits numeric(6, 1) not null check (credits >= 0),
  per_minutes numeric(6, 1) check (per_minutes > 0),
  per_meters integer check (per_meters > 0),
  updated_at timestamptz not null default now(),
  foreign key (activity_type_id, team_id)
    references public.activity_types (id, team_id) on delete cascade,
  foreign key (intensity_id, team_id)
    references public.intensities (id, team_id) on delete cascade,
  unique nulls not distinct (activity_type_id, intensity_id),
  check (
    (kind = 'per_session' and per_minutes is null and per_meters is null)
    or (kind = 'per_time' and per_minutes is not null and per_meters is null)
    or (kind = 'per_distance' and per_meters is not null and per_minutes is null)
  )
);

alter table public.activity_types enable row level security;
alter table public.intensities enable row level security;
alter table public.credit_rules enable row level security;

-- ---------------------------------------------------------------------------
-- RLS: members read, admins write.
-- ---------------------------------------------------------------------------

create policy "Members can read activity types"
  on public.activity_types for select to authenticated
  using (public.is_team_member(team_id));
create policy "Admins can add activity types"
  on public.activity_types for insert to authenticated
  with check (public.is_team_admin(team_id));
create policy "Admins can edit activity types"
  on public.activity_types for update to authenticated
  using (public.is_team_admin(team_id))
  with check (public.is_team_admin(team_id));

create policy "Members can read intensities"
  on public.intensities for select to authenticated
  using (public.is_team_member(team_id));
create policy "Admins can add intensities"
  on public.intensities for insert to authenticated
  with check (public.is_team_admin(team_id));
create policy "Admins can edit intensities"
  on public.intensities for update to authenticated
  using (public.is_team_admin(team_id))
  with check (public.is_team_admin(team_id));

create policy "Members can read credit rules"
  on public.credit_rules for select to authenticated
  using (public.is_team_member(team_id));
create policy "Admins can add credit rules"
  on public.credit_rules for insert to authenticated
  with check (public.is_team_admin(team_id));
create policy "Admins can edit credit rules"
  on public.credit_rules for update to authenticated
  using (public.is_team_admin(team_id))
  with check (public.is_team_admin(team_id));
create policy "Admins can delete credit rules"
  on public.credit_rules for delete to authenticated
  using (public.is_team_admin(team_id));

-- Types and intensities are archived, never deleted, and never move teams.
revoke delete on public.activity_types, public.intensities from authenticated;
revoke update on public.activity_types, public.intensities from authenticated;
grant update (name, is_custom, requires_photo, sort_order, archived_at)
  on public.activity_types to authenticated;
grant update (name, sort_order, archived_at)
  on public.intensities to authenticated;
revoke update on public.credit_rules from authenticated;
grant update (kind, credits, per_minutes, per_meters)
  on public.credit_rules to authenticated;

-- Shared trigger: stamp updated_at on every update.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger set_credit_rules_updated_at
  before update on public.credit_rules
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Defaults for new teams
-- ---------------------------------------------------------------------------

-- Every default type starts at 1 credit per 10 minutes; admins adjust them.
create function public.create_team_defaults()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.activity_types (team_id, name, is_custom, sort_order)
  values
    (new.id, 'Erg', false, 1),
    (new.id, 'Berg', false, 2),
    (new.id, 'Row', false, 3),
    (new.id, 'Run', false, 4),
    (new.id, 'Bike', false, 5),
    (new.id, 'Lift', false, 6),
    (new.id, 'Custom', true, 7);

  insert into public.intensities (team_id, name, sort_order)
  values
    (new.id, 'Steady state', 1),
    (new.id, 'Hard', 2);

  insert into public.credit_rules (team_id, activity_type_id, kind, credits, per_minutes)
  select new.id, a.id, 'per_time', 1, 10
  from public.activity_types a
  where a.team_id = new.id;

  return null;
end;
$$;

create trigger on_team_created_defaults
  after insert on public.teams
  for each row execute function public.create_team_defaults();
