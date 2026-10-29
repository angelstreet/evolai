# ADR 0061: Use and Conditions scored, audit-quality score, day-90 follow-up

Date: 2026-10-29. Status: accepted. Builds on ADR 0041, 0058, 0059 and 0060. Owner choice after the gap
check: "Weight existing questions".

## Context

Questionnaire v2 scored Knowledge only, so every report showed "No answer" for Use and Conditions and said the
overall score rests on Knowledge alone. PRD §29 asks for an audit-quality rubric before the client reads the
report; nothing computed it. PRD §30 and goal G4 ask to track actions to a measured outcome; actions had a
baseline and a follow-up date, but nothing recorded the value measured on that date or said a follow-up was due.

## Decision

- **Readiness rubric by question code** (`packages/domain/src/readinessRubric.ts`). Scores come from questions
  already asked, so the survey stays at 14 questions and 8 minutes:
  - Knowledge: `v1_source_check`, `v1_data_sharing`, `v1_repeat_data` (as before).
  - Use: `v1_request_style` (one line 0, some context 0.5, a full brief 1; it moves from Knowledge, because it
    asks what the person usually does) and `v2_task_tool` (an AI assistant 1, any other named tool 0).
  - Conditions: `v2_task_tool` (paper 0, email 0.25, spreadsheet 0.5, a business application or an AI assistant 1)
    and `v1_repeat_time` (over 6 hours 0, 3 to 6 hours 1/3, 1 to 3 hours 2/3, under 1 hour 1).
  - "I don't know" and "Something else" are not scored. Codes outside the rubric keep their item's own scoring.
    The rubric lives in code and is keyed by code (codes are never reused), so it applies to answers already given
    and to every client without a migration or a v3 survey. Published reports are snapshots and do not change.
- **Audit-quality score** (`packages/domain/src/auditQuality.ts`), PRD §29 weights, each dimension 0 to 5 from
  what the app records: who answered (against the 70% target of G1, minus one point when a team is hidden),
  work seen on site (one point per interview, two per observation or workshop), evidence (the time figure, and
  the share of approved findings with 5 people or a visit note), actions ready to start (owner and what is
  needed first), risks and rules (a risks note, prerequisites on risky actions, a Conditions score), checked by
  the client (findings confirmed, or disputed and answered), ready to measure (baseline and follow-up date).
  80 and above: ready; 60 to 79: fill the gaps; under 60: more discovery; unscored under 5 answers. No-go:
  a high-impact automation without an owner, or an unanswered dispute. Staff only: a card on the report screen,
  never in the snapshot or the PDF.
- **Day-90 follow-up.** `report_steps.follow_up_value` (migration `0032_follow_up_value.sql`) holds the value
  measured on the follow-up date, in the baseline's unit. The measure line says "At follow-up: 16 minutes per
  order (−60%)". The measure can be recorded on a published report: the published version does not change until
  a new version is published. The report screen lists the follow-ups that are due (date passed, no day-90
  result) and marks each such action "Follow-up due". The field shows only once 0032 is applied.

## Alternatives

- Add scored questions for Use and Conditions (a v3 survey): stronger, but longer than the 8-minute goal; left for
  after the pilot shows which answers discriminate.
- Store the rubric in `question_items.scoring_json`: existing rows are never updated by the apply script, so
  current clients would keep the old scores.
- Email reminders for due follow-ups: the email provider is optional and off by default; the screen list works
  without it.

## Consequences

- Use rests on two answers and Conditions on two; the levels stay descriptive (PRD §34.5), not validated.
- Readiness of an engagement already reported changes on its next version, not on the published one.
- The audit-quality score is a checklist with numbers, not a certification; its thresholds are the PRD's.
- 0032 needs owner approval on production; until then the follow-up value field is hidden.
