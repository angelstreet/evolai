import type pg from 'pg';
import type { TenantId } from '@evolai/contracts';
import { anonymise } from '@evolai/domain';
import { withTenant } from './db';

/**
 * Visit notes (TASK-AJ A6, ADR 0059): what the staff observed and heard on site, dated, per team or
 * for the whole mission, anonymised on save with the same rules as the survey's free texts. Staff
 * only: never shown to the client and never in a published snapshot. A finding can cite notes as
 * its evidence (`finding_notes`). Erased with the mission (cascade).
 *
 * Until migration 0030 is applied the reads answer `null` and pages show nothing new.
 */

export const NOTE_KINDS = ['interview', 'observation', 'workshop'] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];

export const NOTE_MAX_LENGTH = 2000;

export interface VisitNote {
  readonly id: string;
  readonly kind: NoteKind;
  readonly notedOn: string;
  readonly teamId: string | null;
  readonly teamName: string | null;
  readonly body: string;
  /** Findings that cite it. */
  readonly findings: number;
}

export class VisitError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'VisitError';
  }
}

/** True once the migration that creates `table` is applied. */
export const tableReady = async (client: pg.PoolClient, table: string): Promise<boolean> =>
  (await client.query<{ ok: boolean }>('SELECT to_regclass($1) IS NOT NULL AS ok', [table])).rows[0]
    ?.ok === true;

const audit = (
  client: pg.PoolClient,
  tenantId: string,
  actor: string,
  action: string,
  targetId: string,
  payload: Record<string, unknown>,
) =>
  client.query(
    `INSERT INTO audit_log (tenant_id, actor_user_id, action, target_kind, target_id, payload_json)
     VALUES ($1, $2, $3, 'visit_note', $4, $5)`,
    [tenantId, actor, action, targetId, JSON.stringify(payload)],
  );

export const listNotesWith = async (
  client: pg.PoolClient,
  tenantId: string,
  engagementId: string,
): Promise<VisitNote[] | null> => {
  if (!(await tableReady(client, 'visit_notes'))) return null;
  const { rows } = await client.query<{
    id: string;
    kind: NoteKind;
    noted_on: string;
    team_id: string | null;
    team_name: string | null;
    body: string;
    findings: number;
  }>(
    `SELECT n.id, n.kind, to_char(n.noted_on, 'YYYY-MM-DD') AS noted_on, n.team_id,
            t.name AS team_name, n.body,
            (SELECT count(*)::int FROM finding_notes fn WHERE fn.note_id = n.id) AS findings
       FROM visit_notes n LEFT JOIN teams t ON t.id = n.team_id
      WHERE n.tenant_id = $1 AND n.engagement_id = $2
      ORDER BY n.noted_on DESC, n.created_at DESC`,
    [tenantId, engagementId],
  );
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    notedOn: r.noted_on,
    teamId: r.team_id,
    teamName: r.team_name,
    body: r.body,
    findings: Number(r.findings),
  }));
};

export const listNotes = (tenantId: TenantId, engagementId: string) =>
  withTenant(tenantId, (c) => listNotesWith(c, tenantId, engagementId));

/** How many notes of each kind: the report's method line counts the visit this way. */
export const countNotesWith = async (
  client: pg.PoolClient,
  tenantId: string,
  engagementId: string,
): Promise<Record<NoteKind, number>> => {
  const out: Record<NoteKind, number> = { interview: 0, observation: 0, workshop: 0 };
  if (!(await tableReady(client, 'visit_notes'))) return out;
  const { rows } = await client.query<{ kind: NoteKind; n: number }>(
    `SELECT kind, count(*)::int AS n FROM visit_notes
      WHERE tenant_id = $1 AND engagement_id = $2 GROUP BY kind`,
    [tenantId, engagementId],
  );
  for (const r of rows) out[r.kind] = Number(r.n);
  return out;
};

export interface NewNote {
  readonly kind: NoteKind;
  readonly notedOn: string;
  readonly teamId: string | null;
  readonly body: string;
}

/** Save a note, anonymised: names to hide, emails, numbers. The typed original is not kept. */
export const addNote = (
  tenantId: TenantId,
  actor: string,
  engagementId: string,
  input: NewNote,
): Promise<string> =>
  withTenant(tenantId, async (client) => {
    if (!(await tableReady(client, 'visit_notes'))) throw new VisitError('unavailable');
    const eng = await client.query<{ locale: 'fr' | 'en' }>(
      'SELECT locale FROM engagements WHERE tenant_id = $1 AND id = $2',
      [tenantId, engagementId],
    );
    const locale = eng.rows[0]?.locale;
    if (!locale) throw new VisitError('not_found');
    if (input.teamId) {
      const team = await client.query(
        `SELECT 1 FROM engagement_teams et JOIN teams t ON t.id = et.team_id
          WHERE et.engagement_id = $1 AND t.tenant_id = $2 AND t.id = $3`,
        [engagementId, tenantId, input.teamId],
      );
      if (team.rowCount === 0) throw new VisitError('bad_input');
    }
    const terms = (
      await client.query<{ term: string }>(
        'SELECT term FROM ai_redaction_terms WHERE tenant_id = $1',
        [tenantId],
      )
    ).rows.map((r) => r.term);
    const body = anonymise(input.body.trim(), { locale, terms }).text.slice(0, NOTE_MAX_LENGTH);
    if (body.length < 3) throw new VisitError('bad_input');
    const ins = await client.query<{ id: string }>(
      `INSERT INTO visit_notes (tenant_id, engagement_id, team_id, kind, noted_on, body, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [tenantId, engagementId, input.teamId, input.kind, input.notedOn, body, actor],
    );
    const id = (ins.rows[0] as { id: string }).id;
    await audit(client, tenantId, actor, 'visit_note.create', id, {
      engagementId,
      kind: input.kind,
    });
    return id;
  });

/** Delete a note; findings that cited it lose that evidence (cascade). */
export const deleteNote = (tenantId: TenantId, actor: string, noteId: string): Promise<void> =>
  withTenant(tenantId, async (client) => {
    if (!(await tableReady(client, 'visit_notes'))) throw new VisitError('unavailable');
    const res = await client.query<{ engagement_id: string }>(
      'DELETE FROM visit_notes WHERE tenant_id = $1 AND id = $2 RETURNING engagement_id',
      [tenantId, noteId],
    );
    const row = res.rows[0];
    if (!row) throw new VisitError('not_found');
    await audit(client, tenantId, actor, 'visit_note.delete', noteId, {
      engagementId: row.engagement_id,
    });
  });

/** The Visit tab: the notes (null before migration 0030) and the mission's teams. */
export const visitTab = (
  tenantId: TenantId,
  engagementId: string,
): Promise<{ notes: VisitNote[] | null; teams: { id: string; name: string }[] }> =>
  withTenant(tenantId, async (client) => {
    const teams = await client.query<{ id: string; name: string }>(
      `SELECT t.id, t.name FROM engagement_teams et JOIN teams t ON t.id = et.team_id
        WHERE et.engagement_id = $2 AND t.tenant_id = $1 ORDER BY t.name`,
      [tenantId, engagementId],
    );
    return {
      notes: await listNotesWith(client, tenantId, engagementId),
      teams: teams.rows,
    };
  });
