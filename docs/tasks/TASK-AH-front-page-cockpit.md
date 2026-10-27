# TASK-AH — The front page as a cockpit: "Workbench"

## Goal

Restyle the front page cockpit of www.evolai.io to the look the owner picked on 2026-10-27, after
round 1 shipped: **glow-up mockup C, "Workbench"**. The mockup is the contract and is committed next
to this doc: `docs/mockups/glowup-c-workbench.html` (a standalone HTML page; open it in a browser,
FR/EN and light/dark toggles and the "Try it" question work). Build it with the real stack (Next.js,
MUI, `packages/i18n`), not by pasting the HTML. ADR 0051 and ADR 0053 still apply: everything on the
page is open; sign-in is the last step of the survey.

Why the change: the round-1 rail cut its words ("Journe", "Questic", "Materia"), the small mono caps
labels and middle-dot strings read as generic, and the stage, the right tabs and the bottom strip
showed the same steps three times. Workbench keeps the behaviour of round 1 and changes the frame.

Round 1 ("Stage + tabs", `docs/mockups/front-page-stage-tabs.html`) is live and is the starting
point: reuse `Cockpit.tsx`, `cockpitModel.ts`, `SendSheet.tsx`, the cockpit messages and
`front-page.spec.ts`; replace the layout and `cockpit.css`. Its goals are kept at the end of this doc.

| #   | Goal       | Done when                                                                                                                                                                                                                                                                                                                                                                                                                 | State |
| --- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| W1  | Side menu  | A 232 px side menu on the page surface: logo, then Home / Learn / Videos / Survey / Report (Accueil / Cours / Vidéos / Questionnaire / Rapport), icon and word on one row, counts (5, 10, 10) right-aligned, current item tinted; at the bottom a small line-art card with "Everything is open. Sign in only to send."; below 860 px it becomes a 5-item bottom tab bar, icon over word                                   | todo  |
| W2  | Header     | One row: a breadcrumb of where you are ("Learn › Lesson 1 of 5"), then the date, FR \| EN, the theme icon and, when signed in, the account avatar menu (UI_RULES §11). No tagline strip, no mono labels, no middle-dot strings                                                                                                                                                                                            | todo  |
| W3  | Main card  | Left, one content card per menu item: Home (title, one-line subtitle, three tiles Understand / Adapt / Evolve), Learn (one lesson per page: read time, title, one-line lede, three icon tiles of title plus one line, the video slot, Previous as a text button and Next lesson as an outlined button), Videos, Survey, Report (Sample, Demo Client). The ‹ 01–05 › bar, the notched stage and the right tabs are removed | todo  |
| W4  | Try it     | Right column, first card: the current survey question with its options as large radio buttons (52 px, teal edge and check when picked), a 10-segment progress line, "1 of 10", one primary "Next question" that is disabled with the reason under it until an answer is picked, and the privacy line. It shares its answers with the Survey view (one store, kept in the browser)                                         | todo  |
| W5  | Your path  | Right column, second card: the seven steps as a checklist, each with a status as icon plus word (Done / Now / To do, and Sign in on the last one), "N / 7" and a thin bar. It replaces the bottom steps strip. Signed in, it fills from the server progress as round 1 goal 4 does                                                                                                                                        | todo  |
| W6  | Words fit  | Every menu, tab and step label is a short word that shows in full in FR and EN at 390 and 1280 px; no ellipsis, no clipping, no horizontal scroll                                                                                                                                                                                                                                                                         | todo  |
| W7  | Checks     | `front-page.spec.ts` updated: every menu item, Try it to Next question, the path checklist, survey to the send sheet, FR/EN, light/dark at 390×844 and 1280×800; a new assertion that no nav or step label has `scrollWidth > clientWidth` and the page has no horizontal scroll; axe clean; `pnpm style-guard` passes                                                                                                    | todo  |
| W8  | Token cost | Sonnet codes it in one worktree from the committed mockup; no new dependency; the round-1 CSS that is no longer used is deleted                                                                                                                                                                                                                                                                                           | todo  |

