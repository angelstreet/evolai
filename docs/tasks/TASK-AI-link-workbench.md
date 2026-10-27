# TASK-AI — Link the Workbench to the rest of the app

## Goal

The front page Workbench (TASK-AH, `docs/mockups/glowup-c-workbench.html`) works on its own: lessons,
survey, report sample, sign-in last, answers sent as one anonymous team response (ADR 0055). The rest of
the app still runs on the old pages. This task connects them, in the owner's order (2026-10-27).

| #   | Link                  | Done when                                                                                                                                                                                                                                                                                                                                                                                                   | State                                                   |
| --- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| L1  | Your path from server | Signed in, Your path loads the account's progress (lessons done, survey finished, sent) and saves it on change; a second device shows the same N / 7. Browser and server merge (union, never undone). Signed out stays browser-only. No answer is stored on the account (PRD §15)                                                                                                                           | done (2026-10-27); migration 0028 applied to production |
| L2  | One set of lessons    | `/learn/*` redirect to the front page's Learn (lesson n of 5); the old `/learn` pages and their strings are deleted; every link to `/learn` points to the front page                                                                                                                                                                                                                                        | done (2026-10-27)                                       |
| L3  | Team survey           | `/s/<token>` uses the Workbench frame (logo, FR \| EN, theme; one centred column, no side menu: a team member has one task) and the Try it question card: progress segments that link back to questions reached, radio options, pick then Next, Previous and Next as an equal pair, Skip only on free text. The address's invitation saves each answer, so no sign-in; same write path as before (ADR 0052) | done (2026-10-27)                                       |
| L4  | Referent space        | `/client` uses the Workbench shell: side menu Home / Results / Report, then Learn and Survey on the front page (`/?learn=1`, `/?survey=1`); header with the organisation, FR \| EN, theme and account; the view-as banner above the pages, which keep their cards (addresses with QR and Share, N of M answered, Reminder, report)                                                                          | done (2026-10-27)                                       |
| L5  | Sign-in landing       | A referent's sign-in lands on the front page (a `/client` path they asked for still wins); the Home card names their team and has Open your space; `/client` says whether their own answers were sent, with Answer the questions when not                                                                                                                                                                   | done (2026-10-27)                                       |
| L6  | Ask for an audit      | A visitor with no account has Ask for an audit on the front page: one email field, refused until the address has the right shape and a domain that takes mail (MX or address record); asking again is fine (public limit 3 per address and 10 per network an hour against bursts); each request reaches the owner by email (`CONTACT_EMAIL`); no account                                                    | done (2026-10-27)                                       |
| L7  | Admin                 | `/admin` uses the same Workbench shell: side menu Missions / Settings / Front page, the organisation in the header, tokens; the pages inside are unchanged; print hides the menu and header                                                                                                                                                                                                                 | done (2026-10-27)                                       |
| L8  | Close TASK-AG         | TASK-AG (mobile `/learn` and `/client`) is marked superseded by L2 and L4; Lighthouse mobile ≥ 90 measured on `/` and `/client`                                                                                                                                                                                                                                                                             | to do                                                   |

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
