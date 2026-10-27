# TASK-AH — The front page as a cockpit: "Stage + tabs"

## Goal

Replace the brochure front page of www.evolai.io with the cockpit the owner picked on 2026-10-27
from ten mockups: **round-2 variant 3, "Stage + tabs"**. The mockup is the contract and is
committed next to this doc: `docs/mockups/front-page-stage-tabs.html` (a standalone HTML page;
open it in a browser, FR/EN and light/dark toggles, the survey and the "Preview as signed-in" footer
button all work). Build it with the real stack (Next.js, MUI, `packages/i18n`), not by pasting the
HTML. ADR 0051 applies: everything on the page is open; sign-in is the last step of the survey.

| #   | Goal                         | Done when                                                                                                                                                                                                                                                                                                                                                                                     | State |
| --- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 1   | Skeleton                     | `/` renders the cockpit: thin header (logo, tagline strip Understand · Adapt · Evolve in three colours, date), left rail Home / Journey / Learn / Questions / Survey / Materials / Language, centre bordered stage with the ‹ 01–05 › control bar, right panel tabs Overview / Questions / Report / Materials, bottom steps strip with check circles; below `sm` the rail is a bottom tab bar | todo  |
| 2   | Stage views                  | The five stage views of the mockup work: journey map, lessons (the five `/learn` pages' text), survey (the ten questions of `pilot-v1.json`, answers kept in the browser), sample report (labelled Sample, Demo Client), materials (ten video slots, "Coming" until `videos.json` has ids)                                                                                                    | todo  |
| 3   | Sign-in last                 | Finishing the survey shows "Send and start your audit" → a one-field email sheet → a real account/invite is created and the answers attached (reuse `authTokens` + TASK-AF's one-address-per-team); nothing else on `/` asks to sign in; "Auditor sign-in" is a footer link to `/login`                                                                                                       | todo  |
| 4   | Progress only when signed in | Anonymous: the rail shows "Sign in to keep your progress"; signed-in referent: the header shows the greeting and "N of 7 steps" and the bottom strip fills; staff: same header, link to Missions                                                                                                                                                                                              | todo  |
| 5   | Splash and motion            | 0.8 s splash once per load (logo, tagline, bar), skipped under `prefers-reduced-motion`; stage change = 150 ms fade; nothing moves on its own                                                                                                                                                                                                                                                 | todo  |
| 6   | Old routes                   | `/learn/*` keep working and link back to the cockpit ("Back to the cockpit"); `/about` and `/welcome` redirect to `/`; the old front-page components are deleted                                                                                                                                                                                                                              | todo  |
| 7   | Checks                       | Playwright `front-page.spec.ts` at 390×844 and 1280×800: splash once, every rail item, survey to the send sheet, FR/EN, light/dark; axe clean; Lighthouse mobile ≥ 90; no real client or person name                                                                                                                                                                                          | todo  |
| 8   | Token cost                   | Sonnet codes it in one worktree from the committed mockup; no new dependency                                                                                                                                                                                                                                                                                                                  | todo  |

## Not in scope

Per-team progress, badges, points, 3D, a mascot. The referent space `/client` (TASK-AF) and the
mobile polish of `/learn` and `/client` (TASK-AG, now only for those two areas) are separate.

## Ground rules

Worktree `~/evolai-taskah`, branch `feat/front-page-cockpit` off `main`; `git merge main` often, TASK-AF
lands on `/client`, `/s` and the mission tabs at the same time and must not be touched here.
`docs/UI_RULES.md`, brand tokens of ADR 0048, MUI only, FR and EN for every string, "Demo Client"
and "Sales team" only. Gates as in TASK-AE, merge to main, Vercel deploy, verify on www.evolai.io
at phone and desktop width, update the State column, `STATUS: done — <sha>, live at …`.
