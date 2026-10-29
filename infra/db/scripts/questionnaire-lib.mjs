/**
 * Questionnaire v1 on the database (TASK-Z2, ADR 0046). Pure functions over a connected pg client,
 * shared by the CLI (questionnaire.mjs), the first-client seed (client-seed-lib.mjs) and the tests.
 *
 * The questions live in packages/contracts/src/questionnaires/pilot-v2.json (the one file the
 * owner edits). Nothing here edits an applied migration: it creates `question_items` rows (frozen
 * once created) and a new `questionnaire_versions` row, then points an engagement that has no
 * answers yet at it. The survey pages read the same JSON; the `question_items` rows are what the
 * answers and the analysis reference.
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

const DEFINITION_URL = new URL(
  '../../../packages/contracts/src/questionnaires/pilot-v2.json',
  import.meta.url,
);
const KINDS = ['scenario_choice', 'single_choice', 'short_text'];

/** Read and sanity-check the definition. The full schema check is the contracts unit test. */
export const loadDefinition = (url = DEFINITION_URL) => {
  const def = JSON.parse(readFileSync(url, 'utf8'));
  if (!def.id || !Number.isInteger(def.version) || !Array.isArray(def.questions)) {
    throw new Error('questionnaire definition: id, version and questions are required');
  }
  const codes = new Set();
  for (const q of def.questions) {
    if (!/^[a-z][a-z0-9_]*$/.test(q.code ?? '')) throw new Error(`bad question code: ${q.code}`);
    if (codes.has(q.code)) throw new Error(`duplicate question code: ${q.code}`);
    codes.add(q.code);
    if (!KINDS.includes(q.kind)) throw new Error(`${q.code}: unsupported kind ${q.kind}`);
    if (!q.prompt?.fr || !q.prompt?.en) throw new Error(`${q.code}: prompt needs fr and en`);
    const isText = q.kind === 'short_text';
    if (isText !== (q.options.length === 0))
      throw new Error(`${q.code}: options do not match kind`);
  }
  return def;
};

/** Same mapping as `toItemRow` in @evolai/contracts (a test keeps them equal). */
export const itemRowFor = (q) => ({
  axis: q.axis,
  code: q.code,
  kind: q.kind,
  locale: 'fr',
  prompt: q.prompt.fr,
  helper: q.helper?.fr ?? null,
  options: q.options.map((o) => ({ value: o.value, label: o.label.fr })),
  scoring: { weight: q.weight, reverse: false },
  sensitivity: q.sensitivity,
  retestable: false,
});

/** Create the missing `question_items` of a tenant; existing rows are left as they are. */
export const ensureQuestionItems = async (client, tenantId, def) => {
  const ids = [];
  const created = [];
  for (const q of def.questions) {
    const found = (
      await client.query('SELECT id FROM question_items WHERE tenant_id = $1 AND code = $2', [
        tenantId,
        q.code,
      ])
    ).rows[0];
    if (found) {
      ids.push(found.id);
      continue;
    }
    const r = itemRowFor(q);
    const id = randomUUID();
    await client.query(
      `INSERT INTO question_items (id, tenant_id, axis, code, kind, locale, prompt, helper,
                                   options_json, scoring_json, sensitivity, retestable)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        id,
        tenantId,
        r.axis,
        r.code,
        r.kind,
        r.locale,
        r.prompt,
        r.helper,
        JSON.stringify(r.options),
        JSON.stringify(r.scoring),
        r.sensitivity,
        r.retestable,
      ],
    );
    ids.push(id);
    created.push(q.code);
  }
  return { ids, created };
};

export const versionMarker = (def) => `questionnaire:${def.id}@${def.version}`;

/**
 * Ensure a questionnaire version holding `def` exists on a template. Idempotent: the version is
 * found by its change-note marker. Returns { id, versionNumber, created }.
 */
export const ensureVersion = async (client, tenantId, templateId, itemIds, def, locale = 'fr') => {
  const marker = versionMarker(def);
  const found = (
    await client.query(
      'SELECT id, version_number FROM questionnaire_versions WHERE template_id = $1 AND change_note = $2',
      [templateId, marker],
    )
  ).rows[0];
  if (found) return { id: found.id, versionNumber: found.version_number, created: false };
  const next = (
    await client.query(
      'SELECT COALESCE(MAX(version_number), 0) + 1 AS n FROM questionnaire_versions WHERE template_id = $1',
      [templateId],
    )
  ).rows[0].n;
  const id = randomUUID();
  await client.query(
    `INSERT INTO questionnaire_versions (id, tenant_id, template_id, version_number, item_ids,
                                         source_locale, frozen_at, change_note)
     VALUES ($1, $2, $3, $4, $5::uuid[], $6, now(), $7)`,
    [id, tenantId, templateId, next, itemIds, locale, marker],
  );
  return { id, versionNumber: next, created: true };
};

/**
 * Apply the definition to one engagement: items for its tenant, a new version on its template,
 * and the engagement pointed at it. Refuses when the engagement already has submissions on a
 * different version (answers must stay attached to the questions they answered).
 */
export const applyQuestionnaire = async (client, { engagementId }, def = loadDefinition()) => {
  if (!/^[0-9a-f-]{36}$/i.test(engagementId ?? ''))
    throw new Error('--engagement-id must be a uuid');
  await client.query('BEGIN');
  try {
    await client.query(`SELECT set_config('app.is_service_account', 'on', true)`);
    const e = (
      await client.query(
        `SELECT tenant_id, template_id, questionnaire_version_id, locale FROM engagements WHERE id = $1`,
        [engagementId],
      )
    ).rows[0];
    if (!e) throw new Error(`no engagement ${engagementId}`);
    const { ids, created } = await ensureQuestionItems(client, e.tenant_id, def);
    const version = await ensureVersion(client, e.tenant_id, e.template_id, ids, def, e.locale);
    let repointed = false;
    if (e.questionnaire_version_id !== version.id) {
      const subs = (
        await client.query('SELECT count(*)::int AS n FROM submissions WHERE engagement_id = $1', [
          engagementId,
        ])
      ).rows[0].n;
      if (subs > 0) {
        throw new Error(
          `engagement already has ${subs} submission(s) on another version; create a new engagement for the new questions`,
        );
      }
      await client.query(
        'UPDATE engagements SET questionnaire_version_id = $2, updated_at = now() WHERE id = $1',
        [engagementId, version.id],
      );
      repointed = true;
    }
    await client.query('COMMIT');
    return {
      tenantId: e.tenant_id,
      engagementId,
      versionId: version.id,
      versionNumber: version.versionNumber,
      versionCreated: version.created,
      itemsCreated: created,
      repointed,
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  }
};
