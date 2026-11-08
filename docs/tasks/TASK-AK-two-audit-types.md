# TASK-AK — Two audit types: team audit and AI governance audit

Owner input 2026-11-08, after running the first pilot audit by hand: the pilot was a **team (job) audit**, not a
company and governance audit. A client needs one or both, and the tool must tell them apart. What is built today
(TASK-V, TASK-AJ, ADRs 0041-0064) is mostly a team audit, but it carries AI-maturity scoring and extra screens
the manual audit did not use, and it captures one task per person where the auditor worked task by task.
Nothing for the governance audit exists.

## The two audits

|             | Team audit                                                                             | AI governance audit                                                             |
| ----------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Question    | Which tasks hurt, repeat or waste time, and what fixes them?                           | How does the company run AI: who decides, which tools, which data, which rules? |
| Who answers | Each team member, in an interview with the auditor or alone in a survey                | The IT lead or the person in charge of AI, in an interview                      |
| Unit        | One task (a family of sub-tasks)                                                       | One governance area                                                             |
| Output      | Task list, fix per task (process, plain automation, AI), five scores, time and comfort | Operating model, gaps per area, recommendations                                 |
| Size        | Small company, one team, days                                                          | Larger company, weeks                                                           |

**Operating model.** Some companies are too small to centralise and let each team choose its AI; others
centralise AI in IT and teams use what IT provides. The governance audit records which one applies (centralised,
per team, mixed). A team audit then reads it: with a centralised model its fixes use the approved tools first;
with a per-team model it adds the guardrails the team must follow (the client-data rule, ADR 0064).

## Team audit: one questionnaire, two ways to run it

Owner decision 2026-11-08: the same questions are either asked by an auditor or answered alone.

|               | Interview                                                               | Survey                                                                              |
| ------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Who fills it  | The auditor, with the person, on a laptop or tablet                     | The person, on a phone, from a link                                                 |
| Identity      | Named on staff pages; the client report shows roles, not names          | Anonymous; groups under 5 hidden (unchanged privacy rules)                          |
| Scores        | The auditor sets the five scores live                                   | Proposed by rules from the answers and the task catalogue                           |
| Extra capture | Sub-tasks, the steps of a chain, tools in place with cost, ideas, goals | Tools in place and one idea, as choices and short text                              |
| Report        | Built from the auditor's board, reviewed, published                     | Built automatically from the answers; an auditor publishes it with one review click |

What the manual pilot captured and the plan must hold (the interview notes, made generic):

- **Five scores per task, 1 to 5:** complexity, time, cost, gain, AI risk. The auditor sets gain by judgement;
  it is not a formula of the others.
- **Cost** (owner definition 2026-11-08): what the task costs today, in time, money and effort, before any
  fix. A task can cost a lot and still have a low gain when it is hard to change (a report bound to a macro).
- **AI risk** (owner definition 2026-11-08): how dangerous it would be to let AI do the task unattended. A task
  that reaches a client, a candidate or a prospect (a message, a call, a reply, a proposal) is high risk: AI may
  prepare it, a person confirms before anything is sent. Low risk: internal work AI can run alone and a person
  checks afterwards.
- **Task families:** one line such as "executive assistance" holds its sub-tasks (fleet, quotes, expense notes,
  bookings, HR questions).
- **Volumes in the person's words:** "20 files a month, 2 h", "50 profiles a day at 3 min", "2 days a month".
- **Feeling:** fine, boring, painful, blocks me.
- **Chains of steps:** need, search, import into the business application, comment, hand-over; or site visit,
  quote, purchase order, work, invoice. Stored as ordered steps under the task.
- **Tools in place with their monthly cost**, per person or per seat, so savings net of what is already paid.
- **Ideas and goals** that are not tasks (a job-ad watch, a daily post, selling a new service).
- **The central business application** used by every team: whether it has an API is noted once per company
  and read by the governance audit.

## Decisions taken (owner can overrule)

1. **One mission, one kind.** A mission is `team` or `governance`. A company can have one governance mission
   and any number of team missions. Existing missions become `team`. A team mission is run as `interview` or
   `survey`.
2. **Hide, do not delete.** The parts the team audit does not need stay in the code, off by default, per
   mission: the literacy scenarios and the three-axis readiness score, the quiz, badges and mascots, synergies,
   the referent dispute gate. They can be switched back on. Deleting them is a later decision.
3. **Euros only from the auditor.** Time is computed from answers; a euro figure appears only when the auditor
   enters an hourly cost for the team, and it is labelled an estimate (PRD §10: no automatic ROI claim). Tool
   and build costs come from dated, configurable rates (PRD §26.2), never hardcoded.
