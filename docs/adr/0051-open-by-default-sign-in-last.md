# ADR 0051 — Open by default: sign-in is the last step, not the gate

Date: 2026-10-27. Status: accepted (owner decision).

## Decision

EvolAI is an open-source tool. Everything a visitor needs to understand and try the audit is public,
with no account:

- what we do and how (the journey Understand → Adapt → Evolve),
- the lessons and knowledge base (`/learn`, five pages, ten video slots),
- the resource materials,
- the ten survey questions, word for word,
- **filling the survey in the browser**.

Sign-in (or an email step) is asked **only** when the visitor wants to **send** the survey and **start
the audit** for their organisation. Onboarding is therefore near-instant: land → explore → answer →
"Send and start your audit" → sign in → done.

Consequences:

- "Sign in" is never a navigation item on the public pages. It is the final call to action of the
  survey. The auditor's working space (`/admin`) stays behind sign-in and is reached by a discreet
  "Auditor sign-in" link at the bottom of the page, never a top-bar button.
- The front page becomes a cockpit (reference: https://learn-esp32.vercel.app): one screen with a
  tab rail, a central interactive panel, a side panel and a lesson strip, rather than a brochure.
  Five mockups are being produced (2026-10-27) and one will be picked by the owner.
- The survey a visitor fills without an account is kept in the browser only until the send step; at
  send, the organisation and team are created from the sign-in and the answers attached (TASK-AF's
  one-address-per-team model then takes over for the rest of the team).

## Supersedes

The "Sign in" / "Contact us" front page of ADR 0049's round and the sign-in-first referent path of
ADR 0040 for clients. Staff sign-in and `/set-password` are unchanged.
