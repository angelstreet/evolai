# ADR 0053: Front page cockpit and the send step

Date: 2026-10-27. Status: accepted. Builds on ADR 0051 (open by default, sign-in last) and ADR 0048 (brand tokens).

## Context

The owner picked "Stage + tabs" (`docs/mockups/front-page-stage-tabs.html`) as the front page (TASK-AH). It is
a cockpit: rail, centre stage with a 01-05 control bar, side panel tabs, a steps strip. ADR 0051 says a visitor
reads, answers the ten questions in the browser, and is only asked for an email at "Send and start your audit".

Two things in the mockup do not map onto what the repository can do today:

1. There is no self-service path that creates an organisation, a team and a referent from a public request.
   Tenants, teams and referents are provisioned by the owner (seed scripts, `/admin`). A public endpoint that
   writes tenants needs its own abuse, ownership and retention design, and a schema decision for the
   unattached answers, which is a production database migration.
2. The shared header and footer (`SiteHeader`, `SiteFooter`) assume a container page, not a full-height app shell.

## Decision

- `/` renders `components/chrome/cockpit/Cockpit.tsx`, a client component using MUI controls and the design
  tokens (`app/cockpit.css`, no literal colour or size). Copy is in `packages/i18n` (`cockpit.*`, FR and EN);
  the ten questions come from `pilot-v1.json`, the video slots from `videos.json`.
- `ChromeGate` (client, `usePathname`) hides the shared header, banner and footer on `/` only; every other route
  is unchanged. The cockpit draws its own header and footer.
- Answers, lessons read and the survey position are kept in `localStorage` (`evolai-cockpit-v1`) and never leave
  the browser before the send step.
- Progress ("N of 7 steps", check circles) is shown only to a signed-in session; anonymous visitors see
  "Sign in to keep your progress". Staff also get a Missions link.
- The send step posts to `POST /api/send`: public, validated (`lib/sendRequest.ts`), throttled with the existing
  public counters, and it fails closed. It emails the owner at `CONTACT_EMAIL` the reply address and the
  choice answers. Free text is counted but never copied into the email, because it has not been through an
  engagement's anonymiser. With no contact address or provider it answers 503 and the sheet says so; nothing
  is ever reported as received when it was not.

## Not decided here

Automatic creation of the organisation, team and referent with the answers attached, and the sign-in link in
the reply. That needs the owner to approve a database change (a table for unattached requests or a tenant
provisioning function) and a retention rule. Until then the owner opens the space by hand with the existing
"Open my space" flow (ADR 0052) after reading the request. The sheet copy says "we contact you", not "we sent a
link".

## Alternatives

- Paste the mockup HTML into a route: rejected (no i18n, no tokens, no tests, not accessible).
- Route group `(site)` for all other pages so only `/` has no chrome: rejected for now, it moves files that
  TASK-AF is editing.
- Store the lead in a new table now: rejected, production migration, owner decision.

## Consequences

- The front page needs `CONTACT_EMAIL` and an email provider in production for the send step to work.
- `/` is dynamic (reads the session for the signed-in header) but reads no tenant data.
- The old front-page copy (`welcome.*`) is unused on `/` and stays for the redirects and metadata title.
