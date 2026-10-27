import { AppIcon, type IconName } from '@evolai/ui';
import { formatDate, type SupportedLocale, type Translator } from '@evolai/i18n';
import PrivacyNotice from '@/components/respondent/PrivacyNotice';
import ProgressBar from '@/components/ProgressBar';
import { CHECK, EDIT } from '@/components/chrome/cockpit/icons';
import type { TeamProgress } from '@/lib/respondent';

interface Props {
  /** For the privacy notice: opens the organisation's details and the request form. */
  engagementId: string;
  title: string;
  team: TeamProgress;
  locale: SupportedLocale;
  t: Translator;
}

/** "1 November" / "1er novembre": French writes the first of the month as an ordinal. */
const dayMonth = (locale: SupportedLocale, iso: string): string => {
  const text = formatDate(locale, iso, { day: 'numeric', month: 'long' });
  return locale === 'fr' ? text.replace(/^1 /, '1er ') : text;
};

const nextStep = (team: TeamProgress, locale: SupportedLocale, t: Translator): string => {
  switch (team.engagementStatus) {
    case 'analysis':
    case 'review':
      return t('survey.nextClosed');
    case 'closed':
    case 'archived':
      return t('survey.nextDone');
    default:
      return team.closesAt
        ? t('survey.nextOpenUntil', { date: dayMonth(locale, team.closesAt) })
        : t('survey.nextOpen');
  }
};

/**
 * "How is my team doing, what happens next" (done page and return visit). One glance: the team
 * answer count and one sentence on the next step; the page ends calm, no quiz (TASK-AD2). Counts only, never
 * names or answers (PRD §4.3, §15).
 */
export default function RespondentStatus({ engagementId, title, team, locale, t }: Props) {
  const steps: ReadonlyArray<{ icon: IconName; text: string }> = [
    { icon: 'success', text: t('survey.nextSaved') },
    { icon: 'time', text: nextStep(team, locale, t) },
    { icon: 'lock', text: t('survey.keepLink') },
  ];
  const teamLine = t('survey.teamProgress', { done: team.answered, total: team.invited });
  return (
    <section className="ck-card ck-try" aria-labelledby="status-title" data-testid="survey-status">
      <div className="ck-try-head">
        <h2>
          {EDIT}
          <span>{t('cockpit.menu.survey')}</span>
        </h2>
        <span className="ck-status done">
          {CHECK}
          {t('cockpit.path.done')}
        </span>
      </div>
      <div className="ck-try-body ck-status-body">
        <h1 id="status-title" className="ck-q">
          {title}
        </h1>

        <section className="ck-sub" aria-labelledby="team-title">
          <h2 id="team-title" className="ck-sub-h">
            <AppIcon name="team" />
            {t('survey.teamHeading')}
          </h2>
          <p className="ck-sub-strong">{teamLine}</p>
          <ProgressBar
            current={team.answered}
            total={team.invited}
            ariaLabel={t('survey.teamProgressAria')}
            valueText={teamLine}
          />
        </section>

        <section className="ck-sub" aria-labelledby="next-title">
          <h2 id="next-title" className="ck-sub-h">
            {t('survey.nextHeading')}
          </h2>
          <ol className="ck-next-list">
            {steps.map((step) => (
              <li key={step.icon}>
                <AppIcon name={step.icon} />
                <span>{step.text}</span>
              </li>
            ))}
          </ol>
          <p className="ck-muted ck-small ck-mt">
            {team.contact
              ? t('survey.contactWith', { contact: team.contact })
              : t('survey.contactNone')}
          </p>
        </section>

        <section className="ck-sub ck-tip" aria-labelledby="tip-title">
          <h2 id="tip-title" className="ck-sub-h">
            {t('survey.tipHeading')}
          </h2>
          <p className="ck-muted ck-small">{t('survey.tip')}</p>
        </section>
        <PrivacyNotice t={t} engagementId={engagementId} />
      </div>
    </section>
  );
}
