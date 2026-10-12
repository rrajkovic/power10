-- Repeating calendar events.
--
-- A repeating event ("every Tuesday until December") is saved as one ordinary
-- event per date. They share a series id, so later ones can be removed
-- together. Each can still be edited or deleted on its own.
alter table public.calendar_events add column series_id uuid;

create index calendar_events_series_idx on public.calendar_events (series_id, event_date)
  where series_id is not null;
