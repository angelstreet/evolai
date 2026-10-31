'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  day90StatusSchema,
  horizonSchema,
  improvementCategorySchema,
  levelSchema,
  type PlanItem,
} from '@evolai/contracts';
import { createTranslator } from '@evolai/i18n';
import { resolveActor } from '@/lib/authServer';
import { isUuid } from '@/lib/invitationForm';
import { MIN_GROUP_SIZE } from '@/lib/invitationTracking';
import { draftSummary, methodologyNote, type MethodWords } from '@/lib/reportModel';
import {
  ReportError,
  addStep,
  createReport,
  generatePlan,
  loadReportForEngagement,
  loadReportInputs,
  loadReportLocale,
  rankForScreen,
  publishReport,
  savePlan,
  setReviewState,
  setStepMeasure,
  setStepStatus,
  startNewVersion,
  suggestSteps,
  unpublishReport,
  updateSections,
  updateStep,
  applyAiDraft,
  type StepInput,
} from '@/lib/reportData';
import type { ReportActionState } from './state';

/**
 * Audit report actions (TASK-V, ADR 0041). The actor and tenant come from the session through
 * `resolveActor` (signed in, staff of that tenant, never inside a view-as); the form's tenant id is
 * only a selector. Each data-layer call writes its own audit row. Results are codes the page words.
 */

const codeOf = (err: unknown): string => {
  if (err instanceof ReportError) return err.code;
  console.error('report action failed', err instanceof Error ? err.name : 'unknown');
  return 'error';
};

/** Words of the generated method note, in the report language. */
const methodWords = (t: ReturnType<typeof createTranslator>): MethodWords => ({
  base: (v) => t('report.sections.methodBase', v),
  themes: (v) => t('report.sections.methodThemes', v),
  opportunities: (v) => t('report.sections.methodOpportunities', v),
  unreviewed: t('report.sections.methodUnreviewed'),
  visit: (v) => t('report.sections.methodVisit', v),
  disputed: (v) => t('report.sections.methodDisputed', v),
});

const str = (fd: FormData, k: string, max: number): string =>
  String(fd.get(k) ?? '')
    .trim()
    .slice(0, max);

const guard = async (fd: FormData) => {
  const tenantId = String(fd.get('tenantId') ?? '');
  const reportId = String(fd.get('reportId') ?? '');
  if (!isUuid(tenantId)) return null;
  const who = await resolveActor(tenantId);
  if (!who.ok) return null;
  return { ...who, reportId: isUuid(reportId) ? reportId : null };
};

const done = (): void => {
  revalidatePath('/admin/engagements', 'layout');
};

const run = async (
  fd: FormData,
  fn: (g: NonNullable<Awaited<ReturnType<typeof guard>>>) => Promise<ReportActionState>,
): Promise<ReportActionState> => {
  const g = await guard(fd);
  if (!g) return { ok: false, code: 'forbidden' };
  try {
    const out = await fn(g);
    done();
    return out;
  } catch (err) {
    const vars = err instanceof ReportError ? err.vars : undefined;
    return { ok: false, code: codeOf(err), ...(vars ? { vars } : {}) };
  }
};

export async function startReportAction(
  _prev: ReportActionState,
  fd: FormData,
): Promise<ReportActionState> {
  const engagementId = String(fd.get('engagementId') ?? '');
  const g = await guard(fd);
  if (!g || !isUuid(engagementId)) return { ok: false, code: 'forbidden' };
  try {
    const inputs = await loadReportInputs(g.tenantId, engagementId);
    if (!inputs) return { ok: false, code: 'not_found' };
    // Generated text is in the report language (the engagement's), not the auditor's screen language.
    const t = createTranslator(inputs.locale);
    await createReport(g.tenantId, g.actor, engagementId, {
      title: (audit) => t('report.list.startedTitle', { audit }),
      methodology: methodologyNote(
        {
          answered: inputs.answered,
          themes: inputs.findings.length,
          opportunities: 0,
          visit: inputs.visit,
          disputed: inputs.review.disputed,
          corrected: inputs.review.corrected,
        },
        MIN_GROUP_SIZE,
        methodWords(t),
      ),
    });
  } catch (err) {
    return { ok: false, code: codeOf(err) };
  }

  revalidatePath('/admin/engagements', 'layout');
  redirect(`/admin/engagements/${engagementId}/report?tenant=${g.tenantId}`);
}

