-- Seasons and the credit targets athletes must hit each period (week, two
-- weeks or month, set on the team). Targets apply to athletes only.

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  unique (id, team_id),
  check (end_date >= start_date)
);

-- Requirements and caps for every period of a season.
-- An empty activity type is the total across all types.
create table public.targets (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null,
  season_id uuid not null,
  activity_type_id uuid,
  min_credits numeric(6, 1) not null default 0 check (min_credits >= 0),
  -- Empty = no cap.
  max_credits numeric(6, 1) check (max_credits >= min_credits),
  foreign key (season_id, team_id)
    references public.seasons (id, team_id) on delete cascade,
  foreign key (activity_type_id, team_id)
    references public.activity_types (id, team_id) on delete cascade,
  unique nulls not distinct (season_id, activity_type_id)
);

-- Special periods (taper, test or race weeks) replace the season's values.
create table public.target_overrides (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null,
  season_id uuid not null,
  period_start date not null,
  activity_type_id uuid,
  min_credits numeric(6, 1) not null default 0 check (min_credits >= 0),
  max_credits numeric(6, 1) check (max_credits >= min_credits),
  label text check (length(label) <= 60),
  foreign key (season_id, team_id)
    references public.seasons (id, team_id) on delete cascade,
  foreign key (activity_type_id, team_id)
    references public.activity_types (id, team_id) on delete cascade,
  unique nulls not distinct (season_id, period_start, activity_type_id)
);

alter table public.seasons enable row level security;
alter table public.targets enable row level security;
alter table public.target_overrides enable row level security;

create policy "Members can read seasons"
  on public.seasons for select to authenticated
  using (public.is_team_member(team_id));
create policy "Admins can add seasons"
  on public.seasons for insert to authenticated
  with check (public.is_team_admin(team_id));
create policy "Admins can edit seasons"
  on public.seasons for update to authenticated
  using (public.is_team_admin(team_id))
  with check (public.is_team_admin(team_id));
create policy "Admins can delete seasons"
  on public.seasons for delete to authenticated
  using (public.is_team_admin(team_id));

create policy "Members can read targets"
  on public.targets for select to authenticated
  using (public.is_team_member(team_id));
create policy "Admins can add targets"
  on public.targets for insert to authenticated
  with check (public.is_team_admin(team_id));
create policy "Admins can edit targets"
  on public.targets for update to authenticated
  using (public.is_team_admin(team_id))
  with check (public.is_team_admin(team_id));
create policy "Admins can delete targets"
  on public.targets for delete to authenticated
  using (public.is_team_admin(team_id));

create policy "Members can read target overrides"
  on public.target_overrides for select to authenticated
  using (public.is_team_member(team_id));
create policy "Admins can add target overrides"
  on public.target_overrides for insert to authenticated
  with check (public.is_team_admin(team_id));
create policy "Admins can edit target overrides"
  on public.target_overrides for update to authenticated
  using (public.is_team_admin(team_id))
  with check (public.is_team_admin(team_id));
create policy "Admins can delete target overrides"
  on public.target_overrides for delete to authenticated
  using (public.is_team_admin(team_id));

-- Rows never move to another team.
revoke update on public.seasons, public.targets, public.target_overrides from authenticated;
grant update (name, start_date, end_date) on public.seasons to authenticated;
grant update (min_credits, max_credits) on public.targets to authenticated;
grant update (period_start, min_credits, max_credits, label)
  on public.target_overrides to authenticated;
