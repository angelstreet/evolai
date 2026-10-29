'use server';

import { revalidatePath } from 'next/cache';
import { resolveActor } from '@/lib/authServer';
import { isUuid } from '@/lib/invitationForm';
import { NOTE_KINDS, VisitError, addNote, deleteNote, type NoteKind } from '@/lib/visitData';

/**
 * Visit notes actions (TASK-AJ A6, ADR 0059). Staff of the tenant only, through `resolveActor`
 * (never inside a view-as); the form's tenant id is a selector. The data layer anonymises the
 * text and writes the audit row. Results are codes the page words.
 */

export interface VisitActionState {
  readonly ok: boolean;
  readonly code: string;
}

const codeOf = (err: unknown): string => {
  if (err instanceof VisitError) return err.code;
  console.error('visit action failed', err instanceof Error ? err.name : 'unknown');
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

export async function addNoteAction(
  _prev: VisitActionState,
  fd: FormData,
): Promise<VisitActionState> {
  const engagementId = String(fd.get('engagementId') ?? '');
  const g = await guard(fd);
  if (!g || !isUuid(engagementId)) return { ok: false, code: 'forbidden' };
  const kind = String(fd.get('kind') ?? '') as NoteKind;
  const notedOn = String(fd.get('notedOn') ?? '');
  const team = String(fd.get('teamId') ?? '');
  const body = String(fd.get('body') ?? '').slice(0, 4000);
  if (
    !NOTE_KINDS.includes(kind) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(notedOn) ||
    (team !== '' && !isUuid(team)) ||
    body.trim().length < 3
  ) {
    return { ok: false, code: 'bad_input' };
  }
  try {
    await addNote(g.tenantId, g.actor, engagementId, {
      kind,
      notedOn,
      teamId: team || null,
      body,
    });
    done();
    return { ok: true, code: 'added' };
  } catch (err) {
    return { ok: false, code: codeOf(err) };
  }
}

export async function deleteNoteAction(
  _prev: VisitActionState,
  fd: FormData,
): Promise<VisitActionState> {
  const noteId = String(fd.get('noteId') ?? '');
  const g = await guard(fd);
  if (!g || !isUuid(noteId)) return { ok: false, code: 'forbidden' };
  try {
    await deleteNote(g.tenantId, g.actor, noteId);
    done();
    return { ok: true, code: 'deleted' };
  } catch (err) {
    return { ok: false, code: codeOf(err) };
  }
}
