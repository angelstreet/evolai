# Independent review (Fable, 2026-10-28): from a survey to a real audit

Owner's question: "The content we have is very little compared to what was planned; we only have the survey, no
audit really. Review the initial goal, whatever was planned, versus our current state, the gap, and plan to reach
that goal."

Sources read: docs/PRD.md (§4, §7, §9, §10, §15, §18, §28, §29), docs/ROADMAP.md, docs/AUDIT_WORKFLOW.md,
docs/AUDITOR_GUIDE.md, docs/PILOT_RUNBOOK.md, docs/FABLE_REVIEW_2026-10-22.md, docs/HANDOVER.md, ADRs 0041 to
0057, TASK-V, TASK-AE, TASK-AH, TASK-AI, `git log --since=2026-10-14`, and the code named below. No code was
changed. Where the docs and the code disagree, the code is what is reported here.

## 1. The goal

A finished audit, per PRD §4.1, §28 and §28.1, is this. The client company holds, at the end: a report for the
sponsor with a readiness result at team level (never per person), a short list of validated findings about how
work really happens in the team (which tasks repeat, where time goes, which tools are missing, where AI use is
risky), a ranked list of opportunities with the evidence behind each one, a set of improvement steps with an
owner role, effort, impact and risk, a 30/60/90-day plan, and a measurement plan so that, at day 90, the client
can say whether a change helped. The auditor holds, before the visit, a brief that says what the team reported
and what to ask on site; during the visit, a place to write what was observed and heard; after the visit, the
means to turn survey evidence plus visit evidence into findings, each one traceable to its source, and to
publish only what a human approved. The product promise in one line (review of 2026-10-22, confirmed by the
owner): "arrive on site already knowing the team, leave the client with a plan they can act on."

## 2. Gap table

"Live" means reachable on www.evolai.io by the owner today, with no terminal.

