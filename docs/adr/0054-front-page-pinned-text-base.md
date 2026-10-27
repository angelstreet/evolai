# ADR 0054: Front page text base pinned to 16 px

Date: 2026-10-27. Status: accepted. Refines ADR 0053 (front page cockpit) and ADR 0025 (design tokens).

## Context

The type tokens are in `rem`, so every page follows the browser's font-size setting. The Workbench mockup
(`docs/mockups/glowup-c-workbench.html`), the contract of TASK-AH, is written in `px`. In a browser whose font
setting is above the default, the live front page showed its text about 20% larger than the mockup in the same
browser, while boxes kept their size. The owner wants the front page to look exactly like the mockup in the same
browser.

## Decision

On the front page only, `html:has(.ck)` sets the root font size to 16 px (`app/cockpit.css`). Every `rem`
there, including the MUI controls, then resolves as in the mockup. Other routes are unchanged.

## Alternatives

- Keep `rem` and accept the difference: rejected by the owner; the mockup is the contract.
- Rewrite the cockpit in `px`: same result, but a second set of sizes next to the tokens.
- Pin the root on every page: wider than asked; the rest of the app keeps the user's setting.

## Consequences

The browser's font-size setting no longer scales the front page; browser zoom still does (WCAG 1.4.4 is met by
zoom). Any later front-page mockup is compared at that 16 px base.
