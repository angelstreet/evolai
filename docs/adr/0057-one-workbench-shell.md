# ADR 0057: One Workbench shell for the whole app

Date: 2026-10-27. Status: accepted. Builds on ADR 0051 (open by default), 0052 (one address per team),
0055 and 0056 (front page send and progress).

## Context

After TASK-AH the front page was a Workbench (side menu, header, cards) while the team survey, the referent
space and admin still used the shared header and old layouts. Lessons existed twice. A referent's sign-in
landed on `/client`, away from the front page, and a visitor without an account could no longer ask for an
audit once the email form went (ADR 0055).

## Decision

- One look: `/s/*` (team survey), `/client` (referent space) and `/admin` draw the Workbench header; the
  shared header and footer remain only for the other pages. The referent space and admin share one
  server component, `WorkbenchShell` (side menu, header with where you are, FR | EN, theme, account, the
  view-as banner). The team survey has no side menu: a team member has one task there.
- The survey question is the front page's Try it card: pick, then Next saves; Previous and the progress
  segments go back. The write path is unchanged (invitation token, `/api/answer`, `/api/skip`).
- One set of lessons: `/learn/*` redirect to `/?learn=n`; `/?survey=1` opens the survey.
- A referent's sign-in lands on the front page, which names their team and links to their space. The
  front page reads team names only for a signed-in referent, scoped by the session.
- Ask for an audit: one email field; the server accepts it only with the right shape and a domain that
  takes mail (MX, else an address record; `.invalid` never). Asking again is fine; the public limit
  (3 per address, 10 per network, per hour) stops bursts. Each request is emailed to the owner; no account.
  If DNS cannot answer, the request is refused as unavailable, never blamed on the visitor.

## Alternatives

- Keep the old layouts and restyle them one by one: three looks for one product.
- Put the side menu on the team survey: it would send team members away from their one task.
- No email check, or a confirmation email: the owner asked for a valid email, not a double opt-in.

## Consequences

`ClientTabs` is gone; admin's tabs are a side menu (a bottom bar below 860 px). Tests sign in with
`next=/client` when they start in the space.