| Part of the audit                     | Planned (PRD)                                                                                                                                                                                                                                      | Built (code exists)                                                                                                                                                                                                                                                                                                                          | Live and reachable today                                                                                                                                                                                                                                                                                                            | Gap                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Survey: questions                     | §6.1 and §7: 3 to 5 calibration questions, 6 to 10 scored scenarios, 2 to 4 context questions, plus a last-7-days workflow block (3 activities, the most painful one, how often and how long, tools, handoffs, desired outcome, data sensitivity). | `packages/contracts/src/questionnaires/pilot-v1.json`: 6 scenario choices, 3 free texts, 1 role. Branching engine not built.                                                                                                                                                                                                                 | Yes. Works end to end on a phone, FR and EN, anonymised on save (ADR 0044), one address per team (ADR 0052).                                                                                                                                                                                                                        | The workflow block of §7 is reduced to three free texts. No task inventory, no frequency or duration per task, no tools, no handoffs, no data sensitivity. No branching (FR-04).                                                                                                                                                                                                      |
| Evidence collection beyond the survey | §4.3: referent lists tools and workflows, validates the process map. §20: freeze a briefing snapshot before the visit.                                                                                                                             | Nothing.                                                                                                                                                                                                                                                                                                                                     | Nothing.                                                                                                                                                                                                                                                                                                                            | The referent space only shares links and shows counts (`apps/web/src/app/client`).                                                                                                                                                                                                                                                                                                    |
| Analysis: answers to findings         | §10 and FR-07: extract facts, cluster themes, contradictions, interview prompts, each claim cited; human review; approved output.                                                                                                                  | Per-submission rule pipeline `services/ai/src/pipeline.ts` (themes are per axis, labelled "literacy maturity" etc.); LLM path `services/ai/src/llm/*` with allowlist, redaction, citation check, mock-tested (ADR 0029); review and approve screens; `aggregateFindings` in `packages/domain/src/findings.ts` counts people per theme label. | No. ADR 0049 parked it: no button, no cron; `/admin/engagements/[id]/analyses` and `/opportunities` redirect to the Report tab. Nothing creates `analyses` rows.                                                                                                                                                                    | The report's findings come only from approved `analyses` rows (`loadFindings`, `apps/web/src/lib/reportData.ts` line 216), so the findings list is always empty. Even unparked, the per-submission pipeline would yield four labels ("literacy maturity", "practice maturity", "readiness (free text)", "opportunity (free text)") raised by everyone: true but useless as findings.  |
| Pre-visit brief                       | G3 and §20: a source-linked brief two days before the visit: themes, hypotheses, contradictions, interview prompts.                                                                                                                                | Overview tab (`apps/web/src/app/admin/engagements/[id]/page.tsx`, `briefFor` in `apps/web/src/lib/answersData.ts`): counts, one bar per choice question per team, role mix, from 5 answers; printable. Answers tab: free texts by question, CSV.                                                                                             | Yes.                                                                                                                                                                                                                                                                                                                                | Counts and raw texts, no reading of them. No interview prompts, no hypotheses, no "what to look at on site". The auditor must do all of that in their head or on paper.                                                                                                                                                                                                               |
| On-site visit support                 | FR-10 (Phase 2): process map and interview notes. §20: 75 min interviews, 90 min observation, 75 min team map. §29: process fidelity weighs 20% of audit quality.                                                                                  | Nothing. No table, no screen (checked: no `interview`, `observation` or `process_map` anywhere in `apps`, `packages` or `infra`).                                                                                                                                                                                                            | Nothing.                                                                                                                                                                                                                                                                                                                            | The visit, which the PRD treats as the heart of the audit, leaves no trace in the product. Findings cannot cite an observation record (PRD §33 "or an explicit observation record").                                                                                                                                                                                                  |
| Opportunities and improvement steps   | FR-08, §11: a register with evidence ids, volume, time per case, feasibility, impact, risk, owner, states. FR-11: compare simplify, automate, AI.                                                                                                  | `opportunities` table and states; 29-entry catalogue `packages/contracts/src/improvementCatalogue.ts`; matcher `packages/domain/src/improvementMatching.ts` (keyword tags plus axis); report steps with effort, impact, risk, owner role, horizon.                                                                                           | Partly. The only way to create an opportunity is "Write my own" in the report editor (`addStep` in `reportData.ts` line 727 inserts an approved opportunity titled like the step). The catalogue is reachable through "From the catalogue" on such a step. "Suggest" fires only for opportunities with findings, so it never fires. | No evidence link on an opportunity (what people wrote is never attached). No volume or time per case. The matcher has no text to match. The catalogue, the most reusable piece of audit knowledge built, is nearly idle.                                                                                                                                                              |
| Scoring                               | §6: three axes (literacy, practice, readiness), shown only above the group threshold, visible weighting.                                                                                                                                           | `packages/domain/src/readiness.ts`: mean per axis per team, equal weights, L0 to L5, groups under 5 hidden, complementary suppression. `scoring.ts`: option order gives the score.                                                                                                                                                           | Yes, in the report.                                                                                                                                                                                                                                                                                                                 | With v1 the "readiness" axis has no scored item (its only question is free text, weight 0), so it is dropped and the score is 4 literacy questions plus 1 practice question. That one practice question is `v1_repeat_time` with `reverse: false`, so "more than 6 hours a week on repeated tasks" scores highest. The score is thin and one of its five inputs points the wrong way. |
| Report                                | §28.1: executive brief, workflow map, friction and tool inventory, aggregate readiness, opportunity backlog with evidence, 30/60/90 roadmap, measurement plan.                                                                                     | Editor, publish gate (`apps/web/src/lib/reportModel.ts`: summary must cite findings when findings exist, no names, no six-word quote from an answer), versions, preview as client, PDF, client Report tab, rule draft of the summary, optional AI draft by worker command (ADR 0043).                                                        | Yes.                                                                                                                                                                                                                                                                                                                                | The container is good; the content is hand-typed. No workflow map, no friction or tool inventory, no evidence under any opportunity, no measurement plan fields (§30.1). The publish gate refuses any six consecutive words from an answer, so the report can never cite evidence; PRD §10 asks for citations.                                                                        |
| Follow-up                             | §28 phase 7 and §30: owners, baseline, KPI, 30/60/90 checks, day-90 status. FR-12, FR-13.                                                                                                                                                          | 30/60/90 plan lines with a checkpoint sentence per horizon.                                                                                                                                                                                                                                                                                  | Yes, as text.                                                                                                                                                                                                                                                                                                                       | No baseline, no KPI, no measurement, no day-90 state. Planned as Phase 2; fine to defer.                                                                                                                                                                                                                                                                                              |
| Privacy and AI rules                  | §15, §25.1, §10, AGENTS.md.                                                                                                                                                                                                                        | Anonymisation on save, group threshold 5 everywhere, referent never sees who answered, allowlisted routes, fail closed, human approval.                                                                                                                                                                                                      | Yes.                                                                                                                                                                                                                                                                                                                                | None. This part is done and should stay as it is.                                                                                                                                                                                                                                                                                                                                     |

