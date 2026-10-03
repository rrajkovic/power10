-- One row per account. Created automatically when someone signs up.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  avatar_path text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Users may only change their name and avatar, nothing else.
revoke update on public.profiles from authenticated;
grant update (name, avatar_path) on public.profiles to authenticated;

-- Create a profile automatically for every new account.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS: you can see and edit only your own profile (for now).
create policy "Users can read their own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Does the signed-in user have a password yet?
-- (OAuth sign-ups don't until they finish the password screen.)
create function public.has_password()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users
    where id = (select auth.uid())
      and encrypted_password is not null
      and encrypted_password <> ''
  );
$$;

revoke execute on function public.has_password() from public, anon;
grant execute on function public.has_password() to authenticated;