4. **Comfort counts as much as time.** The report ranks by gain and by pain removed, not by time alone.
5. **Interview mode is not anonymous.** People are met by name, so the minimum of 5 does not apply to it; the
   client report names roles, and the person is told so at the start of the interview.
6. **A survey report needs one review click** (owner decision 2026-11-08). It is built automatically from the
   answers and the rules; nothing reaches the client until an auditor opens it and publishes it. No full audit
   is needed, and the PRD §10 human-approval rule stays as it is.
7. **AI never contacts people unattended.** Every fix for a task with AI risk 4 or 5, and every task that
   sends something to a client, candidate or prospect, is proposed as "AI drafts, a person confirms and sends".
   The report shows this as the fix's mode, next to the tools (a prospecting sequence tool included), and the
   catalogue cannot propose a fully automatic version of it.

## Steps

Team audit first (K1 to K7), it is what clients buy now. Governance second (K8 to K10).

| #   | Step                       | Done when                                                                                                                                                                                                                                                                                                                                                                     | State                       |
| --- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| K1  | Mission kind and mode      | ADR 0065; `engagements.kind` (`team`, `governance`) and `mode` (`interview`, `survey`), defaults `team` and `survey` (migration, production needs owner approval); the new-mission form asks kind and mode first; each shows only its own tabs                                                                                                                                | done (2026-11-08, ADR 0065) |
| K2  | Task catalogue per job     | Task families and sub-tasks per job family (first: IT services firm and field telecom works, synthetic wording), each with default complexity, AI risk and suggested fix; versioned like the improvement catalogue                                                                                                                                                            | todo                        |
| K3  | Questionnaire v4           | Job, areas of work, up to 5 tasks picked from the catalogue or typed, then per task: how often, how long, feeling, tools, data; tools in place with cost; one idea. The literacy scenarios are an optional module, off by default. About 8 minutes. v1-v3 answers keep their meaning                                                                                          | todo                        |
| K4  | Interview screen           | Auditor screen that walks the same questions for one named person and adds sub-tasks, chain steps, the five scores, tools with cost, ideas and goals; saves as it goes                                                                                                                                                                                                        | todo                        |
| K5  | Task board                 | Every task of a team in one list, grouped by family, duplicates merged, five scores, fix tagged (process, plain automation, AI, leave it); survey tasks show rule-proposed scores the auditor can change                                                                                                                                                                      | todo                        |
| K6  | Gain, cost and report v2   | Hours a week today, hours saved (range), pain removed, cost to build and tools net of what is paid, payback when an hourly cost is entered (unit tests). Report: summary, tasks ranked by gain and pain, fix per task, quick wins first, data risks, 30/60/90 days; client view and PDF                                                                                       | todo                        |
| K7  | Hide the extras            | Per-mission switches for the parts in decision 2, off for new team missions; existing missions keep what they have; the dry run (`apps/web/e2e/dry-run.spec.ts`) passes with them off                                                                                                                                                                                         | todo                        |
| K8  | Governance checklist       | Interview guide filled by the auditor. Areas: operating model, owner of AI, approved tools and shadow use, data allowed per tool, the central business application and its API, vendor contracts and hosting, security and access, policy and training, use inventory and risk level (EU AI Act), licence costs. Each item: in place, partial, missing, with an evidence note | todo                        |
| K9  | Governance report          | Operating model stated first; per area: status, gap, recommendation, owner; 30/60/90 days. Client view and PDF                                                                                                                                                                                                                                                                | todo                        |
| K10 | Link the two               | A team mission of the same company shows the operating model and the approved tools from its governance mission, and its suggested fixes follow them. Without a governance mission, the team report keeps the client-data rule as its first step                                                                                                                              | todo                        |
| K11 | Dry run on the pilot shape | A synthetic company shaped like the first pilot (no real names, public repo), one interview mission and one survey mission end to end, report text and PDF read by a human                                                                                                                                                                                                    | todo                        |

Production: migration `0035_mission_kind.sql` applied to Neon on 2026-11-08 (owner approval): the new-mission
form offers team interview, team survey and governance; the four existing missions are team surveys.

## Not in scope

- Model-drafted findings or task tagging: still behind a contract-approved route (TASK-AJ A10).
- A sponsor login, slide export, cross-company benchmarks.

## Open for the owner

- Whether the hourly cost is entered per team or once per company (default: per team).
- The governance checklist wording: a first draft comes with K8 for the owner to read.
