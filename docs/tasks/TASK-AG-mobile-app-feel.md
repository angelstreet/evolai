# TASK-AG — Mobile app feel: learn and referent pages like a phone app

## Goal

On a phone, EvolAI's `/learn` pages and the referent space should feel like a small app, not a
website: a loading splash with the brand, one sticky header with a progress line, one big visual per
page, a card list you tap, a bottom tab bar, and small page transitions. The reference the owner
named (2026-10-27) is https://learn-esp32.vercel.app: cream paper background, rounded bordered cards,
one accent colour, monospace small labels, progress "0/20" always visible, lessons as a horizontal
card strip with a checkmark circle, bottom tabs Home / Lessons / Reference / Settings / Language.
EvolAI keeps its own brand kit (ADR 0048) and MUI; this task copies the **structure and motion**,
not the colours.

Runs after TASK-AF (same files). Sonnet codes it; one worktree; no new library beyond what the
repo already has (MUI, no three.js, no animation library — CSS transitions and MUI `Fade`/`Slide`).

| # | Goal | Done when | State |
|---|------|-----------|-------|
| 1 | Splash | First paint of `/learn` and `/client` on a cold load shows the logo, the tagline and a thin progress bar for at most 1.2 s, then the page fades in; no splash on later navigations | todo |
| 2 | Sticky header with progress | On every `/learn/*` page the header holds the logo, the step "2 / 5" and a progress bar; it stays while scrolling; the current header (FR/EN, theme, sign-in) folds into the Settings tab below `sm` | todo |
| 3 | One visual per learn page | Each of the five pages opens with one illustration (SVG, brand colours: the three-step symbol, the phone with the survey, the report with the score, …) above the text; text width stays 65 ch | todo |
| 4 | Bottom tab bar on phones | Below `sm`: a fixed bottom bar with Home / Learn / Questions / Report / Language for `/learn/*`, and Home / Results / Report / Learn for `/client/*`; `ClientTabs` and the learn pager become that bar; content gets bottom padding so nothing hides | todo |
| 5 | Cards you tap | `/learn/questions` and `/learn/videos` show cards with a number tile, title, one-line subtitle and a check circle; tapping a card opens it in place (`Collapse`); no table on a phone | todo |
| 6 | Motion | Page change = fade 150 ms; card open = collapse 200 ms; progress bar animates; `prefers-reduced-motion` turns all of it off; nothing moves on its own (owner: no idle motion) | todo |
| 7 | Checks | Lighthouse mobile performance ≥ 90 on `/learn`; axe clean; FR/EN; 360/390/1280; dark and light; Playwright `mobile-feel.spec.ts` at 390×844 asserts the bottom bar, the sticky progress and the splash once | todo |

## Not in scope
- No 3D, no canvas, no gamification (badges, streaks), no sounds.
- No change to the survey pages `/s/*` (respondents already get a one-column phone flow).
- No new colours: cream paper is the reference's choice, EvolAI stays on Off White #F7FAFC / Deep Navy.

## Ground rules
Worktree `~/evolai-taskag`, branch `feat/mobile-app-feel` off `main` **after TASK-AF is merged**
(it rewrites `/client` and `ClientTabs`). `docs/UI_RULES.md`, MUI only, no real names. Gates as in
TASK-AE, merge, Vercel deploy, verify on a phone-width browser, `STATUS: done — <sha>, live at …`.
