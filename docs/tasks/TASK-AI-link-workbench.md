# TASK-AI — Link the Workbench to the rest of the app

## Goal

The front page Workbench (TASK-AH, `docs/mockups/glowup-c-workbench.html`) works on its own: lessons,
survey, report sample, sign-in last, answers sent as one anonymous team response (ADR 0055). The rest of
the app still runs on the old pages. This task connects them, in the owner's order (2026-10-27).

| #   | Link                  | Done when                                                                                                                                                                                                                                                                         | State                                                   |
| --- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| L1  | Your path from server | Signed in, Your path loads the account's progress (lessons done, survey finished, sent) and saves it on change; a second device shows the same N / 7. Browser and server merge (union, never undone). Signed out stays browser-only. No answer is stored on the account (PRD §15) | done (2026-10-27); migration 0028 applied to production |
| L2  | One set of lessons    | `/learn/*` redirect to the front page's Learn (lesson n of 5); the old `/learn` pages and their strings are deleted; every link to `/learn` points to the front page                                                                                                              | done (2026-10-27)                                       |
| L3  | Team survey           | `/s/<slug>` uses the Workbench frame (side menu, Try it style question card, progress segments, Previous); the address's team is known, so Send needs no sign-in; same write path as today (ADR 0052)                                                                             | to do                                                   |
| L4  | Referent space        | `/client` uses the Workbench shell: Home shows the team addresses with QR and Share, "N of M answered", Reminder and the report when published; Learn and Survey are the front page's                                                                                             | to do                                                   |
| L5  | Sign-in landing       | A referent's sign-in lands on the Workbench; the front page shows their team and a link to their space; `/client` says when their own answers were sent                                                                                                                           | to do                                                   |
| L6  | Ask for an audit      | A visitor with no account has one action to ask for an audit (owner decides the form: email to the owner, or a request row the owner approves); no account is created without the owner                                                                                           | to do, needs the owner's choice                         |
| L7  | Admin                 | `/admin` (Missions and tabs) uses the Workbench shell and tokens; nothing else changes                                                                                                                                                                                            | to do                                                   |
| L8  | Close TASK-AG         | TASK-AG (mobile `/learn` and `/client`) is marked superseded by L2 and L4; Lighthouse mobile ≥ 90 measured on `/` and `/client`                                                                                                                                                   | to do                                                   |

## Ground rules

Work on `main` in this checkout, one commit per link, each with tests (unit, plus Playwright for UI and
tenant isolation), `docs/UI_RULES.md`, FR and EN for every string, "Demo Client" and "Sales team" only.
Push to main, Vercel deploys, verify on www.evolai.io at 390 and 1280 px, update the State column.
Production migrations are applied by the owner (RUNBOOK "Apply migrations to Neon"); code must run
before and after the migration.

## L1 notes

Migration `0028_account_progress.sql`: one row per user (`lessons_seen` as a small int array, `survey_done`,
`sent_at`), service-account RLS only, no tenant data, no answers. `GET/PUT /api/progress` (session only):
PUT merges, never removes. Until 0028 is applied the route answers `unavailable` and the page keeps the
browser state. ADR 0056.
