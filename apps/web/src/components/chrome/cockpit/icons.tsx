import type { ReactNode } from 'react';

/** Inline 24px line icons for the cockpit rail and controls; stroke follows the text colour. */
const line = (d: ReactNode): ReactNode => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
    {d}
  </svg>
);

export const RAIL_ICONS: Record<string, ReactNode> = {
  home: line(<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" />),
  journey: line(
    <>
      <circle cx="5" cy="17" r="2.5" />
      <circle cx="12" cy="10" r="2.5" />
      <circle cx="19" cy="5" r="2.5" />
      <path d="M7 15.5l3-3.5M14 8.5l3-2" />
    </>,
  ),
  learn: line(
    <path d="M4 5h6a2 2 0 012 2v12a2 2 0 00-2-2H4zM20 5h-6a2 2 0 00-2 2v12a2 2 0 012-2h6z" />,
  ),
  questions: line(
    <>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <circle cx="4.5" cy="6" r="1" />
      <circle cx="4.5" cy="12" r="1" />
      <circle cx="4.5" cy="18" r="1" />
    </>,
  ),
  survey: line(
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </>,
  ),
  materials: line(
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M10 9.5l4.5 2.5-4.5 2.5z" />
    </>,
  ),
  progress: line(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.7 2.7L16 9.8" />
    </>,
  ),
  lang: line(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" />
    </>,
  ),
};

export const CHECK = (
  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M2.5 6.2l2.3 2.3 4.7-5" />
  </svg>
);
export const PLAY = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M10 8.5l5 3.5-5 3.5z" />
  </svg>
);
export const ARROW_LEFT = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M15 6l-6 6 6 6" />
  </svg>
);
export const ARROW_RIGHT = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M9 6l6 6-6 6" />
  </svg>
);

/** The Understand / Adapt / Evolve step glyphs: one, two, three bars (apricot, blue, teal). */
export const STEP_GLYPHS: ReactNode[] = [
  <svg key="1" viewBox="0 0 40 40" aria-hidden="true">
    <rect x="8" y="22" width="24" height="10" rx="2" fill="var(--color-amber)" />
  </svg>,
  <svg key="2" viewBox="0 0 40 40" aria-hidden="true">
    <rect x="8" y="22" width="11" height="10" rx="2" fill="var(--color-amber)" />
    <rect x="21" y="14" width="11" height="18" rx="2" fill="var(--color-blue)" />
  </svg>,
  <svg key="3" viewBox="0 0 40 40" aria-hidden="true">
    <rect x="5" y="24" width="8" height="8" rx="2" fill="var(--color-amber)" />
    <rect x="16" y="17" width="8" height="15" rx="2" fill="var(--color-blue)" />
    <rect x="27" y="9" width="8" height="23" rx="2" fill="var(--color-teal)" />
  </svg>,
];

export const ARROW_ICONS = { left: ARROW_LEFT, right: ARROW_RIGHT };