Carried over from round 1 and still open: goal 3 (the send step creates no account yet, ADR 0053) and
the Lighthouse mobile ≥ 90 measure of goal 7.

## Not in scope

Per-team progress, badges, points, 3D, a mascot. The referent space `/client` (TASK-AF) and the
mobile polish of `/learn` and `/client` (TASK-AG, now only for those two areas) are separate.
Mockups A ("Trail") and B ("Studio") in `docs/mockups/` were not picked; do not mix their parts in.

## Ground rules

Worktree `~/evolai-taskah`, a new branch `feat/front-page-workbench` off `main`; `git merge main`
often, TASK-AF lands on `/client`, `/s` and the mission tabs at the same time and must not be touched
here. `docs/UI_RULES.md`, brand tokens of ADR 0048, MUI only, FR and EN for every string, "Demo Client"
and "Sales team" only. Gates as in TASK-AE, merge to main, Vercel deploy, verify on www.evolai.io
at phone and desktop width, update the State column, `STATUS: done — <sha>, live at …`.

## Round 1: "Stage + tabs" (shipped 2026-10-27)

| #   | Goal                         | Done when                                                                                                                                                                                                                                                                                                                                                                                     | State                                                                         |
| --- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | Skeleton                     | `/` renders the cockpit: thin header (logo, tagline strip Understand · Adapt · Evolve in three colours, date), left rail Home / Journey / Learn / Questions / Survey / Materials / Language, centre bordered stage with the ‹ 01–05 › control bar, right panel tabs Overview / Questions / Report / Materials, bottom steps strip with check circles; below `sm` the rail is a bottom tab bar | done (2026-10-27), replaced by W1–W5                                          |
| 2   | Stage views                  | The five stage views of the mockup work: journey map, lessons (the five `/learn` pages' text), survey (the ten questions of `pilot-v1.json`, answers kept in the browser), sample report (labelled Sample, Demo Client), materials (ten video slots, "Coming" until `videos.json` has ids)                                                                                                    | done (2026-10-27)                                                             |
| 3   | Sign-in last                 | Finishing the survey shows "Send and start your audit" → a one-field email sheet → a real account/invite is created and the answers attached (reuse `authTokens` + TASK-AF's one-address-per-team); nothing else on `/` asks to sign in; "Auditor sign-in" is a footer link to `/login`                                                                                                       | partial: the send step emails the owner, no account is created yet (ADR 0053) |
| 4   | Progress only when signed in | Anonymous: the rail shows "Sign in to keep your progress"; signed-in referent: the header shows the greeting and "N of 7 steps" and the bottom strip fills; staff: same header, link to Missions                                                                                                                                                                                              | done (2026-10-27)                                                             |
| 5   | Splash and motion            | 0.8 s splash once per load (logo, tagline, bar), skipped under `prefers-reduced-motion`; stage change = 150 ms fade; nothing moves on its own                                                                                                                                                                                                                                                 | done (2026-10-27)                                                             |
| 6   | Old routes                   | `/learn/*` keep working and link back to the cockpit ("Back to the cockpit"); `/about` and `/welcome` redirect to `/`; the old front-page components are deleted                                                                                                                                                                                                                              | done (2026-10-27)                                                             |
| 7   | Checks                       | Playwright `front-page.spec.ts` at 390×844 and 1280×800: splash once, every rail item, survey to the send sheet, FR/EN, light/dark; axe clean; Lighthouse mobile ≥ 90; no real client or person name                                                                                                                                                                                          | partial: gates green on CI; Lighthouse mobile not measured                    |
| 8   | Token cost                   | Sonnet codes it in one worktree from the committed mockup; no new dependency                                                                                                                                                                                                                                                                                                                  | done (2026-10-27)                                                             |