export async function saveSectionsAction(
  _prev: ReportActionState,
  fd: FormData,
): Promise<ReportActionState> {
  return run(fd, async (g) => {
    if (!g.reportId) return { ok: false, code: 'not_found' };
    const title = str(fd, 'title', 200);
    if (!title) return { ok: false, code: 'bad_input' };
    await updateSections(g.tenantId, g.actor, g.reportId, {
      title,
      summary: str(fd, 'summary', 6000),
      summaryCitations: fd
        .getAll('citation')
        .map(String)
        .filter((c) => c.length > 0 && c.length <= 240)
        .slice(0, 30),
      risksNote: str(fd, 'risksNote', 6000),
      methodology: str(fd, 'methodology', 4000),
    });
    return { ok: true, code: 'saved' };
  });
}

/** Rule-based first draft of the summary, with its citations; replaces the summary text. */
export async function draftSummaryAction(
  _prev: ReportActionState,
  fd: FormData,
): Promise<ReportActionState> {
  return run(fd, async (g) => {
    const engagementId = String(fd.get('engagementId') ?? '');
    if (!g.reportId || !isUuid(engagementId)) return { ok: false, code: 'not_found' };
    const bundle = await loadReportForEngagement(g.tenantId, engagementId);
    if (!bundle || bundle.report.id !== g.reportId) return { ok: false, code: 'not_found' };
    const t = createTranslator(bundle.report.locale);
    const ranked = rankForScreen(bundle.inputs, bundle.steps).filter((o) =>
      bundle.steps.some((s) => s.opportunityId === o.id && s.status === 'accepted'),
    );
    const d = draftSummary(
      bundle.inputs.readiness,
      bundle.inputs.findings,
      ranked.map((o) => o.title),
      {
        intro: (v) => t('report.draft.intro', v),
        introNoScore: t('report.draft.introNoScore'),
        findings: (v) => t('report.draft.findings', v),
        opportunities: (v) => t('report.draft.opportunities', v),
        closing: t('report.draft.closing'),
        closingNoSteps: t('report.draft.closingNoSteps'),
        listSep: t('report.draft.listSep'),
        levelName: (l) => t(`report.readiness.level.${l as 'L0'}`).toLowerCase(),
      },
    );
    const r = bundle.report;
    await updateSections(g.tenantId, g.actor, g.reportId, {
      title: r.title,
      summary: d.text,
      summaryCitations: d.citations,
      risksNote: r.risksNote,
      methodology: methodologyNote(
        {
          answered: bundle.inputs.answered,
          themes: bundle.inputs.findings.length,
          // The actions the client will read: the accepted steps (dry run, 2026-10-29).
          opportunities: bundle.steps.filter((x) => x.status === 'accepted').length,
          visit: bundle.inputs.visit,
          disputed: bundle.inputs.review.disputed,
          corrected: bundle.inputs.review.corrected,
        },
        MIN_GROUP_SIZE,
        methodWords(t),
      ),
    });
    return { ok: true, code: 'saved' };
  });
}

export async function suggestAction(
  _prev: ReportActionState,
  fd: FormData,
): Promise<ReportActionState> {
  return run(fd, async (g) => {
    if (!g.reportId) return { ok: false, code: 'not_found' };
    const count = await suggestSteps(g.tenantId, g.actor, g.reportId);
    return { ok: true, code: 'suggested', count };
  });
}

