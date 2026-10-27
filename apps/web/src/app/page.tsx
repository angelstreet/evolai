import { PILOT_QUESTIONNAIRE, LEARN_VIDEOS } from '@evolai/contracts';
import Cockpit, { type CockpitQuestion, type Viewer } from '@/components/chrome/cockpit/Cockpit';
import { getSession } from '@/lib/authServer';
import { getT } from '@/lib/i18n';
import { effectiveContext } from '@/lib/tenantAccess';

export const dynamic = 'force-dynamic';

export function generateMetadata() {
  return { title: getT().t('meta.pages.welcome') };
}

/**
 * Front page (TASK-AH, docs/mockups/front-page-stage-tabs.html): the cockpit. Open by default
 * (ADR 0051): the page reads no tenant data; the signed-in header only needs the session.
 */
export default async function FrontPage() {
  const { t, locale } = getT();
  const q = PILOT_QUESTIONNAIRE;
  const questions: CockpitQuestion[] = q.questions.map((question) => ({
    code: question.code,
    kind: question.kind === 'short_text' ? 'text' : 'choice',
    prompt: question.prompt[locale],
    helper: question.helper?.[locale] ?? null,
    options: (question.options ?? []).map((o) => o.label[locale]),
    why: t(`learn.questions.${question.code}.why` as never),
  }));
  const videos = Array.from({ length: 10 }, (_, i) => {
    const slot = LEARN_VIDEOS.find((v) => v.id === `slot-${i + 1}`);
    return { youtubeId: slot?.youtubeId || null, title: slot?.title[locale] ?? '' };
  });
  const session = await getSession();
  let viewer: Viewer = { kind: 'anon' };
  if (session) {
    const name = session.name || '';
    viewer =
      effectiveContext(session).kind === 'client'
        ? { kind: 'referent', name }
        : { kind: 'staff', name };
  }
  return (
    <Cockpit
      questions={questions}
      freeTextHint={q.freeTextHint[locale]}
      freeTextMax={q.freeTextMaxLength}
      videos={videos}
      viewer={viewer}
    />
  );
}
