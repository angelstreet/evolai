# TASK-AE — Learn the audit: five client pages, the ten questions, ten video slots (model: sonnet)

Owner decision 2026-10-26, after the second Fable review: the MVP is a simple staff view and a simple client view,
and the client must be able to **learn what the audit is in four or five pages of clicking**: the questions we ask,
the must-know facts, and at most ten short videos. Nothing else is built before this. Data features are frozen
(ADR 0049): no analysis pipeline, no new tabs on the staff side.

## Goal

| #   | Goal                                                       | Done when                                                                                            | State |
| --- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----- |
| 1   | A client learns the audit in five pages                    | `/learn` opens from the referent home and the front page; five pages, Next/Back, FR and EN           | to do |
| 2   | The ten questions are visible before the survey            | Page 3 lists the live questionnaire from `pilot-v1.json`, same words as the survey, read only        | to do |
| 3   | Ten video slots, filled by the owner, never fewer than one | A list of up to 10 videos; each is title, length, YouTube id; the list comes from one JSON file      | to do |
| 4   | Nothing new to maintain                                    | No database change, no new i18n namespace beyond `learn.*`, MUI components only, `style-guard` green | to do |
| 5   | Token cost                                                 | Sonnet builds; Haiku fills the FR/EN strings and the video JSON; one review pass                     | to do |

## Ground rules

- Public repo: no secrets, no real client or person names ("Demo Client" only; the leak scan fails on BANNED_TERMS).
- Own worktree off `origin/main`: `git -C ~/evolai worktree add -b feat/learn-the-audit ~/evolai-taskae origin/main`.
  Never edit `~/evolai` itself.
- Gates before merging: `format:check`, `lint`, `typecheck`, `test`, `leak-scan`, `style-guard`, Playwright
  `--workers=1` for the new spec. Merge to main yourself when green; Vercel deploys main.
- Read `docs/UI_RULES.md` first. Standard MUI only: Stepper or Tabs for the five pages, Card, List, Button. No custom
  widget, no hex, no emoji, no mascot.
- Words: Mission (staff), Survey (employees and referent), Report. Never "auditor", "engagement", "tenant" on a
  client screen (`docs/glossary-fr-en.md`).

## The five pages (`/learn`, public, no account)

Each page: a title (one line), at most 150 words of body, one video card when a slot is filled, Back and Next
buttons, a progress line "Page 2 of 5". On a phone the page is one column; on desktop the video sits beside the text.

1. **Why an AI audit** (`/learn`). What companies get wrong about AI (tools bought, nobody uses them; risky use of
   client data; time lost on repetitive work nobody measured). One sentence on what EvolAI does instead: ask the
   people who do the work, then come on site with the picture already clear. Video slot 1.
2. **How it runs** (`/learn/how`). The three steps as on the front page, with the facts a referent must know:
   - the survey takes about 7 minutes on a phone, ten questions, every one can be skipped;
   - answers are anonymous: no name, no email; names typed in free text are masked before saving;
   - the referent sees counts only, never who answered; groups under 5 people are never shown;
   - the visit comes after the survey closes; the report follows the visit.
     Video slot 2.
3. **The ten questions** (`/learn/questions`). The live questionnaire, read only, rendered from
   `packages/contracts/src/questionnaires/pilot-v1.json` (same source as the survey, so it never drifts). One card per
   question: the question text, the choices as a plain list, and one line in the client's language on what the
   question tells us (new `learn.questions.<id>.why` strings; list below). Free-text questions show "Free text, 400
   characters" instead of choices. Video slot 3.
4. **What you get** (`/learn/results`). Readiness score (what 0 to 100 means in one sentence), ranked actions, the
   30/60/90-day plan, the report PDF. One anonymised sample report page as an image from the Demo Client, or the
   existing report preview if it can render without a session. Video slots 4 and 5.
5. **Learn more** (`/learn/videos`). All filled video slots as one MUI List: title, length, "Watch" opens YouTube in
   a new tab (no embed on this page; embeds only on pages 1 to 4). A last line: "Received a survey link? Open it from
   the message you got." and the Sign in link for referents.

Entry points: a text link "Learn how the audit works" under the three steps on the front page; a card "Learn the
audit" on the referent home (`/client`), before the progress block; the survey intro page gets no link (people
there answer, they do not learn).

## The ten questions and what each tells us (page 3 copy, EN; Haiku writes FR)

| Question (pilot-v1)                                                            | What it tells us                                              |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| An AI tool gives an answer without saying where it comes from. What do you do? | Whether people check AI output before using it                |
| A document with client data and a public AI assistant. What do you do?         | How client data is handled today, and whether rules are known |
| You ask an AI tool to summarise customer feedback. How do you word it?         | How far people already know how to ask                        |
| A report is made by hand through 4 tools. Where would you start?               | Whether people map the work before automating it              |
| Someone copies the same data every day. How would you do it differently?       | Whether AI is the reflex, or a simple automation              |
| Hours per week on tasks that come back the same way                            | The size of the repetitive work, per team                     |
| Which repetitive task took you the most time last week? (free text)            | The first candidates for an improvement step                  |
| What tool or information were you missing this week? (free text)               | Friction that is not about AI at all                          |
| If an assistant could help with one thing, what would it be? (free text)       | What people would accept help with                            |
| Which area do you work in?                                                     | Results by area, only for groups of 5 or more                 |

The choices on page 3 are read from the JSON and never retyped here.

## Video slots (owner fills; empty slots are hidden, never shown as "coming soon")

File: `packages/contracts/src/learn/videos.json`, validated by a zod schema in `packages/contracts/src/learn.ts`:
`{ "id": "slot-1", "page": "why" | "how" | "questions" | "results" | "more", "youtubeId": "", "minutes": 0,
"title": { "en": "", "fr": "" } }`, at most 10 entries, `youtubeId` empty means hidden.

| Slot | Page      | Suggested subject (owner replaces with the real video)         |
| ---- | --------- | -------------------------------------------------------------- |
| 1    | why       | Why most AI roll-outs stall: tools without the work understood |
| 2    | how       | The three steps in two minutes (Understand, Adapt, Evolve)     |
| 3    | questions | How to answer the survey honestly: there is no right answer    |
| 4    | results   | Reading a readiness score                                      |
| 5    | results   | What a 30/60/90-day plan looks like                            |
| 6    | more      | Using an AI assistant without leaking client data              |
| 7    | more      | Writing a request an AI tool can act on                        |
| 8    | more      | Map the work before you automate it                            |
| 9    | more      | Simple automation versus AI: choosing the cheap one            |
| 10   | more      | After the audit: how a team keeps improving                    |

Embeds use `youtube-nocookie.com` in an MUI Card with a 16:9 box; the page passes the contrast test with the video
title as a caption, not an overlay.

## Do not

- No quiz, no badge, no mascot, no score for the reader.
- No account, no tracking of who read what.
- No new tab on the staff side; staff learn from `docs/AUDITOR_GUIDE.md` (to be rewritten to the five mission tabs
  in a separate docs commit).
- No new questionnaire; page 3 reads the existing one.

## Acceptance

- Playwright `learn.spec.ts`: five pages reachable by Next from `/learn`, Back works, page 3 shows ten question
  cards whose texts equal the survey's, hidden video slots render nothing, FR and EN, 360 and 1280 px, axe clean.
- Reviewed in light and dark with a long French string. Owner reads the five pages on a phone and says yes.

STATUS line at the end of every turn as in the other tasks.