const parseStep = (fd: FormData): StepInput | null => {
  const effort = levelSchema.safeParse(fd.get('effort'));
  const impact = levelSchema.safeParse(fd.get('impact'));
  const risk = levelSchema.safeParse(fd.get('risk'));
  const horizon = horizonSchema.safeParse(fd.get('horizon'));
  const title = str(fd, 'title', 200);
  if (!effort.success || !impact.success || !risk.success || !horizon.success || !title) {
    return null;
  }
  return {
    title,
    description: str(fd, 'description', 2000),
    effort: effort.data,
    impact: impact.data,
    risk: risk.data,
    owner: str(fd, 'owner', 120),
    horizon: horizon.data,
  };
};

export async function updateStepAction(
  _prev: ReportActionState,
  fd: FormData,
): Promise<ReportActionState> {
  return run(fd, async (g) => {
    const stepId = String(fd.get('stepId') ?? '');
    const step = parseStep(fd);
    if (!isUuid(stepId) || !step) return { ok: false, code: 'bad_input' };
    await updateStep(g.tenantId, g.actor, stepId, step);
    return { ok: true, code: 'saved' };
  });
}

/** Baseline and day-90 follow-up of an accepted action (TASK-AJ A9). Empty fields clear. */
export async function measureStepAction(
  _prev: ReportActionState,
  fd: FormData,
): Promise<ReportActionState> {
  return run(fd, async (g) => {
    const stepId = String(fd.get('stepId') ?? '');
    const rawValue = str(fd, 'baselineValue', 20).replace(',', '.');
    const value = rawValue === '' ? null : Number(rawValue);
    const rawAfter = str(fd, 'followUpValue', 20).replace(',', '.');
    const after = rawAfter === '' ? null : Number(rawAfter);
    const followUpOn = str(fd, 'followUpOn', 10);
    const status = str(fd, 'day90Status', 20);
    const day90 = status === '' ? null : day90StatusSchema.safeParse(status);
    if (
      !isUuid(stepId) ||
      (value !== null && (!Number.isFinite(value) || value < 0)) ||
      (after !== null && (!Number.isFinite(after) || after < 0)) ||
      (followUpOn !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(followUpOn)) ||
      (day90 !== null && !day90.success)
    ) {
      return { ok: false, code: 'bad_input' };
    }
    await setStepMeasure(g.tenantId, g.actor, stepId, {
      baselineValue: value,
      baselineUnit: str(fd, 'baselineUnit', 40),
      baselineSource: str(fd, 'baselineSource', 200),
      followUpOn: followUpOn || null,
      day90Status: day90?.success ? day90.data : null,
      ...(fd.has('followUpValue') ? { followUpValue: after } : {}),
    });
    return { ok: true, code: 'saved' };
  });
}

export async function decideStepAction(
  _prev: ReportActionState,
  fd: FormData,
): Promise<ReportActionState> {
  return run(fd, async (g) => {
    const stepId = String(fd.get('stepId') ?? '');
    const decision = String(fd.get('decision') ?? '');
    if (!isUuid(stepId) || !['accepted', 'rejected', 'suggested'].includes(decision)) {
      return { ok: false, code: 'bad_input' };
    }
    await setStepStatus(
      g.tenantId,
      g.actor,
      stepId,
      decision as 'accepted' | 'rejected' | 'suggested',
    );
    return { ok: true, code: 'saved' };
  });
}

export async function addStepAction(
  _prev: ReportActionState,
  fd: FormData,
): Promise<ReportActionState> {
  return run(fd, async (g) => {
    const opportunityId = String(fd.get('opportunityId') ?? '');
    const catalogueId = str(fd, 'catalogueId', 80);
    // A written step may come without an opportunity: the audit may have none approved.
    if (!g.reportId || (opportunityId ? !isUuid(opportunityId) : catalogueId !== '')) {
      return { ok: false, code: 'bad_input' };
    }
    if (catalogueId) {
      await addStep(g.tenantId, g.actor, g.reportId, opportunityId, { catalogueId });
    } else {
      const step = parseStep(fd);
      const category = improvementCategorySchema.safeParse(fd.get('category'));
      if (!step || !category.success) return { ok: false, code: 'bad_input' };
      await addStep(g.tenantId, g.actor, g.reportId, opportunityId || null, {
        custom: { ...step, category: category.data },
      });
    }
    return { ok: true, code: 'added' };
  });
}

