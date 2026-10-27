# EvolAI docs — index & map

> Top-level entry point for the public docs in this repo. If a thing is
> not linked from here, it is not part of the "owned-by-docs" surface.

This index is the **map contract** for everything under `docs/`. The
contract: every artifact under `docs/` belongs to one of four buckets
below; every ADR is reachable in two hops; every ROADMAP milestone names
its ADRs; every gate names its blocking evidence.

---

## 1. The four buckets

| Bucket       | Files                                                                                                                                        | Purpose                                                                                                                            |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Product      | [PRD.md](PRD.md)                                                                                                                             | Full product requirements (35 sections). Public, anonymised.                                                                       |
| Delivery     | [ROADMAP.md](ROADMAP.md)                                                                                                                     | Phase / milestone / gate state. Mirrors PRD §18. Updated in the merge that ships a milestone.                                      |
| Operations   | [RUNBOOK.md](RUNBOOK.md), [AUDITOR_GUIDE.md](AUDITOR_GUIDE.md), [AUDIT_WORKFLOW.md](AUDIT_WORKFLOW.md), [PILOT_RUNBOOK.md](PILOT_RUNBOOK.md) | Deploy, rollback, migrations, auditor accounts, secrets, health, cron, recovery drill; how to run a real pilot with a real client. |
| Architecture | [adr/](adr/)                                                                                                                                 | Numbered ADR records. Every significant technical decision lands here. Never amend an old ADR.                                     |
| Workflow     | [INDEX.md](INDEX.md) (this file), [README.md](../README.md), [AGENTS.md](../AGENTS.md), [CONTRIBUTING.md](../CONTRIBUTING.md)                | Working agreements + the public top-level story.                                                                                   |

## 2. The PRD section map

The PRD has 35 sections across two parts (Part I: product surface, Part II:
security / governance / operations / value). Below is the section-by-section index.

### Part I — Product requirements

| §                          | Title                                               | Mirrors in the roadmap     | ADRs                                                                                                                                                                                                           |
| -------------------------- | --------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1                          | Positioning and terminology                         |                            |                                                                                                                                                                                                                |
| 2                          | Product goals and non-goals                         |                            |                                                                                                                                                                                                                |
| 3                          | Personas and permissions                            |                            |                                                                                                                                                                                                                |
| 4                          | Core user journeys                                  | M5, M10, M11, M12, M14     | [0004](adr/0004-mobile-web-survey-stack.md), [0008](adr/0008-auditor-review.md), [0009](adr/0009-opportunity-register.md), [0010](adr/0010-sponsor-onboarding.md), [0013](adr/0013-quiz-badges-and-mascots.md) |
| 5                          | Mobile-first experience requirements                | M5                         | [0004](adr/0004-mobile-web-survey-stack.md)                                                                                                                                                                    |
| 6                          | Adaptive AI maturity model                          | M2, M14                    | [0002](adr/0002-monorepo-tooling.md), [0013](adr/0013-quiz-badges-and-mascots.md)                                                                                                                              |
| 7                          | Workflow discovery questionnaire                    | M5                         | [0004](adr/0004-mobile-web-survey-stack.md)                                                                                                                                                                    |
| 8                          | The six AI-first learning principles                |                            |                                                                                                                                                                                                                |
| 9                          | Functional requirements by priority (FR-01 … FR-17) | All milestones             | All ADRs                                                                                                                                                                                                       |
| 10                         | AI workflow design                                  | M9                         | [0007](adr/0007-ai-pipeline.md)                                                                                                                                                                                |
| 11                         | Opportunity data contract                           | M11                        | [0009](adr/0009-opportunity-register.md)                                                                                                                                                                       |
| 12                         | Suggested stack and build-vs-buy                    | M2                         | [0002](adr/0002-monorepo-tooling.md)                                                                                                                                                                           |
| 13                         | Repository / code organization                      | M2                         | [0002](adr/0002-monorepo-tooling.md)                                                                                                                                                                           |
| 14                         | Data model (logical)                                | M3, M4                     | [0003](adr/0003-postgres-migrations-and-rls.md)                                                                                                                                                                |
| 15                         | Security, privacy, and governance                   | All milestones             | [0003](adr/0003-postgres-migrations-and-rls.md), [0006](adr/0006-local-dev-runner.md), [0010](adr/0010-sponsor-onboarding.md), [0013](adr/0013-quiz-badges-and-mascots.md)                                     |
| 16                         | UX acceptance criteria                              | M5, M6                     | [0004](adr/0004-mobile-web-survey-stack.md), [0005](adr/0005-admin-engagements-page.md)                                                                                                                        |
| 17                         | Non-functional requirements                         | M7, M8                     | [0006](adr/0006-local-dev-runner.md)                                                                                                                                                                           |
| 18                         | Rollout phases, timelines and gates                 | [ROADMAP.md](ROADMAP.md)   |                                                                                                                                                                                                                |
| 19                         | Success metrics and instrumentation                 | M14 (literacy tier rollup) | [0015](adr/0015-team-badge-rollup.md)                                                                                                                                                                          |
| 20                         | Detailed first pilot                                | M12 (sponsor onboarding)   | [0010](adr/0010-sponsor-onboarding.md)                                                                                                                                                                         |
| 21                         | Example user stories                                |                            |                                                                                                                                                                                                                |
| 22                         | Open decisions / product risks                      |                            |                                                                                                                                                                                                                |
| 23                         | Delivery acceptance / definition of done            |                            |                                                                                                                                                                                                                |
| References and assumptions |                                                     |                            |

