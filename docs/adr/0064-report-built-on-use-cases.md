# ADR 0064: The audit report is built on use cases

Date: 2026-10-31. Status: accepted. Builds on ADR 0041, 0058, 0060, 0061, 0062 and 0063. Owner choice: "Yes, 1 to 6".

## Context

Read as the client's director, the rehearsal report of a 50-person IT consulting firm described the survey
instead of answering the question the client pays for: where AI saves time in the firm, how much, and what to do
first. The real opportunities (CVs rewritten for each offer, 45 minutes each; tender answers; timesheets retyped
into invoices; the staffing sheet) were findings 6, 13 and 15 of 15, behind generic signals. Every approved
finding became its own opportunity, and its steps came from a keyword match on a generic catalogue, so the CV
problem got "a single request form". No figure said how many hours each change could free. Seven people said
there is no rule on client data in AI tools, the main risk for a firm whose consultants work on bank and pharma
data, yet the report said "no particular risk". The visit had no guide to measure a use case, and the client had
no say in the order.

## Decision

1. **Use cases.** A playbook (`packages/contracts/src/useCases.ts`, versioned) names the pieces of work: data
   rules, consultant CVs, tenders, timesheets to invoices, staffing, recruiting, client status reports, meeting
   notes, finding documents, double entry, first drafts, incoming requests. Each one has an approach, the
   evidence tags that propose it, its steps (catalogue entries), a data rule, a unit and the visit questions.
   `proposeUseCases` proposes at most five from the approved findings: a task use case needs a finding that names
   the work (free-text theme, auditor or visit finding); choice answers alone do not. One opportunity per use
   case and mission (migration `0034_use_cases.sql`: `use_case_id`), with its findings linked as evidence.
   Findings no longer make one opportunity each once 0034 is applied; rejecting a finding archives a use case
   only when none of its findings stays approved.
2. **Specific actions.** Eleven catalogue entries for professional services (client-data rule, master profiles,
   CV tailoring, tender library and first draft, timesheets entered once, invoices from timesheets, staffing
   board, candidate screening, interview notes, status reports). Catalogue version `2026-10-31.1`. A use case
   brings its own steps; the keyword matcher only serves opportunities that are not use cases.
3. **Risks first.** A new report starts with risk lines from the findings (client data with no rule, candidates'
   data, unchecked AI answers), which the auditor edits. The client-data use case is pinned: always first,
   steps in the first 30 days.
4. **Saving estimate.** The auditor measures volume a week and minutes per unit; the report shows time today
   and an estimated saving as a range from `SAVING_RATES` (dated, versioned, recorded in the snapshot as
   `ratesVersion`), marked as an estimate to check at day 90. No price and no euro figure.
5. **Workflow.** Under each use case, the visit questions and the measure form are the auditor's visit guide.
   While the report is in review, the referent orders the use cases ("Where to start?", `client_rank`); the
   ranking is pinned rules, then the referent's order, then impact and effort.
6. **Report.** "Where to save time" comes right after the summary: per use case the approach, time today, the
   saving, what shows it (people and finding numbers), the data rule and the steps. The summary draft names the
   use cases, the hours and the rule that comes first. The report lists at most 8 key findings (cited ones and
   the use cases' evidence first); free-text themes stay behind the use cases. The PDF shows the same lines.

## Alternatives

- Keep one opportunity per finding and only rename them: the report would still list survey signals, not work.
- Let a model write the use cases: no source link per claim and no stable wording to measure against; the
  playbook stays deterministic and the auditor edits.
- A price or euro saving: rates and salaries change and differ by client; hours are what the client can check.

## Consequences

- The audit's value is visible in the report: named pieces of work, hours, first steps, rules.
- The auditor must measure the first use cases during the visit, or the report says they are not measured.
- Migration 0034 is needed on production; until it runs, the report keeps the per-finding behaviour.
- The saving ranges are working assumptions; the day-90 measures should be used to correct them (new version).
