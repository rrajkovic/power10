-- Team accent colors: a required primary and an optional secondary.
-- Used for the background glow, progress bars and highlights. Any hex color
-- is allowed; the app picks readable text colors on top of them.

alter table public.teams
  add column accent_primary text not null default '#0033A0'
    check (accent_primary ~ '^#[0-9A-Fa-f]{6}$'),
  add column accent_secondary text
    check (accent_secondary ~ '^#[0-9A-Fa-f]{6}$');

-- Admins change them like any other team setting.
grant update (accent_primary, accent_secondary) on public.teams to authenticated;
