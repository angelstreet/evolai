# Pilot runbook: run a real audit with a real client

For the owner (auditor) and the client's team referent. One live pilot, two
people, one survey round, one published report. Everything here was checked
against the live site on 2026-10-20; the "verified" marks say what was
actually tested and what was not.

Companions: [AUDITOR_GUIDE.md](AUDITOR_GUIDE.md) (how to run the audit),
[AUDIT_WORKFLOW.md](AUDIT_WORKFLOW.md) (why each rule exists),
[RUNBOOK.md](RUNBOOK.md) (commands, migrations, secrets).

---

## 0. Where the pilot stands today (verified 2026-10-20)

The application is healthy and every screen works. What is missing is set-up
data, not code.

| Check                                                                                                              | Result                                                                                  |
| ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| All 24 migrations on the live database                                                                             | verified — applied through `0024_audit_verbs_resync`                                    |
| `GET /api/health`                                                                                                  | verified — `{"ok":true,"db":true}`                                                      |
| Auditor screens (Engagements, Invitations, Teams, Synergies, Reports, Data, Names to hide, Audit trail, Portfolio) | verified — all HTTP 200 on the client tenant                                            |
| Client space (`/client`, `/client/results`, `/client/report`)                                                      | verified — signed-in only, anonymous is redirected to `/login`                          |
| Invitation signing in production                                                                                   | verified — a real link was created and opened; `SURVEY_SIGNING_SECRET` is set and works |
| Anonymous access to admin, board or client                                                                         | verified — refused, no tenant data leaks                                                |

## 1. Owner set-up before anyone is invited (about 20 minutes)

Everything in this section is on the live site in the admin, no terminal. Do
it in this order; steps 5 and 6 depend on the earlier ones.

1. **Name the engagement.** The audit exists but its name is empty, so screens
   fall back to the organisation name. Admin → Engagements → _the pilot client_ →
   **Settings** → Engagement form → name it (for example "Pilote IA 2026").
2. **Set the team size.** The pilot team has a headcount of 0, so progress
   shows "0 of 0". Same page, Teams section → put the real number of people
   who will answer. This drives "12 of 24" for the referent and the progress
   bars for the auditor.
3. **Rename the team with its accent.** It is currently `Equipe pilote`; write
   `Équipe pilote`. Unaccented French in an English or French screen was
   called out in testing and it is the first thing a client sees.
4. **Set the dates.** Opening and closing dates are empty. The closing date
   appears in the invitation message to colleagues and drives the reminder
   days, so set both before links go out.
5. **Fill the privacy notice.** Same page → **Privacy notice**. It is empty
   today, and the public page hides whatever is not set, so colleagues would
   answer without learning who is asking, why, or where the data goes. Fill:
   - who is the controller (the client organisation),
   - the purpose,
   - the legal basis (consent or legitimate interest),
   - a contact name and address,
   - the sub-processors (the host and the database provider),
   - the region the data is stored in,
   - whether AI analysis is used, and if so the approved service name.
     Nothing real goes in before the processing agreement is signed.
6. **Add the names to hide.** Admin → **Names to hide**. Put the client
   company name, product names and any person who could be mentioned in an
   answer. They are replaced by placeholders before any model sees the text
   and are refused in the published report.

## 2. Give the referent a login (2 minutes)

The referent account exists on the client tenant but has **no password and no
login link has ever been issued**. Until this is done, the referent cannot open
`/client`.

Admin → **Teams** → **Referents** → issue a single-use login link for the team
referent and send it to them. The app stores no address for referents, so
nothing about them is recorded; the link sets their password the first time
they open it.

They should set the language once (account menu, top right) if the
default is not French.

## 3. Launch and invite (5 minutes, after steps 1-6)

0. **Attach questionnaire v1** (once, before launch; ADR 0046): with the live `DATABASE_URL` set, run
   `pnpm questionnaire:apply --engagement-id <the engagement id>`. It records the pilot questions (six choices, three
   free-text questions, one role question) as the engagement's questionnaire version. The survey itself already
   shows them; this step keeps the version recorded on each answer correct. It refuses an engagement that already
   has answers.
