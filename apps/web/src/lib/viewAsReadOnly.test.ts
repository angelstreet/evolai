import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * TASK-P (ADR 0035): while the owner views as a client, every mutating server action, route and
 * public write is refused, and the only database write is the `view_as.refused` trail row.
 * The database, cookies and Next helpers are mocked; the session is really signed and verified.
 */
const state = vi.hoisted(() => ({
  cookie: '' as string,
  sql: [] as { sql: string; params: unknown[] }[],
}));

vi.mock('next/headers', () => ({
  cookies: () => ({
    get: (name: string) =>
      name === 'evolai_session' && state.cookie ? { value: state.cookie } : undefined,
  }),
  headers: () => new Headers({ 'x-evolai-path': '/admin/test' }),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
  notFound: () => {
    throw new Error('notFound');
  },
}));
vi.mock('@/lib/db', () => {
  const client = {
    query: async (sql: string, params: unknown[] = []) => {
      state.sql.push({ sql, params });
      return { rows: [], rowCount: 0 };
    },
  };
  return {
    withTenant: async (_t: string, fn: (c: typeof client) => unknown) => fn(client),
    withServiceAccount: async (fn: (c: typeof client) => unknown) => fn(client),
    getPool: () => ({ connect: async () => ({ ...client, release: () => undefined }) }),
    findTenantForInvitation: async () => null,
  };
});

const T = '33333333-3333-4333-8333-333333333333';
const ID = '44444444-4444-4444-8444-444444444444';
const viewAs = {
  role: 'team_referent',
  tenantId: T,
  teamId: '55555555-5555-4555-8555-555555555555',
  personaId: '66666666-6666-4666-8666-666666666666',
  label: 'Sam Synthetic',
  tenantLabel: 'Synthetic client C',
  teamLabel: 'Synthetic pilot team',
};

const form = (): FormData => {
  const fd = new FormData();
  for (const k of [
    'tenantId',
    'engagementId',
    'analysisId',
    'opportunityId',
    'synergyId',
    'invitationId',
  ]) {
    fd.set(k, k === 'tenantId' ? T : ID);
  }
  fd.set('title', 'A valid title');
  fd.set('to', 'approved');
  fd.set('nextStatus', 'surfaced');
  fd.set('kind', 'tenant');
  fd.set('rationale', 'ok');
  fd.set('respondentPseudonym', 'p-0123456789abcdef');
  fd.set(`count:${ID}`, '5');
  fd.set('count', '5');
  fd.set('expiresInDays', '14');
  fd.set('reminderDays', '3, 7');
  fd.set('op', 'revoke');
  return fd;
};

/** No SQL except the trail insert of a refused view-as action. */
const onlyRefusalTrail = () => {
  for (const q of state.sql) {
    expect(q.sql).toMatch(/INSERT INTO audit_log/);
    expect(q.params).toContain('view_as.refused');
    expect(q.params[0]).toBe(T);
  }
};

let readOnlyText = '';

beforeAll(async () => {
  const { newSessionPayload, signSession, withViewAs } = await import('./session');
  const owner = newSessionPayload({ id: '77777777-7777-4777-8777-777777777777', name: 'Owner' }, [
    { id: T, role: 'auditor' },
    { id: T, role: 'platform_owner' },
  ]);
  state.cookie = await signSession(withViewAs(owner, viewAs));
  const { messages } = await import('@evolai/i18n');
  readOnlyText = messages.fr.client.viewAs.readOnly;
});

beforeEach(() => {
  state.sql = [];
});

type Action = (prev: never, fd: FormData) => Promise<unknown>;

const ACTIONS: [string, () => Promise<Record<string, unknown>>][] = [
  ['admin/data', () => import('@/app/admin/data/actions')],
  ['admin/engagements', () => import('@/app/admin/engagements/actions')],
  ['admin/teams', () => import('@/app/admin/teams/actions')],
  ['admin/notice', () => import('@/app/admin/engagements/[id]/settings/actions')],
  ['admin/opportunities', () => import('@/app/admin/engagements/[id]/opportunities/actions')],
  ['admin/analyses', () => import('@/app/admin/engagements/[id]/analyses/[analysisId]/actions')],
  ['admin/synergies', () => import('@/app/admin/synergies/actions')],
  ['admin/invitations', () => import('@/app/admin/engagements/[id]/invitations/actions')],
  ['intake', () => import('@/app/intake/actions')],
  ['quiz', () => import('@/app/quiz/actions')],
  ['client/space', () => import('@/app/client/actions')],
];

describe('every server action refuses in a view-as session', () => {
  for (const [name, load] of ACTIONS) {
    it(name, async () => {
      const mod = await load();
      const fns = Object.entries(mod).filter(([, v]) => typeof v === 'function');
      expect(fns.length).toBeGreaterThan(0);
      for (const [fnName, fn] of fns) {
        state.sql = [];
        let out: unknown;
        try {
          // submitRespondentQuizAction takes the token first; a bad token is refused anyway.
          out =
            fnName === 'submitRespondentQuizAction'
              ? await (fn as (t: string, p: never, f: FormData) => Promise<unknown>)(
                  'x.y',
                  {} as never,
                  form(),
                )
              : await (fn as Action)({} as never, form());
        } catch (err) {
          throw new Error(`${name}.${fnName} threw ${(err as Error).message}`);
        }
        const r = out as { ok?: boolean; message?: string; code?: string };
        expect(r.ok, `${name}.${fnName}`).toBe(false);
        if (r.message !== undefined && fnName !== 'submitRespondentQuizAction') {
          expect(r.message, `${name}.${fnName}`).toBe(readOnlyText);
        }
        if (r.code !== undefined) expect(['forbidden', 'read_only']).toContain(r.code);
        onlyRefusalTrail();
        if (fnName !== 'submitRespondentQuizAction') expect(state.sql.length).toBe(1);
      }
    });
  }
});

describe('routes refuse in a view-as session', () => {
  it('admin invitations API: 403 on read and write', async () => {
    const { GET, POST } = await import('@/app/api/admin/invitations/route');
    const { NextRequest } = await import('next/server');
    const get = await GET(
      new NextRequest(`http://x/api/admin/invitations?tenant=${T}&engagement=${ID}`),
    );
    expect(get.status).toBe(403);
    const post = await POST(
      new NextRequest('http://x/api/admin/invitations', {
        method: 'POST',
        body: JSON.stringify({ tenantId: T, engagementId: ID, op: 'create', counts: { [ID]: 5 } }),
      }),
    );
    expect(post.status).toBe(403);
    expect(state.sql).toEqual([]);
  });

  it('survey answer route: 403 read_only, nothing written but the trail', async () => {
    const { POST } = await import('@/app/api/answer/route');
    const { NextRequest } = await import('next/server');
    const res = await POST(
      new NextRequest('http://x/api/answer', {
        method: 'POST',
        body: JSON.stringify({ token: 'a.b', index: 0, choice: 'x' }),
      }),
    );
    expect(res.status).toBe(403);
    onlyRefusalTrail();
  });

  it('staff pages redirect to the team space', async () => {
    const { sessionTenantIds, sessionTenantFor } = await import('./authServer');
    await expect(sessionTenantIds()).rejects.toThrow('redirect:/client');
    await expect(sessionTenantFor(T)).rejects.toThrow('redirect:/client');
  });
});
