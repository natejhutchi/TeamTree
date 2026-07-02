# Single Active Session Per Google Account

## Goal
Prevent a team from sharing one Gmail account across many people.

One Google account should have only one active TeamTree session at a time.

## Preferred Behavior
- On login, check whether this Google/Supabase user already has an active session.
- If no active session exists, allow login.
- If an active session exists and is recent, deny login.
- Show a clear message: `Someone is already using this account.`
- If the active session is stale, allow login and replace it.

## Stale Session Rule
Use a stale-session timeout so a user is not locked out forever if they close their laptop or browser without logging out.

Recommended starting point:

```txt
active if last_seen_at is within 2 minutes
stale if last_seen_at is older than 2 minutes
```

## Runtime Checks
After login:
- Update `last_seen_at` every 30 seconds.
- Also check immediately when the tab/window regains focus.
- If the current session is no longer active, force logout instantly.

## Data Model Idea
Create a table like `user_sessions` with:
- `user_id`
- `session_id`
- `last_seen_at`
- `created_at`
- optional `device_label`

## Notes
This cannot fully stop someone from sharing a Google password, but it makes shared usage impractical and gives users a clear message instead of silently kicking out the first person.
