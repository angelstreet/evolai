# ADR 0059: Task inventory, visit notes, referent review, ask-on-site prompts and day-90 measures

Date: 2026-10-28. Status: accepted. Builds on ADR 0058 (findings from the answers) and the gap review
`docs/FABLE_REVIEW_2026-10-28.md` (TASK-AJ A5 to A9). No model is used anywhere in this ADR.

## Context

After ADR 0058 the audit had one evidence source: the survey. The review named four gaps between that and an
audit a client can act on: the survey does not say which task, how often, how long, with which tool and data
(A5); the visit, which the PRD treats as the heart of the audit, leaves no trace and no finding can cite it
(A6); the auditor has no list of what to ask on site (A7); the client never checks the findings before they
are published (A8); and an action has no baseline, so nobody can say at day 90 whether it helped (A9).

## Decision

- **Questionnaire v2 (A5).** `pilot-v2.json` is v1 plus four single-choice screens right after "which repeated
  task took the most time": how often (daily to less often), how long each time (four bands), which tool
  (spreadsheet, email, business application, paper or PDF, AI assistant, other) and which data (none, internal,
  personal, confidential client data). Weight 0: they describe work, they do not score maturity. v1 codes and
  wording are unchanged, so answers given on v1 keep their meaning; the survey shows v2 from this deploy on
  (estimated 8 minutes). The brief shows the new bars per team without new code. `proposeFindings` gets four
  choice rules (daily; over an hour; spreadsheet, email or paper; personal or client data) and a combined
  "heavy task" rule (daily or weekly and over an hour), whose evidence is both answers of each person.
- **Visit notes (A6).** A Visit tab on the mission: dated notes of kind interview, observation or workshop, for
  one team or the whole mission, anonymised on save with the survey's rules (names to hide, emails, numbers);
  the typed original is not kept. Staff only, never in a snapshot, erased with the mission (cascade). The
  auditor ticks notes and writes a finding from them (`finding_notes`). A finding that cites a note is
  **reportable whatever its people count**: the auditor saw it on site. The report then never shows a count
  under 5; it says "seen on the visit" instead. The method note counts interviews, observations and workshops.
- **Ask on site (A7).** The Overview adds one printable card: one question per open finding (most people
  first), from a template per evidence pattern or else per axis, with the count behind it, and the standard
  question of the axis with the least evidence. Rule-based (`sitePrompts`). It is per mission, not per team,
  because findings are per mission.
- **Referent review (A8).** While the working report is in review, the referent's Report tab lists the
  approved, reportable findings with labels and counts only (never a statement, an answer or a note), each with
  Confirm or Dispute and one line (needed to dispute). A view-as session is read only. An unanswered dispute
  **blocks publishing** (`disputed`); the auditor marks it corrected or keeps it. A kept dispute shows as
  "disputed by the client, kept" in the report and the method note counts disputes and corrections.
- **Measures (A9).** An accepted action gets a baseline value, unit and source, a follow-up date and the day-90
  status (validated, mixed, no benefit, not implemented), PRD §30.1 minimum. Shown in the editor, the client
  view and the PDF; a new report version can update the status. Unit and source go through the publish leak
  checks like every other text.
- One migration, `0030_visit_review_measure.sql`: `visit_notes`, `finding_notes`, `finding_reviews` (row-level
  security like `findings`), the measure columns on `report_steps`, new audit verbs. The app checks with
  `to_regclass` and `information_schema` whether 0029 and 0030 are applied and works before and after each.

## Alternatives

- A per-mission choice between v1 and v2: rejected for now. The survey pages read one definition; adding four
  screens after v1 keeps v1 answers valid, and a mission whose survey is open only gets more evidence.
- The referent fills the task inventory before the visit (review option b): kept as a later option; the
  survey gives one inventory per person and counts per team.
- Count a note as "people": rejected, a note is the auditor's observation, not a person's answer; mixing them
  would make the minimum group meaningless.
- Let a dispute withdraw the finding: rejected, the auditor decides; the dispute is recorded and shown.

## Consequences

- New audit verbs `finding.confirm`, `finding.dispute`, `finding.resolve`, `report_step.measure`,
  `visit_note.create`, `visit_note.delete`; new target `visit_note`.
- `reportFindingSchema.people` may be 0 (visit only) and gains optional `visit` and `disputed`; steps gain an
  optional `measure`. Snapshots published before keep validating.
- The Visit tab sits between Answers and Report. Before 0030 is applied it says notes are not available.
