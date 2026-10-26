# 0051 — One survey address per team, and "Open my space" without a password

Status: accepted

## Context

The referent flow of ADR 0039 and ADR 0047 made the referent create one single-use link per respondent and hand each
out by hand. The owner rejected that model: links do not exist anywhere for a user, a list of them says nothing, and
the referent should go from one message to a published report in a few screens on a phone, with no password
(`docs/tasks/TASK-AF-referent-flow.md`). Respondents stay anonymous and the minimum group rule stays.

## Decision

- **One address per team**: table `team_addresses (id, tenant_id, engagement_id, team_id, slug UNIQUE,
expected_size, created_at)` with the `invitations` RLS pattern (migration `0026_team_addresses.sql`; 0025 was
  taken). The slug is `<organisation-short>-<team-short>` in lower-case ASCII (`demo-sales`), unique across the
  platform, made on first read and editable by the auditor on the Team tab. Rows are created lazily by
  `ensureTeamAddresses`, so existing missions need no data migration.
- **`/s/<slug>`** is a branch of `/s/[token]`, decided by shape (an invitation token always contains a dot). A
  browser without the cookie `evolai_r_<slug>` goes through `/s/open/<slug>`, which creates one anonymous invitation
  (random pseudonym, `status = opened`, expiring 30 days after the mission closes) and keeps its signed token in an
  httpOnly cookie scoped to `/s/`; with the cookie it goes straight back to its own token. Everything downstream
  (answers, submit, done, team progress, minimum group) is unchanged: a visitor is an invitation. A closed mission
  refuses new visitors in plain words; an unknown slug is a 404. The cookie is the only per-browser state; there is
  no per-person tracking.
- **Progress**: "N of M answered" with N = submitted invitations of the team and M = the size the referent stated,
  never below the number of people who opened the address (so it cannot read "14 of 12"); without a stated size M
  is the number of people who opened it. The referent view still goes through `referentParticipation`, so under
  `MIN_GROUP_SIZE` it shows words, not figures.
- **"Open my space"**: `auth_tokens` gains `purpose = 'space'` (migration 0027, additive; stored with kind `invite`; 30 days, single use, hashed at rest, spent by one atomic
  UPDATE). `/client?open=<token>` is redirected by the middleware to `/api/auth/open`, which spends the token and
  sets the normal client session cookie, for team referents only. Set-password and reset tokens cannot open a session.
  Staff keep `/set-password`. No extra security work on this path beyond single use and expiry, as the owner asked.
  A mail scanner that opens the address first will spend it; the auditor sends the welcome email again.
- **Referent screens**: `/client` shows one card per team (address in big type, server-rendered QR code SVG with the
  `qrcode` package already in the workspace, "Share with the team", "See the questions"), then "Answers N of M" with
  "Send a reminder", then the report state. Share and reminder are dialogs with the prefilled message (FR and EN),
  Copy and a `wa.me` link; nothing is sent by the platform. The reminder-day hint still comes from `referentView.ts`.
- **Staff**: the mission's Links tab becomes **Team** (same URL segment `invitations`, so old links keep working):
  the referent's welcome email, each team's address with its ending and size, and the contact line of the forwarded
  message. `createBatch`, the per-person link table, the link CSV, the QR sheet and `/client/invitations` are
  removed (`/client/invitations` redirects to `/client`).

## Alternatives

- A signed team token instead of a slug: rejected, an address people can read out loud and type is the point.
- Counting visitors by IP or fingerprint to stop a second answer from one browser: rejected, it is per-person
  tracking; the cookie only returns a browser to its own answers.
- A password step for referents: rejected by the owner for the MVP.

## Consequences

- Anyone with the address can start a survey, so the count can include people outside the team. The referent shares
  the address inside the team; a spam risk is accepted for the pilot and handled by closing the mission.
- Two browsers of the same person count twice. Acceptable for an anonymous survey.
- Supersedes the per-person link parts of ADR 0039 and ADR 0047; the rule that the referent never sees who answered
  holds more strongly, since no per-person link exists.
