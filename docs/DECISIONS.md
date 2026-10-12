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
- An account without a password (a Google/Apple sign-up that didn't finish) only sees the "Create your password" screen until it sets one, even after closing the app. **Decided**
- Sign-in after that, two options. **Decided**
  - **Email + password**
  - **OAuth (Google, Apple):** the only passwordless way in
- There is no sign-in by emailed link or code. Emailed codes are only for confirming a new account and for "forgot password". **Decided**
- Sign-up asks for full name, email and password. **Decided**
- Passwords must be at least 8 characters, with no other rules. Enforced by Supabase Auth, not just the app. **Decided**
- Codes appear only inside the email, never in the subject line (lock-screen privacy). **Decided**
- Signed-out users land on **sign-in**. On a device where nobody has ever signed in, they land on **sign-up** instead (probably a new user). **Decided**
- Sign-in offers email + password, Continue with Apple, Continue with Google, and a "Create an account" link. Sign-up offers the same Apple/Google buttons and an "Already have an account? Sign in" link. **Decided**
- Signing in to an account whose email was never confirmed sends a fresh code and opens the code screen. **Decided**
- A wrong email or password shows the same message ("Wrong email or password."), so the form can't reveal who has an account. **Decided**
- Sign in with Apple is offered alongside Google (Apple requires it in the iOS app when Google sign-in is offered). **Decided**
- Forgot password: enter your email, get a 6-digit code, enter it, then set a new password before using the app. Closing the app doesn't skip that step. The new password must differ from the old one. **Decided**
- The password-reset email contains only the code (no link): a link would open a web page that can't sign in to the app. **Decided**
- Secondary emails are added and verified by a 6-digit code or magic link. Unverified emails count for nothing. **Decided**
- A school or personal email can be either primary or secondary. **Decided**
- Any verified secondary can be swapped to primary; the old primary becomes secondary. The password stays with the account. **Decided**
- Email + password sign-in and password resets use the primary email only; secondary emails are for proving membership, not login. **Decided**
- OAuth sign-in is tied to the Google/Apple account, so it keeps working after a swap even if that email is now the secondary. **Decided**
- One email belongs to at most one account, as primary or secondary. Sign-up is blocked for an email already claimed as someone's secondary. **Decided**
- Sign-up confirmation emails contain both a link and a 6-digit code (a link opened on a laptop can't sign in the phone app, so the user types the code instead). **Decided**
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
- The logging form asks for: activity, intensity (optional), day (today or earlier, never the future), time, distance (optional; km, m or miles), and notes (optional). Custom activities also need a short description. **Decided**
- Time can be typed the way people say it or read it off a machine: `45` (minutes), `1h 15m`, `39:40`, `1:05:20`. **Decided**
- The form previews the credits before saving. The preview is only a convenience: the database calculates the saved number. **Decided**
- Coaches and admins get a **Who** choice at the top of the form: **Me** or **Athletes**. Athletes shows a checklist of the team's athletes with an **Everyone** row; each ticked athlete gets the same workout. **Decided**
- A workout logged for athletes has no photo step, even for activities that normally need one, because it's already verified. **Decided**
- A group log is saved all at once: either every athlete's session is saved or none is. The sessions share a group id so they can later be shown or undone together. **Decided**
- Only athletes appear in the list (not other coaches), and not members who are locked out of the team. **Decided**
- Built: logging for yourself with photos, coaches logging for athletes, and editing or deleting a workout (from the Feed). **Decided**

### Changing a workout afterwards

- **An athlete changes the numbers** (activity, intensity, time, distance or day) of a workout that has been through the photo check or a coach's review: it goes to the coaches' list as **Corrected by athlete**, every time, and a coach decides. Changing only the notes doesn't do this. **Decided**
- A workout that was never checked (no photo, not reviewed) can be edited freely: there's no verification to undo. **Decided**
- **An admin changes the numbers** of someone's workout: it's verified. **Decided**
- An admin changing their own workout is treated like any athlete: nobody verifies themselves. **Decided**

### How far back athletes can log and change

- Each team sets two limits for its athletes, on the Team tab ("Rules for athletes", admins only): **Decided**
  - **Log:** how old a workout can be when it's logged.
  - **Change or delete:** how old a workout can be and still be edited or deleted.
- Each limit is one of: **Any time** (the default), **A few days** (today and the last N days; 0 means the same day only), **This week** (Monday to Sunday), **This month**. **Decided**
- Limits go by the workout's day in the team's time zone. An athlete also can't move a workout to a day they couldn't log. **Decided**
- Coaches and admins are never limited: they can log, change or delete any workout on any day. An athlete outside the limit is told to ask a coach. **Decided**
- Confirming a flag ("It's correct") is always allowed, however old the workout is. **Decided**
- The limits are enforced by the database. The app also follows them (the day picker stops at the limit, Edit and Delete are hidden) so athletes get an explanation instead of an error. **Decided**

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
- Every new team starts with a first season (from the day it's created until the same day next year) and a weekly target of **12 credits** (120 minutes at the default 1 credit per 10 minutes), with no max. Admins can change or remove both. **Decided**
- The calendar holds important tests and races. **Decided**
- Coaches can schedule workouts on the calendar. **Decided**
- Athletes can link a logged session to a scheduled workout (optional). **Decided**
- Admins can override the weekly target and cap for specific weeks (taper, test, race weeks). **Decided**
- A team can have several seasons, and past seasons keep their history. **Decided**
- A session's date is decided by the team's time zone, not where the athlete is. **Decided**
- Weeks always run Monday to Sunday (in the team's time zone). There is no setting to change the start day. **Decided**
- Two-week periods are counted from the Monday of the season's first week (weeks 1–2, 3–4, …). **Decided**
- The team's time zone is detected when the team is created and can be changed in settings. **Decided**

## Photos and verification

- Photos can come from the in-app camera or the gallery. **Decided**
- Sessions count as soon as they're logged. Sessions the AI fails or finds suspicious are flagged for admins and keep counting until an admin rejects them. **Decided**
- Gallery photos (not taken live in the app) are marked for admins. **Decided**
- Photos are read by Google's Gemini (a model that understands images), called from Supabase Edge Functions so the API key never reaches the app. Which models to try, and in what order, is a setting (`GEMINI_MODELS`). On-device reading is not planned for now. **Decided**
- **Auto-fill:** adding photos to the logging form has the AI read each screen (erg, bike erg, watch, app): activity, intensity, time, distance, date. The athlete checks it and can change anything before saving. Up to 6 photos at once. Only work time counts, never rest. **Decided**
- **Several workouts from one set of photos:** photos of the same activity are added together into one workout; a different activity, intensity or day becomes a separate workout. Example: photos of erg 20 min, berg 40 min, erg 20 min, erg 20 min are logged as one 60-minute erg workout and one 40-minute berg workout. The form lists the workouts found, each can be checked and edited, and they are saved together (all or nothing). **Decided**
- The AI only reads each photo. The grouping and adding up is done by ordinary code, so the totals are always exact. A value the AI couldn't read (no date on the screen, unclear intensity) doesn't split a workout. **Decided**
- **Confidence:** the AI rates how sure it is that it read a screen correctly, from 1 to 10. A workout's confidence is the lowest of its photos. Below **7** it isn't trusted: the form warns the athlete, and after saving the session is flagged for a coach even if the numbers match. The threshold is one setting (`MIN_CONFIDENCE`). **Decided**
- **Check after saving:** the AI compares each saved session with its own photos (time and distance within about 10%) and marks it passed or flagged, with a one-sentence reason for the coach. A screen dated before the session is fine (logged late); one dated after is flagged. Athletes can't set this themselves: it's decided on the server. **Decided**
- A photo that can't be read at all isn't attached to any workout when others were read. If nothing could be read, the athlete types the workout in, the photos stay attached, and the check flags it. **Decided**
- **Answering a flag:** when one of your workouts is flagged, Home shows "1 workout needs a quick check". The review screen shows what was logged, why it was flagged, and the photos, with two choices: **Decided**
  - **It's correct:** the workout stays flagged, marked **Confirmed by athlete**.
  - **Fix it:** change the activity, intensity, time or distance. The workout is marked **Corrected by athlete**, credits are recalculated, and it stays in the coaches' list for a decision. (It is not sent through the photo check again.)
  - Either way the athlete can add a short note for the coach.
- A coach or admin always has the final word. Their **Needs review** list (Team tab) shows every flagged workout with one of three labels: **Waiting for athlete**, **Confirmed by athlete**, **Corrected by athlete**. Answered ones are listed first. Approve makes it verified; Reject stops it counting. **Decided**
- A coach or admin doesn't have to wait for the athlete. At any point, whatever label the workout has, they can **Approve**, **Reject**, or **Fix the numbers** (change the activity, intensity, time or distance; this saves the fix and approves it in one step). Any of the three settles the workout and removes it from the list. **Decided**
- An athlete can't mark their own workout verified: the answer is only a signal for the coach. Once a coach has decided, the athlete can't answer again. **Decided**
- If the AI can't be reached, the check is retried up to 3 times; after that the session stays "pending" for an admin to look at. **Decided**
- Photos are shrunk on the phone (longest side 1600 px) before upload. **Decided**
- **Photo limits:** up to 6 photos per log. As a safety net against abuse, one person can have at most 60 photos read in 24 hours (each read costs money, and adding a photo re-reads the set); past that they're told to type the workout in. Both numbers are settings in the function. **Decided**
- **Reused photos** are caught during the check after saving, in two steps: **Decided**
  1. The exact same photo file is already on another workout of the team (compared by fingerprint).
  2. Another workout's photos read as exactly the same time **and** distance. That can be a coincidence, so only then are the two sets of pictures compared by the AI, and it's flagged only if they show the same picture.
  Either way the workout is flagged as "Possibly a reused photo", naming the other workout, and a coach decides. Two athletes legitimately sharing one screen (a crew boat) will be flagged too; the coach approves it.
- Not built yet: a background job that retries waiting checks. **Open**

## Joining a team

- Each team has separate invite links and codes for athletes and for coaches. **Decided**
- Using an invite joins the team instantly (the school-email requirement still applies). **Decided**
- Admins can reset links and codes, e.g. after a leak. **Decided**
- Signed-in users who aren't on any team (or only on teams they're locked out of) see onboarding: **Join a team** (code or pasted invite link, with a preview of the team and role before joining) or **Create a team** (name and your role; time zone taken from the phone). **Decided**
- Codes aren't case-sensitive. **Decided**
- The app remembers which team you last viewed on this device; otherwise it opens the team you joined first. **Decided**

## Look and feel

- The app has a light and a dark theme. It follows the phone's setting by default, and users can override it in settings (Light / Dark / System). The choice is saved on the device. **Decided**
- Each team has a **primary** accent color (required, app default until set) and an optional **secondary** accent color. **Decided**
- Teams can pick from ~15 preset colors with generic names (Red, Navy, Gold…) or enter any hex code. **Decided**
- Admins change the team colors, like other team settings. **Decided**
- Team colors are used for the blurred background glow, progress bars, highlights and primary buttons. Body text, backgrounds and error messages always use the app's own colors, so any team color stays readable. Text on team-colored buttons is black or white, picked automatically for contrast. **Decided**
- Without a secondary color, the glow uses two shades of the primary. **Decided**
- The top bar (profile and team switcher) is frosted and blurred. It fades and slides off the top while you scroll down, and slides back when you stop scrolling, scroll up, or reach the top. The glow stays fixed behind the page, and pull-to-refresh shows its spinner below the bar. **Decided**

## Social

- Feed, comments and reactions, visible to everyone on the team. The feed lives in the Feed tab. **Decided**
- Reactions can be any emoji. Six are one tap away (👏 🔥 💪 🙌 😮 ❤️); any other can be typed in. Tapping a reaction you already gave takes it back. **Decided**
- **Feed, first version:** the team's workouts newest first, 20 at a time with "Load more". Each card shows who, when, the activity and intensity, time, distance, credits, notes, photos and reactions. Filters: **Everyone**, **My workouts**, **People** (tick any teammates). **Decided**
- Tapping a workout opens it: bigger photos, comments, and for its athlete or an admin, **Edit** and **Delete**. Delete asks twice and takes the workout's photos, comments and reactions with it. **Decided**
- Anyone on the team can comment. You can delete your own comments; admins can delete any. **Decided**
- A workout a coach logged for an athlete says "logged by coach". **Decided**
- The photo-check label (Verified, Checking photo, Flagged, Rejected) is shown only to the workout's athlete and to admins. A rejected workout disappears from everyone else's feed. **Decided**
- You can edit your own comments; an edited comment says "edited". **Decided**
- **Live updates:** when a teammate logs or changes a workout, comments or reacts, the Feed (and the totals on Home) update by themselves within a second or so. The exception is someone else deleting something, which shows after your next refresh. **Decided**
- Deleting a workout also deletes its photo files. (Deleting a whole team or account still leaves files behind; a cleanup job for that comes later.) **Decided**
- A link straight to a tab (for example a notification pointing at the Feed) opens that tab. Without one, the app opens on Home. **Decided**
- Push notifications for comments and reactions. **Decided**
- Users can turn notification types off in settings. **Proposed**

## Navigation and Home

- Bottom tabs, left to right: **Team · Calendar · Home · Feed · Profile**, with Home in the middle. Native tabs (Liquid Glass on iOS 26, Material on Android). **Decided**
- Style follows the Equinox reference: dark-leaning, typography-led, flat lists, small uppercase monospace labels, team-color glow. **Decided**
- Home, top to bottom: account (left) and team switcher (right); goal cards (**Your week**, **Team**, swipeable); leaderboard; a "Log a session" bar above the tab bar. **Decided**
- **Feed**: every session on the team, with comments and reactions, filterable to **Everyone** (default), **My workouts** (your history), one person, or a chosen list of people. **Decided**
- No search for now. **Decided**
- **Log a workout** lives in the iOS 26 tab bar's bottom accessory (Liquid Glass, visible on every tab, like Apple Music's mini player). Tapping it slides up a native sheet with the logging form; the sheet grows out of the bar and shrinks back into it (Apple's zoom transition, iOS 18 and later); elsewhere it's the standard sheet. Android and older iPhones get a floating "＋ Log a workout" button instead. To be built together with logging. **Decided**

### Leaderboard

- Each person has a horizontal **bar**. For credits, the full width is the team's **max** (e.g. Penn: 300 min-equivalent), and a vertical line marks the **target** (e.g. 120). **Decided**
- With no max set, the full width is target + 50%, and the end of the bar is left unlabeled. **Decided**
- Anyone past the end of the bar gets a full bar with a » marker; the number shows their real total. **Decided**
- Going over the max is a gentle caution, not praise: that bar (and the » marker) is muted orange. Teams without a max have no caution state; going past target + 50% just shows the » marker in the team color. **Decided**
- The max is the most people *should* do, not a limit: sessions above it still count. **Decided**
- For minutes and distance (no targets), bars are relative to the leader. **Decided**
- Bars past the target use the team color; bars short of it are grey. **Decided**
- Period: choose **Week, Month or Season** (plus **2 weeks** for teams using that period), and step to earlier ones with ‹ › (the current one by default, never the future). **Decided**
- Metric: **Credits, Minutes or Distance** (no session count). The target and max lines only show for credits. **Decided**
- Home shows the top 10 plus your own row (highlighted, pinned if you're outside the top 10), with "See all" for the full list. **Decided**

### Who sees what

- Everyone sees everyone's numbers, bars and rank, and their **own** "X to go". **Decided**
- Only coaches and admins see who else is behind: "X to go" on other people, the grey "behind" look, the orange over-max warning, and AI verification flags. Athletes see a plain scoreboard. **Decided**
- Athletes do see flags on their **own** workouts, so they can answer them (see "Answering a flag"). They never see anyone else's. **Decided**
- This is enforced by the database, not just hidden by the app: verification details can't be read from the sessions table at all, only through a function that answers for your own workouts (or everyone's, for admins). A rejected workout is invisible to other athletes. **Decided**

### Goal cards (Home)

- **Your week:** your credits toward the target, per-type requirements, and "X to go". Coaches get the same card without a target: their credits, sessions, minutes and distance. **Decided**
- Home is meant to motivate: it shows progress, not who's behind. **Decided**
- **Team this week:** the team's total minutes (big) and hours, the team goal (everyone's target added up) as credits and %, plus sessions, kilometers and minutes per athlete. Athletes only: coaches' sessions don't count. Links to the Team tab. **Decided**
- Coaches and admins also see "5 / 13 on target · 8 still to go — See who ›" at the bottom of that card. Athletes don't. **Decided**
- The on-target count ("5 / 13 athletes have hit the weekly target") is on the Team tab for everyone; the list of who's still to go (or missed it, for past weeks) is for coaches and admins only. **Decided**

## Team tab

First version, top to bottom:

- **Missed target** (coaches and admins only): how many athletes missed the target in a given week and who they are, sorted by how far short (no sessions at the bottom), using that week's own target (taper weeks included). ‹ › to look at any week. For the current week it shows who is still behind, with a **Nudge** button (push notification). Coaches don't count. **Decided**
- **Needs review** (coaches and admins only): sessions the AI flagged, approve or reject in one tap. **Decided**
- **Coming up:** the next test or race with a countdown, and today's scheduled workout with who has done it. **Decided**
- **Target hit rate:** % of athletes on target, week by week across the season. **Decided**
- **Streaks:** weeks in a row on target, per athlete. **Decided**
- **Members and invites:** the roster and invite codes; managing them is for admins. **Decided**
- Later: athlete drill-down, load warnings (sudden volume jumps), team challenges, erg test board, a season view of missed weeks per athlete. **Note**

## Open questions

### Credits (can wait)
1. A type + intensity with no rule (e.g. the team set Run at steady state, someone logs Run at hard): what does it earn? Option: every type has a default rule, and intensity-specific rules override it.

### Later
2. Billing: who handles it?
