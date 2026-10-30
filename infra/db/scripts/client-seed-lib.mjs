/**
 * First-client seed (TASK-P, ADR 0035). Pure function over a connected pg client so the CLI
 * (client-seed.mjs) and the tests share one code path. Idempotent: every row is looked up by a
 * natural key first, so a second run changes nothing. Never part of a migration: the client's
 * name only ever comes from flags, never from this public repository.
 *
 * Creates, inside one transaction:
 *   tenant (by slug) -> organisation -> department -> team -> template (named after the
 *   engagement) -> the pilot questionnaire's items -> its questionnaire version -> engagement (draft) -> link to
 *   the team; the owner (an existing user) as auditor AND platform owner of that tenant; the
 *   referent persona with a non-deliverable `.invalid` address and NO password (cannot sign in).
 */
import { randomUUID } from 'node:crypto';
import { CLI_ACTOR_ID, emailHash } from './auditor-lib.mjs';
import { ensureQuestionItems, ensureVersion, loadDefinition } from './questionnaire-lib.mjs';

const PRIVACY = {
  minResponsesForGroupBreakdown: 5,
  managerSeesIndividualMaturity: false,
  benchmarkCandidate: false,
  emailDelivery: false,
  reminderDays: [3, 7],
};

export const slugify = (s) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

/** Non-deliverable placeholder (RFC 2606 `.invalid`): firstname-lastname@<tenant-slug>.invalid */
export const placeholderEmail = (referentName, tenantSlug) =>
  `${slugify(referentName) || 'referent'}@${tenantSlug}.invalid`;

/** Throws on missing or unsafe flags. Returns normalised options. */
export const validateSeedOptions = (o) => {
  const need = (k, label) => {
    const v = typeof o[k] === 'string' ? o[k].trim() : '';
    if (!v) throw new Error(`--${label} is required`);
    if (v.length > 120) throw new Error(`--${label} is too long`);
    return v;
  };
  const tenantName = need('tenantName', 'tenant-name');
  const slug = o.slug ? slugify(o.slug) : slugify(tenantName);
  if (!slug) throw new Error('--slug could not be derived from --tenant-name');
  const locale = o.locale ?? 'fr';
  if (!['fr', 'en'].includes(locale)) throw new Error('--locale must be fr or en');
  const ownerEmail = need('ownerEmail', 'owner-email').toLowerCase();
  const referentName = need('referentName', 'referent-name');
  const referentEmail = (o.referentEmail ?? placeholderEmail(referentName, slug)).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(referentEmail)) throw new Error('bad --referent-email');
  return {
    tenantName,
    slug,
    locale,
    engagementName: need('engagementName', 'engagement-name'),
    teamName: need('teamName', 'team-name'),
    referentName,
    referentEmail,
    ownerEmail,
    country: (o.country ?? 'FR').toUpperCase(),
  };
};

const one = async (client, sql, params) => (await client.query(sql, params)).rows[0] ?? null;

/** Find-or-insert by a natural key. Returns { id, created }. */
const ensure = async (client, findSql, findParams, insert) => {
  const found = await one(client, findSql, findParams);
  if (found) return { id: found.id, created: false };
  const id = randomUUID();
  await insert(id);
  return { id, created: true };
};

const ensureMembership = async (client, tenantId, userId, role, teamId = null) => {
  const found = await one(
    client,
    `SELECT id FROM memberships WHERE tenant_id = $1 AND user_id = $2 AND role = $3
        AND team_id IS NOT DISTINCT FROM $4::uuid`,
    [tenantId, userId, role, teamId],
  );
  if (found) return false;
  await client.query(
    `INSERT INTO memberships (id, tenant_id, user_id, team_id, role) VALUES ($1, $2, $3, $4, $5)`,
    [randomUUID(), tenantId, userId, teamId, role],
  );
  return true;
};