1. Admin → Engagements → the audit → **Settings** → **Launch**. Status goes
   from _Draft_ to _Open_. Links cannot be created before this.
2. **Names to hide** is already checked in step 6 — do this again if the client
   added a product name since.
3. Send the referent the welcome email from the mission's **Team** tab (one address per team,
   no links to create). Enter the real team size there or let the referent do it.
4. **Check the address before you send it.** Open the team address yourself in a private
   window. You should land on the survey, in French, with the privacy notice
   visible. Only then send the set to the client.

### Two small production settings worth fixing first

- **`APP_BASE_URL` is not set in Vercel.** Links are therefore generated as
  `https://evolai.vercel.app/s/...`. They do work — that host redirects to
  `www.evolai.io` — but the client's colleagues will read a Vercel hostname in
  their inbox, and there is one extra hop. Set `APP_BASE_URL` to
  `https://www.evolai.io` and redeploy.
- **Secret desync after the 2026-10-18 rotation.** `CRON_SECRET` and
  `SURVEY_SIGNING_SECRET` were rotated into the owner's local env file, but
  the same values never reached Vercel, so the local file and production now
  differ. The survey is unaffected (links are signed by the server, and
  production's value is proven working). But the RUNBOOK command that triggers
  a cron by hand
  (`curl -H "Authorization: Bearer $CRON_SECRET" "$BASE/api/cron/retention"`)
  will be **rejected** if the bearer is taken from the local file. Either put
  the local file's two values into Vercel and redeploy, or take the bearer
  value from Vercel when running that one command.

## 4. The two-sided test script

Run it once, in order. The point is to find what is confusing for a person who
has never seen the product, not to prove the happy path works.

### Side A — the auditor (owner)

Sign in at `https://www.evolai.io/login`. Tabs: Portfolio, Engagements,
Invitations, Teams, Synergies, Reports, Data, Names to hide, Audit trail.

1. Open the audit. Is the name, the team and the closing date right?
2. Invitations: is there one link per colleague, with the closing date and the
   contact in the message? Does the copy/share button work on a phone?
3. Teams: does progress read "n of m" rather than "0 of 0"?
4. Engagements → Analyses: read one analysis. Is every claim traceable to a
   source? Does anything look invented?
5. Opportunities: approve the ones you agree with.
6. Reports → Start the report. Are the proposed improvement steps relevant?
   Accept, reject or edit. Write the executive summary **in your own words** —
   do not use the AI draft for a real client without reviewing it line by line.
7. Preview as the client. This must show exactly what the client will see. If
   it refuses, it names the reason; fix that reason first.
8. Publish. Download the PDF and read it as if you were the sponsor. Is it
   something you would put your name on?
9. Audit trail: is every action you just took recorded, with no report text in
   it?

### Side B — the referent (the client contact)

Use a phone. This is the side that matters most and the side least tested.

1. Open the login link that was sent. Does it ask for a language first? Is the
   screen readable without pinching to zoom?
2. Sign in. Does the home page say what to do next, and does it show progress
   out of the real number of people?
3. Invitations: create one link for yourself and one for a colleague. Can you
   copy them and share them from the phone? Is the message ready to paste, and
   does it contain the closing date and the contact?
4. Send yourself the generic reminder. Is there exactly one message, and does
   it name nobody?
5. Results: is there something to show the team, or is it an empty screen?
6. Answer the survey yourself as an employee, on the phone. Is any question
   unclear, does anything read like an exam, is there a way to skip or say "I
   don't know"?
7. Report tab after publication: does it show the report, and does the PDF
   download on a phone?
8. Try to reach anything you should not see: another team's numbers, who
   answered, a raw answer. Every attempt must fail quietly.

### What to write down

For each step: what you expected, what you saw, and whether a colleague could
do it without help. A step that needs a hint from the owner is a finding.

## 5. What is not covered by this pilot

Say so to the client rather than discovering it later.

- **The AI route is not approved for real data yet.** The pipeline runs on the
  deterministic rule-based route. Themes are real; a live model route needs a
  contract-approved provider, in the EU if the client requires it.
- **Pilot tracking is not in the app.** The 30/60/90 checkpoints in the report
  are a plan on paper. Measured benefits live with the client for now.
- **Real-device coverage is partial.** Automated checks run at 360, 768 and
  1280 pixels; nobody has yet run this on a low-end Android or on a screen
  reader.
- **No SSO, no multi-factor authentication.** Auditors use a password.
- **No recovery drill has been run.** The procedure is written in the RUNBOOK
  but untested.

## 6. After the pilot

1. Open the mission, tab **Answers**: counts per choice and the anonymised free texts by question, with no link
   to a person. Press **Export CSV** for the same answers in a spreadsheet (pseudonym, question, answer, time).
   Both stay hidden, and the CSV is refused, until five people have answered.
2. Keep the audit-trail export (**Settings**, **Audit trail**) with the report you send the referent.
3. Retention and erasure requests are handled in **Settings**, **Data and erasure**.
4. Start a new report version rather than editing a published one if the plan
   changes.

---

## Appendix A: two pre-pilot workers (recommended, narrow scope)

A five-persona agent test already ran on 2026-10-19
([TEST_FEEDBACK_2026-10-19.md](TEST_FEEDBACK_2026-10-19.md)) and produced 15
ranked findings; groups A to D of them shipped as TASK-S, T, U and V. Sending
two more workers to "check whether it works" would mostly re-find the same
things.

What is still worth one agent each is the two sides a real person walks, on the
newest surfaces, judged by whether a step needs a hint from the documentation.
That is what the two briefs below are for. Run them in parallel with the owner
set-up in section 1; they use their own local stack and never touch production.

**Non-negotiable for both:** own git worktree on a fresh branch; `pnpm local:up`
with its own port; synthetic data only; **never** write to the live database,
never sign in to the live site, never commit; deliverable is a ranked findings
list, not code. If a bug is found, describe it with a repro path and stop — do
not start fixing it, or the two workers will collide.

### Worker 1 — the auditor side, "a consultant on day one"

Goal: find every step that needs a hint from [AUDITOR_GUIDE.md](AUDITOR_GUIDE.md).

Desktop first (1280 and 1440), then one pass at 360 to check nothing is
unreachable on a small screen.

1. Set an audit up from nothing: new engagement, teams and headcounts, privacy
   notice, launch, preview.
2. Read one analysis. Judge whether every claim shows its source and whether
   any of it reads as invented.
3. Approve analyses, turn them into opportunities, move them to approved.
4. Build the report: start it, accept/reject/edit steps, write the summary,
   build the 30/60/90 plan, fill risks.
5. Preview as the client. Note every reason it refuses and whether the message
   tells you how to fix it.
6. Publish, download the PDF, read it as if you were the sponsor.
7. Data: export each kind, erase a pseudonym, find the audit trail.
8. Audit trail: confirm every action above is recorded and that no report text
   leaked into it.

Deliverable: findings ranked by severity, each with a repro path, plus a
one-line verdict on whether the guide is complete.

### Worker 2 — the referent side, "the client contact, non-technical, on a phone"

Goal: find every step that needs a hand, at 360 pixels, in a real browser.

1. Log in from a single-use link. Does it make sense cold? Can they recover
   if the tab closes?
2. Home: does it say what to do next? Is progress shown against the real
   number of people?
3. Create a link for themselves and one for a colleague. Can they copy and share
   them from the phone? Is the message ready to paste, with the closing date
   and the contact in it?
4. Send themselves the generic reminder. Exactly one message, nobody named.
5. Results tab before any answers exist: useful, or a dead end?
6. Answer the survey themselves as an employee. Flag any question that reads like
   an exam, anything that feels sensitive, and the absence of a skip or an "I
   don't know".
7. Report tab after publication: does it read well on a phone, does the PDF
   download?
8. Try deliberately to reach what they must not: another team's numbers, who
   answered, a raw answer. Every attempt must fail quietly.

Deliverable: findings ranked by severity with a repro path, plus the five
things that most confused them, in their own words.

### What the workers cannot settle

They cannot judge AI theme quality (needs an approved real route and a human
expert), cannot replace a real client on the phone, and cannot answer whether
the report is good enough to put your name on. Those are the owner's calls.
