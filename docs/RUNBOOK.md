# EvolAI — runbook (production)

Live site: evolai.io and www.evolai.io, Vercel project `evolai` (team: the owner's scope in the Vercel dashboard),
database: Neon Postgres in Frankfurt. Secrets never go in git or in chat: they live in Vercel sensitive environment
variables and in the owner's private env file (named below as `$ENV_FILE`).

## Where things are

| What                  | Where                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------- |
| Code                  | this repo, branch `main`; the Vercel project root is `apps/web` (`apps/web/vercel.json`)  |
| App DB role           | `auditai_app` (restricted, subject to row-level security); migrations run as the owner    |
| Pooled DB URL         | `DATABASE_URL` (Vercel env and `$ENV_FILE`)                                               |
| Direct (unpooled) URL | `DATABASE_URL_UNPOOLED` in `$ENV_FILE` only; used for migrations and the auditor commands |
| App secrets           | `AUTH_SESSION_SECRET`, `SURVEY_SIGNING_SECRET`, `DATABASE_APP_PASSWORD`, `CRON_SECRET`    |

Load the file into a shell without printing it: `set -a; . "$ENV_FILE"; set +a`.

## Deploy and roll back

- A push to `main` deploys to production automatically. Keep `main` green (CI: format, lint, typecheck, tests,
  leak-scan, style-guard, Playwright). A pull request gets a preview deployment.
- Migrations are **not** run by the deploy. Apply them first when a change adds one (next section), then merge.
- Roll back: Vercel dashboard, project `evolai`, Deployments, pick the last good deployment, "Promote to Production"
  (or `vercel rollback`). A rollback does not undo migrations; migrations are forward-only and backward compatible
  with the previous release, so the previous build still runs.
- Check after a deploy: `curl -fsS https://evolai.io/api/health` returns `{"ok":true,"db":true}`.

## Apply migrations to Neon

```bash
set -a; . "$ENV_FILE"; set +a
DATABASE_URL="$DATABASE_URL_UNPOOLED" node infra/db/scripts/migrate.mjs
```

The runner is idempotent and prints `+` for each file it applies. Never run `seed-synthetic-auth.mjs` against a
deployed database (it refuses under `NODE_ENV=production`; do not work around that).

## Auditor accounts

Run from the repo root with `$ENV_FILE` loaded. The password is typed at a hidden prompt (or piped on stdin), never
on the command line. Minimum 12 characters. Tenant ids are the `tenants.id` values of the live database.

```bash
set -a; . "$ENV_FILE"; set +a
pnpm auditor:create --email <address> --name "<Full Name>" --tenant <tenant-uuid> [--tenant <tenant-uuid>]
pnpm auditor:set-password --email <address>
pnpm auditor:disable --email <address>
```

The command uses `DATABASE_URL_UNPOOLED` when set. If both URLs are set and point at different hosts it refuses.
Add `--expect-host <direct Neon host>` to pin the target. Every change writes an `audit_log` row. The first auditor
on the live database: `auditor:create` with the live tenant ids, then sign in at `/login`.

If a user is locked out (5 failures in 15 minutes), wait 15 minutes. Nothing else to do.

## First client and its referent (TASK-P, ADR 0035)

`pnpm seed:client` creates a client tenant, one engagement (named after `--engagement-name`), one team, the
referent persona and the owner's memberships on it (`auditor` and `platform_owner`, which unlocks "View as"). It is
idempotent (a second run creates nothing), safe on the live database and refuses to run without explicit names.
Names come from the command line only, never from the repository. Apply migration 0019 first.

```bash
set -a; . "$ENV_FILE"; set +a
pnpm seed:client --tenant-name "<Client>" --engagement-name "Pilote <Client>" --team-name "<Team>" \
  --referent-name "<First Last>" --owner-email <owner sign-in address> --locale fr \
  [--expect-host <direct Neon host>]
```

The output lists the ids and the referent's placeholder address, `firstname-lastname@<client-slug>.invalid`. The
referent has **no password**: the account cannot sign in, it exists for "View as" only. Sign out and in again so
the session picks up the new `platform_owner` membership, then open the account menu: "View as".

### Give a referent a real login

Apply migration 0026 first. In the mission, **Team**, **Referent**: type the referent's real address (with their
agreement) and press "Send the welcome email". The address replaces the placeholder (only its hash is stored). The
page shows the address that opens their space, valid 30 days and usable once: copy it and send it yourself (the
email goes out as well only when `EMAIL_PROVIDER` is configured). The referent opens it and lands on `/client`
with no password. To send a fresh one (lost, expired, spent by a mail scanner), press the button again: the old
one dies. Staff keep a password (`/set-password`, `pnpm auditor:set-password`).

