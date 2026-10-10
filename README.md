# Power10

A training tracker for sports teams. Athletes log their extra training, the team sees a shared leaderboard, and coaches see who is on target.

Power10 started as a web app for Penn Lightweight Rowing, where about 40 athletes use it to log and rank extra training. This repository is the rebuild: one codebase for iOS, Android and the web, designed so any team can use it with its own activities, scoring rules and targets.

> **Status:** in active development. Not yet released. "Power10" is a working title.

## Features

**Built**

- **Accounts:** sign-up with an emailed code, sign-in, password reset.
- **Teams:** create a team or join one with an invite code; athlete, coach and admin roles.
- **Credits:** each team defines what counts and how much, per session, per minute or per distance, by activity and intensity.
- **Targets:** weekly, two-week or monthly goals per team, with an optional cap.
- **Home:** your progress for the period, the team's total, and a leaderboard you can switch between credits, minutes and distance.
- **Team view:** how many athletes are on target; coaches and admins also see who isn't yet.
- **Logging:** activity, intensity, day, time, distance and notes, with a live credits preview.
- **AI photo logging:** photograph an erg monitor, watch or fitness app and the form fills itself in. After saving, the workout is checked against its photo and mismatches are flagged for a coach.
- **Look and feel:** light and dark themes, and each team's own colors.

**Planned**

- Coaches logging for an athlete, a group or the whole team
- Feed with comments and reactions
- Calendar of tests, races and scheduled workouts
- Profile and settings
- Sign in with Google and Apple

## Tech stack

| Area | Technology |
| --- | --- |
| App | [Expo](https://expo.dev) (React Native), TypeScript, Expo Router |
| Data fetching | TanStack Query |
| Backend | [Supabase](https://supabase.com): PostgreSQL, Auth, Storage, Edge Functions |
| AI | Google Gemini API, called from Edge Functions |
| Tests | pgTAP (database), ESLint and TypeScript (app) |

## How it works

The app talks to Supabase directly; there is no separate API server. That puts the rules in the database:

- **Row-level security** on every table decides which rows each signed-in user can read or change, so one team can never see another team's data, even if the app has a bug.
- **Database functions** compute credits, leaderboards, targets and streaks, so every device shows the same numbers.
- **Credits are calculated when a workout is saved** and stored with it. Changing a rule later doesn't rewrite past weeks.
- **Edge Functions** hold the Gemini API key and do the photo reading, so the key never reaches a phone.

The reasoning behind product and design choices is recorded in [docs/DECISIONS.md](docs/DECISIONS.md), and the table design in [docs/SCHEMA.md](docs/SCHEMA.md).

## Project structure

```
frontend/            The Expo app
  src/app/           Screens (file-based routes)
  src/components/    Shared UI
  src/lib/           Data access, auth, theme, helpers
supabase/
  migrations/        Database schema, security rules and functions
  functions/         Edge Functions (AI photo reading and checking)
  tests/             Database tests
  seed.sql           Demo data for local development
docs/                Product decisions and schema notes
```

## Running locally

You need [Node.js](https://nodejs.org) (version in `.node-version`), [Docker](https://www.docker.com), and the [Supabase CLI](https://supabase.com/docs/guides/cli).

**1. Start the backend** (from the repository root):

```bash
supabase start
```

This starts a local Supabase in Docker, applies the migrations and loads the demo data. It prints an API URL and a publishable key.

**2. Configure the app.** Copy `frontend/.env.example` to `frontend/.env.local` and fill in the two values from step 1. To test on a phone, use your computer's network address in place of `127.0.0.1`.

**3. Start the app:**

```bash
cd frontend
npm install
npx expo start
```

Press `w` for the browser or `i` for the iOS simulator, or scan the QR code with Expo Go.

**4. Sign in** with a demo account from `supabase/seed.sql` (a coach and an athlete on a team called "Demo Rowing").

### AI photo logging (optional)

Copy `supabase/functions/.env.example` to `supabase/functions/.env`, add a [Gemini API key](https://aistudio.google.com/apikey), then run:

```bash
supabase functions serve --env-file supabase/functions/.env
```

Without a key, everything else works and the photo features report that they aren't set up.

## Development

| Task | Command | Run from |
| --- | --- | --- |
| Database tests | `supabase test db` | repository root |
| Rebuild the local database | `supabase db reset` | repository root |
| Regenerate TypeScript types after a schema change | `npm run db:types` | `frontend/` |
| Lint | `npm run lint` | `frontend/` |

Work happens on feature branches that are merged into `main`.

## Team

Built by Matija Rajković and a co-founder, both Penn Lightweight Rowing athletes.

## License

All rights reserved. This code is not open source.
