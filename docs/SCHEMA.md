# Database schema

Plain-English design of the Supabase (Postgres) database. Every rule here comes
from [DECISIONS.md](DECISIONS.md); change a decision there first, then here.

The tables store only **facts** (what happened) and **settings** (each team's
rules). Totals, weekly progress and leaderboards are **calculated** from them,
never stored, so they can't go out of sync.

---

## How the tables connect

```
profiles ──< user_emails
    │
    └──< memberships >── teams ──< invites
                           │
           ┌───────────────┼──────────────────┬─────────────┐
           │               │                  │             │
    activity_types    intensities          seasons    calendar_events
           │               │                  │             │
           └──< credit_rules >┘          targets            │
                                         target_overrides   │
                                                            │
                         sessions >─────────────────────────┘ (optional link)
                           │
              ┌────────────┼───────────────────┬─────────────┐
     session_photos   verification_checks   comments      reactions
```

`A ──< B` means one A has many B's.

Every team-owned table carries `team_id`. Row-Level Security lets a user see a
row only if they're an active member of that team.

---

## 1. People

### profiles
One per account. Its id is the Supabase Auth user id. Whether the account has a
password comes from the `has_password()` function (it asks Supabase Auth), not a column.

| Column | Meaning |
|---|---|
| name | Display name |
| avatar_path | Profile picture (storage path) |
| created_at | |

### user_emails
Every email on an account, primary and secondary.

| Column | Meaning |
|---|---|
| user | Owner |
| email | Stored lowercase |
| kind | `primary` or `secondary` |
| verified_at | Empty = not verified; unverified emails count for nothing |

Enforced by the database:
- A **verified** email appears only once in the whole table: **one email = one account**.
  Unverified claims don't block anyone (so nobody can squat someone else's school
  email); when an address is verified, other accounts' unverified claims are removed.
- Sign-up is blocked for an address another account has verified (Auth hook
  `hook_before_user_created`).
- An account has exactly one primary and at most one secondary.

Supabase Auth also keeps the primary email; this table mirrors it so the
uniqueness check covers primary and secondary together.

### push_tokens
| Column | Meaning |
|---|---|
| user | |
| token | Device push token |
| platform | `ios` or `android` |

### notification_settings
Which notification types (comments, reactions, …) a user has turned off.

---

## 2. Teams and membership

### teams
| Column | Meaning |
|---|---|
| name, logo | |
| time_zone | Detected at creation, editable; decides each session's date |
| week_start_day | Monday by default |
| target_period | `week` (default), `two_weeks` or `month` |
| require_email_domain | On/off |
| allowed_domains | List, e.g. `upenn.edu`; subdomains are allowed automatically |
| created_at | |

### memberships
Who is on which team, and as what.

| Column | Meaning |
|---|---|
| team, user | Unique together |
| role | `coach` or `athlete` |
| is_admin | Always true for coaches (enforced) |
| joined_at | Decides who inherits admin when the last athlete admin leaves |
| grace_until | Set when the team's email requirement isn't met; 2 weeks out |
| (locked out) | Not stored: a member is locked out once `grace_until` has passed; member and team can't see each other |

### invites
One active athlete invite and one active coach invite per team.

| Column | Meaning |
|---|---|
| team | |
| role | `athlete` or `coach`; joining through it gives this role |
| token | Used in the invite link |
| code | Short code to type in |
| created_by, created_at | |
| revoked_at | Resetting a leaked invite = revoke it and create a new one |

---

## 3. Team configuration

### activity_types
Erg, Berg, Row, Run, Bike, Lift, Custom (created for every new team), plus any the team adds.

| Column | Meaning |
|---|---|
| team, name | |
| requires_photo | Off by default |
| is_custom | The "describe it yourself" type |
| archived_at | "Deleting" archives it, so old sessions keep their history |

### intensities
Steady state, hard, … (defaults per new team, editable).

| Column | Meaning |
|---|---|
| team, name | |
| sort_order | Order in menus |
| archived_at | Same archiving as activity types |

### credit_rules
How a type + intensity earns credits.

| Column | Meaning |
|---|---|
| team | |
| activity_type | |
| intensity | Empty = the default rule for this type |
| kind | `per_session`, `per_time` or `per_distance` |
| credits | Credits awarded (one decimal) |
| per_minutes | For per_time: e.g. 10 (1 credit per 10 minutes) |
| per_meters | For per_distance: e.g. 2000 (1 credit per 2 km) |

