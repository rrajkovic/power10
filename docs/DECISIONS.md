# Product decisions

Running log of how the app should behave. Each rule is marked:

- **Decided**: agreed, build it this way.
- **Proposed**: suggested, not yet confirmed.
- **Open**: still needs a decision.

Change a rule here first, then in the code.

---

## Stack

| | |
|---|---|
| App | Expo (React Native): iOS, Android and web from one codebase |
| Backend | Supabase only: Postgres + RLS, database functions, Edge Functions (TypeScript) |
| Project | New repo + new Supabase project; the current Penn app keeps running until migration |

**Decided.**

## Frontend vs. backend

- The backend decides what's true and what's allowed; the app only shows things and collects input. **Decided**
- The app sends raw facts (activity, intensity, time, distance); credits are computed by the backend, never trusted from the client. **Decided**

## Teams

- Teams are flat and independent. No club or organization layer for now. A university with several squads creates one team per squad. **Decided**
- Every team-owned row carries `team_id`; RLS lets you see a row only if you're a member of that team. **Decided**
- One account can belong to several teams (via `memberships`), and each team sees only its own data. **Proposed**
- A club layer above teams may be added later without restructuring. **Note**

## Accounts and sign-in

- Every account has exactly one **primary** email and at most one **secondary** email. **Decided**
- Sign-up has two options, and both end with a **verified email + a password**. **Decided**
  - **OAuth (Google, Apple):** the provider has already verified the email. The user must then create and confirm a password.
  - **Email + password:** the user enters an email and a password, then receives one email containing both a magic link and a 6-digit code. Either one verifies the email.
- Nobody gets into the app until the email is verified and a password is set. Every account has a password. **Decided**
- An account that verified its email but never set a password is sent straight back to the password screen on its next sign-in. **Proposed**
- Sign-in after that, three options. **Decided**
  - **Email + password**
  - **OAuth (Google, Apple):** passwordless
  - **Magic link or 6-digit code** sent to the primary email: passwordless