## 3. Why the gap exists

Oct 15 to 20 built the whole chain on paper: pipeline, review, opportunities, catalogue, score, report, PDF. It
was tested on synthetic data only and the chain's weakest link, the per-submission rule pipeline, produced themes
nobody would put in a report. The Oct 22 review looked at the staff screens, saw a generic admin around a pipeline
that could not run, and said: cut to Missions, Answers, Report; read the sixty lines of free text by hand; revisit
analysis after three real missions. ADR 0049 did exactly that.

What was right about it: the staff side was unreadable, the kanban, synergies, intake, badges and quiz were noise,
and a consultant reading sixty lines by hand is faster than a bad theme extractor. The Overview brief and Answers
tab that came out of it are the most useful staff screens in the product. The front-page work since (TASK-AE,
AH, AI: lessons, try the survey, sample report, one shell) made the product presentable and the survey easy to
try, which matters for selling.

What it lost: the review's §4 said "park the pipeline", and the product took that as "park the analysis". They
are not the same thing. The pipeline was one implementation; the analysis step (answers become findings, findings
become opportunities, opportunities get steps and evidence) is the audit. When ADR 0049 parked the only thing that
wrote `analyses` rows, it silently emptied `loadFindings`, which emptied the catalogue matcher, which turned the
report editor into a text box with a score at the top. Nobody replaced the parked step with the manual version of
it (an auditor writing a finding and ticking the answers it rests on). TASK-AE then froze data features, and six
days and about 70 commits went into the front page and shell while the audit stayed at "survey plus hand-typed
report". The visit, which no version of the plan ever built, stayed unbuilt. The result is the owner's sentence:
"we only have the survey, no audit really."

In short: the parking was a good cut of the wrong layer. The fix is not to un-cut it but to build the thin manual
layer the review assumed the consultant would do "by hand", inside the product, with the evidence links the PRD
requires.

## 4. Is the questionnaire enough evidence for an audit?

No, and it was never meant to be. The PRD (§7, §20) counts three sources: the survey, the referent's process
facts, and the on-site day. The survey is the first and the thinnest.

What ten questions let an auditor conclude, for a team of 5 or more:

- Roughly how the team treats an AI answer with no source and client data in a public tool (two literacy
  questions): good for a "risk and habits" paragraph and one or two training steps.
- Whether people frame a request with context (one question) and whether they would map before automating (two
  questions): a weak signal on method.
- A self-reported band of hours per week on repeated tasks: a size-of-prize hint, not a measurement.
- Three free texts: which repeated task took the most time, what was missing, what an assistant could help with.
  This is the only real evidence of work. Sixty lines for a team of twenty, anonymised.
- The role mix, in seven broad buckets.

What an auditor cannot conclude: which processes exist and who owns them; how often a task happens and how long
one case takes (the §30.1 baseline); which tools and data each task touches; where the handoffs and waits are;
whether the data involved is personal, confidential or regulated; whether what people say matches what they do.
None of these can be scored from choices; most of them come from the visit.

What is missing, in order of value for a first audit:

1. A task inventory per team: for each repeated task, its name, how often, how long one case takes, which tools,
   which data sensitivity. The PRD §7 block. Can come from the survey (two or three more screens, one task
   inspected in depth) or from the referent before the visit.
2. Interview notes and observation notes from the visit, per team, attached to the mission, citable.
3. A referent-validated list of tools and workflows (PRD §4.3).
4. A validation step after the report draft: the referent confirms or disputes each finding (PRD §28 phase 5,
   §29 "stakeholder validation" 10%).

The survey wording itself is good. Two scoring fixes are needed regardless: `v1_repeat_time` must not count as a
practice score (or must be reversed), and the readiness axis must get at least one scored item or the score must
be labelled as literacy only.

## 5. Plan to reach a real first audit

Principle: the audit is a chain of evidence, and every link must be in the product, created by a human or by a
rule, and traceable. Build the manual chain first; add rules where they save the auditor time; add a model only
when a route is approved. Reuse everything that already exists on the data side: `opportunities`, `report_steps`,
the catalogue, the matcher, the score, the publish gate, the Answers tab.

