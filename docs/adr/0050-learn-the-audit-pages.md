# 0050 — Public "learn the audit" pages

Status: accepted

## Context

The MVP is a simple staff view and a simple client view (ADR 0049). A client should be able to learn what the
audit is, which questions are asked and what they receive, in a few clicks and before any survey link is opened
(`docs/tasks/TASK-AE-learn-the-audit.md`).

## Decision

- Five public pages under `/learn` (`/learn`, `/how`, `/questions`, `/results`, `/videos`), read in order with Back
  and Next and a "Page n of 5" line. They need no account and read nothing from the database; each is listed in
  `routeAccess.json`.
- Page 3 renders `packages/contracts/src/questionnaires/pilot-v1.json` (the survey's own source), read only, with
  one "what it tells us" line per question code in the `learn.*` strings. A new question without a line fails
  typecheck on the key, not silently.
- Ten video slots live in `packages/contracts/src/learn/videos.json`, validated by a zod schema (`learn.ts`). The
  owner fills the YouTube id, length and titles. A slot with an empty id renders nothing. Pages 1 to 4 embed with
  `youtube-nocookie.com`; page 5 lists every filled video and opens YouTube in a new tab.
- Entry points: a text button under the three steps on the front page, and a card on the referent home before the
  progress block. The survey intro has none.
- Standard MUI only, no tracking, no quiz, no database change; copy only in the new `learn.*` namespace.

## Alternatives

- Embedding all videos on one page: rejected, slow on a phone and one request per player.
- A sample report image on page 4: deferred; no anonymised sample is committed yet, and the page works as text.
- Storing videos in the database with an admin screen: rejected for the MVP, one JSON file the owner edits is enough.

## Consequences

- Editing the questionnaire updates page 3 on the next deploy. Video titles are in both languages or the slot is
  rejected at import time.
- Watching a video on pages 1 to 4 sends a request to YouTube (nocookie domain); page 5 sends none until clicked.
