-- The social side: comments and emoji reactions on sessions, visible to
-- everyone who can see the session.

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null,
  session_id uuid not null,
  author_id uuid not null references public.profiles (id) on delete cascade
    default auth.uid(),
  body text not null check (length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  foreign key (session_id, team_id)
    references public.sessions (id, team_id) on delete cascade
);

create index comments_session_idx on public.comments (session_id, created_at);

create table public.reactions (
  team_id uuid not null,
  session_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade
    default auth.uid(),
  -- Any emoji (some are several characters long, e.g. flags and families).
  emoji text not null check (length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (session_id, user_id, emoji),
  foreign key (session_id, team_id)
    references public.sessions (id, team_id) on delete cascade
);

alter table public.comments enable row level security;
alter table public.reactions enable row level security;

create policy "Members can read comments on visible sessions"
  on public.comments for select to authenticated
  using (exists (select 1 from public.sessions s where s.id = session_id));

create policy "Members can comment on visible sessions"
  on public.comments for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and public.is_team_member(team_id)
    and exists (select 1 from public.sessions s where s.id = session_id)
  );

create policy "Authors can edit their comments"
  on public.comments for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

create policy "Authors or admins can delete comments"
  on public.comments for delete to authenticated
  using (author_id = (select auth.uid()) or public.is_team_admin(team_id));

revoke update on public.comments from authenticated;
grant update (body) on public.comments to authenticated;

create function public.set_comment_edited_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.edited_at := now();
  return new;
end;
$$;

create trigger set_comment_edited_at
  before update of body on public.comments
  for each row execute function public.set_comment_edited_at();

create policy "Members can read reactions on visible sessions"
  on public.reactions for select to authenticated
  using (exists (select 1 from public.sessions s where s.id = session_id));

create policy "Members can react to visible sessions"
  on public.reactions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_team_member(team_id)
    and exists (select 1 from public.sessions s where s.id = session_id)
  );

create policy "Users can remove their reactions"
  on public.reactions for delete to authenticated
  using (user_id = (select auth.uid()));

revoke update on public.reactions from authenticated;
