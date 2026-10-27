import type { ReactNode } from 'react';

/**
 * A Workbench card (TASK-AI): the front page's card with its title band (icon, title, an optional
 * count or status on the right) and a padded body. Used inside the referent space so the look
 * carries through from the front page.
 */
export default function WorkCard({
  icon,
  title,
  aside,
  children,
  'data-testid': testId,
  headingId,
}: {
  icon?: ReactNode;
  title: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  'data-testid'?: string;
  headingId?: string;
}) {
  return (
    <section className="ck-card ck-try ck-work" aria-labelledby={headingId} data-testid={testId}>
      <div className="ck-try-head">
        <h2 id={headingId}>
          {icon}
          <span>{title}</span>
        </h2>
        {aside}
      </div>
      <div className="ck-try-body">{children}</div>
    </section>
  );
}