### Privacy notice and requests (TASK-U, ADR 0040)

Admin, Engagements, the engagement's settings: fill "Privacy notice" (contact, service providers, AI service if
AI analysis is on). The warning "Not configured yet" lists what the public page `/privacy?e=<engagement id>` still
hides; the invitation page links to that address by itself. Retention comes from the organisation's
`retention_days`. People send withdraw/erase requests from the public page; they appear in Admin, **Data**,
"Privacy requests" (open first). Check who is asking, run the erase there if it is justified, then "Mark as
handled" (this also clears the reply address). Set `EMAIL_PROVIDER` to be told by email.

### View as (owner)

Account menu, "View as": "Me: auditor" or a client persona. While viewing as, a banner says so on every page,
everything is read only (actions refused with a message), admin pages send you to the team space, and each page
view writes a `view_as.request` row with your own user id. "Back to my view" (banner or menu) ends it; signing out
or the 8-hour session expiry ends it too. Trail: `SELECT created_at, action, payload_json FROM audit_log WHERE
action LIKE 'view_as.%' ORDER BY created_at DESC LIMIT 50;` (as the service account).

### Referent self-service (TASK-AF, ADR 0052)

Before the referent shares the survey, set the mission's **closing date** (Settings) and the **contact person**
(Team tab). Both appear in the referent's ready-made message and on their space; the reminder days are computed
from the closing date (7 and 2 days before). The referent's space shows one survey address per team with a QR code,
"Share with the team" (prefilled message, Copy, WhatsApp; nothing is sent by the platform) and one generic reminder
message. The referent never sees who answered; if a client asks "who has not answered?", the answer is no, by
design (ADR 0039, ADR 0052).

## Produce the audit result for a client (TASK-V, ADRs 0041-0043)

Prerequisite: migrations **0023** and **0024** applied (above). The full walk-through in plain words is in
[AUDITOR_GUIDE.md](AUDITOR_GUIDE.md).

1. Approve the analyses (themes) and the opportunities of the engagement as usual. Only themes raised by at least
   5 people and opportunities in the approved, in progress or delivered states reach the report.
2. Admin, **Reports**: "Start the report". The rule-based matcher proposes up to three improvement steps per
   approved opportunity from the catalogue (`packages/contracts/src/improvementCatalogue.ts`, version stamped on the
   report). Accept, edit (effort, impact, risk, owner as a role, timing) or reject each one; add steps from the
   catalogue or write your own. "Suggest again" proposes steps for opportunities approved later.
3. Summary: "Write a first draft", then rewrite it in your own words and tick the findings it rests on. Optional AI
   draft (needs an approved real route, never in CI):
   `DATABASE_URL=... EVOLAI_AI_PROVIDER=... EVOLAI_AI_MODEL=... EVOLAI_AI_REGION=... pnpm --filter @evolai/ai report-draft -- --tenant <id> --engagement <id> --actor <your user id>`;
   it prints the route and cost, and the draft appears in the editor as "AI draft, not reviewed".
4. "Build from the accepted steps" for the 30/60/90-day plan, then edit lines; fill risks and the method note.
5. "Mark ready for review", check "Preview as the client" (or read the reason it is not ready), then "Publish" and
   confirm. The publish gate refuses: no summary, no cited finding, a cited finding no longer approved, no accepted
   step, a name from the "names to hide" list, or six words copied from what a respondent wrote.
6. The referent sees it in the **Report** tab and downloads the PDF; you can download the same PDF from the editor
   for the sponsor. Each download is in the audit trail.
