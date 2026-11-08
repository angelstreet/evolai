# ADR 0065: Mission kind and mode

Date: 2026-11-08. Status: accepted. Builds on ADR 0049 (missions home and tabs) and ADR 0064. Task: TASK-AK, step K1.

## Context

The first pilot audit was run by hand as named interviews with each team member, task by task. It was a team
(job) audit, not a company audit of AI governance. The owner wants both kinds of audit in the tool, and a team
audit run either by an auditor asking the questions or by a self-serve survey that works without an auditor
until one review click before publishing (TASK-AK decisions 1, 5 and 6). Today every mission is a team survey:
links, anonymous answers, groups under 5 hidden. The tool cannot say that a mission is an interview, where people
are named and no link is sent, or a governance audit, which has no team answers at all.

## Decision

- **Two columns on `engagements`** (migration `0035_mission_kind.sql`): `kind` (`team`, `governance`,
  default `team`) and `mode` (`interview`, `survey`, default `survey`), with a check that a governance mission
  is an interview. Existing missions keep their meaning: team surveys.
- **The contract** (`packages/contracts/src/missionKind.ts`): the two enums and `missionShape`, which reads
  stored or typed values, falls back to a team survey and forces interview for governance.
- **Chosen once, at creation.** The new-mission form asks what the audit looks at (a team's tasks, or how the
  company runs AI) and, for a team, how answers are collected (interview, survey), each choice with one line of
  help. Settings show the choice as fixed text. Changing it later would change what the answers mean.
- **Tabs follow the shape** (`missionTabs`): a team survey keeps all six; a team interview drops the Team tab
  (no links to send); a governance audit keeps Overview, Visit, Report, Settings. The header shows the shape
  next to the status. An open interview mission's next step is "Run the interviews" on the Visit tab.
- **Before and after the migration.** Reads use `to_jsonb(e) ->> 'kind'`, which is null before 0035 and falls
  back to a team survey, so no query breaks. The form offers the choice only once the column exists; a create
  that asks for anything but a team survey before then fails closed (`kind_not_ready`). The audit row of
  `engagement.create` records the kind and mode.

## Alternatives

- **A separate table of mission types.** Rejected: two closed values with a cross-check fit two columns, and a
  join on every mission query buys nothing.
- **Mode on the team rather than the mission.** Rejected for now: one mission runs one way; a company that wants
  both makes two missions. Revisit if a mission must mix interviews and a survey.
- **Editable kind and mode.** Rejected: a mission that switched from survey to interview would mix anonymous and
  named answers under one privacy promise.

## Consequences

- Tabs that a shape hides are left out of the navigation only; their pages still render by URL. The interview
  screen (K4), the task board (K5) and the governance checklist (K8) give each shape its own content.
- Applying `0035_mission_kind.sql` on production needs the owner's approval; until then the form offers team
  surveys only and everything else works as before.
