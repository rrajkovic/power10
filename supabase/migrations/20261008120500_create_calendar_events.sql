-- Team calendar: tests, races and workouts coaches schedule. Athletes can
-- link a logged session to a scheduled workout.

create type public.calendar_event_kind as enum ('test', 'race', 'workout', 'other');

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  kind public.calendar_event_kind not null,
  title text not null check (length(trim(title)) between 1 and 120),
  description text check (length(description) <= 4000),
  event_date date not null,
  -- Optional; in the team's time zone.
  start_time time,
  -- Optional suggestion for workouts.
  activity_type_id uuid,
  intensity_id uuid,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (id, team_id),
  foreign key (activity_type_id, team_id)
    references public.activity_types (id, team_id),
  foreign key (intensity_id, team_id)
    references public.intensities (id, team_id)
);

create index calendar_events_team_date_idx on public.calendar_events (team_id, event_date);

alter table public.calendar_events enable row level security;

create policy "Members can read the calendar"
  on public.calendar_events for select to authenticated
  using (public.is_team_member(team_id));
create policy "Admins can add calendar events"
  on public.calendar_events for insert to authenticated
  with check (public.is_team_admin(team_id) and created_by = (select auth.uid()));
create policy "Admins can edit calendar events"
  on public.calendar_events for update to authenticated
  using (public.is_team_admin(team_id))
  with check (public.is_team_admin(team_id));
create policy "Admins can delete calendar events"
  on public.calendar_events for delete to authenticated
  using (public.is_team_admin(team_id));

revoke update on public.calendar_events from authenticated;
grant update (kind, title, description, event_date, start_time, activity_type_id, intensity_id)
  on public.calendar_events to authenticated;
