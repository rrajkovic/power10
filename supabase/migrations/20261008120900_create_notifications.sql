-- Push notification devices and per-user settings.

create type public.push_platform as enum ('ios', 'android', 'web');
create type public.notification_kind as enum ('comment', 'reaction');

create table public.push_tokens (
  token text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform public.push_platform not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index push_tokens_user_idx on public.push_tokens (user_id);

-- No row = enabled. A row with enabled = false turns that kind off.
create table public.notification_settings (
  user_id uuid not null references public.profiles (id) on delete cascade
    default auth.uid(),
  kind public.notification_kind not null,
  enabled boolean not null,
  primary key (user_id, kind)
);

alter table public.push_tokens enable row level security;
alter table public.notification_settings enable row level security;

create policy "Users can read their devices"
  on public.push_tokens for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can remove their devices"
  on public.push_tokens for delete to authenticated
  using (user_id = (select auth.uid()));

revoke insert, update on public.push_tokens from authenticated, anon;

-- A phone can switch accounts, so registering moves the token to you.
create function public.register_push_token(device_token text, device_platform public.push_platform)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.push_tokens (token, user_id, platform)
  values (device_token, (select auth.uid()), device_platform)
  on conflict (token) do update
  set user_id = excluded.user_id,
      platform = excluded.platform,
      last_seen_at = now();
$$;

revoke execute on function public.register_push_token(text, public.push_platform) from public, anon;
grant execute on function public.register_push_token(text, public.push_platform) to authenticated;

create policy "Users can read their notification settings"
  on public.notification_settings for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Users can add notification settings"
  on public.notification_settings for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Users can change notification settings"
  on public.notification_settings for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "Users can remove notification settings"
  on public.notification_settings for delete to authenticated
  using (user_id = (select auth.uid()));

revoke update on public.notification_settings from authenticated;
grant update (enabled) on public.notification_settings to authenticated;
