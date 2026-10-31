# ADR 0063: Fixes from the review of the real pilot set-up

Date: 2026-10-31. Status: accepted. Builds on ADR 0040, 0052, 0059 and 0062.

## Context

The first real pilot mission was set up on the live site (four teams, dates, privacy notice, names to hide;
nothing about the client is in this repository). A worker then played the referent: the public pages live,
and the whole journey on a local copy with the same set-up. It found a crash on the Team tab, answers
accepted before the opening day, the template name where the mission name belongs, a publish block that does
not say which name blocks it, a referent review with titles only, "1.5 heure" in French, an unnumbered findings
list that the summary's "Sources" refer to by number, and gaps in the privacy page.

## Decision

- **'use server' files export only async functions.** Two of them exported a constant (the Team tab and the
  names-to-hide list); Next.js refuses it at run time and the page crashes. The constants moved to a sibling
  `state.ts`; a unit test scans every 'use server' file under `app/`.
- **Nothing opens before the opening day.** A team address refuses a new invitation while `opens_at` is in the
  future and says "The survey is not open yet. It opens on …". The referent's home shows "Opens on …" and no
  reminder hint until then.
- **Mission name first.** The referent's home shows the mission name, the template name only when none is set.
- **The publish block names the name.** `contains_name` carries the term and the sentence it sits in, on the
  publish message and on the preview.
- **The referent reads the sentence.** Review items carry the approved statement, the same sentence the report
  will carry; still no evidence, answer or note (this widens ADR 0059).
- **Numbers in plurals follow the locale** ("1,5 heure"); the findings list is numbered and each item has an
  anchor.
- **Privacy page.** It always has an AI section: the approved service when AI is on, otherwise "No AI service
  analyses your answers". It says EvolAI handles the answers for the organisation, adds the right to complain
  to the CNIL, drops "no name is kept", and the done page sends deletion requests to the privacy form, not to
  the person who invited.
- **Copy.** The welcome text says any question can be skipped (true since ADR 0062).

## Alternatives

- Allow answers before the opening day and only warn the referent: rejected, an early answer from a test
  would count in the results.
- A generic line on transfers outside the EU: rejected, it would be wrong for providers that are not American.
  The pilot's provider entries say it themselves.

## Consequences

- An auditor who wants to try the survey before the opening day sets the opening day to today, or tests on a
  synthetic mission.
- The referent can see the wording of a finding before publication; the wording is already approved and
  client-facing, so nothing new leaks.
- Still open for the pilot: a contact address in the notice and the referent's real login (facts only the owner
  has), the learn-page videos, a native French read.
