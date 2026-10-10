-- Weeks always run Monday to Sunday, so the start-day setting goes away.
alter table public.teams drop column week_start_day;

-- Every new team starts with a first season (today until the same day next
-- year, in the team's time zone) and a weekly target of 12 credits
-- (120 minutes at the default 1 credit per 10 minutes), with no max.
-- Admins can change or remove both.
create function public.create_team_first_season()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  first_day date := (now() at time zone new.time_zone)::date;
  last_day date := (first_day + interval '1 year' - interval '1 day')::date;
  new_season_id uuid;
begin
  insert into public.seasons (team_id, name, start_date, end_date)
  values (
    new.id,
    to_char(first_day, 'YYYY') || '–' || to_char(last_day, 'YY'),
    first_day,
    last_day
  )
  returning id into new_season_id;

  insert into public.targets (team_id, season_id, min_credits)
  values (new.id, new_season_id, 12);

  return null;
end;
$$;

create trigger on_team_created_first_season
  after insert on public.teams
  for each row execute function public.create_team_first_season();
