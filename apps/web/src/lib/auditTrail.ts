import type { TenantId } from '@evolai/contracts';
import { withTenant } from './db';

/**
 * Read side of the audit trail for the admin screen and its CSV (TASK-U, ADR 0040). Only who, when
 * and which action leave this module: never the payload, so no token, address or text can leak
 * through it. Actions are grouped so the filter speaks in plain words.
 */
export const AUDIT_GROUPS = {
  export: ['export.complete', 'invitation.export'],
  erase: ['pseudonym.erase', 'badge.erase', 'invitation.purge_addresses'],
  viewAs: ['view_as.start', 'view_as.stop', 'view_as.request', 'view_as.refused'],
  invitations: [
    'invitation.create_batch',
    'invitation.revoke',
    'invitation.extend',
    'invitation.regenerate',
    'invitation.remind',
    'invitation.revoke_batch',
    'referent.invite',
  ],
  settings: [
    'invitation.settings',
    'engagement.create',
    'engagement.update',
    'engagement.launch',
    'engagement.close',
    'team.create',
    'team.update',
    'privacy.update',
    'redaction_term.add',
    'redaction_term.remove',
    'client.seed',
  ],
  signIn: [
    'user.create',
    'user.set_password',
    'user.disable',
    'user.set_email',
    'password.set',
    'password.reset_request',
    'password.reset',
  ],
  privacy: ['privacy_request.create', 'privacy_request.handle', 'answers.anonymise'],
  reports: [
    'report.create',
    'report.update',
    'report.plan',
    'report.suggest',
    'report.ai_draft',
    'report.submit',
    'report.publish',
    'report.unpublish',
    'report.new_version',
    'report.export',
    'report_step.add',
    'report_step.update',
    'report_step.accept',
    'report_step.reject',
    'finding.create',
    'finding.propose',
    'finding.approve',
    'finding.reject',
    'finding.confirm',
    'finding.dispute',
    'finding.resolve',
    'report_step.measure',
    'visit_note.create',
    'visit_note.delete',
  ],
} as const;

export type AuditGroup = 'all' | keyof typeof AUDIT_GROUPS;
export const AUDIT_GROUP_KEYS: readonly AuditGroup[] = [
  'all',
  ...Object.keys(AUDIT_GROUPS),
] as AuditGroup[];

/** One page is plenty for a human; the CSV uses the same cap, with the dates to narrow it. */
export const AUDIT_LIMIT = 500;

export const parseGroup = (raw: string | undefined): AuditGroup =>
  AUDIT_GROUP_KEYS.includes(raw as AuditGroup) ? (raw as AuditGroup) : 'all';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
/** A `YYYY-MM-DD` that is a real calendar day, else undefined. */
export const parseDay = (raw: string | undefined): string | undefined => {
  if (!raw || !DAY_RE.test(raw)) return undefined;
  const d = new Date(`${raw}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== raw ? undefined : raw;
};

/** Message key segment of an action: dots are not allowed in catalog keys. */
export const actionKey = (action: string): string => action.replace(/\./g, '_');

export interface AuditFilter {
  readonly group: AuditGroup;
  readonly from?: string;
  readonly to?: string;
}

export interface AuditEntry {
  readonly id: string;
  readonly at: string;
  readonly who: string;
  readonly action: string;
}

export const listAuditTrail = async (
  tenantId: TenantId,
  filter: AuditFilter,
): Promise<{ entries: AuditEntry[]; truncated: boolean }> =>
  withTenant(tenantId, async (client) => {
    const params: unknown[] = [tenantId];
    const where: string[] = ['a.tenant_id = $1'];
    if (filter.group === 'all') {
      // One row per page served while viewing as a referent would drown everything else.
      where.push(`a.action <> 'view_as.request'`);
    } else {
      params.push([...AUDIT_GROUPS[filter.group]]);
      where.push(`a.action = ANY($${params.length}::text[])`);
    }
    if (filter.from) {
      params.push(filter.from);
      where.push(`a.created_at >= $${params.length}::date`);
    }
    if (filter.to) {
      params.push(filter.to);
      where.push(`a.created_at < ($${params.length}::date + 1)`);
    }
    const { rows } = await client.query<{
      id: string;
      created_at: Date | string;
      display_name: string;
      action: string;
    }>(
      `SELECT a.id, a.created_at, u.display_name, a.action
         FROM audit_log a JOIN users u ON u.id = a.actor_user_id
        WHERE ${where.join(' AND ')}
        ORDER BY a.created_at DESC, a.id
        LIMIT ${AUDIT_LIMIT + 1}`,
      params,
    );
    return {
      entries: rows.slice(0, AUDIT_LIMIT).map((r) => ({
        id: r.id,
        at: new Date(r.created_at).toISOString(),
        who: r.display_name,
        action: r.action,
      })),
      truncated: rows.length > AUDIT_LIMIT,
    };
  });