Examples:

| Type | Intensity | Kind | Rule |
|---|---|---|---|
| Erg | Hard | per_session | 10 credits |
| Erg | Steady state | per_time | 1 credit per 10 min |
| Lift | (any) | per_session | 3 credits |
| Run | (any) | per_distance | 1 credit per 2 km |

Lookup: the exact type + intensity rule if one exists, otherwise the type's default rule.

### seasons
| Column | Meaning |
|---|---|
| team, name | |
| start_date, end_date | |

### targets
The requirements and caps for a season (per target period).

| Column | Meaning |
|---|---|
| season | |
| activity_type | Empty = the total |
| min_credits | Required credits |
| max_credits | Cap; empty = no cap |

Example: one row "total ≥ 30, ≤ 60", one row "Lift ≥ 6".
Targets apply only to athletes.

### target_overrides
Special periods (taper, test and race weeks).

| Column | Meaning |
|---|---|
| season, period_start | Which week/period |
| activity_type | Empty = the total |
| min_credits, max_credits | Replace the season's values for that period |
| label | e.g. "Taper", "2k test week" |

### calendar_events
Tests, races and scheduled workouts.

| Column | Meaning |
|---|---|
| team | |
| date, time | Time optional |
| kind | `test`, `race`, `workout` or `other` |
| title, description | |
| activity_type, intensity | Optional suggestion for workouts |
| created_by | |

---

## 4. Training

### sessions
One row per athlete per workout.

| Column | Meaning |
|---|---|
| team, athlete | |
| activity_type, intensity | What the athlete logged |
| custom_label | Description, when the type is Custom |
| date | In the team's time zone |
| duration | Seconds |
| distance | Meters, optional |
| notes | |
| **credits** | Calculated by the backend, floored to one decimal, never sent by the app |
| **rule_used** | Copy of the credit rule at logging time; later rule changes don't rewrite old sessions |
| calendar_event | Optional link to a scheduled workout |
| logged_by | The athlete, or the admin who logged it |
| group_log_id | Shared by all rows created in one group/whole-team log |
| verification_status | `not_needed`, `pending`, `passed`, `flagged`, `rejected` |
| verification_note | The AI's reason when it flags a session |
| reviewed_by, reviewed_at, review_note | Admin override (never on their own session) |
| created_at, updated_at | |

Counting rule: **every session counts unless its status is `rejected`.**
Sessions logged by an admin for others start as verified.

### session_photos
| Column | Meaning |
|---|---|
| session | |
| storage_path | Private storage bucket |
| source | `camera` or `gallery` (gallery is marked for admins) |
| taken_at | |
| image_hash | Catches the same photo being reused |

### verification_checks
The AI's work queue and log. Works the same whether OCR or an API reads the photo.

| Column | Meaning |
|---|---|
| session | |
| status | `queued`, `running`, `done`, `failed` |
| attempts | |
| engine | Which OCR/model read it |
| result | What it read (time, distance, …) |
| verdict, note | `passed` / `flagged`, with a reason for admins |
| created_at, finished_at | |

---

## 5. Social

### comments
| Column | Meaning |
|---|---|
| session, user | |
| body | |
| created_at, edited_at | |

### reactions
| Column | Meaning |
|---|---|
| session, user | |
| emoji | Any emoji; one person can add several different ones, not the same one twice |

---

## Design choices

1. **Deleting a type or intensity archives it.** It leaves the menus but old sessions keep it.
2. **`rule_used` is copied onto every session** to explain how many credits a session got and to stop rule changes rewriting history.
3. **An empty intensity on a credit rule is the type's default rule.** This is the proposed answer to the open "no rule for this intensity" question.
4. **A group log creates one session per athlete**, linked by `group_log_id`, so each athlete appears normally in the feed, leaderboard and verification.
5. **No sample/demo rows in real data.** A demo is its own team.
6. **Calculated, not stored:** credit totals, target progress, leaderboards. They're SQL views/functions over `sessions`.
7. **Membership changes go through functions**, not direct table writes: `create_team`, `join_team`, `set_member_role`, `set_member_admin`, `remove_member`, `leave_team`, `delete_team`, `reset_invite`, `review_session`. They enforce the role rules in DECISIONS.md.
8. **Default credit rule:** every default activity type starts at 1 credit per 10 minutes; admins change it.
9. **A coach who is turned back into an athlete stays an admin** until a coach removes that separately.