- Passwordless is only for signing in. Creating an account always requires setting a password. **Decided**
- Sign-up asks for full name, email and password. **Decided**
- Passwords must be at least 8 characters, with no other rules. Enforced by Supabase Auth, not just the app. **Decided**
- Codes appear only inside the email, never in the subject line (lock-screen privacy). **Decided**
- Sign in with Apple is offered alongside Google (Apple requires it in the iOS app when Google sign-in is offered). **Decided**
- Forgot password: sign in passwordless, then set a new password in account settings. **Proposed**
- Secondary emails are added and verified by a 6-digit code or magic link. Unverified emails count for nothing. **Decided**
- A school or personal email can be either primary or secondary. **Decided**
- Any verified secondary can be swapped to primary; the old primary becomes secondary. The password stays with the account. **Decided**
- Email + password and passwordless sign-in use the primary email only; secondary emails are for proving membership, not login. **Decided**
- OAuth sign-in is tied to the Google/Apple account, so it keeps working after a swap even if that email is now the secondary. **Decided**
- One email belongs to at most one account, as primary or secondary. Sign-up is blocked for an email already claimed as someone's secondary. **Decided**
- Verification emails contain both a magic link and a 6-digit code (a link opened on a laptop can't sign in the phone app, so the user types the code instead). **Decided**
- Swapping the primary requires verifying the new primary email again at the moment of the swap (link or code), even though it was already verified as a secondary. **Decided**

## Team email requirement

- Each team can require an email from a list of allowed domains, and can turn this on or off. **Decided**
- The check happens when joining a team, not at sign-in, and is enforced in the database. **Decided**
- Any verified email on the account (primary or secondary) can satisfy the requirement. **Decided**
- Allowing a domain also allows its subdomains (`upenn.edu` covers `seas.upenn.edu`). **Proposed**
- Coaches see the member's verified school email, not their personal login email. **Proposed**

### Grace period (2 weeks)

A member who no longer has a verified email matching the team's domains gets **2 weeks** to add one. **Decided**

- Starts when they remove the matching email, or when the team turns the requirement on after they joined. **Decided**
- During the 2 weeks: full access, and the membership is flagged so the member and coaches can see it. **Proposed**
- After the 2 weeks: the member can't see the team, and the team can't see them. They can still use their own account. Verifying a matching email restores everything. **Decided**

### Recovery

- If the primary email is a school email and there's no secondary, the app keeps prompting the user to add a personal email as a backup. The app can't detect when a school shuts an email off, so it prompts from the start. **Decided**
- Because every account has a password, a user who loses access to their primary inbox can still sign in and swap their primary. **Note**

## Logging sessions

- Athletes log sessions for themselves. **Decided**
- Coaches can log a session for one athlete, a group of athletes, or the whole team. **Decided**
- Sessions logged by a coach are verified automatically. **Decided**

## Roles

- Each team member has one role: **Coach** or **Athlete**. **Decided**
- Separately, any member can also be an **Admin**. **Decided**
- Coaches are admins by default. Athletes can be made admins. **Decided**
- Only coaches can grant or remove admin privileges; athlete admins can't. **Decided**
- Coaches are always admins; a coach's admin privileges can't be removed. **Decided**
- Coaches can make other members coaches. **Decided**
- Whoever creates a team chooses to be a coach or an athlete, and is an admin either way. **Decided**
- A team doesn't need to have a coach. **Decided**
- Coaches can log their own training, like athletes. Their own sessions are checked like everyone else's (not verified automatically). **Decided**
- Athlete admins can do everything coach admins can, except: they can't remove coaches from the team, can't grant or remove admin, and can't make someone a coach. **Decided**
- A coach can be turned back into an athlete, or removed from the team, by another coach or by themselves. **Decided**
- If the last admin is a coach, they must make someone else an admin before leaving. **Decided**
- If the last admin is an athlete, they can leave, and admin passes automatically to the member who joined the team earliest (by team join date, not account age). **Decided**
- Coaches can delete the team. **Decided**
- Admins can invite someone directly as a coach (the role is set on the invite). **Decided**
- While a team has no coach, athlete admins have all coach rights (grant admin, make coaches, delete the team). Once the team has a coach, the normal limits apply again. **Decided**
- When the last member leaves, the team is deleted automatically. **Decided**
- Sessions are verified by AI. Admins can override the AI's decision (approve a failed session or reject a passed one), but never on their own sessions. **Decided**
- Coaches are on the same leaderboard as athletes, but only in weeks where they logged something. **Decided**
- Weekly targets apply only to athletes. Coaches are never shown as behind, and their sessions don't count toward team goals. **Decided**

### Permissions

| Action | Athlete | Athlete admin | Coach (always admin) |
|---|:-:|:-:|:-:|
| Log own sessions | ✅ | ✅ | ✅ |
| See teammates' sessions, feed, leaderboard | ✅ | ✅ | ✅ |
| Comment on sessions | ✅ | ✅ | ✅ |
| Log sessions for others (one, group, whole team) | ❌ | ✅ | ✅ |
| Edit or delete other people's sessions | ❌ | ✅ | ✅ |
| Override AI verification (not on own sessions) | ❌ | ✅ | ✅ |
| Invite members, reset invite links and codes | ❌ | ✅ | ✅ |
| Remove athletes | ❌ | ✅ | ✅ |
| Remove coaches | ❌ | ❌ | ✅ |
| Team settings, season, targets, activity types | ❌ | ✅ | ✅ |
| Grant or remove admin | ❌ | ❌ | ✅ |
| Make someone a coach | ❌ | ❌ | ✅ |
| Delete the team | ❌ | ❌ | ✅ |

## Activities

- Each team manages its own activity types. **Decided**
- New teams start with standard types: Erg, Berg, Row, Run, Bike, Lift, Custom. **Decided**
- Admins can add their own types, and edit or delete any type, including the standard ones (those are only starting defaults). **Decided**
- Athletes can log a **Custom** session and describe it themselves when nothing else fits. **Decided**
- Distance is optional on every type; time is what's logged. **Decided**
- No type needs a photo by default. Admins can require a photo per type. **Decided**
- Training is measured in **credits**. Admins set credit rules for every type, including Custom. **Decided**
- A rule can depend on the type **and the intensity** (e.g. steady state, hard). **Decided**
- Each team defines its own intensity levels (starting from defaults), just like activity types. **Decided**
- Credits are calculated from what the athlete logs (type + intensity). **Decided**
- Credits always have one decimal place, floored (e.g. 2.57 → 2.5). This applies to every credit value: per rule, per session, totals and leaderboards. **Decided**
- Each session's credits are floored when saved, so totals are exact sums and never need re-rounding. **Decided**
- Three kinds of rule: **Decided**
  - **Per session:** e.g. hard Erg = 10 credits, Lift = 3 credits.
  - **Per time:** e.g. steady-state Erg = 1 credit per 10 minutes.
  - **Per distance:** e.g. 1 credit per 2 km. Rewards faster work: in the same time, a faster athlete covers more distance.
- Targets are set in credits: a **required total** plus a **required amount per type** (e.g. 30 total, of which at least 6 from Lift). **Decided**
- Target period: weekly (default), every 2 weeks, or monthly, chosen by the team. **Decided**
- Teams can set a maximum on total credits and on each type, or have no cap. **Decided**
- The leaderboard ranks by credits by default and can be switched to minutes, distance or sessions. **Decided**
- A session's credits are computed by the backend and saved with the session, so a later rule change doesn't rewrite old weeks. **Proposed**

## Seasons and calendar

- Teams set season dates. **Decided**
- The calendar holds important tests and races. **Decided**
- Coaches can schedule workouts on the calendar. **Decided**
- Athletes can link a logged session to a scheduled workout (optional). **Decided**
- Admins can override the weekly target and cap for specific weeks (taper, test, race weeks). **Decided**
- A team can have several seasons, and past seasons keep their history. **Decided**
- A session's date is decided by the team's time zone, not where the athlete is. **Decided**
- Weeks run Monday to Sunday by default; the team can change the start day. **Decided**
- The team's time zone is detected when the team is created and can be changed in settings. **Decided**

## Photos and verification

- Photos can come from the in-app camera or the gallery. **Decided**
- Sessions count as soon as they're logged. Sessions the AI fails or finds suspicious are flagged for admins and keep counting until an admin rejects them. **Decided**
- Gallery photos (not taken live in the app) are marked for admins. **Decided**
- Which AI reads the photos (on-device OCR, an API, or both) is still undecided. The database stays the same either way. **Open**

## Joining a team

- Each team has separate invite links and codes for athletes and for coaches. **Decided**
- Using an invite joins the team instantly (the school-email requirement still applies). **Decided**
- Admins can reset links and codes, e.g. after a leak. **Decided**

## Look and feel

- The app has a light and a dark theme. It follows the phone's setting by default, and users can override it in settings (Light / Dark / System). The choice is saved on the device. **Decided**
- Each team has a **primary** accent color (required, app default until set) and an optional **secondary** accent color. **Decided**
- Teams can pick from ~15 preset colors with generic names (Red, Navy, Gold…) or enter any hex code. **Decided**
- Admins change the team colors, like other team settings. **Decided**
- Team colors are used for the blurred background glow, progress bars, highlights and primary buttons. Body text, backgrounds and error messages always use the app's own colors, so any team color stays readable. Text on team-colored buttons is black or white, picked automatically for contrast. **Decided**
- Without a secondary color, the glow uses two shades of the primary. **Decided**

## Social

- Feed, comments and reactions, visible to everyone on the team. **Decided**
- Reactions can be any emoji. **Decided**
- Push notifications for comments and reactions. **Decided**
- Users can turn notification types off in settings. **Proposed**

## Open questions

### Credits (can wait)
1. A type + intensity with no rule (e.g. the team set Run at steady state, someone logs Run at hard): what does it earn? Option: every type has a default rule, and intensity-specific rules override it.

### Later
2. Billing: who handles it?
