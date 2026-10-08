-- Proof photos and the AI verification queue.
--
-- Photos live in the private `session-photos` storage bucket at
--   <team_id>/<session_id>/<file name>
-- Adding a photo to a self-logged session marks it 'pending' and queues a
-- check. The worker (an Edge Function, service role) reads the photo with
-- OCR and/or an AI API and calls apply_verification(). Sessions keep counting
-- while pending or flagged; only an admin rejection stops them counting.

create type public.photo_source as enum ('camera', 'gallery');
create type public.check_status as enum ('queued', 'running', 'done', 'failed');
create type public.check_verdict as enum ('passed', 'flagged');

create table public.session_photos (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null,
  session_id uuid not null,
  storage_path text not null unique,
  -- Gallery photos are marked for admins.
  source public.photo_source not null,
  taken_at timestamptz,
  -- Fingerprint to catch the same photo being reused.
  image_hash text,
  uploaded_by uuid references public.profiles (id) on delete set null
    default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (session_id, team_id)
    references public.sessions (id, team_id) on delete cascade
);

create index session_photos_session_idx on public.session_photos (session_id);
create index session_photos_hash_idx on public.session_photos (team_id, image_hash)
  where image_hash is not null;

create table public.verification_checks (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null,
  session_id uuid not null,
  status public.check_status not null default 'queued',
  attempts integer not null default 0,
  -- Which OCR engine or AI model read the photo.
  engine text,
  -- What it read (time, distance, …).
  result jsonb,
  verdict public.check_verdict,
  note text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  foreign key (session_id, team_id)
    references public.sessions (id, team_id) on delete cascade
);

create index verification_checks_queue_idx on public.verification_checks (created_at)
  where status = 'queued';

alter table public.session_photos enable row level security;
alter table public.verification_checks enable row level security;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

-- Photos are visible to whoever can see the session.
create policy "Members can read photos of visible sessions"
  on public.session_photos for select to authenticated
  using (exists (select 1 from public.sessions s where s.id = session_id));

create policy "Session owner or admins can add photos"
  on public.session_photos for insert to authenticated
  with check (public.can_edit_session(session_id) and uploaded_by = (select auth.uid()));

create policy "Session owner or admins can remove photos"
  on public.session_photos for delete to authenticated
  using (public.can_edit_session(session_id));

revoke update on public.session_photos from authenticated;

-- Checks: the athlete and the team's admins can see them; only the worker writes.
create policy "Session owner and admins can read checks"
  on public.verification_checks for select to authenticated
  using (
    public.is_team_admin(team_id)
    or exists (
      select 1 from public.sessions s
      where s.id = session_id and s.athlete_id = (select auth.uid())
    )
  );

revoke insert, update, delete on public.verification_checks from authenticated, anon;

-- ---------------------------------------------------------------------------
-- New photo → queue a check (self-logged sessions only)
-- ---------------------------------------------------------------------------

create function public.handle_new_session_photo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.sessions;
begin
  select * into s from public.sessions where id = new.session_id;

  -- Admin-logged sessions are already verified; reviewed ones are settled.
  if s.logged_by is distinct from s.athlete_id or s.reviewed_at is not null then
    return null;
  end if;

  -- The same photo on another session of this team: flag straight away.
  if new.image_hash is not null and exists (
    select 1 from public.session_photos p
    where p.team_id = new.team_id
      and p.image_hash = new.image_hash
      and p.session_id <> new.session_id
  ) then
    update public.sessions
    set verification_status = 'flagged',
        verification_note = 'The same photo is used on another session'
    where id = new.session_id;
    return null;
  end if;

  update public.sessions set verification_status = 'pending'
  where id = new.session_id and verification_status in ('not_needed', 'passed');

  insert into public.verification_checks (team_id, session_id)
  values (new.team_id, new.session_id);

  return null;
end;
$$;

create trigger on_session_photo_added
  after insert on public.session_photos
  for each row execute function public.handle_new_session_photo();

-- Called by the worker when a check finishes. Admin reviews always win.
create function public.apply_verification(
  check_id uuid,
  check_verdict public.check_verdict,
  check_note text default null,
  check_result jsonb default null,
  check_engine text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.verification_checks;
begin
  update public.verification_checks
  set status = 'done',
      verdict = check_verdict,
      note = check_note,
      result = check_result,
      engine = check_engine,
      finished_at = now()
  where id = check_id
  returning * into c;

  if not found then
    raise exception 'Unknown check %', check_id;
  end if;

  update public.sessions
  set verification_status = check_verdict::text::public.verification_status,
      verification_note = check_note
  where id = c.session_id and reviewed_at is null;
end;
$$;

revoke execute on function
  public.apply_verification(uuid, public.check_verdict, text, jsonb, text)
from public, anon, authenticated;
grant execute on function
  public.apply_verification(uuid, public.check_verdict, text, jsonb, text)
to service_role;

-- ---------------------------------------------------------------------------
-- Storage bucket
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'session-photos', 'session-photos', false, 10485760,
  array['image/jpeg', 'image/png', 'image/heic', 'image/webp']
);

-- Path must be <team_id>/<session_id>/<file>, and you must be able to edit
-- that session.
create function public.can_edit_photo_path(path text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  parts text[] := string_to_array(path, '/');
  uuid_pattern text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if array_length(parts, 1) <> 3
     or parts[1] !~ uuid_pattern
     or parts[2] !~ uuid_pattern then
    return false;
  end if;
  return exists (
    select 1 from public.sessions s
    where s.id = parts[2]::uuid and s.team_id = parts[1]::uuid
  ) and public.can_edit_session(parts[2]::uuid);
end;
$$;

revoke execute on function public.can_edit_photo_path(text) from public, anon;

create policy "Members can view photos of visible sessions"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'session-photos'
    and exists (
      select 1 from public.session_photos p where p.storage_path = name
    )
  );

create policy "Session owner or admins can upload photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'session-photos' and public.can_edit_photo_path(name));

create policy "Session owner or admins can delete photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'session-photos' and public.can_edit_photo_path(name));