### Part II — Security, governance, cost, ops, value

| §   | Title                                             | Mirrors in the roadmap         | ADRs                                                                                                                                                                                                               |
| --- | ------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 24  | Open-source product and paid-services model       |                                | [0001](adr/0001-license-and-stack.md)                                                                                                                                                                              |
| 25  | Security & privacy requirements (incl. **Gates**) | M3, M4, M6, M7, M10, M11, M14  | [0003](adr/0003-postgres-migrations-and-rls.md), [0008](adr/0008-auditor-review.md), [0009](adr/0009-opportunity-register.md), [0011](adr/0011-cross-team-synergy.md), [0013](adr/0013-quiz-badges-and-mascots.md) |
| 26  | Cost management / FinOps                          | M9                             | [0007](adr/0007-ai-pipeline.md)                                                                                                                                                                                    |
| 27  | Audit service catalogue & pricing                 |                                |                                                                                                                                                                                                                    |
| 28  | Repeatable audit process and timeline             |                                |                                                                                                                                                                                                                    |
| 29  | Audit-quality rubric                              |                                |                                                                                                                                                                                                                    |
| 30  | Measuring gains after an audit                    |                                |                                                                                                                                                                                                                    |
| 31  | Feedback and continuous improvement               |                                |                                                                                                                                                                                                                    |
| 32  | Client FAQ                                        |                                |                                                                                                                                                                                                                    |
| 33  | Additional engineering requirements & tests       | M4 (RLS deny), M5 (Playwright) | [0003](adr/0003-postgres-migrations-and-rls.md), [0004](adr/0004-mobile-web-survey-stack.md), [0008](adr/0008-auditor-review.md)                                                                                   |
| 34  | Open questions before v1 release                  |                                |                                                                                                                                                                                                                    |
| 35  | Primary governance references                     |                                |                                                                                                                                                                                                                    |

## 3. The ADR index

Numbered, current, and tied to the milestone that introduced them. Order
is also the chronology of design choices. **Never amend** an old ADR;
write a new one that supersedes it.