7. Changes after publishing: "Start a new version" (the client keeps the published one until you publish again).
   "Unpublish" withdraws it at once.

## Anonymised free text (TASK-W, ADR 0044)

Free text is anonymised before it is saved: emails, phone numbers, links, handles, ids, addresses, names after a
title, pairs of capitalised words and the names on the client's list become `[email]`, `[phone]`, `[name]`,
`[organisation]` and so on. The original is not kept anywhere.

- **Before a pilot, add the client's names** (company, products, teams, people) in Admin, Redaction (as the auditor
  of that client, or "view as"). One name per line item; case and accents do not matter; whole words only.
  A single first name with no title is not detected by the rules, so list the people who matter.
- **Backfill existing answers** (migration **0025** applied first): with `DATABASE_URL` (or
  `DATABASE_URL_UNPOOLED`) set, run `pnpm anonymise:backfill` for a dry run. It prints, per tenant, how many answers
  it scanned and would change, never the text. Then `pnpm anonymise:backfill -- --apply` writes the change and adds
  one audit row per tenant. It is safe to run again: the second run changes nothing. It cannot be undone, so run the
  dry run first and add the names to hide before applying.
- A name that is wrongly masked (a tool or company) goes in `NAME_STOP_LIST` in
  `packages/domain/src/anonymise.ts`, with a test case.

## Change the questions (TASK-Z2, ADR 0046)

The whole questionnaire is one file: `packages/contracts/src/questionnaires/pilot-v2.json` (French and English side
by side). No migration is involved.

1. Edit the file: wording (`prompt`, `helper`, option `label`), option order (for scored choices, from the least to
   the most established practice; keep `unsure` last, it is never scored), the free-text limit
   (`freeTextMaxLength`) and hint (`freeTextHint`), `estimatedMinutes` (shown on the welcome page: keep it honest,
   about 20 seconds per choice and a minute per text question).
2. Check it: `pnpm --filter @evolai/contracts test` (the file is validated: unique codes, both languages, no options
   on a text question, no hint words such as "a good request", about 6 to 8 minutes) and
   `pnpm --filter @evolai/ai test` (the gold respondents must still use the real question texts).
3. **Fixing a typo or rewording without changing the meaning**: edit the file, merge, deploy. Rows already created
   in the database keep the old French text for the analysis, which is fine for a typo.
4. **Changing what a question means, adding or removing one**: give it a **new `code`** (never reuse one) and change
   the file. Deploy. The new rows are created the first time someone answers. For an engagement that has no answers
   yet, also run, with the live `DATABASE_URL` (or `DATABASE_URL_UNPOOLED`) set, once per engagement:
   `pnpm questionnaire:apply --engagement-id <uuid> [--expect-host <db host>]`.
   It prints the version it created or reused and whether the engagement was pointed at it. It refuses an engagement
   that already has answers: create a new engagement for the new questions rather than mixing two versions.
5. Keep the order of the file: the survey shows the questions in that order and stores each answer by its position.
   Do not reorder or delete questions once people have answered.

Questions are kept in the order: choices, free text, role. Free text and the role question stay optional (a skip is
saved so the survey can be finished). After editing French, ask a native speaker to read it.

## Rotate secrets

1. **App secrets** (`AUTH_SESSION_SECRET`, `SURVEY_SIGNING_SECRET`, `CRON_SECRET`): generate a value with
   `openssl rand -base64 48`, write it to `$ENV_FILE`, set it in Vercel (Settings, Environment Variables, mark
   Sensitive), redeploy. Rotating `AUTH_SESSION_SECRET` signs everyone out; rotating `SURVEY_SIGNING_SECRET`
   invalidates every invitation link already sent (re-issue them), so do that only if it leaked.
2. **DB app password** (`auditai_app`): `ALTER ROLE auditai_app WITH PASSWORD '<new>'` through the direct URL (psql
   prompts; do not paste the password into a shared place), update `DATABASE_APP_PASSWORD` in `$ENV_FILE` and
   Vercel, redeploy. Check `/api/health`.

## Survey addresses and reminders (FR-03, ADR 0033, ADR 0052)

