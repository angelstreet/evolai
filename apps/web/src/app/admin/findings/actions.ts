'use server';

import { revalidatePath } from 'next/cache';
import type { TenantId } from '@evolai/contracts';
import type { MessageKey } from '@evolai/i18n';
import { createTranslator } from '@evolai/i18n';
import type { FindingAxis, FindingProposal } from '@evolai/domain';
import { resolveActor } from '@/lib/authServer';
import {
  FINDING_AXES,
  FindingError,
  createFinding,
  decideFinding,
  proposeMissionFindings,
  resolveDispute,
  updateFinding,
} from '@/lib/findingsData';
import { isUuid } from '@/lib/invitationForm';
import { ReportError, loadReportForEngagement, suggestSteps } from '@/lib/reportData';
import { CHOICE_SEP, type FindingActionState } from './state';

/**
 * Findings actions (TASK-AJ, ADR 0058). The actor and tenant come from the session through
 * `resolveActor` (staff of that tenant, never inside a view-as); the form's tenant id is only a
 * selector. Each data-layer call writes its own audit row. Results are codes the page words.
 */

const codeOf = (err: unknown): string => {
  if (err instanceof FindingError || err instanceof ReportError) return err.code;
  console.error('finding action failed', err instanceof Error ? err.name : 'unknown');
  return 'error';
};

const guard = async (fd: FormData) => {
  const tenantId = String(fd.get('tenantId') ?? '');
  if (!isUuid(tenantId)) return null;
  const who = await resolveActor(tenantId);
  return who.ok ? who : null;
};

const done = (): void => {
  revalidatePath('/admin/engagements', 'layout');
};

/** Words of a rule proposal in the mission's language. */
const proposalWords =
  (locale: 'fr' | 'en') =>
  (p: FindingProposal, question: string): { label: string; statement: string } => {
    const t = createTranslator(locale);
    const vars = { count: p.people, total: p.total };
    switch (p.rule.kind) {
      case 'choice':
        return {
          label: t(`report.findings.rule.choice.${p.rule.code}.label` as MessageKey),
          statement: t(`report.findings.rule.choice.${p.rule.code}.statement` as MessageKey, vars),
        };
      case 'unsure':
        return {
          label: t('report.findings.rule.unsure.label', { question }),
          statement: t('report.findings.rule.unsure.statement', { ...vars, question }),
        };
      case 'tag': {
        const tag = t(`report.steps.tag.${p.rule.tag}` as MessageKey);
        return {
          label: t('report.findings.rule.tag.label', { tag }),
          statement: t('report.findings.rule.tag.statement', { ...vars, tag }),
        };
      }
    }
  };

/** After a new approved opportunity: propose its catalogue actions in the working report. */
const suggestInReport = async (tenantId: TenantId, actor: string, engagementId: string) => {
  const bundle = await loadReportForEngagement(tenantId, engagementId);
  if (!bundle || bundle.report.status === 'published') return;
  await suggestSteps(tenantId, actor, bundle.report.id);
};

export async function proposeFindingsAction(
  _prev: FindingActionState,
  fd: FormData,
): Promise<FindingActionState> {
  const engagementId = String(fd.get('engagementId') ?? '');
  const g = await guard(fd);
  if (!g || !isUuid(engagementId)) return { ok: false, code: 'forbidden' };
  try {
    const count = await proposeMissionFindings(g.tenantId, g.actor, engagementId, proposalWords);
    done();
    return { ok: true, code: 'proposed', count };
  } catch (err) {
    return { ok: false, code: codeOf(err) };
  }
}

export async function decideFindingAction(
  _prev: FindingActionState,
  fd: FormData,
): Promise<FindingActionState> {
  const findingId = String(fd.get('findingId') ?? '');
  const to = String(fd.get('to') ?? '');
  const g = await guard(fd);
  if (!g || !isUuid(findingId) || (to !== 'approved' && to !== 'rejected')) {
    return { ok: false, code: 'forbidden' };
  }
  try {
    const out = await decideFinding(g.tenantId, g.actor, findingId, to);
    if (out.opportunity) await suggestInReport(g.tenantId, g.actor, out.engagementId);
    done();
    if (to === 'rejected') return { ok: true, code: 'rejected' };
    return { ok: true, code: out.opportunity ? 'approvedWithActions' : 'approved' };
  } catch (err) {
    return { ok: false, code: codeOf(err) };
  }
}

export async function makeFindingAction(
  _prev: FindingActionState,
  fd: FormData,
): Promise<FindingActionState> {
  const engagementId = String(fd.get('engagementId') ?? '');
  const g = await guard(fd);
  if (!g || !isUuid(engagementId)) return { ok: false, code: 'forbidden' };
  const label = String(fd.get('label') ?? '')
    .trim()
    .slice(0, 200);
  const statement = String(fd.get('statement') ?? '')
    .trim()
    .slice(0, 600);
  const axis = String(fd.get('axis') ?? '') as FindingAxis;
  if (label.length < 3 || !FINDING_AXES.includes(axis)) return { ok: false, code: 'bad_input' };
  const answerIds = fd
    .getAll('answer')
    .map(String)
    .filter((id) => isUuid(id))
    .slice(0, 2000);
  const choices = fd
    .getAll('choice')
    .map(String)
    .slice(0, 200)
    .flatMap((v) => {
      const [code, choice] = v.split(CHOICE_SEP);
      return code && choice ? [{ code, label: choice }] : [];
    });
  const noteIds = fd
    .getAll('note')
    .map(String)
    .filter((id) => isUuid(id))
    .slice(0, 200);
  try {
    await createFinding(g.tenantId, g.actor, engagementId, {
      label,
      statement,
      axis,
      answerIds,
      choices,
      noteIds,
    });
    await suggestInReport(g.tenantId, g.actor, engagementId);
    done();
    return { ok: true, code: 'created' };
  } catch (err) {
    return { ok: false, code: codeOf(err) };
  }
}

/** The auditor answers the referent's dispute (A8): corrected, or kept with the dispute noted. */
export async function resolveDisputeAction(
  _prev: FindingActionState,
  fd: FormData,
): Promise<FindingActionState> {
  const findingId = String(fd.get('findingId') ?? '');
  const to = String(fd.get('to') ?? '');
  const g = await guard(fd);
  if (!g || !isUuid(findingId) || (to !== 'corrected' && to !== 'kept')) {
    return { ok: false, code: 'forbidden' };
  }
  try {
    await resolveDispute(g.tenantId, g.actor, findingId, to);
    done();
    return { ok: true, code: to };
  } catch (err) {
    return { ok: false, code: codeOf(err) };
  }
}

/** Reword a finding (ADR 0060): title, sentence, axis; the evidence stays. */
export async function editFindingAction(
  _prev: FindingActionState,
  fd: FormData,
): Promise<FindingActionState> {
  const findingId = String(fd.get('findingId') ?? '');
  const g = await guard(fd);
  if (!g || !isUuid(findingId)) return { ok: false, code: 'forbidden' };
  const label = String(fd.get('label') ?? '')
    .trim()
    .slice(0, 200);
  const statement = String(fd.get('statement') ?? '')
    .trim()
    .slice(0, 600);
  const axis = String(fd.get('axis') ?? '') as FindingAxis;
  if (label.length < 3 || !FINDING_AXES.includes(axis)) return { ok: false, code: 'bad_input' };
  try {
    await updateFinding(g.tenantId, g.actor, findingId, { label, statement, axis });
    done();
    return { ok: true, code: 'updated' };
  } catch (err) {
    return { ok: false, code: codeOf(err) };
  }
}