| #    | Title                                                                                                                    | Milestone                        | Status   |
| ---- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------- | -------- |
| 0001 | [License & stack](adr/0001-license-and-stack.md)                                                                         | M1 (initial)                     | Accepted |
| 0002 | [Monorepo + tooling](adr/0002-monorepo-tooling.md)                                                                       | M2                               | Accepted |
| 0003 | [Postgres migrations + RLS](adr/0003-postgres-migrations-and-rls.md)                                                     | M4                               | Accepted |
| 0004 | [Mobile web survey stack](adr/0004-mobile-web-survey-stack.md)                                                           | M5                               | Accepted |
| 0005 | [Admin engagements page](adr/0005-admin-engagements-page.md)                                                             | M6                               | Accepted |
| 0006 | [Local one-command runner](adr/0006-local-dev-runner.md)                                                                 | M7                               | Accepted |
| 0007 | [AI pipeline worker](adr/0007-ai-pipeline.md)                                                                            | M9                               | Accepted |
| 0008 | [Auditor review surface](adr/0008-auditor-review.md)                                                                     | M10                              | Accepted |
| 0009 | [Opportunity register](adr/0009-opportunity-register.md)                                                                 | M11                              | Accepted |
| 0010 | [Sponsor onboarding + portfolio board](adr/0010-sponsor-onboarding.md)                                                   | M12                              | Accepted |
| 0011 | [Cross-team synergy — schema + contract](adr/0011-cross-team-synergy.md)                                                 | M13 slice A                      | Accepted |
| 0012 | [Cross-team synergy — admin surface](adr/0012-synergy-admin-surface.md)                                                  | M13 slice C                      | Accepted |
| 0013 | [Quiz badges + mascot SVGs](adr/0013-quiz-badges-and-mascots.md)                                                         | M14 slice A                      | Accepted |
| 0014 | [Quiz form + result reveal](adr/0014-quiz-form-and-result.md)                                                            | M14 slice B                      | Accepted |
| 0015 | [Team badge rollup + profile](adr/0015-team-badge-rollup.md)                                                             | M14 slice C                      | Accepted |
| 0016 | [FR-09 retention + export + deletion](adr/0016-fr09-retention-export-deletion.md)                                        | M15 slice A                      | Accepted |
| 0017 | [Board integration + landing](adr/0017-board-integration-and-landing.md)                                                 | M15 slice B                      | Accepted |
| 0018 | [DevX + deploy](adr/0018-devx-and-deploy.md)                                                                             | M15 slice C                      | Accepted |
| 0019 | [Public-routes Playwright suite](adr/0019-public-routes-playwright.md)                                                   | M15 slice D                      | Accepted |
| 0020 | [Coverage gate scope](adr/0020-coverage-gate-scope.md)                                                                   | M15 review (CI gates)            | Accepted |
| 0021 | [Manual e2e workflow](adr/0021-manual-e2e-workflow.md)                                                                   | M15 review (CI gates)            | Accepted |
| 0022 | [Deploy token + static hosting](adr/0022-deploy-token-and-static-hosting.md)                                             | M15 review (CI gates)            | Accepted |
| 0023 | [Auditor auth + session](adr/0023-auditor-auth-and-session.md)                                                           | TASK-A                           | Accepted |
| 0024 | [French + English (i18n)](adr/0024-i18n-fr-en.md)                                                                        | TASK-C                           | Accepted |
| 0025 | [Design tokens + style guard](adr/0025-design-tokens.md)                                                                 | TASK-E ([UX audit](UX_AUDIT.md)) | Accepted |
| 0026 | [Rename to EvolAI](adr/0026-rename-to-evolai.md)                                                                         | TASK-F                           | Accepted |
| 0027 | [One font, Playwright in CI](adr/0027-one-font-and-playwright-in-ci.md)                                                  | TASK-G                           | Accepted |
| 0028 | [Accessibility gate, next steps](adr/0028-accessibility-gate-and-respondent-next-steps.md)                               | TASK-I                           | Accepted |
| 0029 | [Model-backed synthesis, provider abstraction](adr/0029-llm-synthesis-provider-abstraction.md)                           | TASK-H                           | Accepted |
| 0030 | [Pseudonym erasure cascade](adr/0030-pseudonym-erasure-cascade.md)                                                       | TASK-B (renumbered from 0020)    | Accepted |
| 0031 | [Housekeeping: ADR number check, CODEOWNERS, smoke actors](adr/0031-housekeeping-adr-numbers-and-smoke-actors.md)        | TASK-J                           | Accepted |
| 0032 | [Production readiness](adr/0032-production-readiness.md)                                                                 | TASK-K                           | Accepted |
| 0033 | [Invitations, tracking, reminders](adr/0033-invitations-tracking-reminders.md)                                           | TASK-N (FR-03)                   | Accepted |
| 0034 | [MUI theme + standard chrome](adr/0034-mui-theme-and-standard-chrome.md)                                                 | TASK-L                           | Accepted |
| 0036 | [Redaction terms admin](adr/0036-redaction-terms-admin.md)                                                               | TASK-Q                           | Accepted |
| 0037 | [/intake behind sign-in, route inventory](adr/0037-intake-behind-sign-in-and-route-inventory.md)                         | TASK-R                           | Accepted |
| 0038 | [Audit set-up, organisation context, plain wording, language](adr/0038-audit-setup-organisation-context-and-language.md) | TASK-T                           | Accepted |
| 0039 | [The team referent never sees a per-link status](adr/0039-referent-sees-no-per-link-status.md)                           | TASK-S                           | Accepted |
| 0041 | [Audit report, improvement catalogue, readiness score](adr/0041-audit-report-improvement-catalogue-readiness.md)         | TASK-V                           | Accepted |
| 0042 | [Server-side PDF of the audit report](adr/0042-report-pdf-export.md)                                                     | TASK-V                           | Accepted |
| 0043 | [Optional AI draft of the report summary](adr/0043-ai-draft-of-report-summary.md)                                        | TASK-V                           | Accepted |
| 0044 | [Anonymise free text before it is stored](adr/0044-anonymise-free-text-on-ingestion.md)                                  | TASK-W                           | Accepted |
| 0045 | [Submit on an explicit finish](adr/0045-submit-on-explicit-finish.md)                                                    | TASK-Y                           | Accepted |
| 0046 | [Questionnaire v1: free-text questions and neutral wording](adr/0046-questionnaire-v1-free-text-and-neutral-wording.md)  | TASK-Z2                          | Accepted |
| 0047 | [Pilot polish: publish path, one count, links that copy](adr/0047-pilot-polish-publish-path-links-and-counts.md)         | TASK-Z1                          | Accepted |
| 0048 | [Brand kit tokens and the teal contrast rule](adr/0048-brand-kit-tokens-and-contrast-rule.md)                            | TASK-AC2                         | Accepted |
| 0049 | [Missions home, mission tabs, two nav entries, parked pipeline](adr/0049-missions-home-and-parked-pipeline.md)           | TASK-AD2                         | Accepted |
| 0050 | [Public "learn the audit" pages](adr/0050-learn-the-audit-pages.md)                                                      | TASK-AE                          | Accepted |
| 0051 | [Open by default: sign-in is the last step](adr/0051-open-by-default-sign-in-last.md)                                    | Owner decision                   | Accepted |
| 0052 | [One survey address per team, "Open my space"](adr/0052-one-address-per-team.md)                                         | TASK-AF                          | Accepted |