export async function buildPlanAction(
  _prev: ReportActionState,
  fd: FormData,
): Promise<ReportActionState> {
  return run(fd, async (g) => {
    if (!g.reportId) return { ok: false, code: 'not_found' };
    const locale = await loadReportLocale(g.tenantId, g.reportId);
    if (!locale) return { ok: false, code: 'not_found' };
    const t = createTranslator(locale);
    const owner = t('report.plan.checkpointOwner');
    await generatePlan(g.tenantId, g.actor, g.reportId, {
      d30: { text: t('report.plan.checkpoint.d30'), owner },
      d60: { text: t('report.plan.checkpoint.d60'), owner },
      d90: { text: t('report.plan.checkpoint.d90'), owner },
    });
    return { ok: true, code: 'planBuilt' };
  });
}

export async function savePlanAction(
  _prev: ReportActionState,
  fd: FormData,
): Promise<ReportActionState> {
  return run(fd, async (g) => {
    if (!g.reportId) return { ok: false, code: 'not_found' };
    const ids = fd.getAll('planId').map(String);
    const texts = fd.getAll('planText').map(String);
    const owners = fd.getAll('planOwner').map(String);
    const horizons = fd.getAll('planHorizon').map(String);
    const plan: PlanItem[] = ids.flatMap((id, i) => {
      const h = horizonSchema.safeParse(horizons[i]);
      const text = (texts[i] ?? '').trim().slice(0, 400);
      return h.success && text
        ? [
            {
              id: id.slice(0, 40) || `line-${i}`,
              horizon: h.data,
              text,
              owner: (owners[i] ?? '').trim().slice(0, 120),
            },
          ]
        : [];
    });
    await savePlan(g.tenantId, g.actor, g.reportId, plan);
    return { ok: true, code: 'saved' };
  });
}

export async function applyAiDraftAction(
  _prev: ReportActionState,
  fd: FormData,
): Promise<ReportActionState> {
  return run(fd, async (g) => {
    if (!g.reportId) return { ok: false, code: 'not_found' };
    await applyAiDraft(g.tenantId, g.actor, g.reportId);
    return { ok: true, code: 'saved' };
  });
}

/** Review, publish, unpublish, new version. Publishing and unpublishing need `confirm=yes`. */
export async function workflowAction(
  _prev: ReportActionState,
  fd: FormData,
): Promise<ReportActionState> {
  return run(fd, async (g) => {
    if (!g.reportId) return { ok: false, code: 'not_found' };
    const change = String(fd.get('change') ?? '');
    const confirmed = fd.get('confirm') === 'yes';
    switch (change) {
      case 'review':
        await setReviewState(g.tenantId, g.actor, g.reportId, 'in_review');
        return { ok: true, code: 'stateChanged' };
      case 'draft':
        await setReviewState(g.tenantId, g.actor, g.reportId, 'draft');
        return { ok: true, code: 'stateChanged' };
      case 'publish':
        if (!confirmed) return { ok: false, code: 'confirm_required' };
        await publishReport(g.tenantId, g.actor, g.reportId);
        return { ok: true, code: 'published' };
      case 'unpublish':
        if (!confirmed) return { ok: false, code: 'confirm_required' };
        await unpublishReport(g.tenantId, g.actor, g.reportId);
        return { ok: true, code: 'unpublished' };
      case 'version':
        if (!confirmed) return { ok: false, code: 'confirm_required' };
        await startNewVersion(g.tenantId, g.actor, g.reportId);
        return { ok: true, code: 'newVersion' };
      default:
        return { ok: false, code: 'bad_input' };
    }
  });
}
