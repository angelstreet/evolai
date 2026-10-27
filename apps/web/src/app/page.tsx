import { PILOT_QUESTIONNAIRE, LEARN_VIDEOS } from '@evolai/contracts';
import Cockpit, { type CockpitQuestion, type Viewer } from '@/components/chrome/cockpit/Cockpit';
import { getSession } from '@/lib/authServer';
import { loadIdentity } from '@/components/chrome/SiteHeader';
import { getT } from '@/lib/i18n';
import { loadTeamNames } from '@/lib/clientData';
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
  if (session) {
    const name = session.name || '';
    const ctx = effectiveContext(session);
    // A referent sees their own team names and a link to their space (TASK-AI L5).
    viewer =
      ctx.kind === 'client'
        ? { kind: 'referent', name, teams: await loadTeamNames(ctx.tenantId, ctx.teamIds) }
        : { kind: 'staff', name };
  }
  return (
    <Cockpit
      questions={questions}
      freeTextHint={q.freeTextHint[locale]}
      freeTextMax={q.freeTextMaxLength}
      videos={videos}
      viewer={viewer}
      identity={await loadIdentity()}
    />
  );
}
