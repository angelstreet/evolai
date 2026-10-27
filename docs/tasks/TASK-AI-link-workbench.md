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
| L8  | Close TASK-AG         | TASK-AG is marked closed, replaced by L2 and L4; Lighthouse mobile measured on the live `/`: performance 90, 90, 96 over three runs (85 before the splash fix; LCP 3.2 s to 1.7 s), accessibility 100. `/client` needs a signed-in account, which an agent cannot use on production: not measured live                                                                                                      | done (2026-10-27), `/client` Lighthouse open            |

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

## Follow-ups (owner, 2026-10-27)

| #   | Item                         | Done when                                                                                                                                                                                        | State             |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- |
| F1  | Survey welcome and thanks    | `/s/<token>` and its done page are one Workbench card each (title band, sections), like the question card                                                                                        | done (2026-10-27) |
| F2  | Cards inside the space       | `/client` home cards are Workbench cards with a title band (Survey, Your answers, Learn, each team, Report); the other outlined cards in `/client` and `/admin` take the card look               | done (2026-10-27) |
| F3  | Organisation switcher        | Staff with several organisations switch from the account menu in the admin header; the header and the side menu keep the new organisation (`admin-switcher.spec.ts`)                             | done (2026-10-27) |
| F4  | Own report on the front page | A signed-in referent's Report section shows their published report (score, summary, next actions, Open the full report) instead of the Demo Client sample; drafts never                          | done (2026-10-27) |
| F5  | Client walkthrough           | `client-walkthrough.spec.ts` runs the whole audit as a client (visitor, referent, five members, own answers, auditor publishes, referent reads), with a screenshot per step (`WALK_SHOTS=<dir>`) | done (2026-10-27) |

What the walkthrough found and fixed: the thank-you page said "open until" the person's own link expiry while the
referent's space said there was no closing date (it now uses the mission's closing date, or none); Results stayed
"Nothing published yet" next to a published report (it now points to the report); the welcome copy still described
one-tap saving. Not a bug: the analysis pipeline is parked (AUDITOR_GUIDE step 6), so findings come from the auditor
and Results stays empty until analyses are approved.
