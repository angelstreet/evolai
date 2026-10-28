# ADR 0058: Findings from the answers, engagement-level, with their evidence

Date: 2026-10-28. Status: accepted. Replaces the findings part of ADR 0049 (parked pipeline); builds on
ADR 0041 (report data layer and catalogue matching) and the gap review `docs/FABLE_REVIEW_2026-10-28.md`.

## Context

Since ADR 0049 parked the per-person analysis pipeline, nothing created findings. The report's key findings
read approved `analyses` rows only, so they were always empty, the catalogue matcher never proposed an action,
and the report was a text box with a score. The old pipeline was not worth unparking: it wrote one analysis
per person with per-axis labels ("literacy maturity") that everyone "raised", and needed one approval click per
person. The readiness score also counted hours on repeated tasks as maturity (more hours scored higher) and
said it averaged three axes when v1 has a scored question on one.

## Decision

- **Findings are their own record** (`findings`, migration 0029): one statement about a mission, axis, label,
  one sentence, status draft / approved / rejected, source auditor or rule, the catalogue evidence patterns it
  shows (`tags`). **Evidence** is a set of answers (`finding_evidence`); people = distinct finished surveys of
  those answers. Erasing a person's answers removes their evidence rows (cascade).
- **Two ways in.** The auditor ticks free texts and choice options in the Answers tab and writes the finding:
  writing it is the approval. Or "Propose findings" on the Report tab runs `proposeFindings`
  (`packages/domain`), a pure rule set over the mission's answers: the weaker practice of each scored scenario
  (3 people or more), questions where 40 % or more answered "I don't know", and the catalogue's evidence
  patterns found in the free texts (`tagsInText`), grouped by pattern. Proposals are drafts, worded in the
  mission's language, saved once per rule (`rule_key`). No model is used.
- **Privacy.** Nothing is proposed or written before 5 finished surveys. A finding under 5 people stays on
  staff pages ("not publishable"); the report and the client read only approved findings of 5 people or more.
  Findings carry counts and the auditor's words, never a quote; the publish checks are unchanged.
- **Findings feed actions.** Approving a finding of 5 people or more creates its approved opportunity
  (`opportunity_findings`), and the working report proposes catalogue actions for it; the matcher takes the
  finding's tags as given evidence. Withdrawing it archives that opportunity and rejects its actions.
- **Score (A4).** Weight 0 now means "not scored" in `scoreSubmission`, as the contract already said;
  `v1_repeat_time` has weight 0 (JSON and existing question items, migration 0029). When an axis has no scored
  answer, the report says which axes the overall score rests on.
- The `analyses` table, the worker and the model route stay for later (TASK-AJ A10).

## Alternatives

- Unpark the per-person pipeline: rejected, see Context.
- Store findings in `opportunities` only: rejected, a finding (what is true) and an opportunity (what to
  change) are different, and evidence belongs to the finding.
- Let rules approve findings themselves: rejected, a person approves everything client-facing (AGENTS.md).

## Consequences

- `loadFindings` (report) and `loadPublishedResults` (client results) read `findings`; before migration 0029
  the pages show nothing new and keep working.
- New audit verbs `finding.create`, `finding.propose`, `finding.approve`, `finding.reject`, target `finding`.
- Rule words live in `report.findings.rule.*` and follow questionnaire v1 codes; questionnaire v2 (A5) adds its
  own rules.
