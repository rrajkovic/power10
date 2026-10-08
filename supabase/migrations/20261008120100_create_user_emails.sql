-- Every email on an account: exactly one primary (mirrors Supabase Auth) and
-- at most one secondary. Verified emails can satisfy a team's domain
-- requirement; unverified ones count for nothing.
--
-- Uniqueness: a VERIFIED address belongs to one account only. Unverified
-- claims don't block anyone, so nobody can squat someone else's school email;
-- when an address gets verified, other accounts' unverified claims are dropped.
--
-- Secondary verification and primary/secondary swaps are done by Edge
-- Functions (service role). Users can only add or remove their own secondary.

create type public.email_kind as enum ('primary', 'secondary');

create table public.user_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  email text not null check (
    email = lower(trim(email))
    and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),
  kind public.email_kind not null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, email)
);

create unique index user_emails_one_primary_idx
  on public.user_emails (user_id) where kind = 'primary';
create unique index user_emails_one_secondary_idx
  on public.user_emails (user_id) where kind = 'secondary';
create unique index user_emails_verified_email_idx
  on public.user_emails (email) where verified_at is not null;

alter table public.user_emails enable row level security;

-- ---------------------------------------------------------------------------
-- Domain checks
-- ---------------------------------------------------------------------------

-- 'abc@seas.upenn.edu' matches 'upenn.edu' (subdomains are allowed).
create function public.email_matches_domains(addr text, domains text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select exists (
    select 1 from unnest(domains) d
    where split_part(addr, '@', 2) = lower(d)
       or right(split_part(addr, '@', 2), length(d) + 1) = '.' || lower(d)
  );
$$;

create function public.meets_email_requirement(team uuid, member uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    not t.require_email_domain
    or exists (
      select 1 from public.user_emails e
      where e.user_id = member
        and e.verified_at is not null
        and public.email_matches_domains(e.email, t.allowed_domains)
    )
  from public.teams t
  where t.id = team;
$$;

-- Start (or clear) the 2-week grace period for one membership.
create function public.refresh_grace(team uuid, member uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.memberships
  set grace_until = case
    when public.meets_email_requirement(team, member) then null
    else coalesce(grace_until, now() + interval '14 days')
  end
  where team_id = team and user_id = member;
$$;

revoke execute on function
  public.meets_email_requirement(uuid, uuid),
  public.refresh_grace(uuid, uuid)
from public, anon, authenticated;

-- An admin can see a member's verified email if it matches the team's
-- domains (the school email), never their other emails.
create function public.can_see_member_email(owner uuid, addr text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    join public.teams t on t.id = m.team_id
    where m.user_id = owner
      and public.is_team_admin(m.team_id)
      and public.email_matches_domains(addr, t.allowed_domains)
  );
$$;

revoke execute on function public.can_see_member_email(uuid, text) from public, anon;

-- ---------------------------------------------------------------------------
-- Keep the primary row in sync with Supabase Auth
-- ---------------------------------------------------------------------------

-- Runs on sign-up and whenever the auth email or its confirmation changes.
-- Swapping primary/secondary = an Edge Function changes the auth email to the
-- user's secondary; this trigger then turns the old primary into the secondary.
create function public.sync_primary_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_email text := lower(new.email);
  old_primary public.user_emails;
  was_swap boolean := false;
begin
  if new_email is null then
    return new;
  end if;

  select * into old_primary from public.user_emails
  where user_id = new.id and kind = 'primary';

  if found and old_primary.email <> new_email then
    -- Promoting the secondary: remove it first so the address can move.
    delete from public.user_emails
    where user_id = new.id and kind = 'secondary' and email = new_email;
    was_swap := found;
  end if;

  insert into public.user_emails (user_id, email, kind, verified_at)
  values (new.id, new_email, 'primary', new.email_confirmed_at)
  on conflict (user_id) where kind = 'primary'
  do update set email = excluded.email, verified_at = excluded.verified_at;

  if was_swap then
    insert into public.user_emails (user_id, email, kind, verified_at)
    values (new.id, old_primary.email, 'secondary', old_primary.verified_at);
  end if;

  return new;
end;
$$;

-- Named so it runs after on_auth_user_created (which creates the profile).
create trigger on_auth_user_email_sync
  after insert or update of email, email_confirmed_at on auth.users
  for each row execute function public.sync_primary_email();

-- ---------------------------------------------------------------------------
-- React to email changes
-- ---------------------------------------------------------------------------

create function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid := coalesce(new.user_id, old.user_id);
  m record;
begin
  -- A newly verified address: drop other accounts' unverified claims on it.
  if tg_op <> 'DELETE' and new.verified_at is not null then
    delete from public.user_emails
    where email = new.email and user_id <> new.user_id and verified_at is null;
  end if;

  for m in select team_id from public.memberships where user_id = owner loop
    perform public.refresh_grace(m.team_id, owner);
  end loop;

  return null;
end;
$$;

create trigger on_user_email_change
  after insert or update or delete on public.user_emails
  for each row execute function public.handle_user_email_change();

-- Turning the requirement on (or changing the domains) starts grace periods
-- for members who don't match; turning it off clears them.
create function public.handle_team_email_rule_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
begin
  for m in select user_id from public.memberships where team_id = new.id loop
    perform public.refresh_grace(new.id, m.user_id);
  end loop;
  return null;
end;
$$;

create trigger on_team_email_rule_change
  after update of require_email_domain, allowed_domains on public.teams
  for each row
  when (
    old.require_email_domain is distinct from new.require_email_domain
    or old.allowed_domains is distinct from new.allowed_domains
  )
  execute function public.handle_team_email_rule_change();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

create policy "Users can read their own emails"
  on public.user_emails for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Admins can read members' verified school emails"
  on public.user_emails for select
  to authenticated
  using (verified_at is not null and public.can_see_member_email(user_id, email));

create policy "Users can add an unverified secondary email"
  on public.user_emails for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and kind = 'secondary'
    and verified_at is null
  );

create policy "Users can remove their secondary email"
  on public.user_emails for delete
  to authenticated
  using (user_id = (select auth.uid()) and kind = 'secondary');

revoke insert, update on public.user_emails from authenticated, anon;
grant insert (user_id, email, kind) on public.user_emails to authenticated;

-- ---------------------------------------------------------------------------
-- Auth hook: block sign-up with an address another account has verified
-- (e.g. someone's secondary school email). Enabled in supabase/config.toml.
-- ---------------------------------------------------------------------------

create function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.user_emails
    where email = lower(event -> 'user' ->> 'email')
      and verified_at is not null
  ) then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 409,
        'message', 'This email is already used by another account'
      )
    );
  end if;
  return '{}'::jsonb;
end;
$$;

revoke execute on function public.hook_before_user_created(jsonb)
  from public, anon, authenticated;
grant execute on function public.hook_before_user_created(jsonb)
  to supabase_auth_admin;
