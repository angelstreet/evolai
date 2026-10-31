'use server';

import { revalidatePath } from 'next/cache';
import { resolveActor } from '@/lib/authServer';
import { addRedactionTerm, removeRedactionTerm } from '@/lib/redactionTermData';
import { redactionTermRemoveSchema, redactionTermWriteSchema } from '@evolai/contracts';
import { getT } from '@/lib/i18n';

/**
 * Admin actions for the per-tenant redaction-term list (TASK-Q, ADR 0035). The actor and the tenant
 * always come from the session; the form's tenant id is only a selector. The data layer writes one
 * `audit_log` row per add / remove so the trail records who changed the redaction list and when.
 */
import type { RedactionActionState } from './state';

export type { RedactionActionState } from './state';

const isUuidV4 = (v: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

export async function addRedactionTermAction(
  _prev: RedactionActionState,
  formData: FormData,
): Promise<RedactionActionState> {
  const { t } = getT();
  const tenantId = String(formData.get('tenantId') ?? '');
  const rawTerm = String(formData.get('term') ?? '');
  if (!isUuidV4(tenantId)) return { ok: false, message: t('admin.redaction.errAdd') };
  const parsed = redactionTermWriteSchema.safeParse({ tenantId, term: rawTerm });
  if (!parsed.success) return { ok: false, message: t('admin.redaction.errAdd') };
  const who = await resolveActor(tenantId);
  if (!who.ok) return { ok: false, message: who.message };
  try {
    const row = await addRedactionTerm(who.tenantId, parsed.data.term, who.actor);
    revalidatePath('/admin', 'layout');
    return { ok: true, message: t('admin.redaction.added', { term: row.term }), term: '' };
  } catch (err) {
    console.error('redaction term add failed', err);
    return { ok: false, message: t('admin.redaction.errAdd') };
  }
}

export async function removeRedactionTermAction(
  _prev: RedactionActionState,
  formData: FormData,
): Promise<RedactionActionState> {
  const { t } = getT();
  const tenantId = String(formData.get('tenantId') ?? '');
  const termId = String(formData.get('termId') ?? '');
  if (!isUuidV4(tenantId) || !isUuidV4(termId)) {
    return { ok: false, message: t('admin.redaction.errRemove') };
  }
  const parsed = redactionTermRemoveSchema.safeParse({ tenantId, termId });
  if (!parsed.success) return { ok: false, message: t('admin.redaction.errRemove') };
  const who = await resolveActor(tenantId);
  if (!who.ok) return { ok: false, message: who.message };
  try {
    const result = await removeRedactionTerm(who.tenantId, parsed.data.termId, who.actor);
    if (!result.removed) {
      return { ok: false, message: t('admin.redaction.errRemove') };
    }
    revalidatePath('/admin', 'layout');
    return {
      ok: true,
      message: t('admin.redaction.removed', { term: result.term }),
    };
  } catch (err) {
    console.error('redaction term remove failed', err);
    return { ok: false, message: t('admin.redaction.errRemove') };
  }
}
