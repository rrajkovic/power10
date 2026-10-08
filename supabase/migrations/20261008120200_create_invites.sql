-- Invite links and codes. Each team has one active athlete invite and one
-- active coach invite. Joining through an invite is instant and gives its role
-- (coaches are admins), but the team's email requirement still applies.

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  role public.member_role not null,
  -- Long secret used in invite links.
  token text not null unique
    default encode(extensions.gen_random_bytes(24), 'hex'),
  -- Short code people can type in.
  code text not null unique
    default upper(encode(extensions.gen_random_bytes(4), 'hex')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create unique index invites_one_active_per_role_idx
  on public.invites (team_id, role) where revoked_at is null;

alter table public.invites enable row level security;

create policy "Admins can read their team's invites"
  on public.invites for select
  to authenticated
  using (public.is_team_admin(team_id));

revoke insert, update, delete on public.invites from authenticated, anon;

-- Revoke the current invite for a role (e.g. after a leak) and create a new one.
-- Any admin can do this, including for the coach invite.
create function public.reset_invite(team uuid, invite_role public.member_role)
returns public.invites
language plpgsql
security definer
set search_path = ''
as $$
declare
  fresh public.invites;
begin
  if (select auth.uid()) is not null and not public.is_team_admin(team) then
    raise exception 'Only admins can manage invites';
  end if;

  update public.invites set revoked_at = now()
  where team_id = team and role = invite_role and revoked_at is null;

  insert into public.invites (team_id, role, created_by)
  values (team, invite_role, (select auth.uid()))
  returning * into fresh;

  return fresh;
end;
$$;

-- Every new team gets both invites straight away.
create function public.create_team_invites()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.invites (team_id, role) values (new.id, 'athlete'), (new.id, 'coach');
  return null;
end;
$$;

create trigger on_team_created_invites
  after insert on public.teams
  for each row execute function public.create_team_invites();

-- What the app shows before joining: team name and the role you'd get.
create function public.invite_preview(token_or_code text)
returns table (team_name text, role public.member_role, requires_email_domain boolean, allowed_domains text[])
language sql
stable
security definer
set search_path = ''
as $$
  select t.name, i.role, t.require_email_domain, t.allowed_domains
  from public.invites i
  join public.teams t on t.id = i.team_id
  where i.revoked_at is null
    and (i.token = token_or_code or i.code = upper(trim(token_or_code)));
$$;

-- Join a team with a link token or a code.
create function public.join_team(token_or_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  inv public.invites;
begin
  if me is null then
    raise exception 'Not signed in';
  end if;

  select * into inv from public.invites
  where revoked_at is null
    and (token = token_or_code or code = upper(trim(token_or_code)));
  if not found then
    raise exception 'This invite is invalid or has been reset';
  end if;

  if exists (
    select 1 from public.memberships where team_id = inv.team_id and user_id = me
  ) then
    raise exception 'You are already on this team';
  end if;

  if not public.meets_email_requirement(inv.team_id, me) then
    raise exception 'This team requires a verified email from its school domain';
  end if;

  insert into public.memberships (team_id, user_id, role, is_admin)
  values (inv.team_id, me, inv.role, inv.role = 'coach');

  return inv.team_id;
end;
$$;

revoke execute on function
  public.reset_invite(uuid, public.member_role),
  public.invite_preview(text),
  public.join_team(text)
from public, anon;

grant execute on function
  public.reset_invite(uuid, public.member_role),
  public.invite_preview(text),
  public.join_team(text)
to authenticated;