## 4. The gates map (PRD §25.4)

ROADMAP § [Gates](ROADMAP.md#gates-prd-254) names four launch gates. The
map below ties each gate to the evidence already in `main`.

| Gate                             | What it gates                                                              | Evidence already in `main`                                                                                                                                | Owner track next                                                                                                                    |
| -------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **A** — survey pilot             | Tenant isolation, retention, audit logs, approved AI data route            | `tests/db` isolation suite (RLS deny) + `audit_log` table + retention cascade and scheduled retention (ADR 0030) + rule-based `model_route` on `analyses` | Done. Keep the isolation suite green on every change.                                                                               |
| **B** — AI synthesis             | Redaction, prompt-injection tests, source traceability, model cost ceiling | `analyses.evidence_json` (sourceKind/sourceId/quote per claim) + `model_route` column + service-account worker posture                                    | LLM-backed swap of the four `synthesize*` functions in `services/ai/src/pipeline.ts` (ADR 0007); prompt-injection harness (Phase 2) |
| **C** — enterprise hosting       | Recovery drill, SSO/MFA, pen test, agreed SLA                              | Embedded Postgres local runner (M7) provides recovery drill substrate; auditor sign-in with signed sessions (ADR 0023)                                    | SSO/OIDC and MFA, production hosting and backups, real pen test (out of scope), SLA contract (out of scope).                        |
| **D** — cross-company benchmarks | Aggregation thresholds, de-identification review                           | Cross-team synergy detection (M13) is the in-tenant precursor; cross-tenant rollups not started                                                           | FR-15 / FR-16 (Phase 3)                                                                                                             |

## 5. The "how to test it" quick links

```bash
cd ~/evolai
pnpm install --frozen-lockfile
pnpm --filter @evolai/web build
pnpm local:up                    # embedded Postgres + migrations + production build
```

After `READY postgres=... web=... admin=...` prints, exercise:

| Command                                          | What it covers                                              | Skill anchor                                    |
| ------------------------------------------------ | ----------------------------------------------------------- | ----------------------------------------------- |
| `pnpm local:smoke`                               | full mobile-survey walk (`/about → /s/[token] → /done`)     | [M5](adr/0004-mobile-web-survey-stack.md), M7   |
| `pnpm m10:smoke`                                 | auditor review + approve                                    | [M10](adr/0008-auditor-review.md)               |
| `pnpm m11:smoke`                                 | opportunity register + status workflow                      | [M11](adr/0009-opportunity-register.md)         |
| `pnpm m12:smoke`                                 | sponsor intake + portfolio board + 2nd engagement teardown  | [M12](adr/0010-sponsor-onboarding.md)           |
| `pnpm m13:smoke`                                 | cross-team synergy worker + admin surface + transition flow | [M11/M13 ADRs](adr/0011-cross-team-synergy.md)  |
| `pnpm m14:smoke`                                 | quiz form + result reveal + team rollup + profile           | [M14 ADRs](adr/0013-quiz-badges-and-mascots.md) |
| `pnpm --filter @evolai/ai run smoke`             | rule-based AI pipeline end-to-end                           | [M9](adr/0007-ai-pipeline.md)                   |
| `pnpm --filter @evolai/ai run synergy-smoke`     | cross-engagement synergy worker                             | [M13](adr/0011-cross-team-synergy.md)           |
| `pnpm --filter @evolai/ai run team-rollup-smoke` | team-mascot rollup worker                                   | [M14](adr/0015-team-badge-rollup.md)            |
| `pnpm local:status`                              | probes web + Postgres                                       | [M7](adr/0006-local-dev-runner.md)              |
| `pnpm local:down`                                | tears everything down                                       | [M7](adr/0006-local-dev-runner.md)              |

Manual URLs (ports come from the `READY` line):

```
/welcome                   M12 sponsor hero
/intake                    M12 sponsor form + live summary
/board                     M12 portfolio kanban
/quiz                      M14 5-question literacy quiz
/quiz/result               M14 mascot reveal (Tortoise / Fox / Owl)
/admin/engagements         M6 + M9–M11 audit surfaces
/admin/synergies           M13 detected synergies + transitions
/admin/teams               M14 team profile (only dominant mascot, no raw scores)
```

## 6. Conventions in this docs tree

- **Names** — Pseudonym-only everywhere; the public PRD talks about
  "the pilot client" and the ROADMAP / ADRs never refer to a real
  client. See [AGENTS.md](../AGENTS.md).
- **Privacy** — The respondent-facing surfaces (`/quiz`, `/quiz/result`,
  `/admin/teams`) never render raw quiz scores. The smoke scripts
  `m14-smoke.mjs`, `m12-smoke.mjs`, and `m13-smoke.mjs` enforce this
  with regex assertions.
- **RLS** — Every tenant-scoped table has a four-policy RLS pattern
  (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) plus a `SET LOCAL
app.tenant_id` / `app.is_service_account` switch. See ADR 0003.
- **ADR numbering** — Next free is `0053`. One decision per ADR; never
  amend an old one.
- **ROADMAP updates** — The State column flips and the README Status
  block updates in the same PR (or the immediately-following commit
  on `main`) the milestone lands.

## 7. Open follow-ups (read first when planning the next slice)

These are **NOT** blockers for the current shipment but are explicit
follow-ups the owner should consider before any external pilot:

- **FR-09 (PRD §9) — done.** Retention cascade, scheduled worker
  (`services/ai/src/retentionWorker.ts`), per-tenant deletion (`apps/web/src/lib/deletionData.ts`),
  CSV export (`apps/web/src/lib/exportData.ts`), and the admin surface at `/admin/data` are
  all in `main` ([0016](adr/0016-fr09-retention-export-deletion.md), [0017](adr/0017-board-integration-and-landing.md),
  [ADR 0030](adr/0030-pseudonym-erasure-cascade.md)). Smoke: `pnpm m15:smoke`.
- **`/board` integration with synergies + team mascots — done.** The kanban
  pulls synergies + team badges in parallel and renders the inline-SVG
  `Mascot` ([0017](adr/0017-board-integration-and-landing.md)).
- **LLM-backed synthesis (Gate B).** Shipped behind an allowlisted
  provider abstraction ([0029](adr/0029-llm-synthesis-provider-abstraction.md));
  the default route is still the rule-based pipeline ([0007](adr/0007-ai-pipeline.md)).
  Open: an EU-hosted or self-hosted route, a real-model theme quality
  review by a person, and a contract-approved route before any real survey data.
  The redaction terms UI at `/admin/redaction` is now live ([0036](adr/0036-redaction-terms-admin.md));
  the per-tenant list of names the redactor scrubs before any model call is
  editable from the admin shell.
- **Real SSO / MFA (Gate C).** Auditors sign in with a password and a
  signed session ([0023](adr/0023-auditor-auth-and-session.md)); Gate C
  requires SSO/OIDC and MFA with a real IdP. The production cut-over
  ([0032](adr/0032-production-readiness.md)) covers the hosting substrate
  (Vercel + Neon), auditor accounts by CLI, login lockout, security headers,
  health check and retention cron. Open: run the recovery drill once with
  a recorded result; SSO/MFA; pen test; SLA.
- **Playwright coverage of admin views.** Today Playwright ([0027](adr/0027-one-font-and-playwright-in-ci.md))
  covers the six public surfaces (`/welcome`, `/about`, `/s/[token]`, `/intake`, `/quiz`,
  `/quiz/result`) at three viewports. Admin pages still rely on the Node smokes
  (`apps/web/scripts/m*‑smoke.mjs`). A future slice can add admin-viewport
  Playwright specs, especially for FR-09 in admin views.
- **Accessibility on real devices.** The axe and keyboard gates
  ([0028](adr/0028-accessibility-gate-and-respondent-next-steps.md)) cover
  automation only; a human screen-reader pass and real phones at 360 px are still open.
- **Invitations and reminders (FR-03) — done.** Bulk links, tracking with
  a minimum group, reminders, revoke / extend / regenerate, optional
  email behind a provider interface, admin Invitations page
  ([0033](adr/0033-invitations-tracking-reminders.md)). Open: live run
  of the Brevo adapter (needs the owner's key) and the client address-window
  notice.
- **Phase 3 (PRD §18) — cross-client benchmark knowledge base, cohort
  analytics, optional native mobile apps.** Not started.

## 8. File-system layout

```
docs/
├── INDEX.md          ← this file (map contract)
├── PRD.md            ← product requirements (35 sections)
├── ROADMAP.md       ← milestone / phase / gate state
├── RUNBOOK.md       ← production operations
├── AUDITOR_GUIDE.md ← run an audit, step by step
├── AUDIT_WORKFLOW.md← why each rule exists
├── PILOT_RUNBOOK.md ← run a real pilot with a real client (auditor + referent)
└── adr/
   ├── 0001-license-and-stack.md
   ├── 0002-monorepo-tooling.md
   ├── 0003-postgres-migrations-and-rls.md
   ├── 0004-mobile-web-survey-stack.md
   ├── 0005-admin-engagements-page.md
   ├── 0006-local-dev-runner.md
   ├── 0007-ai-pipeline.md
   ├── 0008-auditor-review.md
   ├── 0009-opportunity-register.md
   ├── 0010-sponsor-onboarding.md
   ├── 0011-cross-team-synergy.md
   ├── 0012-synergy-admin-surface.md
   ├── 0013-quiz-badges-and-mascots.md
   ├── 0014-quiz-form-and-result.md
   ├── 0015-team-badge-rollup.md
   ├── 0016-fr09-retention-export-deletion.md
   ├── 0017-board-integration-and-landing.md
   ├── 0018-devx-and-deploy.md
   ├── 0019-public-routes-playwright.md
   ├── 0020-coverage-gate-scope.md
   ├── 0021-manual-e2e-workflow.md
   ├── 0022-deploy-token-and-static-hosting.md
   ├── 0023-auditor-auth-and-session.md
   ├── 0024-i18n-fr-en.md
   ├── 0025-design-tokens.md
   ├── 0026-rename-to-evolai.md
   ├── 0027-one-font-and-playwright-in-ci.md
   ├── 0028-accessibility-gate-and-respondent-next-steps.md
   ├── 0029-llm-synthesis-provider-abstraction.md
   ├── 0030-pseudonym-erasure-cascade.md
   ├── 0031-housekeeping-adr-numbers-and-smoke-actors.md
   ├── 0032-production-readiness.md
   ├── 0033-invitations-tracking-reminders.md
   ├── 0034-mui-theme-and-standard-chrome.md
   ├── 0036-redaction-terms-admin.md
   ├── 0037-intake-behind-sign-in-and-route-inventory.md
   ├── 0038-audit-setup-organisation-context-and-language.md
   ├── 0039-referent-sees-no-per-link-status.md
   ├── 0041-audit-report-improvement-catalogue-readiness.md
   ├── 0042-report-pdf-export.md
   ├── 0043-ai-draft-of-report-summary.md
   ├── 0044-anonymise-free-text-on-ingestion.md
   ├── 0045-submit-on-explicit-finish.md
   ├── 0046-questionnaire-v1-free-text-and-neutral-wording.md
   ├── 0047-pilot-polish-publish-path-links-and-counts.md
   ├── 0048-brand-kit-tokens-and-contrast-rule.md
   ├── 0049-missions-home-and-parked-pipeline.md
   ├── 0050-learn-the-audit-pages.md
   ├── 0051-open-by-default-sign-in-last.md
   └── 0052-one-address-per-team.md
```

The contract map of every Zod schema and TS type in `@evolai/contracts`
lives at [`packages/contracts/src/contracts-map.md`](../packages/contracts/src/contracts-map.md).