export const seedClient = async (client, raw) => {
  const o = validateSeedOptions(raw);
  await client.query('BEGIN');
  try {
    await client.query(`SELECT set_config('app.is_service_account', 'on', true)`);
    const owner = await one(client, 'SELECT id FROM users WHERE email_hash = $1', [
      emailHash(o.ownerEmail),
    ]);
    if (!owner) throw new Error('no user with --owner-email; create the auditor account first');

    const created = [];
    const note = (what, r) => {
      if (r.created) created.push(what);
      return r.id;
    };
    const tenantId = note(
      'tenant',
      await ensure(client, 'SELECT id FROM tenants WHERE slug = $1', [o.slug], (id) =>
        client.query(
          `INSERT INTO tenants (id, slug, display_name, plan, data_region, retention_days)
           VALUES ($1, $2, $3, 'consultant_managed', 'EU', 365)`,
          [id, o.slug, o.tenantName],
        ),
      ),
    );
    const orgId = note(
      'organisation',
      await ensure(
        client,
        'SELECT id FROM organisations WHERE tenant_id = $1 ORDER BY created_at LIMIT 1',
        [tenantId],
        (id) =>
          client.query(
            `INSERT INTO organisations (id, tenant_id, legal_name, trading_name, country)
             VALUES ($1, $2, $3, $3, $4)`,
            [id, tenantId, o.tenantName, o.country],
          ),
      ),
    );
    const deptId = note(
      'department',
      await ensure(
        client,
        `SELECT id FROM departments WHERE organisation_id = $1 AND code = 'pilot'`,
        [orgId],
        (id) =>
          client.query(
            `INSERT INTO departments (id, tenant_id, organisation_id, name, code)
             VALUES ($1, $2, $3, $4, 'pilot')`,
            [id, tenantId, orgId, o.teamName],
          ),
      ),
    );
    const teamId = note(
      'team',
      await ensure(
        client,
        'SELECT id FROM teams WHERE tenant_id = $1 AND name = $2',
        [tenantId, o.teamName],
        (id) =>
          client.query(
            `INSERT INTO teams (id, tenant_id, organisation_id, department_id, name, expected_headcount)
             VALUES ($1, $2, $3, $4, $5, 0)`,
            [id, tenantId, orgId, deptId, o.teamName],
          ),
      ),
    );
    const templateId = note(
      'template',
      await ensure(
        client,
        'SELECT id FROM templates WHERE tenant_id = $1 AND name = $2',
        [tenantId, o.engagementName],
        (id) =>
          client.query(
            `INSERT INTO templates (id, tenant_id, name, owner_user_id, default_locale)
             VALUES ($1, $2, $3, $4, $5)`,
            [id, tenantId, o.engagementName, owner.id, o.locale],
          ),
      ),
    );
    // The pilot questionnaire (packages/contracts/src/questionnaires/pilot-v3.json): its items,
    // then the version that holds them, found by its change-note marker so a rerun adds nothing.
    const def = loadDefinition();
    const { ids: itemIds } = await ensureQuestionItems(client, tenantId, def);
    const versionId = note(
      'questionnaire',
      await ensureVersion(client, tenantId, templateId, itemIds, def, o.locale),
    );
    const engagementId = note(
      'engagement',
      await ensure(
        client,
        'SELECT id FROM engagements WHERE tenant_id = $1 AND template_id = $2 ORDER BY created_at LIMIT 1',
        [tenantId, templateId],
        (id) =>
          client.query(
            `INSERT INTO engagements (id, tenant_id, template_id, questionnaire_version_id, status,
                                      locale, privacy_json)
             VALUES ($1, $2, $3, $4, 'draft', $5, $6)`,
            [id, tenantId, templateId, versionId, o.locale, JSON.stringify(PRIVACY)],
          ),
      ),
    );
    await client.query(
      `INSERT INTO engagement_teams (engagement_id, team_id, tenant_id) VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [engagementId, teamId, tenantId],
    );

    // Referent persona: placeholder address, no password, so the account cannot sign in.
    const referentId = note(
      'referent',
      await ensure(
        client,
        'SELECT id FROM users WHERE email_hash = $1',
        [emailHash(o.referentEmail)],
        (id) =>
          client.query(
            `INSERT INTO users (id, email_hash, display_name, password_hash) VALUES ($1, $2, $3, NULL)`,
            [id, emailHash(o.referentEmail), o.referentName],
          ),
      ),
    );
    if (await ensureMembership(client, tenantId, referentId, 'team_referent', teamId)) {
      created.push('referent membership');
    }
    if (await ensureMembership(client, tenantId, owner.id, 'auditor')) {
      created.push('owner auditor membership');
    }
    if (await ensureMembership(client, tenantId, owner.id, 'platform_owner')) {
      created.push('owner platform_owner membership');
    }
    if (created.length > 0) {
      await client.query(
        `INSERT INTO audit_log (tenant_id, actor_user_id, action, target_kind, target_id, payload_json)
         VALUES ($1, $2, 'client.seed', 'engagement', $3, $4)`,
        [tenantId, CLI_ACTOR_ID, engagementId, JSON.stringify({ via: 'cli', created })],
      );
    }
    await client.query('COMMIT');
    return { tenantId, engagementId, teamId, referentId, referentEmail: o.referentEmail, created };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  }
};