**Unpark or replace?** Replace. Do not unpark the per-submission pipeline. Its themes are per axis per person
("literacy maturity"), which aggregate into labels everyone "raised"; it needs an `analyses` row per submission
with an approval click each; and it was designed for a model to fill in later. An audit finding is an
engagement-level statement ("8 of 14 people spend over 3 hours a week on repeated tasks; the task named most is
re-entering orders") that rests on a set of answers. Build findings as their own table, engagement-level, written
by the auditor or proposed by a rule, each with the answer ids it cites. Keep `services/ai/src/pipeline.ts` and
the `analyses` table for the model route later; change `loadFindings` to read the new table. Reuse from the old
pipeline: `answerPlainText`, the citation shape (`sourceKind`, `sourceId`, `quote`), `aggregateFindings` as the
group threshold rule, and the evidence tags in `improvementCatalogue.ts`.

Each step: done when, size (S under a day, M one to two days, L three to five), reuse or build.

- **A1. Findings written from answers.** A `findings` table (tenant, engagement, team or null, axis, label, one
  sentence, status draft or approved, created_by) and a `finding_evidence` table (finding, answer id). In the
  Answers tab the auditor selects free-text answers or a choice bar and presses "Make a finding": label, sentence,
  axis, the selected answers as evidence. Findings list on the Report tab with the count of people cited. Done
  when: a finding with at least 5 distinct people cited appears in the report's findings list and the summary can
  cite it; a finding under 5 people is kept but marked "not publishable" and never leaves staff pages; `loadFindings`
  reads this table; the old `analyses` path is removed from `reportData.ts` and `clientData.ts`. Size M. Build; reuse
  `aggregateFindings` threshold logic, `findingKey`, the publish gate unchanged.
- **A2. Rule proposals for findings (engagement level).** A pure function in `packages/domain` that takes the
  brief's counts and the free texts and proposes findings: for each choice question, the majority option and the
  risky option if 3 or more people chose it ("5 of 12 paste client data as is"); for the hours question, the share
  above 3 hours; for free texts, the evidence tags of `improvementCatalogue.ts` found in each text (`tagsInText`)
  grouped by tag, with the matching answers as evidence ("manual re-entry named by 6 people"). Every proposal is a
  draft finding with its evidence; the auditor approves, edits or deletes. Done when: on a seeded team of 12, the
  function proposes at least one choice finding and one tag finding, each with 5 or more cited answers, unit tested;
  "Propose findings" on the Report tab writes them as drafts. Size M. Build on `EVIDENCE_KEYWORDS`, `tagsInText`,
  `briefFor`.
- **A3. Opportunities with evidence.** An opportunity can be created from one or more approved findings (title,
  problem statement, desired outcome, category simplify, automate or AI, self-reported volume and time per case as
  free fields marked "self-reported", linked finding ids). "Suggest steps" then runs `matchImprovements` on the
  opportunity text plus the finding labels, as designed. Done when: an opportunity created from a tag finding gets
  up to three catalogue proposals with a "why" line; the report ranks it; the published snapshot shows the
  opportunity with the number of people behind it, never a quote. Size M. Reuse `opportunityData.ts`,
  `improvementMatching.ts`, `report_steps`, the ranking. Drop the `/opportunities/new` redirect.
- **A4. Fix the score.** `v1_repeat_time` leaves the scored set (weight 0) or is reversed; decide which readiness
  input exists (none in v1, so the report says "literacy and practice only" until A5 adds one). Done when: unit tests
  on `readiness.ts` and the questionnaire apply script cover it; the report's weighting sentence matches. Size S.
- **A5. Task inventory in the survey (questionnaire v2).** Two or three screens after the free texts, PRD §7:
  the one repeated task named, how often (daily, weekly, monthly), how long one case takes (bands), which kind of
  tool (list), which kind of data (none, internal, personal, client-confidential). Stored as choices, so they count
  in the brief and feed A2 ("6 people run a daily task over 30 minutes on personal data"). New codes, version 2,
  `questionnaire:apply` refuses an engagement with answers (already true). Done when: the brief shows the new bars
  per team, the proposal rule uses them, Playwright at 360 px passes, FR read once by a native speaker. Size M.
  Build on `pilot-v1.json` and `questionnaire-lib.mjs`. Keep the survey under 10 minutes.
- **A6. Visit notes.** A "Visit" tab on the mission: dated notes of kind interview, observation or workshop, per
  team, free text, written by staff only, anonymised with the same `answerAnonymiser.ts` on save, never shown to the
  client. A note can be cited as evidence on a finding (A1's evidence table gets a kind: answer or note). Done when:
  a finding can rest on a note alone; the method note in the report counts "N interviews, M observations"; notes are
  exported with the mission and erased with it. Size M. Build; reuse the anonymiser, the audit log, the CSV route
  pattern.
- **A7. Interview prompts in the brief.** From approved or proposed findings, the Overview adds a printable
  "Ask on site" list: one question per finding ("Who re-enters orders, from what, into what, how long per order?")
  with the count behind it, plus the standard prompts for the lowest-evidence axis. Rule-based text from a small
  template table per tag and per question. Done when: the printed brief has counts, bars, free texts and the prompt
  list on one page per team. Size S. Build; replace `buildInterviewPrompts` in `pipeline.ts`.
- **A8. Referent validation.** After "Mark ready for review", the referent sees the findings and opportunities
  (labels and counts only) in their space with Confirm or Dispute and one line; disputes show in the editor and in
  the method note ("2 findings disputed, 1 corrected"). PRD §28 phase 5. Done when: a disputed finding cannot be
  published without the auditor marking it corrected or keeping it with the dispute noted. Size M. Reuse the client
  Report tab and the audit log.
- **A9. Measurement fields on accepted steps.** Baseline value, unit, source, follow-up date, day-90 status
  (validated, mixed, no benefit, not implemented). Shown in the plan and the PDF. PRD §30.1 minimum. Done when: a
  published report lists each accepted step with its baseline and date; a new version can update the status. Size S.
- **A10. Model draft of findings, only behind an approved route.** When the owner has a contract-approved EU
  route, the existing LLM path drafts findings (not themes) from the brief and the free texts with the same checks
  (allowlist, redaction, citation per sentence, fail closed), writes them as draft findings with evidence, labelled
  "AI draft, not reviewed". Done when: `pnpm ai:eval` covers the finding schema; a run on the mock writes drafts
  that A1 shows; nothing runs without a route in the allowlist. Size M. Reuse `services/ai/src/llm/*`, ADR 0043's
  pattern. Not before A1 to A3, and not before a route is approved.

Order: A1, A2, A4 (one week) make the report honest with what exists today. A3 and A7 (one week) give the
auditor the catalogue and the brief they were promised. A5 and A6 (one to two weeks) add the two missing evidence
sources. A8 and A9 close the loop. A10 waits on the route. After A1 to A7, run the first real mission on the
sandbox with the owner as auditor and a seeded team of 12, then on the pilot client.

Rules that hold at every step: nothing per person leaves staff pages; a finding, opportunity or score reaches the
client only from 5 people; names and six-word quotes stay refused in the report; every published claim has a
finding behind it and every finding has answer or note ids behind it; AI only drafts, behind the allowlist, and a
human approves.

## 6. Owner decisions needed

1. **Where the task inventory comes from (A5).** Option a: three more survey screens (10 minutes, more answers to
   read, better evidence per person). Option b: the referent fills a short task list per team before the visit
   (cheaper for employees, manager's view not the worker's). Recommendation: a, because PRD §29 weighs process
   fidelity on "actual work, not manager descriptions", and the survey is already anonymous and in place.
2. **Visit notes in the product or on paper (A6).** The PRD puts FR-10 in Phase 2. Recommendation: build the
   minimal notes tab now, because without it findings from the visit have no citable source and the report's
   method note cannot say what was observed. Paper notes cannot be erased with the mission or cited.
3. **Quotes in the report.** Today any six consecutive words from an answer are refused (ADR 0041), so the report
   cannot cite evidence as the PRD §10 asks. Recommendation: keep the rule for the client report (an anonymised
   quote in a team of 12 can still identify someone) and show counts only; allow quotes in the staff brief, which
   already shows the texts. No change needed; decide once so the question stops coming back.
4. **AI route.** A10 cannot start without a contract-approved EU-hosted or self-hosted route. Recommendation:
   do not wait for it; A1 to A9 need no model. Approve the route when the first client signs the DPA.
5. **Survey version for the pilot client.** v1 is attached and the apply script refuses changes once answers exist.
   Recommendation: finish A4 and A5 before the pilot client's survey opens; if it has already opened, keep v1 for
   that mission and use v2 for the next.
