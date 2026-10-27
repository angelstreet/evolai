# ADR 0055: Front page answers are sent after sign-in

Date: 2026-10-27. Status: accepted. Replaces the send step of ADR 0053; keeps ADR 0051 (open by default,
sign-in last) and ADR 0052 (one address per team).

## Context

ADR 0053 ended the front page survey with a one-field email form: the answers were emailed to the owner and
attached to nothing. The owner decided that the answers stay in the browser until the person signs in, and
that the end of the survey shows a sign-in step.

## Decision

- Signed out, the last step is a dialog: the answers stay in this browser; the one action is Sign in. It
  opens `/login?next=/?send=1`; the login route accepts exactly that path, so the person comes back to the
  front page and the dialog opens again. Nothing is sent and nothing is stored on the server before that.
- Signed in as a team referent, Send posts the browser's answers to `POST /api/send`. The server takes the
  tenant and the teams from the session only; a slug in the request only selects among those teams (two or
  more: the dialog asks which). It opens the team address as a fresh browser would (ADR 0052): a new
  anonymous invitation with a random pseudonym, the answers written through the same path as the survey
  pages (free text anonymised, missing answers recorded as skips), then submitted. Nothing in the stored
  response refers to the account.
- Staff accounts and the owner's view-as get a message and nothing is written. The browser keeps a `sent`
  flag; the page then shows "Answers sent" instead of a second Send.
- The email form, `lib/sendRequest.ts` and its owner email are removed.

## Alternatives

- Keep the email form: rejected by the owner.
- Store the answers under the account: breaks the anonymity the survey promises (PRD §15).
- Ask for the team address instead of a sign-in: team members have no account; that path stays the team
  address itself (`/s/<slug>`).

## Consequences

A visitor with no account can read and answer but not send; a prospect has no form on the page any more.
A referent who sends twice from two browsers counts twice, as two fresh browsers on a team address already
do (ADR 0052).
