# TASK-AF — The referent flow: one address per team, "Open my space", share and remind

## Goal

A team referent (the client-side person who first onboards a team) goes from one message to a
published report in seven screens, on a phone, without a password and without ever seeing the word
"link" for a person. Today the referent creates one invitation link **per respondent** on
`/client/invitations` and hands each out by hand; the owner rejected that model ("links make no sense
for a user, they do not exist anywhere"). After this task a team has **one survey address**, the
referent forwards it with a prefilled message, watches the count, sends one reminder, and reads the
report. The seven screens were agreed on the clickable prototype of 2026-10-26 (artifact
"EvolAI referent flow"); this doc is the written contract for them.

| #   | Goal                               | Done when                                                                                                                                                                                                                                                                        | State |
| --- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 1   | One survey address per team        | `/client` shows one address `https://www.evolai.io/s/<slug>` per team of the mission, with a QR code; opening it on a fresh browser starts the survey; a second fresh browser gets its own answers; the per-person link creation (`CreateLinksForm`, link CSV, `#links`) is gone | done  |
| 2   | "Open my space" without a password | The referent's welcome email carries one address that opens `/client` signed in; no set-password step on that path; `/set-password` stays only for staff (`/admin`)                                                                                                              | done  |
| 3   | Share with the team                | `/client` has a "Share with the team" action that shows the prefilled message (FR/EN) with the team address, a Copy button, and a `https://wa.me/?text=…` link; nothing is sent by the platform                                                                                  | done  |
| 4   | Progress and one reminder          | `/client` shows "N of M answered" per team (M = team size set by the referent, min-group rule kept), and a "Send a reminder" action with a prefilled message and Copy button                                                                                                     | done  |
| 5   | Learn before you share             | The welcome email and `/client` (while the team has 0 answers) link to `/learn` ("Learn the audit in 10 minutes", TASK-AE)                                                                                                                                                       | done  |
| 6   | Report                             | `/client/report` shows the readiness score, the three actions (30/60/90 days) and the PDF; unchanged if it already does, verified on the Demo Client mission                                                                                                                     | done  |
| 7   | Token cost                         | Sonnet does the coding in one worktree; one Playwright spec `referent-flow.spec.ts`; no manual browser session longer than the spec                                                                                                                                              | done  |

## The seven screens (contract)

Every screen below is a page or a state of a page that already exists. Nothing new in the top nav.

1. **Message.** Email to the referent (sent by the auditor from the mission's Links tab, which becomes
   the **Team** tab, see "What changes"). Subject "Your team's audit is ready". Two buttons:
   "Learn the audit in 10 minutes" → `/learn`; "Open my space" → `/client?open=<token>` (goal 2).
2. **Learn.** `/learn` as shipped by TASK-AE. No change in this task except that `/learn/results`
   ends with "Back to my space" when a client session exists.
3. **My space.** `/client`, one card per team: team name, the team address in big type, a QR code
   (rendered server-side as SVG, no external service, no new dependency — `qrcode` is already a
   workspace dependency; if it is not, add it as the only new one), buttons "Share with the team"
   and "See the questions" (→ `/learn/questions`). Below: "Answers: N of M", "Report: pending".
4. **Share.** A dialog on `/client`: the prefilled message (from `referentMessages.ts`, with the team
   address instead of a person's link), Copy, and "Open in WhatsApp" (`wa.me` link). The referent
   can also set M, the team size, here ("How many people are in the team?" — one number field).
5. **Survey.** `/s/<slug>` → the existing respondent flow (`/s/[token]/q/[index]`), unchanged for the
   respondent: same welcome, same ten questions, same done page.
6. **Progress.** `/client` once answers exist: "9 of 12 answered", a bar, and "Send a reminder" (a
   dialog like Share, with the reminder text). The reminder days logic in `referentView.ts` stays and
   drives the hint "a reminder is due today".
7. **Report.** `/client/report` as it is: readiness, three actions, PDF. Verify on Demo Client.

## How one address works (design, keep it this simple)

- A **team address** is a row in a new table `team_addresses (id, tenant_id, engagement_id, team_id,
slug UNIQUE, expected_size INT NULL, created_at)`. The slug is `<engagement-short>-<team-short>`
  lower-case ASCII, e.g. `demo-sales`; the auditor can edit it on the Team tab. Migration
  `infra/db/migrations/0025_team_addresses.sql`, RLS like `invitations`.
- `GET /s/<slug>` (new branch inside `apps/web/src/app/s/[token]/page.tsx`, decided by shape: a slug
  is not `looksLikeToken`): if the browser has no cookie `evolai_r_<slug>`, create one `invitations`
  row (pseudonym = random, `status='opened'`, `opens_at=now`, `expires_at` = mission close + 30 d),
  put its signed token in an httpOnly cookie scoped to `/s/`, then redirect to `/s/<token>`. With a
  cookie, redirect to `/s/<token>` straight away. Everything downstream (answers, submit, done,
  team progress, min-group rule) is untouched: a visitor **is** an invitation.
- Progress "N of M": N = submitted invitations of the team (existing `teamCounts`), M =
  `expected_size` when set, else the number of started invitations. The min-group rule
  (`MIN_GROUP_SIZE`) stays exactly as it is.
- **"Open my space"** reuses `authTokens.ts` with a new kind `space` (TTL 30 days, single use):
  `/client?open=<token>` exchanges it for the normal client session cookie and redirects to
  `/client`. The welcome email (`invitationDelivery.ts` / the staff invite path) sends this address
  instead of the set-password address for `role = client`. Staff keep `/set-password`. The owner's
  rule: no extra security work on this path beyond single use + expiry.

## What changes, what goes

| Area                                                                      | Change                                                                                                                                                                                         |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/client/invitations`                                                     | Removed; `/client` and its two dialogs replace it. `ClientTabs` becomes Home / Results / Report. Old URL redirects to `/client`.                                                               |
| `CreateLinksForm.tsx`, `ShareLinks.tsx`, link CSV export, `listTeamLinks` | Deleted with their tests.                                                                                                                                                                      |
| Mission **Links** tab (`MissionTabs`, `invitations`)                      | Renamed **Team**: the referent (name, email, "Send the welcome email" / "Send again"), the team addresses with slug + expected size, and the per-team count. Per-person link table and CSV go. |
| `api/admin/invitations`                                                   | Keeps the referent invite; the batch link creation (`createBatch`, `MAX_BATCH`) goes.                                                                                                          |
| Reminder cron (`api/cron/reminders`)                                      | Unchanged: it only emails referents / staff, never respondents.                                                                                                                                |
| i18n                                                                      | New keys in `packages/i18n/src/messages` FR + EN; `client.home.noLinks` and every "link" string the referent can see is reworded ("address").                                                  |
| `docs/AUDITOR_GUIDE.md`                                                   | Rewritten to the five mission tabs Overview / Team / Answers / Report / Settings and the referent flow above (it still lists nine tabs).                                                       |
| ADR                                                                       | `docs/adr/0051-one-address-per-team.md`: supersedes the per-person link part of ADR 0039 and 0047.                                                                                             |

## Ground rules

- Worktree `~/evolai-taskaf`, branch `feat/referent-flow` off `main`; MUI only, `UI_RULES.md`,
  glossary words Mission / Survey / Report / Team; FR and EN for every string; no real client or
  referent names anywhere (BANNED_TERMS leak scan) — "Demo Client", "Sales team".
- Do not touch `/learn` (TASK-AE) beyond the one "Back to my space" button.
- Do not add tracking, per-person state, or any new third-party service. QR = server-side SVG.
- Tests: unit tests for the slug→invitation branch and the `space` token; Playwright
  `apps/web/e2e/referent-flow.spec.ts` walking screens 3 → 6 on Demo Client (two fresh contexts
  answer the same address and count 2); axe clean; 360 and 1280 widths.
- Gates as in TASK-AE (`pnpm lint`, `pnpm typecheck`, `pnpm test`, e2e), then `integrate request
feat/referent-flow` or merge to main and let Vercel deploy; verify on www.evolai.io with the Demo
  Client mission and end with `STATUS: done — <merge sha>, live at …`.

## Do not

- No password, no 2FA, no "secure link" wording for referents.
- No per-respondent link anywhere a referent can see.
- No new top-level tab, no dashboard widgets beyond the card described above.
- No change to the ten questions or the respondent pages.
