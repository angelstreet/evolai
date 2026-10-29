# ADR 0060: Time on repeated tasks, editing findings, and fixes from the first dry run

Date: 2026-10-29. Status: accepted. Builds on ADR 0058 and 0059. Owner request after the gap check: "do we
answer the goal to audit a company?".

## Context

A full dry run of one audit (8 synthetic people, findings, a visit, a report, the referent's review,
publishing, the client's page and PDF: `apps/web/e2e/dry-run.spec.ts`) showed what a client would read. The
report had no figure for where the time goes, though questionnaire v2 asks how often and how long. A dispute
could only be answered by keeping the finding, because a finding could not be reworded. And the client
report had defects no unit test sees: the same catalogue action under two findings (so twice in the plan),
"Owner: —" on every action, the method note counting findings as "approved actions", "No answer · No answer",
the same on-site question printed several times, "8 of 0 answered", and rule titles such as "Cité dans les
textes libres : rédaction".

## Decision

- **Time on repeated tasks.** `estimateRepeatedTime` (`packages/domain`) turns each person's answers into
  hours a week (times a week per frequency band: daily 5, weekly 1, monthly 0.25, less often 0.05; hours each
  time at the middle of the duration band: 7.5 min, 37.5 min, 2 h, 4 h for "over 3 hours"), summed per team
  and rounded to the hour, with the tool most named. Teams under 5 people who gave both answers are counted
  only. The report gets a section "Time on repeated tasks", stated as self-reported and an order of
  magnitude, in the client view and the PDF; snapshots carry it as optional `repeatedTime`.
- **Editing a finding.** Title, sentence and axis can be changed; the evidence cannot. The opportunity made
  from it follows, so the action list says the same. Editing a disputed finding answers the dispute as
  "corrected". New audit verb `finding.update` (migration `0031_finding_update.sql`); the edit button shows
  only once 0031 is applied.
- **Dry-run fixes.** A catalogue action is proposed once per report. Proposed actions get the catalogue's
  owner role as their owner ("Process owner"), which the auditor can change. The method note counts accepted
  actions. One "No answer" per axis. "Ask on site" prints each question once, with every finding it follows
  up. When the entered team size is below the answers, the brief shows the answers only. Free-text rule
  findings are titled "“{pattern}” comes up in the free texts".
- The dry run stays in the repository, off by default (`DRY_RUN_OUT=<dir>`), to be run before a pilot and
  after large changes; it writes screenshots, the report text and the PDF for a human read.

## Alternatives

- Ask for exact minutes and counts: rejected, people do not know them; bands are honest and fast.
- Let a dispute edit the finding for the client: rejected, the auditor words what is published.

## Consequences

- The time figure exists only for missions answered on questionnaire v2.
- Report and client text are in the mission's language; the page frame follows the reader's language. The
  dry run showed a French report under English headings for an English-speaking reader; left as is.
