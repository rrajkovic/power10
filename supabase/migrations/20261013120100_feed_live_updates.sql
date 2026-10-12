-- Live updates for the Feed.
--
-- Supabase Realtime tells connected apps when rows in these tables change, so
-- a new workout, comment or reaction shows up without pulling to refresh.
-- Row-level security still applies: you only hear about rows you could read.
alter publication supabase_realtime add table public.sessions, public.comments, public.reactions;
