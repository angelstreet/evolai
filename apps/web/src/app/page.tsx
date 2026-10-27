import { PILOT_QUESTIONNAIRE, LEARN_VIDEOS } from '@evolai/contracts';
import Cockpit, {
  type CockpitQuestion,
  type OwnReport,
  type Viewer,
} from '@/components/chrome/cockpit/Cockpit';
import { getSession } from '@/lib/authServer';
import { loadIdentity } from '@/components/chrome/SiteHeader';
import { getT } from '@/lib/i18n';
import type { TenantId } from '@evolai/contracts';
import { loadClientSurvey, loadTeamNames } from '@/lib/clientData';
import { loadPublishedReport } from '@/lib/reportData';
import { effectiveContext } from '@/lib/tenantAccess';

export const dynamic = 'force-dynamic';

export function generateMetadata() {
  return { title: getT().t('meta.pages.welcome') };
}

/**
 * Front page (TASK-AH, docs/mockups/glowup-c-workbench.html): the cockpit. Open by default
 * (ADR 0051): signed out, the page reads no tenant data; a signed-in referent also gets their own
 * team names, scoped by the session (TASK-AI L5).
 */
const HORIZON_DAYS = { d30: 30, d60: 60, d90: 90 } as const;

const loadOwnReport = async (
  tenantId: string,
  teamIds: readonly string[],
  locale: 'fr' | 'en',
): Promise<OwnReport | null> => {
  const survey = await loadClientSurvey(tenantId, teamIds);
  if (!survey) return null;
  const published = await loadPublishedReport(tenantId as TenantId, survey.engagementId);
  if (!published) return null;
  const r = published.snapshot;
  const days = (h: keyof typeof HORIZON_DAYS) =>
    locale === 'fr' ? `${HORIZON_DAYS[h]} jours` : `${HORIZON_DAYS[h]} days`;
  const fromPlan = (['d30', 'd60', 'd90'] as const)
    .map((h) => r.plan.find((p) => p.horizon === h))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map((p) => ({ when: days(p.horizon), text: p.text, owner: p.owner }));
  const actions =
    fromPlan.length > 0
      ? fromPlan
      : r.steps.slice(0, 3).map((s) => ({ when: days(s.horizon), text: s.title, owner: s.owner }));
  return {
    title: r.title,
    publishedAt: r.publishedAt,
    score: r.readiness.overall?.overall ?? null,
    summary: r.summary.length > 280 ? `${r.summary.slice(0, 277)}…` : r.summary,
    actions,
  };
};

export default async function FrontPage() {
  const { locale } = getT();
  const q = PILOT_QUESTIONNAIRE;
  const questions: CockpitQuestion[] = q.questions.map((question) => ({
    code: question.code,
    kind: question.kind === 'short_text' ? 'text' : 'choice',
    prompt: question.prompt[locale],
    helper: question.helper?.[locale] ?? null,
    options: (question.options ?? []).map((o) => o.label[locale]),
  }));
  const videos = Array.from({ length: 10 }, (_, i) => {
    const slot = LEARN_VIDEOS.find((v) => v.id === `slot-${i + 1}`);
    return { youtubeId: slot?.youtubeId || null, title: slot?.title[locale] ?? '' };
  });
  const session = await getSession();
  let viewer: Viewer = { kind: 'anon' };
  let ownReport: OwnReport | null = null;
  if (session) {
    const name = session.name || '';
    const ctx = effectiveContext(session);
    // A referent sees their own team names and a link to their space (TASK-AI L5).
    viewer =
      ctx.kind === 'client'
        ? { kind: 'referent', name, teams: await loadTeamNames(ctx.tenantId, ctx.teamIds) }
        : { kind: 'staff', name };
    // Their own published report replaces the Demo Client sample (TASK-AI), tenant and teams
    // from the session only; a draft is never shown.
    if (ctx.kind === 'client') ownReport = await loadOwnReport(ctx.tenantId, ctx.teamIds, locale);
  }
  return (
    <Cockpit
      questions={questions}
      freeTextHint={q.freeTextHint[locale]}
      freeTextMax={q.freeTextMaxLength}
      videos={videos}
      viewer={viewer}
      identity={await loadIdentity()}
      ownReport={ownReport}
    />
  );
}
