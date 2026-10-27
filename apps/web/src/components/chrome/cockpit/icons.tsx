import type { ReactNode } from 'react';

/** Inline 24px line icons for the cockpit menu and cards; stroke follows the text colour. */
const line = (d: ReactNode): ReactNode => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
    {d}
  </svg>
);

export const MENU_ICONS: Record<string, ReactNode> = {
  home: line(<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />),
  learn: line(
    <path d="M3 5a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v15a2 2 0 0 0-2-2H3zM21 5a2 2 0 0 0-2-2h-5a2 2 0 0 0-2 2v15a2 2 0 0 1 2-2h7z" />,
  ),
  videos: line(
    <>
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="M16 10l5-3v10l-5-3" />
    </>,
  ),
  survey: line(
    <>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" />
    </>,
  ),
  settings: line(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
    </>,
  ),
  results: line(<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />),
  report: line(
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M14 3v5h5M9 17v-3M12 17v-6M15 17v-4" />
    </>,
  ),
};

export const TILE_ICONS: Record<string, ReactNode> = {
  eye: line(
    <>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>,
  ),
  target: line(
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </>,
  ),
  route: line(
    <>
      <circle cx="6" cy="19" r="2" />
      <circle cx="18" cy="5" r="2" />
      <path d="M8 19h8a3 3 0 0 0 0-6H8a3 3 0 0 1 0-6h8" />
    </>,
  ),
};

export const EDIT = line(
  <>
    <path d="M4 20h4L19 9l-4-4L4 16z" />
    <path d="M13 7l4 4" />
  </>,
);
export const SHIELD = line(<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />);
export const CHECK = line(<path d="M5 12l4 4 10-10" />);
export const CIRCLE = line(<circle cx="12" cy="12" r="8" />);
export const DOT = line(
  <>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3" fill="currentColor" />
  </>,
);
export const LOCK = line(
  <>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </>,
);
export const PLAY = line(<path d="M8 5l11 7-11 7z" />);
export const ARROW_LEFT = line(<path d="M15 6l-6 6 6 6" />);
export const ARROW_RIGHT = line(<path d="M9 6l6 6-6 6" />);
export const CHEVRON_RIGHT = ARROW_RIGHT;

/** Line-art for the side card: sun, ridge, route arrow (apricot, teal). */
export const SIDE_ART = (
  <svg
    viewBox="0 0 200 90"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="160" cy="24" r="12" fill="var(--color-amber)" />
    <path
      d="M0 86 L40 58 L70 76 L110 34 L150 70 L200 50"
      stroke="var(--color-teal)"
      strokeWidth="2.5"
    />
    <path d="M110 34 V14 l12 5 -12 5" stroke="var(--color-teal)" strokeWidth="2.5" />
  </svg>
);

/** Video slot backdrop. */
export const VIDEO_ART = (
  <svg
    viewBox="0 0 700 300"
    preserveAspectRatio="xMidYMid slice"
    fill="none"
    aria-hidden="true"
    className="bg"
  >
    <circle cx="590" cy="70" r="34" fill="var(--color-amber)" opacity=".5" />
    <path
      d="M0 260 L120 190 L220 240 L360 120 L470 220 L560 170 L700 250"
      stroke="var(--color-teal)"
      strokeWidth="3"
      opacity=".5"
    />
    <path
      d="M0 290 L160 240 L300 280 L460 210 L700 290"
      stroke="var(--color-blue)"
      strokeWidth="3"
      opacity=".35"
    />
  </svg>
);
