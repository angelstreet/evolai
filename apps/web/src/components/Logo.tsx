import type { CSSProperties } from 'react';

/**
 * EvolAI logo and wordmark component, drawn from the brand kit (apps/web/public/brand/kit, 01_Logos).
 *
 * Renders the Adaptive Steps symbol (three ascending steps, apricot → blue → teal)
 * plus the "EvolAI" wordmark with "AI" highlighted in the brand teal.
 *
 * Two sizes:
 *   - default  (28px icon + text-lg wordmark) for the top navigation
 *   - "hero"   (64px icon + text-2xl wordmark) for the about / landing pages
 *
 * The icon is drawn from the brand kit palette (amber, blue, teal, deep navy tokens).
 * The wordmark uses the same navy with the "AI" portion rendered in teal.
 */

interface LogoProps {
  size?: 'default' | 'menu' | 'hero';
  /**
   * If `true`, render only the icon (no wordmark). Useful for favicons or compact
   * navigation in the future.
   */
  iconOnly?: boolean;
  className?: string;
  style?: CSSProperties;
}

const ICON_SIZES = {
  default: 28,
  menu: 32,
  hero: 64,
} as const;

const WORDMARK_SIZES = {
  default: '--text-lg',
  menu: '--text-xl',
  hero: '--text-2xl',
} as const;

// Colours come from the design tokens (packages/ui/src/tokens.css, ADR 0025).
const AMBER = 'var(--color-amber)';
const BLUE = 'var(--color-blue)';
const TEAL = 'var(--color-teal)';
// Teal text on white fails 4.5:1; the wordmark uses the teal-ink text tone (ADR 0025).
const TEAL_INK = 'var(--color-accent-ink)';
// Wordmark follows the text colour so it reads in light and dark (ADR 0034).
const NAVY = 'var(--color-fg)';

export function Logo({ size = 'default', iconOnly = false, className, style }: LogoProps) {
  const iconSize = ICON_SIZES[size];
  const wordmarkSize = WORDMARK_SIZES[size];
  return (
    <span
      data-testid={iconOnly ? 'brand-symbol' : 'brand-logo'}
      className={['brand', className].filter(Boolean).join(' ')}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: iconSize * 0.4,
        color: NAVY,
        fontWeight: 700,
        fontSize: `var(${wordmarkSize})`,
        lineHeight: 1,
        letterSpacing: '-0.01em',
        fontFamily: 'var(--font-sans)',
        ...style,
      }}
    >
      <svg
        viewBox="8 30 166 113"
        width={Math.round(iconSize * 1.47)}
        height={iconSize}
        aria-hidden="true"
        focusable="false"
      >
        <path d="M 8 131 L 8 112 Q 8 100 20 100 H 49 V 116 Q 49 143 22 143 H 8 Z" fill={AMBER} />
        <path d="M 59 140 V 82 Q 59 68 73 68 H 109 V 99 Q 109 140 70 140 Z" fill={BLUE} />
        <path d="M 119 139 V 46 Q 119 30 135 30 H 174 V 98 Q 174 139 133 139 Z" fill={TEAL} />
      </svg>
      {!iconOnly && (
        <span style={{ whiteSpace: 'nowrap' }}>
          Evol<span style={{ color: TEAL_INK }}>AI</span>
        </span>
      )}
    </span>
  );
}
