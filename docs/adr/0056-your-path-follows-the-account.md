# ADR 0056: Your path follows the signed-in account

Date: 2026-10-27. Status: accepted. Builds on ADR 0055 (answers sent after sign-in).

## Context

The front page keeps "Your path" (five lessons, survey finished, answers sent) in the browser only. A
referent who signs in on a second device sees 0 / 7. TASK-AH W5 asked for the signed-in path to come from
the server.

## Decision

- New table `account_progress` (migration 0028): one row per user with the lessons done (0..4), whether
  the survey was finished, and when the answers were sent. No answer, no team, no tenant data. Service
  account only under RLS; the route checks the session.
- `GET /api/progress` returns it; `PUT /api/progress` merges (union of lessons, flags only turn on). Two
  devices never undo each other. Signed out gets 401; the owner's view-as neither reads nor writes.
- The page loads it once after sign-in, merges it into the browser state and saves on change. A survey
  finished on another device marks the step done but does not move the question: the answers stay in the
  browser where they were given.
- `POST /api/send` marks the account as sent on success. The account learns that it sent, never which
  response is its own (ADR 0055 and PRD §15 hold).
- Until 0028 is applied in production, both routes answer `unavailable` and the page keeps its browser
  state.

## Alternatives

- Keep it browser-only: rejected, a second device starts again.
- Store the answers on the account to resume the survey anywhere: breaks the anonymity the survey promises.
- A JSON column on `users`: mixes product state with identity, and RLS on `users` is wider than needed.

## Consequences

One more table to export and erase with the account (cascade on user delete). Progress is per account,
not per team.
