import Link from 'next/link';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { getT } from '@/lib/i18n';
import { MIN_GROUP_SIZE } from '@/lib/invitationTracking';
import { getPublicNotice } from '@/lib/privacyNotice';
import { aroundLink } from '@/lib/richText';
import PrivacyRequestForm from './PrivacyRequestForm';

export const dynamic = 'force-dynamic';

export function generateMetadata() {
  return { title: getT().t('meta.pages.privacy') };
}

/**
 * Public privacy notice (TASK-U, ADR 0040). Fixed parts are the same for everyone; the parts that
 * depend on the organisation come from the engagement the visitor arrived from (`?e=`) and are
 * left out until configured, with a line saying who to ask. Holds no tenant data beyond what the
 * organisation chose to publish.
 */
export default async function PrivacyPage({ searchParams }: { searchParams: { e?: string } }) {
  const { t } = getT();
  const engagementId = typeof searchParams.e === 'string' ? searchParams.e : '';
  const found = engagementId ? await getPublicNotice(engagementId) : null;
  const n = found?.notice ?? null;
  const [before, after] = aroundLink((vars) => t('privacy.seeAbout', vars));
  const Section = ({
    title,
    children,
    id,
  }: {
    title: string;
    children: React.ReactNode;
    id?: string;
  }) => (
    <Paper
      variant="outlined"
      component="section"
      id={id}
      sx={{ p: 4, borderRadius: 3, mb: 4, scrollMarginTop: 96 }}
    >
      <Typography variant="sectionTitle" component="h2" sx={{ mb: 2 }}>
        {title}
      </Typography>
      {children}
    </Paper>
  );
  return (
    <section aria-labelledby="privacy-title">
      <h1 id="privacy-title">{t('trust.notice.title')}</h1>
      <p>{t('trust.notice.intro')}</p>
      <p data-testid="privacy-one-line">{t('survey.privacyShort')}</p>

      {n ? (
        <Section title={t('trust.notice.whoTitle')}>
          <p>{t('trust.notice.whoBody', { org: n.controller })}</p>
          {n.contact ? <p>{t('trust.notice.contactLine', { contact: n.contact })}</p> : null}
        </Section>
      ) : null}

      <Section title={t('trust.notice.purposeTitle')}>
        <p>{n?.purpose ?? t('trust.notice.defaultPurpose')}</p>
      </Section>

      <Section title={t('trust.notice.basisTitle')}>
        <p>{t(`trust.notice.basis.${n?.basis ?? 'consent'}`)}</p>
      </Section>

      <Section title={t('trust.notice.collectedTitle')}>
        <p>{t('trust.notice.collected')}</p>
        <p>{t('trust.notice.addressNote')}</p>
        <Typography variant="sectionTitle" component="h3" sx={{ mt: 3, mb: 1 }}>
          {t('trust.notice.notCollectedTitle')}
        </Typography>
        <p>{t('trust.notice.notCollected')}</p>
      </Section>

      <Section title={t('trust.notice.seesTitle')}>
        <ul>
          <li>{t('trust.notice.seesAuditor')}</li>
          <li>{t('trust.notice.seesReferent')}</li>
          <li>{t('trust.notice.seesSponsor', { n: MIN_GROUP_SIZE })}</li>
        </ul>
      </Section>

      {n?.retentionDays != null ? (
        <Section title={t('trust.notice.retentionTitle')}>
          <p>{t('trust.notice.retention', { days: n.retentionDays })}</p>
        </Section>
      ) : null}

      {n && (n.region || n.providers.length > 0) ? (
        <Section title={t('trust.notice.hostingTitle')}>
          {n.region ? <p>{t('trust.notice.hosting', { region: n.region })}</p> : null}
          {n.providers.length > 0 ? (
            <p>{t('trust.notice.providers', { list: n.providers.join(', ') })}</p>
          ) : null}
        </Section>
      ) : null}

      {n ? (
        <Section title={t('trust.notice.aiTitle')}>
          <p>
            {n.aiRoute
              ? t('trust.notice.ai', { route: n.aiRoute })
              : n.gaps.includes('ai')
                ? t('trust.notice.hiddenNote')
                : t('trust.notice.aiOff')}
          </p>
        </Section>
      ) : null}

      <Section title={t('trust.notice.rightsTitle')}>
        <p>{t('trust.notice.rights')}</p>
        {n && n.gaps.some((g) => g !== 'ai') ? (
          <p className="muted" data-testid="notice-gap">
            {t('trust.notice.hiddenNote')}
          </p>
        ) : null}
      </Section>

      <Section id="request" title={t('trust.notice.requestTitle')}>
        {found ? (
          <>
            <p>{t('trust.notice.requestIntro')}</p>
            <PrivacyRequestForm engagementId={engagementId} />
          </>
        ) : (
          <p>{t('trust.notice.openFromInvite')}</p>
        )}
      </Section>

      <p>
        {before}
        <Link href="/welcome">{t('privacy.aboutLink')}</Link>
        {after}
      </p>
    </section>
  );
}
