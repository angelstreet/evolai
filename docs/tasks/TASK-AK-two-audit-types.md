# TASK-AK — Two audit types: team audit and AI governance audit

Owner input 2026-11-08, after running the first pilot audit by hand: the pilot was a **team (job) audit**, not a
company and governance audit. A client needs one or both, and the tool must tell them apart. What is built today
(TASK-V, TASK-AJ, ADRs 0041-0064) is mostly a team audit, but it carries AI-maturity scoring and extra screens
the manual audit did not use, and it captures one task per person where the auditor worked task by task.
Nothing for the governance audit exists.

## The two audits

|             | Team audit                                                                                | AI governance audit                                                             |
| ----------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Question    | Which tasks hurt, repeat or waste time, and what fixes them?                              | How does the company run AI: who decides, which tools, which data, which rules? |
| Who answers | Each team member (short survey), then the auditor with them on site                       | The IT lead or the person in charge of AI, in an interview                      |
| Unit        | One task                                                                                  | One governance area                                                             |
| Output      | Task list, fix per task (process, plain automation, AI), cost, time saved, comfort gained | Operating model, gaps per area, recommendations                                 |
| Size        | Small company, one team, days                                                             | Larger company, weeks                                                           |

**Operating model.** Some companies are too small to centralise and let each team choose its AI; others
centralise AI in IT and teams use what IT provides. The governance audit records which one applies (centralised,
per team, mixed). A team audit then reads it: with a centralised model its fixes use the approved tools first;
with a per-team model it adds the guardrails the team must follow (the client-data rule, ADR 0064).

## Decisions taken (owner can overrule)

1. **One mission, one kind.** A mission is `team` or `governance`. A company can have one governance mission
   and any number of team missions. Existing missions become `team`.
2. **Hide, do not delete.** The parts the team audit does not need stay in the code, off by default, per
   mission: the literacy scenarios and the three-axis readiness score, the quiz, badges and mascots, synergies,
   the referent dispute gate. They can be switched back on. Deleting them is a later decision.
3. **Euros only from the auditor.** Time is computed from answers; a euro figure appears only when the auditor
   enters an hourly cost for the team, and it is labelled an estimate (PRD §10: no automatic ROI claim). Tool
   and build costs come from dated, configurable rates (PRD §26.2), never hardcoded.
4. **Comfort counts as much as time.** Each task gets a pain level; the report ranks by time saved and by pain
   removed, not by time alone.

## Steps

Team audit first (K1 to K6), it is what clients buy now. Governance second (K7 to K9).

| #   | Step                       | Done when                                                                                                                                                                                                                                                                                                                                                                   | State |
| --- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| K1  | Mission kind               | ADR 0065; `engagements.kind` (`team`, `governance`), default `team` (migration, production needs owner approval); the new-mission form asks the kind first; each kind shows only its own tabs                                                                                                                                                                               | todo  |
| K2  | Task inventory survey (v4) | Each person lists up to 5 tasks; for each: what it is, how often, how long, how it feels (fine, boring, painful, blocks me), tool, data. The literacy scenarios are an optional module, off by default. About 8 minutes. v1-v3 answers keep their meaning                                                                                                                   | todo  |
| K3  | Task board                 | Auditor screen: every task of a team in one list, duplicates merged, each task tagged: fix the process, plain automation, AI, or leave it; notes from the visit attached to the task. Replaces "findings" as the main working object for a team mission                                                                                                                     | todo  |
| K4  | Gain and cost per task     | Per task: hours a week today, hours saved (range), pain removed, effort to build (days band) and tool cost a month from dated rates, payback when an hourly cost is entered. Unit tests on the formulas                                                                                                                                                                     | todo  |
| K5  | Team report v2             | Summary, task table ranked by gain and pain, the suggested fix per task (process, tools, AI), quick wins first, risks (data), 30/60/90 days. Client view and PDF. The use-case playbook (ADR 0064) feeds the suggested fixes instead of being the report's spine                                                                                                            | todo  |
| K6  | Hide the extras            | Per-mission switches for the parts in decision 2, off for new team missions; existing missions keep what they have; the dry run (`apps/web/e2e/dry-run.spec.ts`) passes with them off                                                                                                                                                                                       | todo  |
| K7  | Governance checklist       | Governance mission: an interview guide filled by the auditor (no employee survey). Areas: operating model, owner of AI, approved tools and shadow use, data allowed per tool, vendor contracts and hosting, security and access, policy and training, use inventory and risk level (EU AI Act), licence costs. Each item: in place, partial, missing, with an evidence note | todo  |
| K8  | Governance report          | Operating model stated first; per area: status, gap, recommendation, owner; 30/60/90 days. Client view and PDF                                                                                                                                                                                                                                                              | todo  |
| K9  | Link the two               | A team mission of the same company shows the operating model and the approved tools from its governance mission, and its suggested fixes follow them. Without a governance mission, the team report keeps the client-data rule as its first step                                                                                                                            | todo  |
| K10 | Dry run on the pilot shape | A synthetic company shaped like the first pilot (no real names, public repo), both kinds run end to end, report text and PDF read by a human                                                                                                                                                                                                                                | todo  |

## Not in scope

- Model-drafted findings or task tagging: still behind a contract-approved route (TASK-AJ A10).
- A sponsor login, slide export, cross-company benchmarks.

## Open for the owner

- Applying the K1 migration on production (as for 0029-0034).
- Whether the hourly cost is entered per team or once per company (default: per team).
- The governance checklist wording: a first draft comes with K7 for the owner to read.
