# ADR 0062: Fixes from the professional-services pilot rehearsal

Date: 2026-10-30. Status: accepted. Builds on ADR 0052, 0058, 0059, 0060 and 0061. Owner choice: "Fix all",
with the design items as recommended.

## Context

Before a first real pilot with a small IT consulting firm (consultants placed at clients, business managers,
recruiting, a back office), a local rehearsal played the client's referent end to end on synthetic data: 23
answers in four teams, findings, a visit, the report, the review with one dispute, publishing, the client page
and the PDF. No real company or person appears in the repository.

It found three blockers: the time section hid small teams but not the team you could work out by subtraction
(the score section already did); the referent had to judge every approved finding, keyword themes included;
and the message after editing a finding suggested the action had changed. It also found that the findings and
actions did not speak the language of such a firm, that consultants would answer about client work, that
some finding titles read as blame, that five choice questions could not be skipped although the welcome text
says every question can, and a list of copy and layout defects.

## Decision

- **Time section, same privacy rule as the score.** `estimateRepeatedTime` hides the smallest visible team
  until the rest cannot describe a group under the minimum (complementary suppression), with the score's
  sentence ("… not shown to protect privacy"). Figures are per person, to the half hour, with plurals.
- **The referent reviews a shortlist.** The auditor ticks up to 7 approved findings ("Ask the referent",
  migration `0033_finding_for_review.sql`, audit verb `finding.update` with `forReview`). With none ticked,
  the app picks up to 7 that can reach the report: written and visit findings first, then most people,
  keyword themes left out. The audit-quality "checked by the client" counts this shortlist.
- **Questionnaire v3** (`pilot-v3.json`), same codes, prompts and option values as v2: the repeated-task and
  weekly-time questions say "for your own company, not a client assignment", and the business-application
  option names time, billing and recruiting tools. Every question has "Skip", choices included.
- **Professional-services work in the evidence patterns:** `cv_profiles`, `tender_response`,
  `timesheet_billing`, `staffing`, `recruiting`, with French and English keywords, attached to the catalogue
  actions that answer them (templates, drafting assistant, transfer between tools, reminders, single source,
  scheduled report, meeting notes, intake form). Catalogue version `2026-10-30.1`.
- **Owners any firm has:** owner roles keep their codes but read "Whoever runs the task", "Whoever manages
  the tools", "Management, with whoever handles data protection", and so on.
- **No blame:** findings on checking sources, client data, briefing an AI, mapping work and simple automation
  are worded as a missing shared practice.
- **Rules on data first:** at equal priority, an opportunity with a rules action ranks first, and rules
  actions open each 30/60/90 horizon.
- **Copy and layout:** team scores as cards on a phone; findings in the client report without the internal
  axis label; "Before starting" lines name their action; follow-up dates written out; levels lower case;
  titles inside the draft summary start lower case (acronyms kept); a "Written in French" note when the
  report language differs from the screen; the finished page counts against the team headcount ("1 of 8");
  team addresses cut at whole words; "14 questions" on the learn page; the review first on the referent's
  Report page; the sharing message says the EvolAI team reads written answers with names masked.

## Alternatives

- Let the referent review everything: rejected, it asks them to judge keyword counts.
- New question codes for the reframed questions: the meaning is unchanged (the helper narrows where to look),
  so codes stay and answers remain comparable.
- A client-specific question set: the reframing reads naturally for any company.

## Consequences

- 0033 needs owner approval on production; until then the tick box is hidden and the automatic shortlist
  applies.
- Existing team addresses keep their slugs; new ones use whole words.
- Still open: the video placeholders wait for the owner's video ids; the area question adds little in teams of
  about six; a native read of the French.