Each team has one survey address, `/s/<slug>`, made when the Team tab or the referent's space is first opened (the
auditor can change its ending there). A browser that opens it gets its own anonymous invitation. There is no link
creation, CSV or QR sheet any more. Progress by team stays in the app (Team and Overview tabs) and in the JSON API
with the session cookie:

```bash
set -a; . "$ENV_FILE"; set +a
BASE=https://evolai.io
curl -sS -c jar -X POST "$BASE/api/auth/login" --data-urlencode "email=$AUDITOR_EMAIL" \
  --data-urlencode "password=$AUDITOR_PASSWORD"   # prompt for the password, do not paste it into history
curl -sS -b jar "$BASE/api/admin/invitations?tenant=<tenant>&engagement=<engagement>"
```

Progress is aggregate (teams under 5 show nothing). Revoke, extend: `op` = `revoke | extend` with `invitationId`.

Reminders run from `apps/web/vercel.json`: `GET /api/cron/reminders` daily at 07:43 UTC with the same
`CRON_SECRET` bearer as the retention route. Default mode: it only counts what is due; use the _Reminder list_
(`GET /api/admin/invitations?...&view=reminders`) and press "mark as resent" after the
client sends it. That list is for the auditor only: never hand it to the team referent, who knows which link went
to whom (ADR 0039); the referent has their own generic reminder. Email mode (per engagement setting, off by default): it sends and consumes each step, then purges
stored addresses. Run it by hand: `curl -sS -H "Authorization: Bearer $CRON_SECRET" "$BASE/api/cron/reminders"`;
the body is `{ok, engagements, sent, failed, listModeDue, purged, emailUnavailable}`.

Email mode needs `INVITE_EMAIL_KEY` (`openssl rand -base64 32`), `EMAIL_PROVIDER=brevo`, `BREVO_API_KEY` and
`EMAIL_FROM` in Vercel (Sensitive). Without them, creating with addresses fails before anything is stored.
Rotating `INVITE_EMAIL_KEY` makes stored addresses unreadable (they are short-lived: purge them first by revoking
or waiting for expiry). Migration 0018 must be applied first (previous section).

## Health and monitoring

Point an uptime check (any external monitor, 1-minute interval) at `https://evolai.io/api/health`; alert on a
non-200 answer or a body other than `{"ok":true,"db":true}`. The route reads no data. Runtime errors:
Vercel dashboard, Logs.

## Retention worker (Vercel cron)

`apps/web/vercel.json` calls `GET /api/cron/retention` daily at 03:17 UTC. Vercel sends
`Authorization: Bearer $CRON_SECRET` when the `CRON_SECRET` environment variable is set on the project (set it, 16+
characters; without it the route always answers 401). There is no public trigger. A pass erases pseudonyms whose
badges are all past retention (ADR 0030). Check in the dashboard (Settings, Cron Jobs) that the job ran and that its
last status is 200; its JSON body is `{ok, tenantsScanned, purged}`.

## Backups and recovery drill (Neon branch, about 20 minutes)

Neon keeps point-in-time history for the plan's restore window, and a branch is a cheap copy-on-write clone. The
drill proves a restore works without touching production:

1. In the Neon console, project of the live database, Branches, "Create branch" from the production branch with
   "Past data" set to a time one hour ago (or the current time if the plan has no window). Name it `drill-<date>`.
2. Copy that branch's **direct** connection string into a temporary file (not into chat or git).
3. `DATABASE_URL_UNPOOLED=<branch url>` then run: `DATABASE_URL="$DATABASE_URL_UNPOOLED" node infra/db/scripts/migrate.mjs`
   (expect only `=` lines: the branch already has every migration).
4. Check the data: connect with psql and run `SELECT count(*) FROM tenants; SELECT count(*) FROM users;
SELECT count(*) FROM audit_log;` and compare with production.
5. Point a preview deployment at the branch (a preview environment variable `DATABASE_URL`) or run `pnpm local:up`
   with that URL, sign in with a real auditor, open `/admin/data`.
6. Write the date, the restore point used and the time it took in `docs/HANDOVER.md` under Gate C, then delete the
   branch in the Neon console.

Gate C needs this drill done once with a real result; this runbook does not claim it.
